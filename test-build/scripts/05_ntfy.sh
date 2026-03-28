#!/bin/bash
# Test 5: ntfy — publish alerts and check they arrive
set -e
BASE="http://localhost:8080"

echo "=== Test 5: ntfy Pub/Sub ==="

# Send minimal alert
echo -n "Send minimal alert... "
RESP=$(curl -sf -d "Test alert from test-build" "$BASE/ntfy/ops-alerts")
echo "$RESP" | grep -q '"event":"message"' && echo "OK" || echo "FAIL: $RESP"

# Send full alert with headers
echo -n "Send full alert with title+priority... "
RESP=$(curl -sf \
  -H "Title: Test: nginx 502" \
  -H "Priority: 5" \
  -H "Tags: rotating_light,test" \
  -d "Backend is not responding - this is a test alert" \
  "$BASE/ntfy/ops-alerts")
echo "$RESP" | grep -q '"priority":5' && echo "OK" || echo "FAIL: $RESP"

# Send dev alert
echo -n "Send dev alert... "
RESP=$(curl -sf \
  -H "Title: Build failed: main" \
  -H "Priority: 4" \
  -H "Tags: warning" \
  -d "CI pipeline #1234 failed on step 'test'" \
  "$BASE/ntfy/dev-alerts")
echo "$RESP" | grep -q '"event":"message"' && echo "OK" || echo "FAIL: $RESP"

# Check cached messages
echo -n "Read cached messages... "
MSGS=$(curl -sf "$BASE/ntfy/ops-alerts/json?poll=1")
LINES=$(echo "$MSGS" | wc -l)
echo "Got $LINES messages"

echo ""
