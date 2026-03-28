"""Escalate alert to on-call engineer via PagerDuty / Opsgenie / custom."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class NotifyOncallAction(BaseRunnerAction):
    name = "notify_oncall"
    label = "Notify on-call"
    category = "business"
    description = "Escalate to the current on-call engineer"
    triggers = ["p1", "critical", "escalate", "page", "oncall"]
    confirm = True
    roles = ["ops"]
    params_schema = {
        "message": {"type": "string", "required": True},
        "severity": {"type": "string", "required": False, "default": "high"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        message = ctx.params.get("message", "")
        severity = ctx.params.get("severity", "high")

        if not message:
            return ActionResult.failure("Missing 'message' parameter")

        return await self.run_runbook_or_default(
            "notify_oncall",
            fallback=f"echo 'Escalated [{severity}]: {message}'",
        )
