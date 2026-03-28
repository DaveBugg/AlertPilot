"""JWT token creation and verification."""

import logging
from datetime import datetime, timedelta, timezone

import jwt

from runner.auth.store import auth_store
from runner.config import settings

logger = logging.getLogger(__name__)


def create_token(username: str, role: str = "ops") -> str:
    """Create a JWT token for authenticated user."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, auth_store.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    """Decode and verify JWT. Returns payload or None."""
    try:
        payload = jwt.decode(token, auth_store.jwt_secret, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug(f"Invalid token: {e}")
        return None
