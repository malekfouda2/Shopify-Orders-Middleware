#!/usr/bin/env bash
# VPS deploy script — run this after every git pull
set -e

REPO_DIR="/opt/tabliya"
APP_DIR="$REPO_DIR/artifacts/api-server"

echo "==> Pulling latest code..."
cd "$REPO_DIR"
git pull

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building api-server..."
pnpm --filter @workspace/api-server run build

echo "==> Restarting app..."
if pm2 list | grep -q "tabliya-api"; then
  pm2 restart tabliya-api
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
fi

echo "==> Done. Checking status..."
pm2 status tabliya-api
