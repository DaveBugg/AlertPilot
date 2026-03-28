"""Re-run a failed CI/CD pipeline."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class RerunPipelineAction(BaseRunnerAction):
    name = "rerun_pipeline"
    label = "Re-run pipeline"
    category = "cicd"
    description = "Re-run a failed or timed-out CI/CD pipeline"
    triggers = ["flaky", "timeout", "retry", "pipeline_failed", "build_failed"]
    confirm = True
    roles = ["ops", "dev"]
    params_schema = {
        "pipeline_id": {"type": "string", "required": True},
        "provider": {"type": "string", "required": False, "default": "github"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        pipeline_id = ctx.params.get("pipeline_id", "")
        provider = ctx.params.get("provider", "github")

        if not pipeline_id:
            return ActionResult.failure("Missing 'pipeline_id' parameter")

        return await self.run_runbook_or_default(
            f"rerun_{provider}",
            fallback=f"echo 'Re-running pipeline {pipeline_id} on {provider}'",
        )
