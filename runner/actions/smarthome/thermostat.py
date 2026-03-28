"""Control thermostat / HVAC via Home Assistant or custom API."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class ThermostatAction(BaseRunnerAction):
    name = "thermostat"
    label = "Set thermostat to {temperature}°C"
    category = "smarthome"
    description = "Adjust thermostat target temperature"
    triggers = ["temperature", "heating", "cooling", "cold", "hot", "hvac"]
    confirm = True
    roles = ["ops"]
    params_schema = {
        "temperature": {"type": "integer", "required": True, "min": 15, "max": 35},
        "zone": {"type": "string", "required": False, "default": "main"},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        temp = int(ctx.params.get("temperature", 22))
        zone = ctx.params.get("zone", "main")

        if not 15 <= temp <= 35:
            return ActionResult.failure("Temperature must be between 15 and 35°C")

        return await self.run_runbook_or_default(
            f"thermostat_{zone}",
            fallback=(
                f"curl -s -X POST http://homeassistant:8123/api/services/climate/set_temperature "
                f'-H "Authorization: Bearer $HA_TOKEN" '
                f'-d \'{{"entity_id":"climate.{zone}","temperature":{temp}}}\''
            ),
        )
