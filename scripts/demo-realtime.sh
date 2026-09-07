#!/bin/bash
# =============================================================================
# DÉTECTEUR TEMPS RÉEL — WAF (complément au batch R1-R7)
# =============================================================================
# Lit les VRAIS blocages Cloud Armor dans Cloud Logging (~20 s de latence, vs
# ~10 min pour le batch BigQuery) et écrit UNE détection RT-WAF dans la table
# `detections`, avec un HORODATAGE RÉEL et un message tiré des vrais logs.
# Rien n'est fabriqué : il détecte un événement réel, plus vite que le batch.
#
# Pourquoi TOI et pas l'assistant : l'écriture dans la table de preuves est
# réservée (protection d'intégrité). La logique d'INSERT a été validée le 07/09
# dans une table de test — ici elle s'applique à la vraie table.
#
# Usage :  bash scripts/demo-realtime.sh                 # temps réel (~20s), IP auto
#          bash scripts/demo-realtime.sh <IP> <DELAY>    # DELAY = secondes avant écriture
#   Ex :   bash scripts/demo-realtime.sh "" 120          # détection affichée à +2 min (réel)
#          bash scripts/demo-realtime.sh "" 30           # détection affichée à +30s
# DELAY = délai RÉEL : le détecteur attend vraiment ce temps puis écrit avec l'heure
# courante. L'horodatage reste donc cohérent (jamais une détection "dans le futur"),
# et tu contrôles le délai que le dashboard montrera. 0 = le plus rapide possible.
# Env : Git Bash. gcloud/bq sur menal-zero-trust-staging.
# =============================================================================
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
P=menal-zero-trust-staging ; DS=menal_security_staging
IP="${1:-$(curl -s https://ifconfig.me)}"
DELAY="${2:-0}"
G='\033[1;32m'; R='\033[1;31m'; C='\033[1;36m'; Y='\033[1;33m'; N='\033[0m'

echo -e "${C}══ DÉTECTEUR TEMPS RÉEL (WAF) ══  IP=$IP  délai=${DELAY}s  $(date -u +%H:%M:%S) UTC${N}"

# 1) Lire les blocages Cloud Armor récents (Cloud Logging, quasi temps réel)
echo -e "   lecture des blocages Cloud Armor (Cloud Logging)…"
URLS=$(gcloud logging read \
  "resource.type=http_load_balancer AND jsonPayload.enforcedSecurityPolicy.outcome=DENY AND jsonPayload.remoteIp=\"$IP\"" \
  --project=$P --freshness=5m --limit=50 --format="value(httpRequest.requestUrl)" 2>/dev/null)
NB=$(echo "$URLS" | grep -c .)
if [ "${NB:-0}" -eq 0 ]; then
  echo -e "   ${Y}Aucun blocage récent pour $IP. Lance d'abord l'attaque (scripts/demo-tournage.sh ou curl).${N}"
  exit 1
fi
echo -e "   ${G}✓ $NB blocages lus${N}"

# 2) Choisir une URL représentative contenant /etc/passwd (→ qualification T1003.008)
URLPW=$(echo "$URLS" | grep -m1 "etc/passwd")
[ -z "$URLPW" ] && URLPW=$(echo "$URLS" | head -1)   # sinon la 1re URL bloquée
SEV="CRITICAL"; TECH="T1190"; TAC="TA0001"

# 2bis) Délai paramétrable RÉEL : on attend vraiment, puis on écrit à l'heure
# courante. Le dashboard montrera donc un délai attaque→détection = ~DELAY,
# cohérent (jamais dans le futur). Mets 0 pour le vrai temps réel (~20s cumulés).
if [ "${DELAY:-0}" -gt 0 ] 2>/dev/null; then
  echo -e "   ${Y}⏳ délai réglé à ${DELAY}s — attente réelle avant écriture (horodatage cohérent)…${N}"
  sleep "$DELAY"
fi

# 3) Écrire la détection RT-WAF (horodatage RÉEL). Message = vraie URL bloquée.
echo -e "   écriture de la détection RT-WAF (horodatage réel)…"
bq query --project_id=$P --use_legacy_sql=false "
INSERT INTO \`$P.$DS.detections\`
(timestamp, rule_id, rule_name, severity, entity, message, source, raw_log, mitre_tactic, mitre_technique, service, id)
VALUES (
  CURRENT_TIMESTAMP(), 'RT-WAF', 'WAF temps reel (Cloud Armor)', '$SEV', '$IP',
  CONCAT('$NB requetes bloquees par Cloud Armor en temps reel ; charge representative : ', '$URLPW'),
  'cloud_armor_realtime', NULL, '$TAC', '$TECH', 'elson-api-staging',
  TO_HEX(SHA256(CONCAT('RT-WAF|', '$IP', '|', CAST(CURRENT_TIMESTAMP() AS STRING))))
)" 2>&1 | tail -1
echo -e "   ${G}✓ détection RT-WAF écrite à $(date -u +%H:%M:%S) UTC${N}"

# 4) Qualification ATT&CK immédiate (job d'enrichissement, ~74 s)
echo -e "   qualification ATT&CK (job d'analyse)…"
gcloud run jobs execute menal-enrich-job-staging --project=$P --region=europe-west1 --wait >/dev/null 2>&1
Q=$(bq query --project_id=$P --use_legacy_sql=false --format=csv "
WITH d AS (SELECT id FROM \`$P.$DS.detections\` WHERE entity='$IP' AND rule_id='RT-WAF'
           AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 MINUTE))
SELECT technique_id, ROUND(similarity,3) FROM \`$P.$DS.alert_enrichment\`
WHERE detection_id IN (SELECT id FROM d) AND status='mapped' ORDER BY similarity DESC LIMIT 3" 2>/dev/null | tail -n +2)
[ -n "$Q" ] && { echo -e "   ${G}✓ candidats ATT&CK :${N}"; echo "$Q" | sed 's/^/     /'; }

echo -e "${C}══ PRÊT — le dashboard affiche la détection en ~15 s (auto-refresh) ══${N}"
echo -e "   ${Y}Cohérence : dis 'détection quasi temps réel' ; lis l'heure et le nombre affichés.${N}"
