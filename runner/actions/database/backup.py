"""Trigger an immediate database backup."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class BackupAction(BaseRunnerAction):
    name = "db_backup"
    label = "Backup database"
    category = "database"
    description = "Create an immediate database backup"
    triggers = ["before_migration", "manual_backup", "backup"]
    confirm = True
    timeout = 120
    roles = ["ops"]
    params_schema = {
        "database": {"type": "string", "required": False, "default": "main"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        database = ctx.params.get("database", "main")

        return await self.run_runbook_or_default(
            f"backup_{database}",
            fallback=f"pg_dump -Fc {database} > /backups/{database}_$(date +%Y%m%d_%H%M%S).dump",
        )
