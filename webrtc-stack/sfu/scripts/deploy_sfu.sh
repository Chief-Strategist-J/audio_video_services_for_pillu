#!/bin/bash
set -euo pipefail

echo "Stopping and removing existing SFU stack..."
docker compose -f docker-compose.yml down --remove-orphans --volumes

# Remove any stray containers by name (optional)
for svc in sfu grafana loki promtail; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${svc}$"; then
    docker rm -f "${svc}" || true
  fi
done

echo "Building and starting fresh containers..."
docker compose -f docker-compose.yml up --build -d

echo "Deployment complete."
echo "SFU API is available at http://localhost:3000"
echo "Grafana is available at http://localhost:3001"
