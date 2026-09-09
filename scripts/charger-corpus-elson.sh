#!/bin/bash
# =============================================================================
# CHARGEMENT DU CORPUS FLORES-200 DANS ELSON
# =============================================================================
# Charge les 60 phrases trilingues (20 groupes paralleles EN/FR/AR) issues de
# FLORES-200 dans elson_db, VIA L'API PUBLIQUE : chaque ecriture traverse donc
# HTTPS -> Cloud Armor (WAF) -> Cloud Run -> sa-elson -> base isolee.
#
# Ce n'est PAS une fabrication de donnees d'usage : c'est le chargement d'un
# corpus linguistique public et citable (benchmark FLORES-200 de Meta). Aucun
# compte, aucune contribution, aucune validation n'est simule.
#
# Les identifiants sont lus dans l'ENVIRONNEMENT et ne sont jamais affiches,
# pas plus que le jeton obtenu.
#
# Usage :
#   export ELSON_ADMIN_EMAIL='...'
#   export ELSON_ADMIN_PASSWORD='...'
#   bash scripts/charger-corpus-elson.sh
#
# Option :  DRY_RUN=1 bash scripts/charger-corpus-elson.sh   (verifie sans ecrire)
# =============================================================================
set -euo pipefail

BASE="${ELSON_BASE:-https://elson.menal-sarl.com}"
PAYLOAD="preuves/corpus/flores_60.json"
DRY_RUN="${DRY_RUN:-0}"

G='\033[1;32m'; R='\033[1;31m'; Y='\033[1;33m'; C='\033[1;36m'; N='\033[0m'
etape() { echo -e "\n${C}== $1${N}"; }

: "${ELSON_ADMIN_EMAIL:?Definir ELSON_ADMIN_EMAIL (export ELSON_ADMIN_EMAIL=...)}"
: "${ELSON_ADMIN_PASSWORD:?Definir ELSON_ADMIN_PASSWORD (export ELSON_ADMIN_PASSWORD=...)}"

[ -f "$PAYLOAD" ] || { echo -e "${R}Payload introuvable : $PAYLOAD${N}"; exit 1; }

etape "1/4 — Corpus a charger"
python -c "
import json;d=json.load(open('$PAYLOAD',encoding='utf-8'))['phrases']
from collections import Counter
print(f'   {len(d)} phrases, {len(set(p[\"hassaniya_reference\"] for p in d))} groupes paralleles')
print('   langues :', dict(Counter(p['source_lang'] for p in d)))
"

etape "2/4 — Connexion (le mot de passe n'est ni affiche ni journalise)"
LOGIN=$(curl -sS -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  --data-binary @<(python -c "
import json,os
print(json.dumps({'email':os.environ['ELSON_ADMIN_EMAIL'],'password':os.environ['ELSON_ADMIN_PASSWORD']}))
"))

TOKEN=$(printf '%s' "$LOGIN" | python -c "
import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    sys.exit('reponse illisible')
t=d.get('accessToken')
if not t: sys.exit('pas de accessToken — reponse: '+json.dumps({k:v for k,v in d.items() if k!='accessToken'})[:200])
print(t)
") || { echo -e "   ${R}Echec de connexion${N}"; exit 1; }
echo -e "   ${G}authentifie${N} (jeton obtenu, non affiche)"

if [ "$DRY_RUN" = "1" ]; then
  echo -e "\n${Y}DRY_RUN=1 : arret avant ecriture. Tout est pret.${N}"; exit 0
fi

etape "3/4 — Import du corpus (POST /api/phrases/bulk-import)"
REP=$(curl -sS -X POST "$BASE/api/phrases/bulk-import" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@$PAYLOAD")
printf '%s' "$REP" | python -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: print('   reponse brute :', sys.stdin.read()[:300]); raise SystemExit
for k,v in d.items():
    if isinstance(v,list) and len(v)>5: v=f'{len(v)} elements'
    print(f'   {k}: {v}')
"

etape "4/4 — Verification cote serveur"
curl -sS "$BASE/api/phrases/pipeline-stats" -H "Authorization: Bearer $TOKEN" \
  | python -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: print('   (stats indisponibles)'); raise SystemExit
for k,v in d.items(): print(f'   {k}: {v}')
"

echo -e "\n${G}Termine.${N} Rejouer ensuite : ${C}bash scripts/extraire-usage.sh${N}"
echo -e "puis mettre a jour PREUVES_CHAINE_DONNEES.md §4.1 avec les nouveaux chiffres."
echo -e "${Y}A dire au jury : corpus FLORES-200 charge le $(date -u +%d/%m/%Y) — contenu public,${N}"
echo -e "${Y}pas de donnee d'usage simulee.${N}"
