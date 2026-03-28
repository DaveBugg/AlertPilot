"""AlertPilot Action Runner — FastAPI application."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from runner.config import settings
from runner.core.context import ActionContext
from runner.core.router import ActionRouter
from runner.auth.deps import require_auth
from runner.auth.routes import router as auth_router
from runner.alerts.routes import router as alerts_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ActionRouter.discover()
    logger.info(f"Runner ready — {len(ActionRouter.all())} actions loaded")
    yield


app = FastAPI(
    title="AlertPilot Runner",
    version="0.1.0",
    lifespan=lifespan,
)

_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Auth routes (login, setup, totp, session)
app.include_router(auth_router)

# Alert state routes (ack, silence, delete — per-user)
app.include_router(alerts_router)


# --- Models ---

class ActionRequest(BaseModel):
    params: dict = {}
    topic: str = "ops-alerts"


# --- Endpoints ---

@app.get("/api/schema")
async def get_schema(auth: dict = Depends(require_auth)):
    """Return metadata for all registered actions.

    PWA calls this on load to dynamically render action buttons.
    """
    return {
        "actions": ActionRouter.schema(),
    }


@app.get("/api/schema/triggers")
async def match_triggers(text: str = "", auth: dict = Depends(require_auth)):
    """Match alert text against action triggers."""
    return {
        "matches": ActionRouter.match_triggers(text),
    }


@app.post("/api/action/{action_name}")
async def execute_action(
    action_name: str,
    body: ActionRequest,
    request: Request,
    auth: dict = Depends(require_auth),
):
    """Execute a runner action by name."""
    action = ActionRouter.get(action_name)
    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_name}' not found")

    # Validate params against action schema
    try:
        action.validate_params(body.params)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ctx = ActionContext(
        params=body.params,
        topic=body.topic,
        caller_ip=request.client.host if request.client else "",
    )

    try:
        result = await action.execute(ctx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Action '{action_name}' failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    # Actions are responsible for calling self.notify() themselves.
    # We only auto-notify if the action did NOT notify (opt-in via result.data).
    if not result.data.get("_notified"):
        label = action.label
        try:
            label = action.label.format(**body.params)
        except (KeyError, IndexError):
            pass
        await ctx.ntfy.notify_result(
            topic=ctx.topic,
            action_name=label,
            ok=result.ok,
            output=result.output or result.error,
        )

    return {
        "ok": result.ok,
        "output": result.output,
        "error": result.error,
        "data": result.data,
    }


@app.post("/api/webhook/{source}")
async def receive_webhook(source: str, request: Request):
    """Receive webhook from external service, transform to ntfy notification.

    Auth: if WEBHOOK_SECRET env var is set, the request must include
    X-Webhook-Secret header with that value.
    """
    # Optional webhook secret (independent from JWT / RUNNER_SECRET)
    webhook_secret = os.getenv("WEBHOOK_SECRET", "")
    if webhook_secret:
        provided = request.headers.get("X-Webhook-Secret", "")
        if not provided or provided != webhook_secret:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    action = ActionRouter.get(source) or ActionRouter.get("generic_webhook")
    if not action:
        raise HTTPException(status_code=404, detail=f"No webhook handler for '{source}'")

    ctx = ActionContext(
        params={"payload": body, "source": source},
        topic=settings.NTFY_OPS_TOPIC,
        caller_ip=request.client.host if request.client else "",
    )

    try:
        result = await action.execute(ctx)
    except Exception as e:
        logger.error(f"Webhook handler '{source}' failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Webhook processing failed")

    return {"ok": result.ok}


@app.post("/api/reload")
async def reload_actions(auth: dict = Depends(require_auth)):
    """Hot-reload actions from disk."""
    ActionRouter.reload()
    return {"ok": True, "count": len(ActionRouter.all())}


@app.get("/health")
async def health():
    """Health check — no auth required."""
    return {"status": "ok", "actions": len(ActionRouter.all())}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.RUNNER_HOST, port=settings.RUNNER_PORT)
