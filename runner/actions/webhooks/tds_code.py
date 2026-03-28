"""Forward 3D Secure / OTP codes as high-priority push notifications.

Use case: you have a service that receives SMS/email with 3DS codes
and forwards them here so you get an instant push on your phone.
"""

from runner.core import BaseRunnerAction, ActionContext, ActionResult


class TdsCodeAction(BaseRunnerAction):
    name = "tds_code"
    label = "3DS Code"
    category = "webhooks"
    description = "Forward 3D Secure / OTP verification codes as urgent push"
    triggers = []  # Webhook-only
    confirm = False
    roles = ["ops", "dev"]
    params_schema = {}  # Raw payload

    async def execute(self, ctx: ActionContext) -> ActionResult:
        payload = ctx.params.get("payload", {})

        code = payload.get("code", "")
        bank = payload.get("bank", payload.get("sender", "Unknown"))
        amount = payload.get("amount", "")
        merchant = payload.get("merchant", "")

        if not code:
            return ActionResult.failure("Missing 'code' in payload")

        title = f"Code: {code}"
        parts = []
        if bank:
            parts.append(f"From: {bank}")
        if amount:
            parts.append(f"Amount: {amount}")
        if merchant:
            parts.append(f"Merchant: {merchant}")
        body = "\n".join(parts)

        result = ActionResult.success(f"Forwarded 3DS code from {bank}")
        await self.notify(
            ctx,
            result=result,
            title=title,
            body=body,
            priority=5,  # Urgent — phone must vibrate
            tags=["lock", "credit_card"],
        )
        return result
