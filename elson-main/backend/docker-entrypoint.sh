#!/bin/sh
set -e

echo "══════════════════════════════════════════════"
echo "  Hassaniya Backend Starting..."
echo "══════════════════════════════════════════════"

# Check if FLORES data needs seeding (run once on first deploy)
if [ "${SEED_FLORES:-false}" = "true" ]; then
  echo "[SEED] Checking if FLORES data needs seeding..."
  npx tsx src/scripts/seed-flores.ts || echo "[SEED] Seeding skipped or failed (may already be done)"
fi

echo "[API] Starting server..."
exec "$@"
