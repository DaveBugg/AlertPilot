"""Action execution context."""

from dataclasses import dataclass, field

from runner.core.ntfy_client import NtfyClient


@dataclass
class ActionContext:
    """Context passed to every action's execute() method."""

    params: dict = field(default_factory=dict)
    topic: str = "ops-alerts"
    caller_ip: str = ""
    ntfy: NtfyClient = field(default_factory=NtfyClient.from_settings)
