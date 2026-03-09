#!/usr/bin/env bash
# deploy/update.sh
#
# Pull latest code and rebuild/restart the container.
# Run from your laptop:
#   ssh root@YOUR_IP 'bash -s' < deploy/update.sh
set -euo pipefail

APP_DIR="/opt/war-room"

cd "$APP_DIR"
git pull origin main
docker compose up --build -d

echo "==> Updated!  http://$(hostname -I | awk '{print $1}')"
