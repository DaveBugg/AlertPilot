"""Block a suspicious IP address via firewall."""

import re
from runner.core import BaseRunnerAction, ActionContext, ActionResult

_IP_PATTERN = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")


class BlockIpAction(BaseRunnerAction):
    name = "block_ip"
    label = "Block IP {ip}"
    category = "security"
    description = "Add an IP address to the firewall blocklist"
    triggers = ["brute_force", "suspicious", "attack", "banned", "intrusion"]
    confirm = True
    roles = ["ops"]
    params_schema = {
        "ip": {"type": "string", "required": True, "pattern": r"^\d{1,3}(\.\d{1,3}){3}$"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        ip = ctx.params.get("ip", "")
        if not ip or not _IP_PATTERN.match(ip):
            return ActionResult.failure(f"Invalid IP address: {ip}")

        return await self.run_runbook_or_default(
            "block_ip",
            fallback=f"ufw deny from {ip} comment 'AlertPilot block'",
        )
