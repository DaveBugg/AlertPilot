#!/bin/bash
# Test 1: Health checks — all services up
set -e
BASE="http://localhost:8080"

echo "=== Test 1: Health Checks ==="

echo -n "ntfy health... "
curl -sf "$BASE/ntfy/v1/health" | grep -q "healthy" && echo "OK" || echo "FAIL"

echo -n "runner health... "
curl -sf "$BASE/runner/health" | grep -q '"status":"ok"' && echo "OK" || echo "FAIL"

echo -n "PWA loads... "
curl -sf "$BASE/" | grep -q "AlertPilot" && echo "OK" || echo "FAIL"

echo ""
