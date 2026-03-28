#!/bin/bash
# Test 6: Webhooks — Stripe, 3DS code, generic
set -e
BASE="http://localhost:8080/runner"

echo "=== Test 6: Webhooks ==="

# Stripe webhook
echo -n "Stripe payment_intent.succeeded... "
RESP=$(curl -sf -X POST "$BASE/api/webhook/stripe" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment_intent.succeeded",
    "data": {"object": {"amount": 4999, "currency": "usd", "customer_email": "test@example.com"}}
  }')
echo "$RESP" | grep -q '"ok":true' && echo "OK" || echo "FAIL: $RESP"

# Stripe dispute (urgent)
echo -n "Stripe charge.dispute.created... "
RESP=$(curl -sf -X POST "$BASE/api/webhook/stripe" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "charge.dispute.created",
    "data": {"object": {"amount": 10000, "currency": "eur"}}
  }')
echo "$RESP" | grep -q '"ok":true' && echo "OK" || echo "FAIL: $RESP"

# 3DS code (payload fields are at root level)
echo -n "3DS code forward... "
RESP=$(curl -sf -X POST "$BASE/api/webhook/tds_code" \
  -H "Content-Type: application/json" \
  -d '{"code": "847291", "bank": "Tinkoff", "amount": "1500 RUB", "merchant": "Amazon"}')
echo "$RESP" | grep -q '"ok":true' && echo "OK" || echo "FAIL: $RESP"

# Generic webhook
echo -n "Generic webhook... "
RESP=$(curl -sf -X POST "$BASE/api/webhook/my_custom_source" \
  -H "Content-Type: application/json" \
  -d '{"title": "Custom event", "message": "Something happened", "priority": 3}')
echo "$RESP" | grep -q '"ok":true' && echo "OK" || echo "FAIL: $RESP"

echo ""
