#!/bin/bash
# Example: Fail2ban action to send alert to AlertPilot
#
# Install:
# 1. Copy to /etc/fail2ban/action.d/alertpilot.conf
# 2. Add to your jail: action = alertpilot
#
# Fail2ban passes: <ip>, <name> (jail name), <failures>, <bantime>

NTFY_URL="${NTFY_URL:-https://alerts.your.host/ntfy}"
TOPIC="${NTFY_TOPIC:-ops-alerts}"
RUNNER_URL="${RUNNER_URL:-https://alerts.your.host/runner}"

IP="<ip>"
JAIL="<name>"
FAILURES="<failures>"

curl -s \
  -H "Title: Fail2ban: ${JAIL} banned ${IP}" \
  -H "Priority: 4" \
  -H "Tags: police_car,${JAIL}" \
  -H "Actions: http, Block IP permanently, ${RUNNER_URL}/api/action/block_ip, body='{\"params\":{\"ip\":\"${IP}\"},\"topic\":\"${TOPIC}\"}', method=POST" \
  -d "IP ${IP} banned by ${JAIL} after ${FAILURES} failures." \
  "${NTFY_URL}/${TOPIC}"
