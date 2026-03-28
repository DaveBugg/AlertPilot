"""Generic webhook receiver — forwards any JSON payload as ntfy notification."""

import json
from runner.core import BaseRunnerAction, ActionContext, ActionResult


class GenericWebhookAction(BaseRunnerAction):
    name = "generic_webhook"
    label = "Webhook notification"
    category = "webhooks"
    description = "Forward any incoming webhook as a push notification"
    triggers = []  # Webhook-only
    confirm = False
    roles = ["ops", "dev"]
    params_schema = {}  # Accepts anything

    async def execute(self, ctx: ActionContext) -> ActionResult:
        payload = ctx.params.get("payload", {})
        source = ctx.params.get("source", "webhook")

        # Try to extract meaningful fields
        title = (
            payload.get("title")
            or payload.get("subject")
            or payload.get("event")
            or payload.get("type")
            or f"Webhook from {source}"
        )

        body = (
            payload.get("message")
            or payload.get("body")
            or payload.get("text")
            or payload.get("description")
            or ""
        )

        # If no body extracted, dump a compact JSON summary
        if not body:
            # Remove nested objects for brevity
            flat = {k: v for k, v in payload.items() if not isinstance(v, (dict, list))}
            body = json.dumps(flat, ensure_ascii=False, indent=None)[:500]

        priority = int(payload.get("priority", 3))
        priority = max(1, min(5, priority))

        result = ActionResult.success(f"Forwarded webhook from {source}")
        await self.notify(
            ctx,
            result=result,
            title=str(title)[:200],
            body=str(body)[:500],
            priority=priority,
            tags=["incoming_envelope"],
        )
        return result
