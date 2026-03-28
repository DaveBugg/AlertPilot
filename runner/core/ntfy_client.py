"""HTTP client for sending notifications to ntfy."""

import httpx
import logging

logger = logging.getLogger(__name__)


class NtfyClient:
    """Sends notifications back to ntfy topics."""

    def __init__(self, base_url: str = "", token: str = ""):
        self._base_url = base_url.rstrip("/")
        self._token = token

    @classmethod
    def from_settings(cls) -> "NtfyClient":
        """Create client from current environment settings (lazy)."""
        from runner.config import settings
        return cls(base_url=settings.NTFY_URL, token=settings.NTFY_TOKEN)

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {}
        if self._token:
            h["Authorization"] = f"Bearer {self._token}"
        return h

    async def publish(
        self,
        topic: str,
        title: str,
        message: str = "",
        priority: int = 3,
        tags: list[str] | None = None,
        actions: list[dict] | None = None,
    ) -> bool:
        """Publish a notification to an ntfy topic.

        Args:
            topic: ntfy topic name
            title: Notification title
            message: Notification body
            priority: 1 (min) to 5 (urgent)
            tags: List of emoji tags
            actions: ntfy action buttons
        """
        headers = self._headers()
        headers["Title"] = title
        headers["Priority"] = str(priority)

        if tags:
            headers["Tags"] = ",".join(tags)

        if actions:
            parts = []
            for a in actions:
                p = f"{a.get('action', 'view')}, {a['label']}, {a['url']}"
                parts.append(p)
            headers["Actions"] = "; ".join(parts)

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{self._base_url}/{topic}",
                    content=message.encode("utf-8"),
                    headers=headers,
                )
                resp.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"Failed to publish to ntfy/{topic}: {e}")
            return False

    async def notify_result(
        self,
        topic: str,
        action_name: str,
        ok: bool,
        output: str = "",
    ) -> bool:
        """Send action result as a notification."""
        emoji = "white_check_mark" if ok else "x"
        status = "Success" if ok else "Failed"
        priority = 2 if ok else 4

        title = f"{status}: {action_name}"
        body = output[-500:] if output else ""

        return await self.publish(
            topic=topic,
            title=title,
            message=body,
            priority=priority,
            tags=[emoji],
        )
