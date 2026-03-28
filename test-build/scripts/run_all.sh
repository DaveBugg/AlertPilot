#!/bin/bash
# Run all tests sequentially
# Usage: bash scripts/run_all.sh
#
# Prereq: docker compose -f docker-compose.test.yml up --build -d
# Wait 10s for services to start, then run this.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  AlertPilot — Full Test Suite"
echo "============================================"
echo ""

# Wait for services
echo "Waiting for services to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8080/runner/health > /dev/null 2>&1; then
    echo "Services ready!"
    break
  fi
  echo -n "."
  sleep 1
done
echo ""

# Run tests
for script in "$SCRIPT_DIR"/0[1-9]_*.sh; do
  bash "$script"
done

echo "============================================"
echo "  All tests completed!"
echo "============================================"
echo ""
echo "Now test the PWA manually:"
echo "  1. Open http://localhost:8080 in browser"
echo "  2. Follow TEST_PLAN.md for PWA checks"
echo ""
