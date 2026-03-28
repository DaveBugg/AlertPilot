#!/bin/bash
# Runbook: Restart nginx
# Called by: RestartAction when service=nginx

set -e
echo "Restarting nginx..."
systemctl restart nginx
echo "nginx restarted successfully"
