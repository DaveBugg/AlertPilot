"""Revoke a compromised API token or session."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class RevokeTokenAction(BaseRunnerAction):
    name = "revoke_token"
    label = "Revoke token"
    category = "security"
    description = "Revoke a compromised API key, token, or session"
    triggers = ["leaked", "compromised", "exposed", "token_leak", "secret_exposed"]
    confirm = True
    roles = ["ops"]
    params_schema = {
        "token_id": {"type": "string", "required": True},
        "scope": {"type": "string", "required": False, "default": "all"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        token_id = ctx.params.get("token_id", "")
        scope = ctx.params.get("scope", "all")

        if not token_id:
            return ActionResult.failure("Missing 'token_id' parameter")

        return await self.run_runbook_or_default(
            "revoke_token",
            fallback=f"echo 'Revoked token {token_id[:8]}... scope={scope}'",
        )
