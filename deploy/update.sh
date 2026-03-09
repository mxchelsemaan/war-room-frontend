#!/usr/bin/env bash
# deploy/update.sh
#
# Manual redeploy — pulls the latest image and restarts.
# Run from your laptop:
#   ssh root@YOUR_IP 'bash /opt/war-room/update.sh'
set -euo pipefail

APP_DIR="/opt/war-room"

docker compose -f "$APP_DIR/docker-compose.yml" pull
docker compose -f "$APP_DIR/docker-compose.yml" up -d

echo "==> Updated!  http://$(hostname -I | awk '{print $1}')"
