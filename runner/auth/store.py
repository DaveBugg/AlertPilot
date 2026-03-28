"""User store — JSON file with bcrypt-hashed passwords and optional TOTP secrets.

Schema (auth.json):
{
  "users": {
    "admin": {
      "password_hash": "$2b$...",
      "role": "ops",
      "totp_secret": null,
      "totp_enabled": false,
      "created_at": "2025-01-01T00:00:00"
    }
  },
  "jwt_secret": "auto-generated-on-first-run"
}
"""

import json
import logging
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

import bcrypt

from runner.config import settings

logger = logging.getLogger(__name__)


class AuthStore:
    """Manages users, passwords, TOTP secrets. Backed by a JSON file."""

    def __init__(self, path: str | None = None):
        self._path = Path(path or settings.AUTH_DB_PATH)
        self._data: dict = {"users": {}, "jwt_secret": ""}
        self._load()

    def _load(self):
        if self._path.exists():
            try:
                self._data = json.loads(self._path.read_text("utf-8"))
                return
            except Exception as e:
                logger.error(f"Failed to load auth store: {e}")

        # First run — initialize
        self._data = {
            "users": {},
            "jwt_secret": settings.JWT_SECRET or secrets.token_urlsafe(48),
        }
        self._save()
        logger.info(f"Created auth store at {self._path}")

    def _save(self):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, indent=2, ensure_ascii=False), "utf-8")
        tmp.replace(self._path)

    # --- Properties ---

    @property
    def jwt_secret(self) -> str:
        return self._data.get("jwt_secret", "fallback-secret")

    @property
    def has_users(self) -> bool:
        return len(self._data.get("users", {})) > 0

    # --- User management ---

    def create_user(self, username: str, password: str, role: str = "ops") -> bool:
        """Create a new user. Returns False if user already exists."""
        users = self._data.setdefault("users", {})
        if username in users:
            return False

        users[username] = {
            "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
            "role": role,
            "totp_secret": None,
            "totp_enabled": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._save()
        logger.info(f"Created user: {username} (role={role})")
        return True

    def verify_password(self, username: str, password: str) -> bool:
        """Check username + password. Returns True if valid."""
        user = self._data.get("users", {}).get(username)
        if not user:
            return False
        return bcrypt.checkpw(password.encode(), user["password_hash"].encode())

    def get_user(self, username: str) -> dict | None:
        """Get user data (without password hash)."""
        user = self._data.get("users", {}).get(username)
        if not user:
            return None
        return {
            "username": username,
            "role": user["role"],
            "totp_enabled": user.get("totp_enabled", False),
        }

    def list_users(self) -> list[dict]:
        """List all users (without sensitive data)."""
        return [
            {
                "username": name,
                "role": u["role"],
                "totp_enabled": u.get("totp_enabled", False),
            }
            for name, u in self._data.get("users", {}).items()
        ]

    def delete_user(self, username: str) -> bool:
        users = self._data.get("users", {})
        if username not in users:
            return False
        del users[username]
        self._save()
        return True

    def change_password(self, username: str, new_password: str) -> bool:
        user = self._data.get("users", {}).get(username)
        if not user:
            return False
        user["password_hash"] = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        self._save()
        return True

    # --- TOTP ---

    def setup_totp(self, username: str) -> str | None:
        """Generate TOTP secret for user. Returns secret (save it, show QR).
        Does NOT enable TOTP yet — user must verify first."""
        user = self._data.get("users", {}).get(username)
        if not user:
            return None

        import pyotp
        secret = pyotp.random_base32()
        user["totp_secret"] = secret
        user["totp_enabled"] = False  # Not enabled until verified
        self._save()
        return secret

    def verify_and_enable_totp(self, username: str, code: str) -> bool:
        """Verify TOTP code and enable 2FA if correct."""
        user = self._data.get("users", {}).get(username)
        if not user or not user.get("totp_secret"):
            return False

        import pyotp
        totp = pyotp.TOTP(user["totp_secret"])
        if totp.verify(code, valid_window=1):
            user["totp_enabled"] = True
            self._save()
            return True
        return False

    def verify_totp(self, username: str, code: str) -> bool:
        """Verify TOTP code during login."""
        user = self._data.get("users", {}).get(username)
        if not user or not user.get("totp_enabled") or not user.get("totp_secret"):
            return False

        import pyotp
        totp = pyotp.TOTP(user["totp_secret"])
        return totp.verify(code, valid_window=1)

    def is_totp_required(self, username: str) -> bool:
        user = self._data.get("users", {}).get(username)
        if not user:
            return False
        return user.get("totp_enabled", False)

    def disable_totp(self, username: str) -> bool:
        user = self._data.get("users", {}).get(username)
        if not user:
            return False
        user["totp_secret"] = None
        user["totp_enabled"] = False
        self._save()
        return True


# Singleton
auth_store = AuthStore()
