"""Alert state store — per-user SQLite persistence.

Schema:
    alert_states(alert_id, username, state, updated_at)
    PRIMARY KEY (alert_id, username)

States: 'acked' | 'silenced' | 'deleted'

Each user maintains an independent state chain — deleting an alert
only removes it from that user's view, not from other users' feeds.
"""

import sqlite3
import time
from pathlib import Path

from runner.config import settings


class AlertStateStore:
    def __init__(self, path: str | None = None):
        self._path = Path(path or settings.ALERT_DB_PATH)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS alert_states (
                    alert_id   TEXT    NOT NULL,
                    username   TEXT    NOT NULL,
                    state      TEXT    NOT NULL,
                    updated_at INTEGER NOT NULL,
                    PRIMARY KEY (alert_id, username)
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_username ON alert_states(username)"
            )

    # --- Write ---

    def set_state(self, alert_id: str, username: str, state: str) -> None:
        """Upsert a single alert state for a user."""
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO alert_states (alert_id, username, state, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(alert_id, username)
                    DO UPDATE SET state = excluded.state,
                                  updated_at = excluded.updated_at
                """,
                (alert_id, username, state, int(time.time())),
            )

    def bulk_set_state(self, alert_ids: list[str], username: str, state: str) -> None:
        """Set the same state for many alerts at once."""
        now = int(time.time())
        with self._conn() as conn:
            conn.executemany(
                """
                INSERT INTO alert_states (alert_id, username, state, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(alert_id, username)
                    DO UPDATE SET state = excluded.state,
                                  updated_at = excluded.updated_at
                """,
                [(aid, username, state, now) for aid in alert_ids],
            )

    def clear_state(self, alert_id: str, username: str) -> None:
        """Remove state entry (un-ack / un-silence / un-delete)."""
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM alert_states WHERE alert_id = ? AND username = ?",
                (alert_id, username),
            )

    # --- Read ---

    def get_states(self, username: str) -> dict[str, dict]:
        """Return {alert_id: {state, updated_at}} for a user."""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT alert_id, state, updated_at FROM alert_states WHERE username = ?",
                (username,),
            ).fetchall()
        return {
            row["alert_id"]: {
                "state": row["state"],
                "updated_at": row["updated_at"],
            }
            for row in rows
        }


# Singleton
alert_state_store = AlertStateStore()
