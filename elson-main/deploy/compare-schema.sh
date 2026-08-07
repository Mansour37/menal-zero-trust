#!/bin/sh
# ══════════════════════════════════════════════════════════════
# compare-schema.sh — diff Schéma PROD vs Référence dépôt (P1-1, §0.3)
#
# Principe : plutôt que différer un dump brut vs init+migrations (formats
# incomparables), on charge les DEUX dans des bases vierges et on re-dumpe
# chacun en --schema-only — même normalisation de part et d'autre, le diff
# final montre uniquement de VRAIES différences de structure.
#
# Usage :
#   sh deploy/compare-schema.sh <prod_schema.sql>
#   où <prod_schema.sql> = pg_dump --schema-only --no-owner du prod (§0.3)
#
# Sortie (dans /tmp/schema-compare/) :
#   diff_raw.txt   → diff Unix brut (lignes '-' = prod, '+' = dépôt)
#   summary.txt    → compteurs + verdict par catégorie
# ══════════════════════════════════════════════════════════════
set -eu

PROD_DUMP="${1:?Usage: compare-schema.sh <prod_schema.sql>}"
[ -f "$PROD_DUMP" ] || { echo "Fichier introuvable: $PROD_DUMP"; exit 1; }

# On se place à la racine du dépôt (le script vit dans deploy/)
SCRIPT_DIR=$(dirname "$0")
[ "$SCRIPT_DIR" = "." ] && SCRIPT_DIR="$(pwd)/deploy"
REPO_ROOT=$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)
[ -n "$REPO_ROOT" ] || REPO_ROOT=$(pwd)
REF_FILE="$REPO_ROOT/backend/sql/schema.sql"
[ -f "$REF_FILE" ] || { echo "Référence introuvable: $REF_FILE — lancer npm run db:schema d'abord"; exit 1; }

OUT=/tmp/schema-compare
mkdir -p "$OUT"
rm -f "$OUT"/*.txt 2>/dev/null || true

command -v docker >/dev/null || { echo "docker requis"; exit 1; }

cleanup() {
  docker rm -f schema-ref schema-prod >/dev/null 2>&1 || true
  docker network rm schema-cmp >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 1. Deux Postgres vierges sur l'image épinglée du dépôt
docker network create schema-cmp >/dev/null 2>&1 || true
for name in schema-ref schema-prod; do
  docker run -d --name "$name" --network schema-cmp \
    -e POSTGRES_USER=cmp -e POSTGRES_PASSWORD=cmp -e POSTGRES_DB=cmp \
    postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193 >/dev/null
done

wait_ready() {
  for i in $(seq 1 30); do
    docker exec "$1" pg_isready -U cmp -d cmp >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "Postgres $1 pas prêt"; exit 1
}
wait_ready schema-ref; wait_ready schema-prod

# 2. Charger la référence du dépôt (init.sql + toutes les migrations)
echo "== Référence : $REF_FILE"
docker exec -i schema-ref psql -U cmp -d cmp -v ON_ERROR_STOP=1 < "$REF_FILE" >/dev/null

# 3. Charger le dump prod
echo "== Prod : $PROD_DUMP"
docker exec -i schema-prod psql -U cmp -d cmp -v ON_ERROR_STOP=1 < "$PROD_DUMP" >/dev/null \
  || { echo "Le dump prod ne s'applique pas sur une base vierge — normal si le dump a été fait avec --clean/--if-exists ou exclut des dépendances. Utiliser pg_dump --schema-only --no-owner sans options additionnelles."; exit 1; }

# 4. Re-dumper les DEUX en --schema-only ; on écran les marqueurs de
#    transaction aléatoires (\restrict <random> / \unrestrict <random>) que
#    pg_dump émet — sinon le diff « brut » est pollué par un identifiant
#    changeant à chaque exécution.
dump() {
  docker exec "$1" pg_dump -U cmp --schema-only --no-owner \
    | sed 's/\r$//' \
    | grep -vE '^\\restrict |^\\unrestrict ' \
    | grep -vE '^--$|^-- (PostgreSQL database dump|Dumped|Started|Completed)'
}
dump schema-ref  > "$OUT/ref_normalized.sql"
dump schema-prod > "$OUT/prod_normalized.sql"

# 4b. Version canonique : lignes triées. Le diff devient insensible à l'ordre
#     des objets (pg_dump n'ordonne pas identiquement selon la taille/état de
#     la base) — seules les VRAIES différences de structure subsistent.
sort "$OUT/ref_normalized.sql"  > "$OUT/ref_sorted.sql"
sort "$OUT/prod_normalized.sql" > "$OUT/prod_sorted.sql"

# 5. Diff (canonique pour le verdict, brut conservé pour le détail)
#    -U1 : contexte réduit → le nombre de lignes reste proportionnel aux
#    écarts réels, pas aux blocs alentour.
diff -u -U 1 "$OUT/prod_sorted.sql" "$OUT/ref_sorted.sql" > "$OUT/diff_canonical.txt" || true
diff -u "$OUT/prod_normalized.sql" "$OUT/ref_normalized.sql" > "$OUT/diff_raw.txt" || true

# 6. Résumé par catégorie d'objet (CREATE TABLE / VIEW / INDEX / FUNCTION / etc.)
grep -E '^[-+] +(CREATE|ALTER|DROP) ' "$OUT/diff_canonical.txt" \
  | sed -E 's/^([+-]) +(CREATE|ALTER|DROP) ([A-Z ]+).*/\1 \3/' \
  | sort | uniq -c | sort -rn > "$OUT/summary.txt"

echo ""
echo "════════════════════════════════════════════════"
echo "  Diff canonique (ordre-insensible) : $(wc -l < "$OUT/diff_canonical.txt") lignes → $OUT/diff_canonical.txt"
echo "  Diff brut (avec position)          : $(wc -l < "$OUT/diff_raw.txt") lignes → $OUT/diff_raw.txt"
echo "  Résumé   : $OUT/summary.txt"
echo "════════════════════════════════════════════════"
cat "$OUT/summary.txt"

echo ""
echo "LECTURE (cf. DEPLOY_CHECKLIST §0.3) :"
echo "  - objets §4.4.2 (votes, votable_phrases, season0_contributors,"
echo "    profiles.total_votes) présents CÔTÉ PROD ? → parité requise."
echo "  - colonnes/contraintes absentes du dépôt mais présentes côté prod ="
echo "    dérive non versionnée → à concilier AVANT d'aller plus loin."
if [ "$(wc -l < "$OUT/diff_canonical.txt")" -eq 0 ]; then
  echo "  ✅ DIFF NUL : dépôt et prod structurellement identiques."
else
  echo "  ⚠️ DIFF NON NUL : inspecter diff_canonical.txt et trancher chaque écart."
fi