#!/bin/bash
# =============================================================================
# TEST DE BLOCAGE DES PORTES — prouve que CHAQUE porte de la chaîne arrête tout
# =============================================================================
# Pour chaque porte, on injecte UNE vraie faille sur une branche jetable, on
# ouvre une PR, et on montre la porte correspondante qui échoue (donc aucun
# déploiement possible). Puis on nettoie (PR fermée + branche supprimée).
#
# Usage :
#   bash demo/gate-tests/run-gate-test.sh secret     # porte Gitleaks (secret)
#   bash demo/gate-tests/run-gate-test.sh sast        # porte Semgrep (SAST)
#   bash demo/gate-tests/run-gate-test.sh pytest      # porte tests API
#   bash demo/gate-tests/run-gate-test.sh jest        # porte tests dashboard
#   bash demo/gate-tests/run-gate-test.sh trivy       # porte CVE image
#   bash demo/gate-tests/run-gate-test.sh clean <branche>   # nettoyage manuel
#
# Chaque lancement affiche l'URL du run et de la PR. La porte visée doit passer
# au ROUGE, et Build/Deploy ne se produit jamais. Git Bash + gh authentifié.
# =============================================================================
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
GATE="$1"
BASE="main"

if [ "$GATE" = "clean" ]; then
  BR="$2"
  [ -z "$BR" ] && { echo "Usage: ... clean <branche>"; exit 1; }
  echo "Fermeture PR + suppression de $BR ..."
  gh pr close "$BR" --delete-branch 2>/dev/null || git push origin --delete "$BR" 2>/dev/null || true
  git checkout "$BASE" 2>/dev/null || true
  echo "OK nettoyé."
  exit 0
fi

case "$GATE" in secret|sast|pytest|jest|trivy) ;; *)
  echo "Porte inconnue: '$GATE'. Choisis: secret | sast | pytest | jest | trivy"; exit 1 ;;
esac

BR="gate-test/${GATE}-$(date +%s)"
echo "== Branche jetable $BR (depuis $BASE) =="
git fetch -q origin "$BASE"
git checkout -q -b "$BR" "origin/$BASE"

case "$GATE" in
  secret)
    # Secret GÉNÉRIQUE haute entropie (détecté par Gitleaks generic-api-key).
    # Généré à la volée : rien de sensible n'est stocké dans le dépôt.
    S="$(head -c 30 /dev/urandom | base64 | tr -d '=/+' | cut -c1-40)"
    cat > api/app/_leaked_config.py <<EOF
# FAILLE VOLONTAIRE — test de la porte Gitleaks. NE JAMAIS FUSIONNER.
secret_key = "${S}"
api_token  = "${S}"
EOF
    TARGET="Gitleaks - Secret Scanning" ; JOB="Security Scans" ;;
  sast)
    cp "$HERE/poison/sast.py.tmpl" api/app/_gate_sast.py
    TARGET="Semgrep - SAST" ; JOB="Security Scans" ;;
  pytest)
    cp "$HERE/poison/test_gate.py.tmpl" api/tests/test_gate_block.py
    TARGET="Run API unit tests" ; JOB="Unit Tests" ;;
  jest)
    mkdir -p dashboard/src/__tests__
    cp "$HERE/poison/gate.test.ts.tmpl" dashboard/src/__tests__/gateBlock.test.ts
    TARGET="Run dashboard unit tests" ; JOB="Dashboard Unit Tests" ;;
  trivy)
    # PyYAML 5.3.1 = CVE-2020-14343 (CRITICAL, corrigée en 5.4) : Trivy la voit
    # dans l'image et bloque (fixable, donc non ignorée par --ignore-unfixed).
    echo 'PyYAML==5.3.1  # FAILLE VOLONTAIRE - test porte Trivy (CVE-2020-14343 CRITICAL)' >> api/requirements.txt
    TARGET="Trivy - CVE Scan (bloquant sur CRITICAL)" ; JOB="Build & Deploy API" ;;
esac

git add -A
git commit -q -m "test(gate:${GATE}): faille volontaire pour prouver le blocage de la porte"
git push -q -u origin "$BR"

PR_URL=$(gh pr create --base "$BASE" --head "$BR" \
  --title "TEST porte ${GATE} — À FERMER (faille volontaire)" \
  --body "PR jetable de démonstration : prouve que la porte **${JOB} / ${TARGET}** bloque la chaîne. **NE PAS FUSIONNER.** Nettoyage : \`bash demo/gate-tests/run-gate-test.sh clean ${BR}\`" \
  2>&1 | tail -1)
echo ""
echo "PR ouverte : $PR_URL"
echo "Porte visée : ${JOB} → ${TARGET} (doit passer au ROUGE)"
echo ""
echo "Suivre le run :   gh run watch \$(gh run list --branch $BR --limit 1 --json databaseId -q '.[0].databaseId')"
echo "Nettoyer ensuite: bash demo/gate-tests/run-gate-test.sh clean $BR"
git checkout -q "$BASE" 2>/dev/null || true
