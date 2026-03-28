"""Silence an alert (server-side tracking for multi-user visibility)."""

import time
from runner.core import BaseRunnerAction, ActionContext, ActionResult

# In-memory store. Replace with Redis for persistence across restarts.
_silenced: dict[str, float] = {}
SILENCE_DURATION = 3600  # 1 hour


class SilenceAction(BaseRunnerAction):
    name = "silence"
    label = "Silence alert"
    category = "devops"
    description = "Mute repeated alerts for 1 hour (server-side, visible to all users)"
    triggers = []  # Never auto-attached; always shown as universal button
    confirm = False
    roles = ["ops", "dev"]
    params_schema = {
        "alert_id": {"type": "string", "required": True},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        alert_id = ctx.params.get("alert_id", "")
        if not alert_id:
            return ActionResult.failure("Missing 'alert_id' parameter")

        _silenced[alert_id] = time.time() + SILENCE_DURATION
        return ActionResult.success(
            f"Alert '{alert_id}' silenced for {SILENCE_DURATION // 60} minutes",
            silenced_until=_silenced[alert_id],
        )

    @staticmethod
    def is_silenced(alert_id: str) -> bool:
        expires = _silenced.get(alert_id)
        if not expires:
            return False
        if time.time() > expires:
            del _silenced[alert_id]
            return False
        return True
