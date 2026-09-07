#!/bin/bash
# =============================================================================
# DÉMO LIVE ORCHESTRÉE — vidéo fluide, sans coupure, données 100% réelles
# =============================================================================
# Principe : l'attaque est jouée À L'ÉCRAN (crédibilité). Ensuite le script
# force le pipeline (détection puis enrichissement) pour que le dashboard soit
# prêt en ~3 min pendant que tu narres les autres piliers. Rien n'est fabriqué :
# ce sont les VRAIES règles et le VRAI modèle, juste déclenchés manuellement
# (comme un admin qui force un scan au lieu d'attendre le cron).
#
# Usage :  bash scripts/demo-live.sh
# Env :    Git Bash. gcloud/bq configurés sur menal-zero-trust-staging.
# =============================================================================
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
P=menal-zero-trust-staging
DS=menal_security_staging
BASE="https://elson.menal-sarl.com"
G='\033[1;32m'; R='\033[1;31m'; C='\033[1;36m'; Y='\033[1;33m'; B='\033[1m'; N='\033[0m'
bq_q(){ bq query --project_id=$P --use_legacy_sql=false --format=csv "$1" 2>/dev/null | tail -n +2; }
# IDs des requêtes planifiées (normalisation + règles) — pour forcer le cycle au
# lieu d'attendre 5 min. Récupérés le 07/09 ; stables tant que le module detection
# n'est pas recréé. force_pipeline() déclenche un run manuel de chacune.
CFG_BASE="projects/110809493492/locations/europe-west1/transferConfigs"
NORM_ACCESS="$CFG_BASE/6a8915b5-0000-2ed7-85cd-c82add7f1fcc"
NORM_ARMOR="$CFG_BASE/6a8915b8-0000-2ed7-85cd-c82add7f1fcc"
RULE_R2="$CFG_BASE/6a716aa3-0000-2a58-bdeb-582429a723c8"
RULE_R6="$CFG_BASE/6a8915b0-0000-2ed7-85cd-c82add7f1fcc"
force_pipeline(){
  local rt=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  for c in "$NORM_ACCESS" "$NORM_ARMOR"; do bq mk --transfer_run --run_time="$rt" "$c" >/dev/null 2>&1; done
  sleep 25   # laisse la normalisation s'exécuter avant les règles
  local rt2=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  for c in "$RULE_R2" "$RULE_R6"; do bq mk --transfer_run --run_time="$rt2" "$c" >/dev/null 2>&1; done
}

# --- Réveil (hors caméra) --------------------------------------------------
curl -s -o /dev/null "$BASE/" ; curl -s -o /dev/null "https://api-staging.menal-sarl.com/health"
curl -s -o /dev/null "https://dashboard.menal-sarl.com/login"

MYIP=$(curl -s https://ifconfig.me)
T0=$(date +%s)
echo -e "${C}══ DÉMO LIVE ══  IP=$MYIP  début=$(date -u +%H:%M:%S) UTC${N}"
echo ""

# --- 1) ATTAQUE (à filmer — c'est le plan visible) -------------------------
# IMPORTANT : les charges /etc/passwd sont envoyées avec le "/" LITTÉRAL (URL
# directe, PAS --data-urlencode). Sinon le "/" est encodé en %2F et le pattern
# de R6 "%etc/passwd%" ne matche pas → pas de candidat T1003.008. C'est le "/"
# littéral qui garantit la belle qualification (0,71) au dashboard.
echo -e "${B}[1] ATTAQUE — injections + accès /etc/passwd (pour la qualification ATT&CK)${N}"
# a) injections/XSS génériques (encodage sans importance) → R2 (pic WAF) + R6
for p in "' UNION SELECT NULL,version()--" "1' OR '1'='1" "<script>alert(1)</script>" \
         "1=1" "<img src=x onerror=alert(1)>" "admin'--" ; do
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -G "$BASE/api/search" --data-urlencode "q=$p")
  [ "$c" = "403" ] && printf "${R}403${N} " || printf "%s " "$c"
done
# b) accès /etc/passwd — "/" LITTÉRAL (garantit R6 → T1003.008) ; 7 variantes
for u in \
  "file=/etc/passwd" "path=/etc/passwd" "file=../../etc/passwd" "path=../../../etc/passwd" \
  "include=/etc/passwd" "page=/etc/passwd" "doc=../../../../etc/passwd" ; do
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$BASE/api/search?$u")
  [ "$c" = "403" ] && printf "${R}403${N} " || printf "%s " "$c"
done
echo ; printf "   légitime /api/health → "; c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health"); echo -e "${G}${c}${N}"
echo ""

# --- 2) DÉTECTION — ingestion (~90s) puis on FORCE le cycle (pas d'attente) --
echo -e "${B}[2] Ingestion des logs (~90s incompressible), puis je force le cycle de détection…${N}"
sleep 90                                   # laisse le sink écrire les logs de l'attaque
echo -e "   …je déclenche normalisation + règles R2/R6 (au lieu d'attendre 5 min)"
force_pipeline
DETOK=0
for i in $(seq 1 12); do                   # filet de 6 min ; re-force à mi-parcours
  pw=$(bq_q "SELECT COUNT(*) FROM \`$P.$DS.detections\` WHERE entity='$MYIP' AND timestamp > TIMESTAMP_SECONDS($T0) AND message LIKE '%etc/passwd%'")
  any=$(bq_q "SELECT COUNT(*) FROM \`$P.$DS.detections\` WHERE entity='$MYIP' AND timestamp > TIMESTAMP_SECONDS($T0)")
  if [ "${pw:-0}" -gt 0 ] 2>/dev/null; then
    echo -e "   ${G}✓ détection /etc/passwd présente à $(( ($(date +%s)-T0) ))s (→ T1003.008)${N}"; DETOK=1; break
  fi
  [ "${any:-0}" -gt 0 ] 2>/dev/null && echo -e "   ${Y}(détection présente, /etc/passwd pas encore — je re-force)${N}"
  [ $i -eq 4 ] && force_pipeline           # re-force si toujours rien
  printf "   …%ss\r" "$(( $(date +%s)-T0 ))"; sleep 25
done
[ $DETOK -eq 0 ] && { echo -e "${Y}Détection /etc/passwd pas confirmée — vérifie manuellement (la détection existe peut-être).${N}"; }
echo ""

# --- 3) ENRICHISSEMENT FORCÉ (~74s au lieu de 15 min), re-forcé si besoin ---
echo -e "${B}[3] Qualification ATT&CK — je déclenche le job d'analyse (temps réel)…${N}"
Q=""
for essai in 1 2 3; do
  gcloud run jobs execute menal-enrich-job-staging --project=$P --region=europe-west1 --wait >/dev/null 2>&1
  sleep 8
  Q=$(bq_q "WITH d AS (SELECT id FROM \`$P.$DS.detections\` WHERE entity='$MYIP' AND timestamp > TIMESTAMP_SECONDS($T0)) SELECT technique_id, ROUND(similarity,3) FROM \`$P.$DS.alert_enrichment\` e WHERE e.detection_id IN (SELECT id FROM d) AND status='mapped' ORDER BY similarity DESC LIMIT 3")
  [ -n "$Q" ] && break
  echo -e "   ${Y}…pas encore de candidat mapped, je relance le job (essai $essai/3)${N}"
done
echo -e "   ${G}✓ enrichissement exécuté${N}"

# --- 4) VÉRIF QUALIFICATION -----------------------------------------------
if [ -n "$Q" ]; then echo -e "   ${G}✓ candidats ATT&CK proposés :${N}"; echo "$Q" | sed 's/^/     /'
else echo -e "   ${Y}(candidat sous le seuil pour cette attaque — la détection reste montrable ;\n     relance avec plus de /etc/passwd pour obtenir T1003.008)${N}"; fi
echo ""

# --- PRÊT ------------------------------------------------------------------
echo -e "${C}══ PRÊT en $(( ($(date +%s)-T0)/60 ))min$(( ($(date +%s)-T0)%60 ))s — montre le dashboard maintenant ══${N}"
echo -e "   Détections → ta ligne (IP $MYIP) · Incident → 'Le socle propose' · clic 'Vrai positif'"
echo -e "   ${Y}Cohérence : lis à l'écran l'HEURE et le NOMBRE affichés, ne récite pas.${N}"
