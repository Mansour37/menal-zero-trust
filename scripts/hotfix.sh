#!/usr/bin/env bash
# Build, push Docker Hub + Artifact Registry, deploy Cloud Run — sans passer par GitHub Actions
set -euo pipefail

PROJECT_ID="menal-dev"
REGION="europe-west1"
AR_REGISTRY="europe-west1-docker.pkg.dev/menal-dev/menal-docker-dev"
DH_USER="mo35ehab"

usage() {
  echo "Usage: $0 <api|dashboard>"
  exit 1
}

[[ $# -lt 1 ]] && usage
SERVICE=$1

case $SERVICE in
  api)
    CONTEXT="api"
    DOCKERFILE="api/Dockerfile"
    AR_IMAGE="$AR_REGISTRY/api"
    DH_IMAGE="$DH_USER/menal-api"
    CR_SERVICE="menal-api-dev"
    ;;
  dashboard)
    CONTEXT="dashboard"
    DOCKERFILE="dashboard/Dockerfile"
    AR_IMAGE="$AR_REGISTRY/menal-dashboard"
    DH_IMAGE="$DH_USER/menal-dashboard"
    CR_SERVICE="menal-dashboard-dev"
    ;;
  *)
    usage
    ;;
esac

TAG="hotfix-$(date +%Y%m%d-%H%M%S)"
echo "==> Build $SERVICE : tag=$TAG"

# Authentification Artifact Registry
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

# Build avec les deux tags
docker build \
  -t "$AR_IMAGE:$TAG" \
  -t "$AR_IMAGE:latest" \
  -t "$DH_IMAGE:$TAG" \
  -t "$DH_IMAGE:latest" \
  -f "$DOCKERFILE" \
  "$CONTEXT"

echo "==> Push Docker Hub ($DH_IMAGE)"
docker push "$DH_IMAGE:$TAG"
docker push "$DH_IMAGE:latest"

echo "==> Push Artifact Registry ($AR_IMAGE)"
docker push "$AR_IMAGE:$TAG"
docker push "$AR_IMAGE:latest"

echo "==> Deploy Cloud Run ($CR_SERVICE)"
if [[ $SERVICE == "api" ]]; then
  gcloud run deploy "$CR_SERVICE" \
    --image="$AR_IMAGE:$TAG" \
    --region="$REGION" \
    --project="$PROJECT_ID"
else
  gcloud run deploy "$CR_SERVICE" \
    --image="$AR_IMAGE:$TAG" \
    --region="$REGION" \
    --project="$PROJECT_ID"
fi

echo ""
echo "✓ Deploy terminé : $DH_IMAGE:$TAG"
echo "  Docker Hub  : https://hub.docker.com/r/$DH_IMAGE/tags"
if [[ $SERVICE == "api" ]]; then
  echo "  API Health  : https://api.menal-sarl.com/health"
else
  echo "  Dashboard   : https://menal-dashboard-dev-5j4ih577pq-ew.a.run.app"
fi
