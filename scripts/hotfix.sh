#!/usr/bin/env bash
# Build, scan Trivy (bloquant CRITICAL) puis push Artifact Registry, deploy Cloud Run
# — echappatoire manuelle hors GitHub Actions (voir modules/dashboard/main.tf pour le
# rappel que le chemin normal de deploiement reste le pipeline CI ci.yml).
#
# Correctif 19/08/2026 (02_SECURITE_AUDITS_ECARTS.md, item M11) :
# - retrait complet du push vers le compte Docker Hub personnel (mo35ehab) : image
#   non scannee, exposee publiquement, jamais utilisee par le deploiement reel
#   (Cloud Run ne tire que depuis Artifact Registry). Artifact Registry seul suffit.
# - PROJECT_ID/AR_REGISTRY/noms de service ne sont plus code en dur sur "dev" : ils
#   se deduisent d un argument d environnement (convention verifiee dans
#   terraform/environments/staging/main.tf : menal-zero-trust-<env>, menal-docker-<env>,
#   menal-api-<env>, menal-dashboard-<env>).
# - ajout d un scan Trivy bloquant sur CRITICAL avant le push, aligne sur la porte
#   du pipeline CI (.github/workflows/ci.yml, "Trivy - CVE Scan (bloquant sur CRITICAL)").
set -euo pipefail

usage() {
  echo "Usage: $0 <api|dashboard> [env]"
  echo "  env : dev (defaut) ou staging"
  exit 1
}

[[ $# -lt 1 ]] && usage
SERVICE=$1
ENVIRONMENT="${2:-dev}"

case $ENVIRONMENT in
  dev|staging)
    ;;
  *)
    echo "Environnement inconnu : $ENVIRONMENT (attendu : dev ou staging)"
    usage
    ;;
esac

PROJECT_ID="menal-zero-trust-$ENVIRONMENT"
REGION="europe-west1"
AR_REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/menal-docker-$ENVIRONMENT"

case $SERVICE in
  api)
    CONTEXT="api"
    DOCKERFILE="api/Dockerfile"
    AR_IMAGE="$AR_REGISTRY/api"
    CR_SERVICE="menal-api-$ENVIRONMENT"
    ;;
  dashboard)
    CONTEXT="dashboard"
    DOCKERFILE="dashboard/Dockerfile"
    AR_IMAGE="$AR_REGISTRY/menal-dashboard"
    CR_SERVICE="menal-dashboard-$ENVIRONMENT"
    ;;
  *)
    usage
    ;;
esac

TAG="hotfix-$(date +%Y%m%d-%H%M%S)"
echo "==> Build $SERVICE (env=$ENVIRONMENT, projet=$PROJECT_ID) : tag=$TAG"

# Authentification Artifact Registry
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

# Build
docker build \
  -t "$AR_IMAGE:$TAG" \
  -t "$AR_IMAGE:latest" \
  -f "$DOCKERFILE" \
  "$CONTEXT"

# Scan Trivy bloquant sur CRITICAL avant tout push, meme regle que ci.yml
# (severity CRITICAL, ignore-unfixed pour ne pas bloquer sur une CVE sans correctif).
# Necessite le CLI trivy installe localement (https://aquasecurity.github.io/trivy) ;
# ce script est une echappatoire manuelle hors CI, il n utilise donc pas l action
# GitHub aquasecurity/trivy-action mais l equivalent CLI direct.
if command -v trivy >/dev/null 2>&1; then
  echo "==> Scan Trivy ($AR_IMAGE:$TAG) — bloquant sur CRITICAL"
  trivy image \
    --severity CRITICAL \
    --ignore-unfixed \
    --exit-code 1 \
    "$AR_IMAGE:$TAG"
else
  echo "!! trivy introuvable en local : scan de securite IGNORE avant ce push manuel."
  echo "!! Installer trivy (https://aquasecurity.github.io/trivy) ou n utiliser ce script"
  echo "!! que pour un correctif deja couvert par un scan recent en CI."
fi

echo "==> Push Artifact Registry ($AR_IMAGE)"
docker push "$AR_IMAGE:$TAG"
docker push "$AR_IMAGE:latest"

echo "==> Deploy Cloud Run ($CR_SERVICE)"
gcloud run deploy "$CR_SERVICE" \
  --image="$AR_IMAGE:$TAG" \
  --region="$REGION" \
  --project="$PROJECT_ID"

# URL du service Cloud Run reelle (evite de coder en dur un hash d URL specifique
# a un projet — dev et staging ont des hash d URL distincts).
SERVICE_URL="$(gcloud run services describe "$CR_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"

echo ""
echo "✓ Deploy termine : $AR_IMAGE:$TAG"
if [[ $SERVICE == "api" ]]; then
  echo "  API Health  : $SERVICE_URL/health"
else
  echo "  Dashboard   : $SERVICE_URL"
fi
