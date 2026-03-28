"""Auth API endpoints."""

import io
import base64
import logging

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from runner.auth.store import auth_store
from runner.auth.jwt_utils import create_token, decode_token
from runner.auth.deps import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# --- Models ---

class SetupRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str
    totp_code: str = ""


class TotpVerifyRequest(BaseModel):
    code: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "ops"


# --- Endpoints ---

@router.get("/status")
async def auth_status():
    """Check if auth is set up. PWA calls this on startup."""
    return {
        "setup_required": not auth_store.has_users,
        "auth_enabled": auth_store.has_users,
    }


@router.post("/setup")
async def initial_setup(body: SetupRequest):
    """Create the first admin user. Only works when no users exist."""
    if auth_store.has_users:
        raise HTTPException(status_code=400, detail="Setup already completed")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    auth_store.create_user(body.username, body.password, role="ops")
    token = create_token(body.username, role="ops")

    logger.info(f"Initial setup: created admin user '{body.username}'")
    return {
        "ok": True,
        "token": token,
        "user": auth_store.get_user(body.username),
    }


@router.post("/login")
async def login(body: LoginRequest):
    """Authenticate and get JWT token.

    If TOTP is enabled and no code provided, returns totp_required=True.
    """
    if not auth_store.verify_password(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Check TOTP
    if auth_store.is_totp_required(body.username):
        if not body.totp_code:
            return {"ok": False, "totp_required": True}
        if not auth_store.verify_totp(body.username, body.totp_code):
            raise HTTPException(status_code=401, detail="Invalid TOTP code")

    user = auth_store.get_user(body.username)
    token = create_token(body.username, role=user["role"])

    return {
        "ok": True,
        "token": token,
        "user": user,
    }


@router.get("/session")
async def get_session(auth: dict = Depends(require_auth)):
    """Validate current JWT and return user info. Also refreshes the token."""
    username = auth["sub"]
    user = auth_store.get_user(username)

    if not user and username.startswith("_"):
        # Service account or setup mode
        return {"ok": True, "user": {"username": username, "role": auth["role"], "totp_enabled": False}}

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Issue fresh token (extends session on each activity)
    token = create_token(username, role=user["role"])

    return {"ok": True, "token": token, "user": user}


@router.post("/totp/setup")
async def totp_setup(auth: dict = Depends(require_auth)):
    """Generate TOTP secret + QR code for the current user."""
    username = auth["sub"]
    secret = auth_store.setup_totp(username)
    if not secret:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate otpauth URI
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=username, issuer_name="AlertPilot")

    # Generate QR as base64 PNG
    qr = qrcode.make(uri)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "secret": secret,
        "uri": uri,
        "qr_png_base64": qr_b64,
    }


@router.post("/totp/verify")
async def totp_verify(
    body: TotpVerifyRequest,
    auth: dict = Depends(require_auth),
):
    """Verify TOTP code and enable 2FA. User must scan QR first."""
    username = auth["sub"]

    if auth_store.verify_and_enable_totp(username, body.code):
        logger.info(f"TOTP enabled for user '{username}'")
        return {"ok": True, "totp_enabled": True}

    raise HTTPException(status_code=400, detail="Invalid code. Try again.")


@router.post("/totp/disable")
async def totp_disable(auth: dict = Depends(require_auth)):
    """Disable 2FA for the current user."""
    username = auth["sub"]
    auth_store.disable_totp(username)
    logger.info(f"TOTP disabled for user '{username}'")
    return {"ok": True, "totp_enabled": False}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    auth: dict = Depends(require_auth),
):
    """Change password for the current user."""
    username = auth["sub"]

    if not auth_store.verify_password(username, body.current_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    auth_store.change_password(username, body.new_password)
    token = create_token(username, role=auth["role"])

    return {"ok": True, "token": token}


# --- User management (ops role required) ---

@router.get("/users")
async def list_users(auth: dict = Depends(require_auth)):
    """List all users. Requires ops role."""
    if auth.get("role") != "ops":
        raise HTTPException(status_code=403, detail="ops role required")
    return {"users": auth_store.list_users()}


@router.post("/users")
async def create_user(body: CreateUserRequest, auth: dict = Depends(require_auth)):
    """Create a new user. Requires ops role."""
    if auth.get("role") != "ops":
        raise HTTPException(status_code=403, detail="ops role required")

    if body.role not in ("ops", "dev"):
        raise HTTPException(status_code=400, detail="role must be 'ops' or 'dev'")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    if not body.username or len(body.username) > 32:
        raise HTTPException(status_code=400, detail="Invalid username")

    ok = auth_store.create_user(body.username, body.password, role=body.role)
    if not ok:
        raise HTTPException(status_code=409, detail=f"User '{body.username}' already exists")

    logger.info(f"User '{body.username}' created by '{auth['sub']}' (role={body.role})")
    return {"ok": True, "user": auth_store.get_user(body.username)}


@router.delete("/users/{username}")
async def delete_user(username: str, auth: dict = Depends(require_auth)):
    """Delete a user. Requires ops role. Cannot delete yourself."""
    if auth.get("role") != "ops":
        raise HTTPException(status_code=403, detail="ops role required")

    if username == auth["sub"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    ok = auth_store.delete_user(username)
    if not ok:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")

    logger.info(f"User '{username}' deleted by '{auth['sub']}'")
    return {"ok": True}
