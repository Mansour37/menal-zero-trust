#!/bin/bash
# ══════════════════════════════════════════════════════════════
# preflight.sh — Elson : contrôles avant déploiement (P1-1 adoption)
#
# Usage (sur le serveur, dans /opt/hassaniya) :
#   bash deploy/preflight.sh
#
# Échoue (exit 1) à la première vérification rouge. Exécuter AVANT
# tout docker compose down/up. Le tableau §1 de docs/DEPLOY_CHECKLIST.md
# décrit chaque contrôle.
# ══════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
finish() {
  echo ""
  echo "════════════════════════════════════════════════"
  if [ "$FAIL" -eq 0 ]; then
    echo "  PREFLIGHT OK : $PASS contrôles passés."
    exit 0
  else
    echo "  PREFLIGHT ÉCHEC : $FAIL contrôle(s) — ne pas déployer."
    exit 1
  fi
}
trap finish EXIT

echo "== Elson preflight =="
command -v docker >/dev/null || { bad "docker introuvable"; exit 1; }

# 1. Compose valide + secrets requis présents
if docker compose config --quiet >/dev/null 2>&1; then
  ok "docker compose config"
else
  bad "docker compose config (variables manquantes dans .env — JWT/API_KEY/AUDIO/OTP/DB_PASSWORD requis)"
fi

[ -f .env ] || { bad ".env absent — cp .env.example .env"; exit 1; }

# 1b. Normaliser les fins de ligne : un .env sauvé sous Windows apporte \r et
# pollue FIÈrement les greps/lectures ci-dessous (bug réel constaté en test).
read_env() { sed 's/\r$//' .env | grep -E "^$1=" | head -n1 | cut -d= -f2-; }

# 2. Les 4 secrets sont positionnés et non triviaux
SECRETS="JWT_SECRET API_KEY_SECRET AUDIO_URL_SECRET OTP_PEPPER"
for s in $SECRETS; do
  v=$(read_env "$s")
  if [ -n "$v" ] && [[ "$v" != change-me-* ]]; then
    ok "$s positionné"
  else
    bad "$s vide ou placeholder — openssl rand -hex 64"
  fi
done

# 3. MIGRATE_MODE cohérent
MODE=$(read_env MIGRATE_MODE)
case "$MODE" in
  auto|baseline|off) ok "MIGRATE_MODE=$MODE" ;;
  "") bad "MIGRATE_MODE absent (.env) — auto est le défaut recommandé" ;;
  *)  bad "MIGRATE_MODE inconnu ($MODE)" ;;
esac

# 4. SQL reachable
if docker compose exec -T postgres pg_isready -U hassaniya >/dev/null 2>&1; then
  ok "postgres pg_isready"
else
  bad "postgres injoignable via docker compose (postgres démarré ?)"
  exit 1
fi

DB="docker compose exec -T postgres psql -U hassaniya -d hassaniya -t -A"
# NB : `-U hassaniya` et `-d hassaniya` sont les valeurs par défaut de `.env.example`;
# si ton .env utilise d'autres DB_NAME/DB_USER, adapter les deux commandes ci-dessus.

# 5. Table schema_migrations présente (adoption outil deployée ?)
if $DB -c "SELECT to_regclass('schema_migrations');" 2>/dev/null | grep -q schema_migrations; then
  ok "schema_migrations existe"
  N=$($DB -c "SELECT count(*) FROM schema_migrations;")
  if [ "$N" -ge 72 ]; then
    ok "nb migrations tracées ($N ≥ 72)"
  else
    bad "seulement $N migrations tracées (< 72 attendu pour une prod)"
  fi
else
  bad "schema_migrations ABSENT — jamais adopté. Voir DEPLOY_CHECKLIST §2 (MIGRATE_MODE=baseline une fois) OU base neuve (§2.2)."
  exit 1
fi

# 6. Migration v76 (et v74/v75) tracées
for v in v74 v75 v76; do
  if $DB -c "SELECT 1 FROM schema_migrations WHERE version='$v';" | grep -q 1; then
    ok "migration $v tracée"
  else
    bad "migration $v absente de schema_migrations — relancer le runner puis redéployer"
  fi
done

# 7. Objets de référence §4.4.2 présents côté prod
OBJS=$($DB -c "SELECT string_agg(to_regclass(x)::text, ',') FROM unnest(ARRAY['votes','votable_phrases','season0_contributors']) x;" 2>/dev/null)
if echo "$OBJS" | grep -q "votes,votable_phrases,season0_contributors"; then
  ok "objets de référence présents (votes, votable_phrases, season0_contributors)"
else
  bad "objets manquants (§4.4.2) : $OBJS — nécessaire pour valider/classement"
fi

# 8. Admin présent (P0-1)
ADMIN=$($DB -c "SELECT count(*) FROM users WHERE role IN ('admin','superadmin');" 2>/dev/null || echo "0")
if [ "${ADMIN}" -gt 0 ] 2>/dev/null; then
  ok "admin en base ($ADMIN)"
else
  bad "aucun admin — exécuter npm run create-admin dans le conteneur backend"
fi

# 9. Santé API (via node, l'image alpine n'a ni curl ni wget)
if docker compose exec -T backend node -e \
  "fetch('http://localhost:4000/api/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"; then
  ok "/api/health répond 200"
else
  bad "/api/health indisponible — regarder le log backend (docker compose logs backend)"
fi

echo ""
echo "Note : pour relancer après avoir réparé, corrige puis relance preflight.sh (aucune action destructive)."