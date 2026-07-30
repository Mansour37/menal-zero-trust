#!/bin/bash
# ══════════════════════════════════════════════════════════
# Hetzner Cloud — Create entire infrastructure via CLI
# Prerequisites: hcloud installed + context configured
# Usage: bash deploy/create-server.sh
# ══════════════════════════════════════════════════════════

set -euo pipefail

SERVER_NAME="hassaniya-prod"
FIREWALL_NAME="hassaniya-fw"
SSH_KEY_NAME="hassaniya-key"
SSH_KEY_FILE="$HOME/.ssh/id_ed25519.pub"
# cx32: 4 vCPU / 8 GB RAM — sized for 5K concurrent users
# (4 Node.js workers + PgBouncer + PostgreSQL 512MB shared_buffers + Docker overhead)
SERVER_TYPE="cx32"
IMAGE="ubuntu-24.04"
LOCATION="fsn1"

echo "══════════════════════════════════════════════"
echo "  Hetzner Cloud — Infrastructure Setup"
echo "══════════════════════════════════════════════"

# 1. Upload SSH key
echo ""
echo "[1/4] Uploading SSH key..."
if hcloud ssh-key describe "$SSH_KEY_NAME" &>/dev/null; then
  echo "  SSH key '$SSH_KEY_NAME' already exists, skipping."
else
  hcloud ssh-key create --name "$SSH_KEY_NAME" --public-key-from-file "$SSH_KEY_FILE"
  echo "  SSH key uploaded."
fi

# 2. Create firewall
echo ""
echo "[2/4] Creating firewall..."
if hcloud firewall describe "$FIREWALL_NAME" &>/dev/null; then
  echo "  Firewall '$FIREWALL_NAME' already exists, skipping."
else
  hcloud firewall create --name "$FIREWALL_NAME"

  # SSH (port 2222 — hardened)
  hcloud firewall add-rule "$FIREWALL_NAME" \
    --direction in --protocol tcp --port 2222 \
    --source-ips 0.0.0.0/0 --source-ips ::/0 \
    --description "SSH (hardened port)"

  # HTTP
  hcloud firewall add-rule "$FIREWALL_NAME" \
    --direction in --protocol tcp --port 80 \
    --source-ips 0.0.0.0/0 --source-ips ::/0 \
    --description "HTTP"

  # HTTPS
  hcloud firewall add-rule "$FIREWALL_NAME" \
    --direction in --protocol tcp --port 443 \
    --source-ips 0.0.0.0/0 --source-ips ::/0 \
    --description "HTTPS"

  echo "  Firewall created with rules: 2222, 80, 443"
fi

# 3. Create server
echo ""
echo "[3/4] Creating server..."
if hcloud server describe "$SERVER_NAME" &>/dev/null; then
  echo "  Server '$SERVER_NAME' already exists!"
  SERVER_IP=$(hcloud server ip "$SERVER_NAME")
else
  hcloud server create \
    --name "$SERVER_NAME" \
    --type "$SERVER_TYPE" \
    --image "$IMAGE" \
    --location "$LOCATION" \
    --ssh-key "$SSH_KEY_NAME" \
    --firewall "$FIREWALL_NAME"

  SERVER_IP=$(hcloud server ip "$SERVER_NAME")
  echo "  Server created!"
fi

# 4. Show result
echo ""
echo "[4/4] Applying firewall..."
hcloud firewall apply-to-resource "$FIREWALL_NAME" --type server --server "$SERVER_NAME" 2>/dev/null || true

echo ""
echo "══════════════════════════════════════════════"
echo "  INFRASTRUCTURE READY!"
echo "══════════════════════════════════════════════"
echo ""
echo "  Server:   $SERVER_NAME"
echo "  IP:       $SERVER_IP"
echo "  Type:     $SERVER_TYPE (4 vCPU, 8 GB RAM)"
echo "  Location: Falkenstein (EU)"
echo "  Firewall: Ports 2222, 80, 443 only"
echo ""
echo "  Cost: ~€7.49/month"
echo ""
echo "══════════════════════════════════════════════"
echo "  NEXT STEPS:"
echo "══════════════════════════════════════════════"
echo ""
echo "  1. Secure the server:"
echo "     ssh root@$SERVER_IP 'bash -s' < deploy/setup-server.sh"
echo ""
echo "  2. Point your DNS:"
echo "     app.YOUR_DOMAIN  → A record → $SERVER_IP"
echo "     api.YOUR_DOMAIN  → A record → $SERVER_IP"
echo ""
echo "  3. Create .env from .env.example:"
echo "     cp .env.example .env && nano .env"
echo ""
echo "  4. Deploy:"
echo "     bash deploy/deploy.sh deploy@$SERVER_IP"
echo ""
echo "══════════════════════════════════════════════"
