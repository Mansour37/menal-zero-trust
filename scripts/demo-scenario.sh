#!/bin/bash
# =============================================================================
# SCÉNARIO DE DÉMONSTRATION PÉDAGOGIQUE — incident complet en une commande
# =============================================================================
# Support de cours : reconstitue UN incident type (attaque → détection →
# qualification) avec la CHRONOLOGIE RÉELLE de production (détection ~2 min après
# l'attaque, enrichissement ~10 min après), condensée pour une démo de 3-4 min.
# Les techniques MITRE et le modèle sont RÉELS ; seule la chronologie est
# reconstituée pour l'enseignement (comme un jeu de données de démo).
#
# Les horodatages sont écrits DANS LE PASSÉ (« il y a N min »), jamais dans le
# futur : la timeline du dashboard reste cohérente à l'écran.
#
# Usage :  bash scripts/demo-scenario.sh                 # IP de démo, défauts
#          bash scripts/demo-scenario.sh <IP> <DET_AGO_MIN> <ENR_AGO_MIN>
#   Ex :   bash scripts/demo-scenario.sh 203.0.113.42 10 0
#          → détection horodatée "il y a 10 min", qualification "à l'instant".
# Env : Git Bash. À lancer PAR TOI (écriture réservée). Vider avant : demo-reset.sh wipe
# =============================================================================
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
P=menal-zero-trust-staging ; DS=menal_security_staging
IP="${1:-203.0.113.42}"          # 203.0.113.x = plage de documentation (RFC 5737)
DET_AGO="${2:-10}"               # âge de la détection en minutes (chronologie prod)
ENR_AGO="${3:-0}"                # âge de la qualification en minutes
G='\033[1;32m'; C='\033[1;36m'; Y='\033[1;33m'; N='\033[0m'
URL="https://elson.menal-sarl.com/api/search?file=/etc/passwd"   # /etc/passwd → T1003.008

echo -e "${C}══ SCÉNARIO DÉMO ══  entité=$IP  détection il y a ${DET_AGO} min  $(date -u +%H:%M:%S) UTC${N}"

# 1) Écrire les 3 détections (chronologie de prod, horodatage = il y a DET_AGO min)
echo -e "   écriture des détections (R6, R3, R2)…"
bq query --project_id=$P --use_legacy_sql=false "
INSERT INTO \`$P.$DS.detections\`
(timestamp, rule_id, rule_name, severity, entity, message, source, raw_log, mitre_tactic, mitre_technique, service, id)
SELECT * FROM UNNEST([
  STRUCT(
    TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${DET_AGO} MINUTE) AS timestamp,
    'R6' AS rule_id, 'Pattern injection detecte' AS rule_name, 'CRITICAL' AS severity, '$IP' AS entity,
    CONCAT('Pattern injectif (bloque par le WAF) sur ', '$URL', ' depuis ', '$IP') AS message,
    'cloud_armor' AS source, CAST(NULL AS STRING) AS raw_log, 'TA0001' AS mitre_tactic, 'T1190' AS mitre_technique,
    'elson-api-staging' AS service, TO_HEX(SHA256(CONCAT('R6|', '$IP', '|', CAST(CURRENT_TIMESTAMP() AS STRING), '|1'))) AS id),
  STRUCT(
    TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${DET_AGO} MINUTE),
    'R3', 'Path traversal', 'HIGH', '$IP',
    CONCAT('Tentative path traversal (bloquee par le WAF) sur ', '$URL', ' depuis ', '$IP'),
    'cloud_armor', CAST(NULL AS STRING), 'TA0001', 'T1190', 'elson-api-staging',
    TO_HEX(SHA256(CONCAT('R3|', '$IP', '|', CAST(CURRENT_TIMESTAMP() AS STRING), '|2')))),
  STRUCT(
    TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${DET_AGO} MINUTE),
    'R2', 'Pic WAF', 'MEDIUM', '$IP',
    CONCAT('13 requetes bloquees par Cloud Armor depuis ', '$IP', ' en 15 min'),
    'cloud_armor', CAST(NULL AS STRING), 'TA0040', 'T1498', 'elson-api-staging',
    TO_HEX(SHA256(CONCAT('R2|', '$IP', '|', CAST(CURRENT_TIMESTAMP() AS STRING), '|3'))))
])" 2>&1 | tail -1
echo -e "   ${G}✓ 3 détections écrites (horodatées il y a ${DET_AGO} min)${N}"

# 2) Qualification ATT&CK réelle : le job d'analyse enrichit (T1003.008 via /etc/passwd)
echo -e "   qualification ATT&CK (job d'analyse réel)…"
gcloud run jobs execute menal-enrich-job-staging --project=$P --region=europe-west1 --wait >/dev/null 2>&1
Q=$(bq query --project_id=$P --use_legacy_sql=false --format=csv "
WITH d AS (SELECT id FROM \`$P.$DS.detections\` WHERE entity='$IP'
           AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL $((DET_AGO+5)) MINUTE))
SELECT technique_id, ROUND(similarity,3) FROM \`$P.$DS.alert_enrichment\`
WHERE detection_id IN (SELECT id FROM d) AND status='mapped' ORDER BY similarity DESC LIMIT 3" 2>/dev/null | tail -n +2)
[ -n "$Q" ] && { echo -e "   ${G}✓ candidats ATT&CK :${N}"; echo "$Q" | sed 's/^/     /'; }

echo -e "${C}══ PRÊT — le dashboard montre l'incident de $IP ══${N}"
echo -e "   ${Y}À l'oral : « attaque détectée il y a ~${DET_AGO} min, qualifiée par le socle ».${N}"
echo -e "   ${Y}Score 100, 2 tactiques (T1190 Initial Access + T1498 Impact), T1003.008 en tête.${N}"
