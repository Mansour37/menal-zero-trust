#!/bin/bash
# ══════════════════════════════════════════════════════════
# Deploy/Update — run from your local machine
# Usage: ./deploy/deploy.sh deploy@YOUR_IP
# ══════════════════════════════════════════════════════════

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: $0 user@host"
    exit 1
fi

SERVER=$1
SSH_PORT=2222
APP_DIR="/opt/hassaniya"

echo "═══ Deploying to $SERVER ═══"

# 1. Backup before deploy
echo "[1/4] Running pre-deploy backup..."
ssh -p $SSH_PORT "$SERVER" "cd $APP_DIR && docker compose --profile backup run --rm pg-backup 2>/dev/null || echo 'First deploy, no backup needed'"

# 2. Sync files
echo "[2/4] Syncing files..."
rsync -avz --delete \
    -e "ssh -p $SSH_PORT" \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude 'dist' \
    --exclude '.env' \
    --exclude '.git' \
    --exclude 'backend/node_modules' \
    --exclude 'backend/dist' \
    ./ "$SERVER:$APP_DIR/"

# 3. Build
echo "[3/4] Building containers..."
ssh -p $SSH_PORT "$SERVER" "cd $APP_DIR && docker compose build"

# 4. Restart
echo "[4/4] Restarting services..."
ssh -p $SSH_PORT "$SERVER" "cd $APP_DIR && docker compose down && docker compose up -d"

echo ""
echo "═══ Deployment complete! ═══"
ssh -p $SSH_PORT "$SERVER" "cd $APP_DIR && docker compose ps"
echo ""
echo "Logs: ssh -p $SSH_PORT $SERVER 'cd $APP_DIR && docker compose logs -f'"
echo "Health: curl -s https://api.YOUR_DOMAIN/api/health | jq"
