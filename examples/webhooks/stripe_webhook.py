"""Example: Minimal Stripe webhook forwarder to AlertPilot.

In production, use the built-in /api/webhook/stripe endpoint instead.
This example shows how to forward from your own backend.
"""

import hmac
import hashlib
import httpx

ALERTPILOT_URL = "https://alerts.your.host/runner/api/webhook/stripe"

async def forward_stripe_event(payload: dict, stripe_signature: str):
    """Forward verified Stripe webhook to AlertPilot runner."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            ALERTPILOT_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        return resp.status_code
