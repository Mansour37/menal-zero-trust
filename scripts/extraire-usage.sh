#!/bin/bash
# =============================================================================
# EXTRACTION DES PREUVES D'USAGE — menal_db + elson_db
# =============================================================================
# Rejoue l'extraction du 08/09/2026 (PREUVES_CHAINE_DONNEES.md §4.1) de bout en
# bout : bucket temporaire -> exports d'AGREGATS -> telechargement -> nettoyage.
#
# Ne sort de la base AUCUNE donnee nominative : que des COUNT() et des dates.
# L'instance reste en IP privee, jamais exposee — tout passe par l'API
# d'administration Google.
#
# Usage :   bash scripts/extraire-usage.sh
# Sortie :  preuves/exports-sql-AAAA-MM-JJ/*.csv
# =============================================================================
set -euo pipefail

PROJET="menal-zero-trust-staging"
INSTANCE="menal-db-staging"
REGION="europe-west1"
BUCKET="menal-preuve-usage-$(date -u +%s)"
DEST="preuves/exports-sql-$(date -u +%F)"

G='\033[1;32m'; Y='\033[1;33m'; C='\033[1;36m'; N='\033[0m'
etape() { echo -e "\n${C}== $1${N}"; }

# Le bucket est supprime meme si une etape echoue — pas de residu dans le projet.
nettoyer() {
  if gcloud storage ls "gs://$BUCKET" >/dev/null 2>&1; then
    etape "Nettoyage — suppression de gs://$BUCKET"
    gcloud storage rm -r "gs://$BUCKET" >/dev/null 2>&1 && echo -e "   ${G}bucket supprime${N}"
  fi
}
trap nettoyer EXIT

etape "1/5 — Bucket temporaire"
gcloud storage buckets create "gs://$BUCKET" --project="$PROJET" \
  --location="$REGION" --uniform-bucket-level-access >/dev/null
echo -e "   ${G}gs://$BUCKET${N}"

etape "2/5 — Droit d'ecriture pour le compte de service de l'instance"
SA=$(gcloud sql instances describe "$INSTANCE" --project="$PROJET" \
       --format="value(serviceAccountEmailAddress)" | tr -d '\r')
echo "   $SA"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin" >/dev/null
echo -e "   ${G}accorde${N}"

exporter() { # $1 = base, $2 = fichier, $3 = requete
  gcloud sql export csv "$INSTANCE" "gs://$BUCKET/$2" \
    --database="$1" --project="$PROJET" --query="$3" >/dev/null
  echo -e "   ${G}$2${N}"
}

etape "3/5 — Exports (agregats uniquement)"

exporter elson_db usage_elson.csv \
"SELECT 'utilisateurs' AS ind, COUNT(*)::text AS val FROM users
 UNION ALL SELECT 'contributeurs_distincts', COUNT(DISTINCT user_id)::text FROM contributions
 UNION ALL SELECT 'contributions', COUNT(*)::text FROM contributions
 UNION ALL SELECT 'contributions_approuvees', COUNT(*)::text FROM contributions WHERE status='approved'
 UNION ALL SELECT 'validations', COUNT(*)::text FROM validations
 UNION ALL SELECT 'phrases', COUNT(*)::text FROM phrases
 UNION ALL SELECT 'derniere_contribution', COALESCE(MAX(created_at)::text,'-') FROM contributions"

exporter menal_db usage_menal.csv \
"SELECT 'utilisateurs' AS ind, COUNT(*)::text AS val FROM users
 UNION ALL SELECT 'utilisateurs_actifs', COUNT(*)::text FROM users WHERE is_active
 UNION ALL SELECT 'mfa_active', COUNT(*)::text FROM users WHERE mfa_enabled
 UNION ALL SELECT 'roles', COUNT(*)::text FROM roles
 UNION ALL SELECT 'cles_api', COUNT(*)::text FROM api_keys
 UNION ALL SELECT 'entrees_audit', COUNT(*)::text FROM audit_logs
 UNION ALL SELECT 'audit_premier', COALESCE(MIN(created_at)::text,'-') FROM audit_logs
 UNION ALL SELECT 'audit_dernier', COALESCE(MAX(created_at)::text,'-') FROM audit_logs"

exporter menal_db audit_detail.csv \
"SELECT action, resource, COUNT(*)::text AS n, COUNT(DISTINCT user_id)::text AS users,
        COUNT(DISTINCT date(created_at))::text AS jours
 FROM audit_logs GROUP BY action, resource ORDER BY COUNT(*) DESC LIMIT 15"

etape "4/5 — Telechargement vers $DEST"
mkdir -p "$DEST"
gcloud storage cp "gs://$BUCKET/*.csv" "$DEST/" >/dev/null 2>&1
echo -e "   ${G}3 fichiers${N}"

etape "5/5 — Controle : aucune donnee nominative"
if grep -riqE "@|password|hash|secret" "$DEST"/*.csv; then
  echo -e "   ${Y}ATTENTION : contenu suspect, NE PAS versionner avant verification${N}"
else
  echo -e "   ${G}aucun e-mail, mot de passe ni hash — versionnable${N}"
fi

echo ""
for f in "$DEST"/*.csv; do
  echo -e "${C}--- $(basename "$f")${N}"
  cat "$f"
  echo ""
done
