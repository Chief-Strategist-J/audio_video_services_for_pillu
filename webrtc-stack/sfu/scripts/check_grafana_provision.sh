#!/bin/bash
set -euo pipefail

STACK_NAME="sfu"
SERVICE_NAME="grafana"
ENV_FILE=".env"

# Ensure we run from the same dir as docker-compose.yml
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Missing $ENV_FILE file in project root ($SCRIPT_DIR)"
  exit 1
fi

echo "🔻 Stopping old stack (with volumes)..."
docker compose -p "$STACK_NAME" --env-file "$ENV_FILE" down -v || true

echo "🚀 Starting stack (with env file)..."
docker compose -p "$STACK_NAME" --env-file "$ENV_FILE" up -d

echo "⏳ Waiting for Grafana ($SERVICE_NAME) to boot..."
sleep 12

echo "🔍 Checking Grafana logs..."
LOGS=$(docker logs "$SERVICE_NAME" 2>&1 || true)

DATASOURCE_OK=$(echo "$LOGS" | grep -i "Provisioned datasource" || true)
DASHBOARD_OK=$(echo "$LOGS" | grep -i "Provisioned dashboard" || true)

if [ -n "$DATASOURCE_OK" ]; then
  echo "✅ Datasource provisioning successful!"
else
  echo "⚠️ Datasource provisioning not confirmed."
fi

if [ -n "$DASHBOARD_OK" ]; then
  echo "✅ Dashboard provisioning successful!"
else
  echo "⚠️ Dashboard provisioning not confirmed."
fi

echo
echo "📜 Recent provisioning log lines:"
echo "$LOGS" | grep -i provision | tail -n 20
