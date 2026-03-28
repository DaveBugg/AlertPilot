"""Action router with recursive auto-discovery from actions/ subdirectories.

Adapted from URBOT's ActionRouter pattern. Scans actions/ recursively,
loads BaseRunnerAction subclasses, indexes them by name.

Directory structure maps to categories:
    actions/
    ├── devops/restart.py     → category="devops", name="restart"
    ├── cicd/rollback.py      → category="cicd",   name="rollback"
    ├── webhooks/stripe.py    → category="webhooks", name="stripe"
    └── custom_action.py      → category="",        name="custom_action"
"""

import importlib
import importlib.util
import logging
import os
from pathlib import Path

from runner.core.base_action import BaseRunnerAction

logger = logging.getLogger(__name__)

# Base path for actions
ACTIONS_DIR = Path(__file__).parent.parent / "actions"


class ActionRouter:
    """Auto-discovers and indexes runner actions."""

    _registry: dict[str, BaseRunnerAction] = {}
    _loaded: bool = False

    @classmethod
    def discover(cls, actions_dir: Path | None = None) -> None:
        """Scan actions/ directory recursively, instantiate action singletons."""
        root = actions_dir or ACTIONS_DIR
        cls._registry.clear()

        if not root.exists():
            logger.warning(f"Actions directory not found: {root}")
            return

        for py_file in sorted(root.rglob("*.py")):
            if py_file.name.startswith("_"):
                continue

            # Determine category from subdirectory
            rel = py_file.relative_to(root)
            parts = rel.parts
            category = parts[0] if len(parts) > 1 else ""

            action_instance = cls._load_action(py_file, category)
            if action_instance:
                if action_instance.name in cls._registry:
                    existing = cls._registry[action_instance.name]
                    logger.warning(
                        f"Duplicate action name '{action_instance.name}': "
                        f"{existing.__class__.__name__} vs {action_instance.__class__.__name__}. "
                        f"Keeping the first one."
                    )
                    continue

                cls._registry[action_instance.name] = action_instance
                logger.info(
                    f"Registered action: {action_instance.name} "
                    f"[{action_instance.category or 'root'}] "
                    f"from {rel}"
                )

        cls._loaded = True
        logger.info(f"Discovered {len(cls._registry)} actions")

    @classmethod
    def _load_action(cls, path: Path, category: str) -> BaseRunnerAction | None:
        """Load a single action module and instantiate the action class."""
        try:
            module_name = f"actions.{path.stem}"
            spec = importlib.util.spec_from_file_location(module_name, path)
            if not spec or not spec.loader:
                return None

            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Find subclass of BaseRunnerAction
            for attr_name in dir(module):
                if attr_name.startswith("_"):
                    continue
                attr = getattr(module, attr_name)
                if (
                    isinstance(attr, type)
                    and issubclass(attr, BaseRunnerAction)
                    and attr is not BaseRunnerAction
                    and hasattr(attr, "name")
                    and attr.name  # skip if name is empty (abstract)
                ):
                    instance = attr()
                    # Auto-set category from directory if not explicitly set
                    if not instance.category and category:
                        instance.category = category
                    return instance

            return None
        except Exception as e:
            logger.error(f"Failed to load action from {path}: {e}", exc_info=True)
            return None

    @classmethod
    def get(cls, name: str) -> BaseRunnerAction | None:
        """Get action by name."""
        if not cls._loaded:
            cls.discover()
        return cls._registry.get(name)

    @classmethod
    def all(cls) -> dict[str, BaseRunnerAction]:
        """Get all registered actions."""
        if not cls._loaded:
            cls.discover()
        return dict(cls._registry)

    @classmethod
    def schema(cls) -> dict[str, dict]:
        """Build full schema for /api/schema endpoint."""
        actions = cls.all()
        return {
            name: action.schema()
            for name, action in actions.items()
        }

    @classmethod
    def match_triggers(cls, text: str) -> list[dict]:
        """Find actions whose triggers match the given alert text.

        Used by PWA to auto-attach action buttons to alert cards.
        """
        text_lower = text.lower()
        matches = []
        for action in cls.all().values():
            for trigger in action.triggers:
                if trigger.lower() in text_lower:
                    matches.append(action.schema())
                    break
        return matches

    @classmethod
    def reload(cls) -> None:
        """Force re-scan of actions directory."""
        cls._loaded = False
        cls._registry.clear()
        cls.discover()
