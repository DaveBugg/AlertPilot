"""FastAPI dependencies for authentication."""

from fastapi import Header, HTTPException

from runner.auth.jwt_utils import decode_token
from runner.auth.store import auth_store


def require_auth(authorization: str = Header(default="")) -> dict:
    """Require valid JWT. Returns decoded payload.

    Accepts both:
    - Bearer <jwt>      (PWA user session)
    - Bearer <secret>   (legacy RUNNER_SECRET for webhooks/scripts)
    """
    from runner.config import settings

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = authorization[7:]

    # If no users exist yet — only allow RUNNER_SECRET (for CLI setup scripts)
    if not auth_store.has_users:
        if settings.RUNNER_SECRET and token == settings.RUNNER_SECRET:
            return {"sub": "_setup", "role": "ops"}
        # No users, no valid secret — /api/auth/status and /health are public,
        # everything else requires token even during setup
        raise HTTPException(status_code=401, detail="Setup required: POST /api/auth/setup")

    # Try JWT first
    payload = decode_token(token)
    if payload:
        return payload

    # Fallback: RUNNER_SECRET still works for machine-to-machine (webhooks, scripts)
    if settings.RUNNER_SECRET and token == settings.RUNNER_SECRET:
        return {"sub": "_service", "role": "ops"}

    raise HTTPException(status_code=401, detail="Invalid or expired token")


def optional_auth(authorization: str = Header(default="")) -> dict | None:
    """Like require_auth but returns None instead of 401."""
    try:
        return require_auth(authorization)
    except HTTPException:
        return None
