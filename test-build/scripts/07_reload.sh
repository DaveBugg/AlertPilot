#!/bin/bash
# Test 7: Hot reload + edge cases
set -e
BASE="http://localhost:8080/runner"
TOKEN=$(cat /tmp/alertpilot_test_token 2>/dev/null || echo "test-secret")
AUTH="Authorization: Bearer $TOKEN"

echo "=== Test 7: Hot Reload & Edge Cases ==="

# Hot reload
echo -n "Hot reload actions... "
RESP=$(curl -sf -X POST "$BASE/api/reload" -H "$AUTH")
echo "$RESP" | grep -q '"ok":true' && echo "OK ($(echo $RESP | grep -o '"count":[0-9]*'))" || echo "FAIL: $RESP"

# Unauthorized access
echo -n "No token returns 401... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/schema")
[ "$CODE" = "401" ] && echo "OK" || echo "FAIL ($CODE)"

# CORS preflight
echo -n "CORS preflight... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE/api/schema" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET")
[ "$CODE" = "200" ] && echo "OK" || echo "FAIL ($CODE)"

echo ""
