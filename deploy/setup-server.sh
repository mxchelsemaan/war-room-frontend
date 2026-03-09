#!/usr/bin/env bash
# deploy/setup-server.sh
#
# One-shot script to provision a fresh DigitalOcean droplet (Ubuntu/Debian).
# Run from your laptop:
#   ssh root@YOUR_IP 'bash -s' < deploy/setup-server.sh
set -euo pipefail

REPO="https://github.com/mxchelsemaan/war-room-frontend.git"
BRANCH="main"
APP_DIR="/opt/war-room"

echo "==> Installing Docker (if needed) …"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

echo "==> Installing Docker Compose plugin (if needed) …"
if ! docker compose version &>/dev/null; then
    apt-get update && apt-get install -y docker-compose-plugin
fi

echo "==> Cloning / updating repo …"
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR" && git pull origin "$BRANCH"
else
    git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

echo "==> Building & starting …"
cd "$APP_DIR"
docker compose up -d --build

echo ""
echo "==> Done!  War Room: http://$(hostname -I | awk '{print $1}')"
echo "    Logs:  docker compose -f $APP_DIR/docker-compose.yml logs -f"
