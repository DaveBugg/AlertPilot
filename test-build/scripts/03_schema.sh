#!/bin/bash
# Test 3: Action schema — all 16 actions discovered
set -e
BASE="http://localhost:8080/runner"
TOKEN=$(cat /tmp/alertpilot_test_token 2>/dev/null || echo "test-secret")

echo "=== Test 3: Action Schema ==="

echo -n "Load schema... "
SCHEMA=$(curl -sf "$BASE/api/schema" -H "Authorization: Bearer $TOKEN")

# Count actions
COUNT=$(echo "$SCHEMA" | grep -o '"name":' | wc -l)
echo "Found $COUNT actions"

# Check each category
for ACTION in restart scale silence rollback approve_deploy rerun_pipeline \
  block_ip revoke_token thermostat lights stripe tds_code generic_webhook \
  pause_campaign notify_oncall db_failover db_backup; do
  echo -n "  $ACTION... "
  echo "$SCHEMA" | grep -q "\"$ACTION\"" && echo "OK" || echo "MISSING"
done

# Trigger matching
echo ""
echo -n "Trigger match 'nginx 502'... "
TRIGGERS=$(curl -sf "$BASE/api/schema/triggers?text=nginx%20502" \
  -H "Authorization: Bearer $TOKEN")
echo "$TRIGGERS" | grep -q "restart" && echo "OK (matched restart)" || echo "FAIL: $TRIGGERS"

echo ""
