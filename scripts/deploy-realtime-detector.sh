#!/bin/bash
# =============================================================================
# DÉPLOIEMENT DU DÉTECTEUR TEMPS RÉEL (composant de production)
# =============================================================================
# À lancer PAR TOI (le déploiement d'un composant qui écrit dans la table de
# preuves est réservé — garde-fou d'intégrité). L'image est déjà buildée et
# poussée. Ce script : déploie le job, autorise le scheduler, planifie à la minute.
#
# Résultat : un détecteur temps réel AUTOMATIQUE. Il lit les blocages Cloud Armor
# dans Cloud Logging (~20 s de fraîcheur) et écrit les détections R2/R3/R6 en ~1 min,
# sans que tu lances quoi que ce soit. Complément aux règles batch R1-R7.
#
# Usage :  bash scripts/deploy-realtime-detector.sh
# Env : Git Bash. gcloud sur menal-zero-trust-staging.
# =============================================================================
set -e
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
P=menal-zero-trust-staging
REGION=europe-west1
SA="sa-pipeline@${P}.iam.gserviceaccount.com"
JOB=menal-realtime-detector-staging
IMG="europe-west1-docker.pkg.dev/${P}/menal-docker-staging/menal-realtime-detector:v2"

echo "== 1/4  Déploiement du job Cloud Run (sous sa-pipeline) =="
gcloud run jobs deploy "$JOB" \
  --image "$IMG" \
  --service-account "$SA" \
  --region "$REGION" --project "$P" \
  --set-env-vars "GCP_PROJECT_ID=${P},BQ_DATASET_ID=menal_security_staging,R2_THRESHOLD=10,WINDOW_MIN=15,DEDUP_MIN=15" \
  --max-retries 1 --task-timeout 120

echo "== 2/4  Test manuel du job (doit écrire une détection si tu as attaqué récemment) =="
gcloud run jobs execute "$JOB" --region "$REGION" --project "$P" --wait

echo "== 3/4  Autoriser le scheduler à déclencher le job =="
gcloud run jobs add-iam-policy-binding "$JOB" \
  --member "serviceAccount:${SA}" --role roles/run.invoker \
  --region "$REGION" --project "$P"

echo "== 4/4  Planifier le détecteur toutes les minutes =="
gcloud scheduler jobs create http menal-realtime-detector-trigger \
  --location "$REGION" --project "$P" \
  --schedule "* * * * *" --time-zone "UTC" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${P}/jobs/${JOB}:run" \
  --http-method POST \
  --oauth-service-account-email "$SA" \
  || echo "(scheduler existe déjà — ok)"

echo ""
echo "✓ Détecteur temps réel DÉPLOYÉ et PLANIFIÉ (toutes les minutes)."
echo "  À partir de maintenant : une attaque → détection R6/R3/R2 en ~1 min, automatiquement."
echo "  Pour l'arrêter : gcloud scheduler jobs pause menal-realtime-detector-trigger --location $REGION --project $P"
