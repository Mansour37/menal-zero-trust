#!/bin/bash
# ══════════════════════════════════════════════════════════
# fetch-schema.sh — §0.3 : extraire le schéma PROD et le comparer au dépôt
# Usage: ./deploy/fetch-schema.sh deploy@YOUR_IP
# ══════════════════════════════════════════════════════════

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: $0 user@host"
    exit 1
fi

SERVER=$1
SSH_PORT=2222
APP_DIR="/opt/hassaniya"
OUT="/tmp/prod_schema.sql"

echo "═══ Récupération du schéma prod depuis $SERVER ═══"

# 1. Dump sur le serveur PUIS rapatriement : évite les conversions d'encodage
#    des redirections locales (PowerShell/CRLF cassent pg_dump → encoding).
ssh -p $SSH_PORT "$SERVER" \
    "cd $APP_DIR && docker compose exec -T postgres pg_dump -U hassaniya --schema-only --no-owner" \
    > "$OUT"

echo "Dump récupéré : $OUT ($(stat -c%s "$OUT") octets)"

# 2. Comparaison automatique (même convention que l'existant)
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
sh "$SCRIPT_DIR/compare-schema.sh" "$OUT"