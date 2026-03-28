"""Pause an ad campaign when budget thresholds are exceeded."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class PauseCampaignAction(BaseRunnerAction):
    name = "pause_campaign"
    label = "Pause campaign {campaign_id}"
    category = "business"
    description = "Pause an advertising campaign via API"
    triggers = ["overspend", "budget", "cpa_high", "roas_low", "ad_spend"]
    confirm = True
    roles = ["ops"]
    params_schema = {
        "campaign_id": {"type": "string", "required": True},
        "platform": {"type": "string", "required": False, "default": "meta"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        campaign_id = ctx.params.get("campaign_id", "")
        platform = ctx.params.get("platform", "meta")

        if not campaign_id:
            return ActionResult.failure("Missing 'campaign_id' parameter")

        return await self.run_runbook_or_default(
            f"pause_campaign_{platform}",
            fallback=f"echo 'Paused campaign {campaign_id} on {platform}'",
        )
