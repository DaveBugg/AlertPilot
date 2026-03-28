"""Approve a pending deployment."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class ApproveDeployAction(BaseRunnerAction):
    name = "approve_deploy"
    label = "Approve deploy"
    category = "cicd"
    description = "Approve a pending deployment to proceed to production"
    triggers = ["awaiting_approval", "staging_ready", "pending_deploy", "needs_approval"]
    confirm = True
    roles = ["ops", "dev"]
    params_schema = {
        "pipeline_id": {"type": "string", "required": True},
        "environment": {"type": "string", "required": False, "default": "production"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        pipeline_id = ctx.params.get("pipeline_id", "")
        env = ctx.params.get("environment", "production")

        if not pipeline_id:
            return ActionResult.failure("Missing 'pipeline_id' parameter")

        return await self.run_runbook_or_default(
            f"approve_{env}",
            fallback=f"echo 'Approved pipeline {pipeline_id} for {env}'",
        )
