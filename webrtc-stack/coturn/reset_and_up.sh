#!/bin/bash
# Ultra-simple Docker reset - just reboot and restart
set -e

echo "🔄 Simple Docker reset..."

# Method 1: Just restart Docker services properly
echo "Restarting Docker services..."
sudo systemctl daemon-reload
sudo systemctl stop docker.socket
sudo systemctl stop docker.service
sudo systemctl stop snap.docker.dockerd 2>/dev/null || true

# Kill any remaining processes
sudo pkill -f docker || true
sudo pkill -f containerd || true
sudo pkill -f runc || true

# Start everything back up
sudo systemctl start docker.socket
sudo systemctl start docker.service

# Wait for Docker
echo "Waiting for Docker to start..."
sleep 10

# Test Docker
if ! sudo docker version >/dev/null 2>&1; then
    echo "❌ Docker not responding. You need to REBOOT your system:"
    echo "   sudo reboot"
    echo ""
    echo "After reboot, run this script again."
    exit 1
fi

echo "✅ Docker is running!"

# Clean everything
echo "Cleaning all Docker resources..."
sudo docker stop $(sudo docker ps -aq) 2>/dev/null || true
sudo docker rm -f $(sudo docker ps -aq) 2>/dev/null || true
sudo docker rmi -f $(sudo docker images -aq) 2>/dev/null || true
sudo docker volume rm -f $(sudo docker volume ls -q) 2>/dev/null || true
sudo docker network rm $(sudo docker network ls -q) 2>/dev/null || true
sudo docker system prune -af --volumes

# Setup files
echo "Setting up files..."
mkdir -p grafana/provisioning/datasources grafana/provisioning/dashboards grafana/dashboards logs

cat > grafana/provisioning/datasources/datasources.yml <<'EOF'
apiVersion: 1
datasources:
  - name: Loki
    uid: Loki
    type: loki
    access: proxy
    url: http://coturn-loki:3100
    isDefault: true
EOF

cat > grafana/provisioning/dashboards/dashboards.yml <<'EOF'
apiVersion: 1
providers:
  - name: 'coturn'
    orgId: 1
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /var/lib/grafana/dashboards
EOF

cat > grafana/dashboards/coturn-logs.json <<'EOF'
{
  "title": "coturn logs",
  "schemaVersion": 39,
  "version": 1,
  "panels": [
    {
      "type": "logs",
      "title": "coturn log stream",
      "datasource": { "type": "loki", "uid": "Loki" },
      "targets": [{ "expr": "{job=\"coturn\"}" }],
      "gridPos": { "h": 20, "w": 24, "x": 0, "y": 0 }
    }
  ]
}
EOF

rm -f logs/*
touch logs/turn.log
sed -i '/^\s*version:\s*/d' docker-compose.yml 2>/dev/null || true

# Start stack
echo "Starting fresh stack..."
sudo docker compose up -d --build

echo ""
echo "✅ Done!"
sudo docker ps
echo ""
echo "Grafana: http://localhost:3000 (admin/admin)"