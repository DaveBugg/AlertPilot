"""Restart a system service or Docker container."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class RestartAction(BaseRunnerAction):
    name = "restart"
    label = "Restart {service}"
    category = "devops"
    description = "Restart a system service or container"
    triggers = ["down", "stopped", "502", "503", "unhealthy", "crashed", "not responding"]
    confirm = True
    roles = ["ops"]
    params_schema = {
        "service": {"type": "string", "required": True, "whitelist": True},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        service = ctx.params.get("service", "")
        if not service:
            return ActionResult.failure("Missing 'service' parameter")

        self.validate_whitelist(service)

        return await self.run_runbook_or_default(
            f"restart_{service}",
            fallback=f"systemctl restart {service}",
        )
