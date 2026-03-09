#!/usr/bin/env bash
# deploy/setup-server.sh
#
# One-shot provisioning of a fresh DigitalOcean droplet (Ubuntu/Debian).
# Run from your laptop:
#   scp deploy/setup-server.sh root@YOUR_IP:/tmp/ && ssh root@YOUR_IP 'bash /tmp/setup-server.sh'
#
# After this runs, deployments happen automatically via GitHub Actions on push to main.
# Manual redeploy: ssh root@YOUR_IP 'bash /opt/war-room/update.sh'
set -euo pipefail

APP_DIR="/opt/war-room"
IMAGE="ghcr.io/mxchelsemaan/war-room-frontend:latest"

echo "==> Installing Docker (if needed) …"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

echo "==> Installing Docker Compose plugin (if needed) …"
if ! docker compose version &>/dev/null; then
    apt-get update && apt-get install -y docker-compose-plugin
fi

echo "==> Writing app directory …"
mkdir -p "$APP_DIR"

cat > "$APP_DIR/docker-compose.yml" <<EOF
services:
  war-room:
    image: ${IMAGE}
    container_name: war-room
    restart: unless-stopped
    ports:
      - "80:80"
EOF

cat > "$APP_DIR/update.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/opt/war-room"
docker compose -f "$APP_DIR/docker-compose.yml" pull
docker compose -f "$APP_DIR/docker-compose.yml" up -d
echo "==> Updated!  http://$(hostname -I | awk '{print $1}')"
EOF
chmod +x "$APP_DIR/update.sh"

echo "==> Pulling image and starting …"
docker compose -f "$APP_DIR/docker-compose.yml" pull
docker compose -f "$APP_DIR/docker-compose.yml" up -d

echo ""
echo "==> Done!  War Room: http://$(hostname -I | awk '{print $1}')"
echo "    Logs:  docker compose -f $APP_DIR/docker-compose.yml logs -f"
echo "    Redeploy: bash $APP_DIR/update.sh"
