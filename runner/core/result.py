"""Action execution result."""

from dataclasses import dataclass, field


@dataclass
class ActionResult:
    ok: bool
    output: str = ""
    error: str = ""
    data: dict = field(default_factory=dict)

    @classmethod
    def success(cls, output: str = "", **data) -> "ActionResult":
        return cls(ok=True, output=output, data=data)

    @classmethod
    def failure(cls, error: str, output: str = "") -> "ActionResult":
        return cls(ok=False, output=output, error=error)
