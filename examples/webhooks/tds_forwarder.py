"""Example: Forward 3DS/OTP codes to AlertPilot for instant push.

This could be triggered by:
- An SMS gateway webhook (Twilio, etc.)
- An email parser (IMAP watcher)
- A custom bank notification scraper

Usage:
    python tds_forwarder.py --code 123456 --bank "Tinkoff" --amount "5000 RUB"
"""

import argparse
import httpx

ALERTPILOT_URL = "https://alerts.your.host/runner/api/webhook/tds_code"


def send_code(code: str, bank: str = "", amount: str = "", merchant: str = ""):
    payload = {
        "code": code,
        "bank": bank,
        "amount": amount,
        "merchant": merchant,
    }

    resp = httpx.post(ALERTPILOT_URL, json=payload)
    print(f"Status: {resp.status_code}, Response: {resp.text}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Forward 3DS code to AlertPilot")
    parser.add_argument("--code", required=True, help="The verification code")
    parser.add_argument("--bank", default="", help="Bank or sender name")
    parser.add_argument("--amount", default="", help="Transaction amount")
    parser.add_argument("--merchant", default="", help="Merchant name")
    args = parser.parse_args()

    send_code(args.code, args.bank, args.amount, args.merchant)
