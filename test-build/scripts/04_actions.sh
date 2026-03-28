#!/bin/bash
# Test 4: Execute actions — restart, scale, silence
set -e
BASE="http://localhost:8080/runner"
TOKEN=$(cat /tmp/alertpilot_test_token 2>/dev/null || echo "test-secret")
AUTH="Authorization: Bearer $TOKEN"

echo "=== Test 4: Execute Actions ==="

# Restart (will fail because no systemctl — but should return, not crash)
echo -n "Restart nginx (expect graceful fail)... "
RESULT=$(curl -sf -X POST "$BASE/api/action/restart" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"params":{"service":"nginx"},"topic":"ops-alerts"}')
echo "$RESULT" | grep -q '"ok"' && echo "OK (returned result)" || echo "FAIL: $RESULT"

# Scale (will fail gracefully — no docker swarm)
echo -n "Scale api to 3 (expect graceful fail)... "
RESULT=$(curl -sf -X POST "$BASE/api/action/scale" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"params":{"service":"api","replicas":3},"topic":"ops-alerts"}')
echo "$RESULT" | grep -q '"ok"' && echo "OK (returned result)" || echo "FAIL: $RESULT"

# Silence (should succeed — in-memory)
echo -n "Silence alert... "
RESULT=$(curl -sf -X POST "$BASE/api/action/silence" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"params":{"alert_id":"test-123"},"topic":"ops-alerts"}')
echo "$RESULT" | grep -q '"ok":true' && echo "OK" || echo "FAIL: $RESULT"

# Validation: missing required param
echo -n "Missing param rejected... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/action/restart" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"params":{},"topic":"ops-alerts"}')
[ "$CODE" = "400" ] && echo "OK (400)" || echo "FAIL ($CODE)"

# Validation: service not in whitelist
echo -n "Non-whitelisted service rejected... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/action/restart" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"params":{"service":"hacker-service"},"topic":"ops-alerts"}')
[ "$CODE" = "400" ] && echo "OK (400)" || echo "FAIL ($CODE)"

# Non-existent action
echo -n "Unknown action returns 404... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/action/nonexistent" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"params":{}}')
[ "$CODE" = "404" ] && echo "OK (404)" || echo "FAIL ($CODE)"

echo ""
