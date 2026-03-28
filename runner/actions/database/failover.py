"""Trigger database failover to replica."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class FailoverAction(BaseRunnerAction):
    name = "db_failover"
    label = "DB failover"
    category = "database"
    description = "Promote replica to primary database"
    triggers = ["replication_lag", "primary_down", "db_down", "failover"]
    confirm = True
    timeout = 60
    roles = ["ops"]
    params_schema = {
        "cluster": {"type": "string", "required": False, "default": "main"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        cluster = ctx.params.get("cluster", "main")

        return await self.run_runbook_or_default(
            f"db_failover_{cluster}",
            fallback=f"echo 'Failover triggered for cluster: {cluster}'",
        )
