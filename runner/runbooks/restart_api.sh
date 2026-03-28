#!/bin/bash
# Runbook: Restart API service
set -e
echo "Restarting api..."
docker restart api || systemctl restart api
echo "api restarted successfully"
