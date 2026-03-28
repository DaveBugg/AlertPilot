"""Runner configuration from environment variables."""

import os


class Settings:
    NTFY_URL: str = os.getenv("NTFY_URL", "http://ntfy:80")
    NTFY_OPS_TOPIC: str = os.getenv("NTFY_OPS_TOPIC", "ops-alerts")
    NTFY_DEV_TOPIC: str = os.getenv("NTFY_DEV_TOPIC", "dev-alerts")
    NTFY_TOKEN: str = os.getenv("NTFY_TOKEN", "")

    RUNNER_SECRET: str = os.getenv("RUNNER_SECRET", "changeme")
    RUNNER_HOST: str = os.getenv("RUNNER_HOST", "0.0.0.0")
    RUNNER_PORT: int = int(os.getenv("RUNNER_PORT", "8000"))

    SERVICE_WHITELIST: list[str] = [
        s.strip()
        for s in os.getenv("SERVICE_WHITELIST", "nginx,api,worker,postgres,redis").split(",")
        if s.strip()
    ]

    RUNBOOKS_DIR: str = os.getenv("RUNBOOKS_DIR", "/app/runbooks")
    ACTION_TIMEOUT: int = int(os.getenv("ACTION_TIMEOUT", "30"))

    # --- Auth ---
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")  # Auto-generated on first run if empty
    JWT_EXPIRY_DAYS: int = int(os.getenv("JWT_EXPIRY_DAYS", "30"))
    AUTH_DB_PATH: str = os.getenv("AUTH_DB_PATH", "/app/data/auth.json")
    SETUP_PASSWORD: str = os.getenv("SETUP_PASSWORD", "")  # Initial admin password; empty = set on first access

    # --- Alert state store ---
    ALERT_DB_PATH: str = os.getenv("ALERT_DB_PATH", "/app/data/alerts.db")


settings = Settings()
