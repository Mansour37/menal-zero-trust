#!/bin/sh
set -e

echo "══════════════════════════════════════════════"
echo "  Hassaniya Backend Starting..."
echo "══════════════════════════════════════════════"

# Schema migrations (P1-1, audit §4.4.1) : démarre toujours au même niveau,
# brique par brique, sans intervention manuelle.
#   MIGRATE_MODE=auto      (défaut) : applique les migrations en attente
#   MIGRATE_MODE=baseline  (1 seule fois, base existante) : enregistre toutes
#                           les migrations comme appliquées sans les rejouer —
#                           à utiliser uniquement pour adopter l'outil sur la
#                           production actuelle, jamais après.
case "${MIGRATE_MODE:-auto}" in
  auto)
    echo "[MIGRATE] Applying pending schema migrations..."
    npx tsx src/scripts/migrate.ts
    ;;
  baseline)
    echo "[MIGRATE] Baseline : enregistrement des migrations existantes (sans relecture)…"
    npx tsx src/scripts/migrate.ts --baseline
    ;;
  off)
    echo "[MIGRATE] Migrations désactivées (MIGRATE_MODE=off)."
    ;;
  *)
    echo "[MIGRATE] ERREUR : MIGRATE_MODE inconnu '$MIGRATE_MODE' (auto|baseline|off)." >&2
    exit 1
    ;;
esac

# Check if FLORES data needs seeding (run once on first deploy)
if [ "${SEED_FLORES:-false}" = "true" ]; then
  echo "[SEED] Checking if FLORES data needs seeding..."
  npx tsx src/scripts/seed-flores.ts || echo "[SEED] Seeding skipped or failed (may already be done)"
fi

echo "[API] Starting server..."
exec "$@"
