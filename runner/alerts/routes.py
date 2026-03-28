"""Alert state API — ack, silence, delete per user."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from runner.auth.deps import require_auth
from runner.alerts.store import alert_state_store

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

_MAX_BULK = 500


class BulkRequest(BaseModel):
    ids: list[str]


# ── Read ────────────────────────────────────────────────────────────────────


@router.get("/states")
async def get_states(auth: dict = Depends(require_auth)):
    """Return all alert states for the authenticated user."""
    return {"states": alert_state_store.get_states(auth["sub"])}


# ── Single operations ────────────────────────────────────────────────────────


@router.post("/{alert_id}/ack")
async def ack_alert(alert_id: str, auth: dict = Depends(require_auth)):
    alert_state_store.set_state(alert_id, auth["sub"], "acked")
    return {"ok": True}


@router.post("/{alert_id}/silence")
async def silence_alert(alert_id: str, auth: dict = Depends(require_auth)):
    alert_state_store.set_state(alert_id, auth["sub"], "silenced")
    return {"ok": True}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, auth: dict = Depends(require_auth)):
    """Soft-delete: marks the alert as deleted for this user only."""
    alert_state_store.set_state(alert_id, auth["sub"], "deleted")
    return {"ok": True}


# ── Bulk operations ──────────────────────────────────────────────────────────


@router.post("/bulk-delete")
async def bulk_delete(body: BulkRequest, auth: dict = Depends(require_auth)):
    """Delete many alerts at once (max 500)."""
    if not body.ids:
        raise HTTPException(status_code=400, detail="ids must not be empty")
    if len(body.ids) > _MAX_BULK:
        raise HTTPException(status_code=400, detail=f"Too many ids (max {_MAX_BULK})")
    alert_state_store.bulk_set_state(body.ids, auth["sub"], "deleted")
    return {"ok": True, "count": len(body.ids)}


@router.post("/bulk-ack")
async def bulk_ack(body: BulkRequest, auth: dict = Depends(require_auth)):
    if not body.ids:
        raise HTTPException(status_code=400, detail="ids must not be empty")
    if len(body.ids) > _MAX_BULK:
        raise HTTPException(status_code=400, detail=f"Too many ids (max {_MAX_BULK})")
    alert_state_store.bulk_set_state(body.ids, auth["sub"], "acked")
    return {"ok": True, "count": len(body.ids)}
