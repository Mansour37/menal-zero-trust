#!/bin/bash
# =============================================================================
# INJECTION DU JEU DE TEST ELSON via l'API publique
# =============================================================================
# Cree les comptes du jeu synthetique (scripts/generer-jeu-test-elson.py) en
# passant par POST /api/auth/register : chaque creation traverse donc
# HTTPS -> Cloud Armor (WAF) -> Cloud Run -> sa-elson -> elson_db isolee.
# Rien n'est ecrit directement en base.
#
# CADENCE — a ne pas modifier a la legere : la regle Cloud Armor 1450 bannit
# une IP pendant 5 min au-dela de 10 requetes d'auth par minute. Le defaut de
# 8 s entre deux inscriptions tient sous ce seuil (7,5/min). Descendre plus bas
# ne va pas plus vite : ca fait bannir l'IP au bout de 10 comptes.
#
# Usage :
#   DRY_RUN=1 bash scripts/injecter-jeu-test-elson.sh    # n'ecrit rien
#   bash scripts/injecter-jeu-test-elson.sh              # cree les comptes
#   PAUSE=10 LIMITE=5 bash scripts/injecter-jeu-test-elson.sh
# =============================================================================
set -euo pipefail

BASE="${ELSON_BASE:-https://elson.menal-sarl.com}"
JEU="${JEU:-preuves/corpus/jeu_test_elson.json}"
PAUSE="${PAUSE:-8}"
LIMITE="${LIMITE:-0}"          # 0 = tous
DRY_RUN="${DRY_RUN:-0}"
JOURNAL="preuves/corpus/injection_$(date -u +%Y%m%d-%H%M%S).log"

G='\033[1;32m'; R='\033[1;31m'; Y='\033[1;33m'; C='\033[1;36m'; N='\033[0m'

[ -f "$JEU" ] || { echo -e "${R}Jeu introuvable : $JEU${N}"
  echo "  Generer d'abord : python scripts/generer-jeu-test-elson.py --n 25"; exit 1; }

TOTAL=$(python -c "import json;print(len(json.load(open('$JEU',encoding='utf-8'))['personas']))")
[ "$LIMITE" -gt 0 ] && [ "$LIMITE" -lt "$TOTAL" ] && TOTAL=$LIMITE

echo -e "${C}== Jeu de test ELSON — injection via l'API publique${N}"
echo "   source   : $JEU"
echo "   cible    : $BASE/api/auth/register"
echo "   comptes  : $TOTAL"
echo "   cadence  : 1 toutes les ${PAUSE}s (~$(python -c "print(round(60/$PAUSE,1))")/min, seuil WAF = 10/min)"
echo -e "   duree    : ~$(python -c "print(round($TOTAL*$PAUSE/60,1))") min"
[ "$DRY_RUN" = "1" ] && echo -e "   ${Y}DRY_RUN — aucune ecriture${N}"
echo ""

OK=0; KO=0; DEJA=0
for i in $(seq 0 $((TOTAL - 1))); do
  LIGNE=$(python -c "
import json
p=json.load(open('$JEU',encoding='utf-8'))['personas'][$i]
champs=['email','username','firstName','lastName','nni','whatsapp','birthdate','sourceLang','password']
print(json.dumps({k:p[k] for k in champs if k in p}))
")
  NOM=$(printf '%s' "$LIGNE" | python -c "import sys,json;d=json.load(sys.stdin);print(f\"{d['firstName']} {d['lastName']}\")")
  NNI=$(printf '%s' "$LIGNE" | python -c "import sys,json;print(json.load(sys.stdin)['nni'])")

  if [ "$DRY_RUN" = "1" ]; then
    printf "   %2d/%d  %-30s NNI %s  ${Y}(simule)${N}\n" $((i + 1)) "$TOTAL" "$NOM" "$NNI"
    continue
  fi

  # L'API applique un garde anti-CSRF (server.ts:originEnforced) : toute methode
  # non-GET exige un Origin allow-liste ET X-Requested-By: elson-web. On emet donc
  # la meme requete que la SPA — ce garde protege le navigateur du cross-origin,
  # il ne remplace pas l'authentification.
  CODE=$(curl -sS -o /tmp/rep_elson.json -w "%{http_code}" -X POST "$BASE/api/auth/register" \
    -H "Content-Type: application/json" \
    -H "Origin: $BASE" \
    -H "X-Requested-By: elson-web" \
    --data-binary "$LIGNE" || echo "000")

  case "$CODE" in
    200|201)
      OK=$((OK + 1))
      printf "   %2d/%d  %-30s NNI %s  ${G}cree${N}\n" $((i + 1)) "$TOTAL" "$NOM" "$NNI" ;;
    409)
      DEJA=$((DEJA + 1))
      printf "   %2d/%d  %-30s NNI %s  ${Y}existe deja${N}\n" $((i + 1)) "$TOTAL" "$NOM" "$NNI" ;;
    403)
      printf "   %2d/%d  %-30s ${R}403 — WAF/geo ou inscription fermee${N}\n" $((i + 1)) "$TOTAL" "$NOM"
      echo -e "   ${Y}Si c'est un bannissement Cloud Armor : attendre 5 min et augmenter PAUSE.${N}"
      KO=$((KO + 1)) ;;
    429)
      printf "   %2d/%d  %-30s ${R}429 — limite de debit${N}\n" $((i + 1)) "$TOTAL" "$NOM"
      echo -e "   ${Y}Augmenter PAUSE (ex: PAUSE=12).${N}"; KO=$((KO + 1)) ;;
    *)
      KO=$((KO + 1))
      printf "   %2d/%d  %-30s ${R}HTTP %s${N} : %s\n" $((i + 1)) "$TOTAL" "$NOM" "$CODE" \
        "$(head -c 140 /tmp/rep_elson.json 2>/dev/null)" ;;
  esac

  { echo "$(date -u +%FT%TZ) $CODE $NNI $NOM"; } >> "$JOURNAL"
  [ $((i + 1)) -lt "$TOTAL" ] && sleep "$PAUSE"
done

[ "$DRY_RUN" = "1" ] && { echo -e "\n${Y}Rien n'a ete ecrit.${N}"; exit 0; }

echo ""
echo -e "   ${G}crees : $OK${N}   deja presents : $DEJA   ${R}echecs : $KO${N}"
echo -e "   journal : ${C}$JOURNAL${N}"
echo ""
echo -e "Verifier cote base :  ${C}bash scripts/extraire-usage.sh${N}"
echo -e "${Y}A dire au jury : jeu de TEST synthetique, cree le $(date -u +%d/%m/%Y) —${N}"
echo -e "${Y}e-mails @example.com non routables, NNI reserves 99xxxxxx. Pas des utilisateurs reels.${N}"
