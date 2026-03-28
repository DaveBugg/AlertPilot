"""Transform Stripe webhook events into ntfy notifications."""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class StripeWebhookAction(BaseRunnerAction):
    name = "stripe"
    label = "Stripe event"
    category = "webhooks"
    description = "Forward Stripe payment events as notifications"
    triggers = []  # Webhook-only, never auto-attached
    confirm = False
    roles = ["ops", "dev"]
    params_schema = {}  # Receives raw webhook payload

    _EVENT_MAP = {
        "payment_intent.succeeded": ("Payment received", 3, ["moneybag"]),
        "payment_intent.payment_failed": ("Payment failed", 4, ["warning"]),
        "invoice.paid": ("Invoice paid", 2, ["white_check_mark"]),
        "invoice.payment_failed": ("Invoice payment failed", 4, ["x"]),
        "customer.subscription.deleted": ("Subscription cancelled", 4, ["warning"]),
        "charge.dispute.created": ("Dispute opened!", 5, ["rotating_light"]),
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        payload = ctx.params.get("payload", {})
        event_type = payload.get("type", "unknown")
        data = payload.get("data", {}).get("object", {})

        title, priority, tags = self._EVENT_MAP.get(
            event_type,
            (f"Stripe: {event_type}", 3, ["credit_card"]),
        )

        amount = data.get("amount", 0)
        currency = data.get("currency", "usd").upper()
        body = ""
        if amount:
            body = f"Amount: {amount / 100:.2f} {currency}"

        customer = data.get("customer_email") or data.get("customer", "")
        if customer:
            body += f"\nCustomer: {customer}"

        result = ActionResult.success(f"Forwarded Stripe event: {event_type}")
        await self.notify(ctx, result=result, title=title, body=body, priority=priority, tags=tags)
        return result
