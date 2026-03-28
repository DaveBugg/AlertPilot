"""Control lights via Home Assistant or custom API."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class LightsAction(BaseRunnerAction):
    name = "lights"
    label = "{state} lights in {zone}"
    category = "smarthome"
    description = "Turn lights on/off in a specific zone"
    triggers = ["motion", "dark", "away", "lights", "illumination"]
    confirm = False
    roles = ["ops"]
    params_schema = {
        "state": {"type": "string", "required": True, "enum": ["on", "off"]},
        "zone": {"type": "string", "required": False, "default": "all"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        state = ctx.params.get("state", "on")
        zone = ctx.params.get("zone", "all")

        if state not in ("on", "off"):
            return ActionResult.failure("State must be 'on' or 'off'")

        service = "turn_on" if state == "on" else "turn_off"

        return await self.run_runbook_or_default(
            f"lights_{zone}_{state}",
            fallback=(
                f"curl -s -X POST http://homeassistant:8123/api/services/light/{service} "
                f'-H "Authorization: Bearer $HA_TOKEN" '
                f'-d \'{{"entity_id":"light.{zone}"}}\''
            ),
        )
