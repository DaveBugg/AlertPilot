#!/bin/bash
# Test 2: Auth flow — setup, login, session
set -e
BASE="http://localhost:8080/runner"

echo "=== Test 2: Auth Flow ==="

# Check status (should need setup)
echo -n "Auth status... "
STATUS=$(curl -sf "$BASE/api/auth/status")
echo "$STATUS"

# Create admin user
echo -n "Setup admin user... "
SETUP=$(curl -sf -X POST "$BASE/api/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test1234"}')
echo "$SETUP" | grep -q '"ok":true' && echo "OK" || echo "FAIL: $SETUP"

# Extract token
TOKEN=$(echo "$SETUP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:20}..."

# Login
echo -n "Login... "
LOGIN=$(curl -sf -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test1234"}')
echo "$LOGIN" | grep -q '"ok":true' && echo "OK" || echo "FAIL: $LOGIN"

# Session check
echo -n "Session valid... "
SESSION=$(curl -sf "$BASE/api/auth/session" \
  -H "Authorization: Bearer $TOKEN")
echo "$SESSION" | grep -q '"ok":true' && echo "OK" || echo "FAIL: $SESSION"

# Bad login
echo -n "Bad password rejected... "
BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}')
[ "$BAD" = "401" ] && echo "OK (401)" || echo "FAIL ($BAD)"

# Export token for other scripts
echo "$TOKEN" > /tmp/alertpilot_test_token
echo ""
