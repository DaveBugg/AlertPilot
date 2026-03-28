#!/bin/bash
# Example: Cron job to check disk usage, alert if >85%
# Add to crontab: */5 * * * * /path/to/disk_check.sh

NTFY_URL="${NTFY_URL:-https://alerts.your.host/ntfy}"
TOPIC="${NTFY_TOPIC:-ops-alerts}"
THRESHOLD=85

USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')

if [ "$USAGE" -gt "$THRESHOLD" ]; then
  curl -s \
    -H "Title: Disk usage ${USAGE}% on $(hostname)" \
    -H "Priority: 4" \
    -H "Tags: warning,disk" \
    -d "Disk usage is at ${USAGE}% on $(hostname). Threshold: ${THRESHOLD}%." \
    "${NTFY_URL}/${TOPIC}"
fi
