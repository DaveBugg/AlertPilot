"""Base class for all runner actions."""

import asyncio
import logging
import os
import subprocess
from abc import ABC, abstractmethod

from runner.config import settings
from runner.core.context import ActionContext
from runner.core.result import ActionResult

logger = logging.getLogger(__name__)


class BaseRunnerAction(ABC):
    """Abstract base for drop-in runner actions.

    Every action is self-describing: name, label, triggers, params_schema.
    Drop a new .py file into actions/<category>/ — the router picks it up.

    Minimal example::

        class RestartAction(BaseRunnerAction):
            name = "restart"
            label = "Restart {service}"
            category = "devops"
            description = "Restart a system service or container"
            triggers = ["down", "stopped", "502", "unhealthy"]
            confirm = True
            params_schema = {
                "service": {"type": "string", "required": True, "whitelist": True}
            }

            async def execute(self, ctx: ActionContext) -> ActionResult:
                service = ctx.params["service"]
                return await self.run_runbook_or_default(
                    f"restart_{service}",
                    fallback=f"systemctl restart {service}",
                )
    """

    # --- Override in subclass ---
    name: str = ""
    label: str = ""
    category: str = ""
    description: str = ""
    triggers: list[str] = []
    confirm: bool = True
    timeout: int = settings.ACTION_TIMEOUT
    roles: list[str] = ["ops"]
    params_schema: dict = {}

    @abstractmethod
    async def execute(self, ctx: ActionContext) -> ActionResult:
        """Execute the action. Must be implemented by subclass."""
        ...

    # --- Validation ---

    def validate_params(self, params: dict) -> None:
        """Validate params against params_schema. Raises ValueError on failure."""
        for key, schema in self.params_schema.items():
            value = params.get(key)

            # Required check
            if schema.get("required") and (value is None or value == ""):
                raise ValueError(f"Missing required parameter: '{key}'")

            if value is None:
                continue

            # Type coercion + check
            expected_type = schema.get("type", "string")
            if expected_type == "integer":
                try:
                    params[key] = int(value)
                    value = params[key]
                except (ValueError, TypeError):
                    raise ValueError(f"Parameter '{key}' must be an integer")
            elif expected_type == "number":
                try:
                    params[key] = float(value)
                    value = params[key]
                except (ValueError, TypeError):
                    raise ValueError(f"Parameter '{key}' must be a number")

            # Min / max
            if "min" in schema and isinstance(value, (int, float)):
                if value < schema["min"]:
                    raise ValueError(f"Parameter '{key}' must be >= {schema['min']}")
            if "max" in schema and isinstance(value, (int, float)):
                if value > schema["max"]:
                    raise ValueError(f"Parameter '{key}' must be <= {schema['max']}")

            # Enum
            if "enum" in schema and value not in schema["enum"]:
                raise ValueError(
                    f"Parameter '{key}' must be one of: {', '.join(schema['enum'])}"
                )

            # Pattern (regex)
            if "pattern" in schema and isinstance(value, str):
                import re
                if not re.match(schema["pattern"], value):
                    raise ValueError(f"Parameter '{key}' does not match pattern: {schema['pattern']}")

            # Whitelist
            if schema.get("whitelist"):
                self.validate_whitelist(str(value))

    def validate_whitelist(self, service: str) -> None:
        """Raise ValueError if service is not in the whitelist."""
        if service not in settings.SERVICE_WHITELIST:
            raise ValueError(
                f"Service '{service}' is not whitelisted. "
                f"Allowed: {', '.join(settings.SERVICE_WHITELIST)}"
            )

    async def run_runbook_or_default(
        self,
        runbook_name: str,
        fallback: str,
    ) -> ActionResult:
        """Execute a runbook script if it exists, otherwise run fallback command.

        Args:
            runbook_name: Script name without extension (e.g. "restart_nginx")
            fallback: Shell command to run if no runbook found
        """
        runbook_path = os.path.join(settings.RUNBOOKS_DIR, f"{runbook_name}.sh")

        if os.path.isfile(runbook_path):
            cmd = f"bash {runbook_path}"
            logger.info(f"Running runbook: {runbook_path}")
        else:
            cmd = fallback
            logger.info(f"No runbook for '{runbook_name}', running fallback: {cmd}")

        return await self.run_shell(cmd)

    async def run_shell(self, cmd: str) -> ActionResult:
        """Run a shell command with timeout covering the full lifecycle."""
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
            )
            stdout, _ = await asyncio.wait_for(
                proc.communicate(),
                timeout=self.timeout,
            )
            output = stdout.decode("utf-8", errors="replace").strip()

            if proc.returncode == 0:
                return ActionResult.success(output)
            else:
                return ActionResult.failure(
                    error=f"Exit code {proc.returncode}",
                    output=output,
                )
        except asyncio.TimeoutError:
            # Kill the process if still running
            try:
                proc.kill()  # type: ignore[possibly-undefined]
            except ProcessLookupError:
                pass
            return ActionResult.failure(f"Timed out after {self.timeout}s")
        except Exception as e:
            return ActionResult.failure(str(e))

    async def notify(
        self,
        ctx: ActionContext,
        result: ActionResult,
        title: str,
        body: str = "",
        priority: int = 3,
        tags: list[str] | None = None,
    ) -> bool:
        """Send notification back to ntfy and mark result as notified.

        Call this from execute() to send a custom notification.
        If you don't call this, main.py will auto-notify with a generic message.
        """
        result.data["_notified"] = True
        return await ctx.ntfy.publish(
            topic=ctx.topic,
            title=title,
            message=body,
            priority=priority,
            tags=tags,
        )

    def schema(self) -> dict:
        """Return action metadata for /api/schema endpoint."""
        return {
            "name": self.name,
            "label": self.label,
            "category": self.category,
            "description": self.description,
            "triggers": self.triggers,
            "confirm": self.confirm,
            "timeout": self.timeout,
            "roles": self.roles,
            "params": self.params_schema,
        }
