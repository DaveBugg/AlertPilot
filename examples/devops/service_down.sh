#!/bin/bash
# Example: Send an alert when a service is down
# Usage: ./service_down.sh nginx

SERVICE=${1:-nginx}
NTFY_URL="${NTFY_URL:-https://alerts.your.host/ntfy}"
TOPIC="${NTFY_TOPIC:-ops-alerts}"

curl -s \
  -H "Title: ${SERVICE} is DOWN" \
  -H "Priority: 5" \
  -H "Tags: rotating_light,${SERVICE}" \
  -H "Actions: http, Restart ${SERVICE}, ${NTFY_URL}/../runner/api/action/restart, body='{\"params\":{\"service\":\"${SERVICE}\"},\"topic\":\"${TOPIC}\"}', method=POST" \
  -d "Service ${SERVICE} is not responding. Last check: $(date)" \
  "${NTFY_URL}/${TOPIC}"
