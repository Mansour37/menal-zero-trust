#!/bin/bash
# =============================================================================
# RESET ENTRE TENTATIVES — dashboard vierge pour re-tourner proprement
# =============================================================================
# À lancer AVANT chaque (nouvelle) tentative de tournage. Vide les détections
# (donc les incidents, qui en sont l'agrégation) et l'enrichissement, pour ne
# jamais montrer de données répétées d'une prise ratée. Backup automatique la
# première fois ; restauration à la fin avec restore.
#
# Usage :
#   bash scripts/demo-reset.sh backup     # 1 fois, avant toute tentative
#   bash scripts/demo-reset.sh wipe        # avant CHAQUE tentative (dashboard vierge)
#   bash scripts/demo-reset.sh restore     # à la fin, remet l'historique
#   bash scripts/demo-reset.sh status      # compte les lignes
# Env : Git Bash. Projet menal-zero-trust-staging.
# =============================================================================
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
P=menal-zero-trust-staging ; DS=menal_security_staging
Q(){ bq query --project_id=$P --use_legacy_sql=false "$@"; }
DET="\`$P.$DS.detections\`"
ENR="\`$P.$DS.alert_enrichment\`"
BAK="\`$P.$DS.detections_backup_tournage\`"

case "$1" in
  backup)
    echo "Backup des détections avant les tentatives…"
    Q "CREATE OR REPLACE TABLE $BAK AS SELECT * FROM $DET"
    echo "OK : sauvegarde dans detections_backup_tournage."
    ;;
  wipe)
    echo "⚠️  Vide détections + enrichissement (dashboard vierge). Backup requis au préalable."
    # TRUNCATE (pas DELETE) : le détecteur temps réel écrit en streaming, et BigQuery
    # refuse DELETE sur les lignes encore dans le streaming buffer (~30-90 min).
    # TRUNCATE, lui, vide la table malgré le buffer.
    Q "TRUNCATE TABLE $DET"
    Q "TRUNCATE TABLE $ENR"
    echo "OK : détections et incidents vidés. Lance ton attaque de démo maintenant."
    ;;
  restore)
    echo "Restauration de l'historique depuis le backup…"
    Q "INSERT INTO $DET SELECT * FROM $BAK
       WHERE id NOT IN (SELECT id FROM $DET)"
    echo "OK : détections restaurées."
    ;;
  status)
    Q --format=csv "SELECT 'detections' t, COUNT(*) n FROM $DET
                    UNION ALL SELECT 'enrichment', COUNT(*) FROM $ENR
                    UNION ALL SELECT 'backup', COUNT(*) FROM $BAK"
    ;;
  *)
    echo "Usage : bash scripts/demo-reset.sh {backup|wipe|restore|status}"
    ;;
esac
