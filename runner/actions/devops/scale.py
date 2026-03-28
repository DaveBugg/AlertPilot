"""Scale a service to N replicas."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class ScaleAction(BaseRunnerAction):
    name = "scale"
    label = "Scale {service} to {replicas}"
    category = "devops"
    description = "Scale a service to the specified number of replicas"
    triggers = ["memory", "cpu", "scale", "overload", "high load", "oom"]
    confirm = True
    roles = ["ops"]
    params_schema = {
        "service": {"type": "string", "required": True, "whitelist": True},
        "replicas": {"type": "integer", "required": True, "min": 1, "max": 20},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        service = ctx.params.get("service", "")
        replicas = int(ctx.params.get("replicas", 1))

        if not service:
            return ActionResult.failure("Missing 'service' parameter")
        if not 1 <= replicas <= 20:
            return ActionResult.failure("Replicas must be between 1 and 20")

        self.validate_whitelist(service)

        return await self.run_runbook_or_default(
            f"scale_{service}",
            fallback=f"docker service scale {service}={replicas}",
        )
