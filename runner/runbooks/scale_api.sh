#!/bin/bash
# Runbook: Scale API service
# Expects $1 = replicas count (passed via env REPLICAS by runner)
set -e
REPLICAS=${1:-2}
echo "Scaling api to $REPLICAS replicas..."
docker service scale api=$REPLICAS
echo "api scaled to $REPLICAS"
