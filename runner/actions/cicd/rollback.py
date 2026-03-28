"""Rollback to a previous deployment."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class RollbackAction(BaseRunnerAction):
    name = "rollback"
    label = "Rollback {service}"
    category = "cicd"
    description = "Rollback a service to the previous deployment version"
    triggers = ["deploy_failed", "error_spike", "rollback", "revert"]
    confirm = True
    roles = ["ops", "dev"]
    params_schema = {
        "service": {"type": "string", "required": True, "whitelist": True},
        "version": {"type": "string", "required": False},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        service = ctx.params.get("service", "")
        version = ctx.params.get("version", "previous")

        if not service:
            return ActionResult.failure("Missing 'service' parameter")

        self.validate_whitelist(service)

        return await self.run_runbook_or_default(
            f"rollback_{service}",
            fallback=f"docker service rollback {service}",
        )
