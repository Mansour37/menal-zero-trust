#!/usr/bin/env bash
# =============================================================================
# produce_evidence.sh — produit les sorties brutes des preuves du rapport PFE.
#
# Chaque preuve est ecrite a l ecran ET archivee en .txt, conformement a la
# regle 8 de l annexe H : « conserver la sortie brute a cote de chaque capture,
# afin qu un tiers puisse recouper le contenu de l image ».
#
# Le bandeau porte systematiquement un horodatage UTC : la regle 3 de la meme
# annexe exige que l horodatage figure DANS le cadre capture, pas seulement en
# legende. Capturez donc l ecran bandeau compris.
#
# Toutes les commandes sont en LECTURE SEULE. Aucune n ecrit dans les tables de
# preuves. Voir NOTE_RESTAURATION ci-dessous pour le seul cas d ecriture, qui
# reste volontairement manuel.
#
# Usage :
#   ./scripts/produce_evidence.sh            # liste les preuves disponibles
#   ./scripts/produce_evidence.sh k21        # produit une preuve
#   ./scripts/produce_evidence.sh k21 k06    # plusieurs
#   ./scripts/produce_evidence.sh all        # toutes les preuves automatisables
# =============================================================================
set -uo pipefail

PROJECT="${MENAL_PROJECT:-menal-zero-trust-staging}"
DATASET="${MENAL_DATASET:-menal_security_staging}"
ARCHIVE="detections_archive_pre_20260824"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTDIR="${MENAL_EVIDENCE_OUT:-$HERE/../rapport PFE/preuves}"
mkdir -p "$OUTDIR"

RC_GLOBAL=0

banner() {
  echo "=================================================================="
  echo " PREUVE $1"
  echo " $2"
  echo " ---"
  echo " genere le : $(date -u '+%Y-%m-%d %H:%M:%S') UTC"
  echo " projet    : $PROJECT"
  echo " dataset   : $DATASET"
  echo "=================================================================="
  echo
}

# bq_query <sql> — lecture seule, format lisible a l ecran
bq_query() {
  bq query --project_id="$PROJECT" --use_legacy_sql=false \
           --format=pretty --max_rows=100 --quiet "$1"
}

footer() {
  local rc="$1"
  echo
  echo "------------------------------------------------------------------"
  echo " code de retour : $rc"
  echo " fin            : $(date -u '+%Y-%m-%d %H:%M:%S') UTC"
  echo "------------------------------------------------------------------"
}

# emit <KID> <titre> <fonction>
emit() {
  local kid="$1" titre="$2" fn="$3"
  local file="$OUTDIR/${kid}.txt"
  {
    banner "$kid" "$titre"
    "$fn"
    local rc=$?
    footer "$rc"
    return $rc
  } 2>&1 | tee "$file"
  local rc=${PIPESTATUS[0]}
  echo
  echo ">> sortie brute archivee : $file"
  echo
  [ "$rc" -ne 0 ] && RC_GLOBAL=1
  return 0
}

# --------------------------------------------------------------------------
# K21 — alerte R2 du 19/08/2026 a 16:56:08 UTC, 13 requetes bloquees.
#
# ATTENTION : les lignes du 19/08 ont ete effacees de `detections` le
# 24/08/2026 par un « DELETE ... WHERE TRUE » lance depuis le compte
# d administration (verifie dans INFORMATION_SCHEMA.JOBS_BY_PROJECT). Elles ont
# ete recuperees par time travel et figent dans la table d archive. La requete
# ci-dessous interroge donc l archive, qui est la source de verite pour cette
# preuve tant que la restauration n a pas ete appliquee.
# --------------------------------------------------------------------------
k21() {
  echo "Source : $DATASET.$ARCHIVE"
  echo "(archive figee des detections anterieures au 24/08/2026)"
  echo
  bq_query "
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', timestamp) AS horodatage_utc,
      rule_id, severity, entity, service,
      mitre_tactic, mitre_technique,
      message
    FROM \`$PROJECT.$DATASET.$ARCHIVE\`
    WHERE DATE(timestamp) = '2026-08-19'
      AND rule_id = 'R2'
    ORDER BY timestamp"
}

# --------------------------------------------------------------------------
# K06 — dernier rattachement du 19/08/2026 a 12:16:15 UTC, T1556.003, 0,698.
# Verifie present dans alert_enrichment (table non effacee).
# --------------------------------------------------------------------------
k06() {
  echo "Source : $DATASET.alert_enrichment"
  echo
  bq_query "
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', timestamp) AS horodatage_utc,
      technique_id, tactic,
      ROUND(similarity, 4) AS similarite,
      status, model_version
    FROM \`$PROJECT.$DATASET.alert_enrichment\`
    WHERE DATE(timestamp) = '2026-08-19'
      AND FORMAT_TIMESTAMP('%H:%M', timestamp) = '12:16'
    ORDER BY timestamp"
}

# --------------------------------------------------------------------------
# Integrite de la chaine de preuve — contre-preuve documentaire.
# Liste les effacements subis par la table des detections. Utile en soutenance :
# le rapport annonce en §5.5.1 qu une identite d administration peut encore
# modifier les preuves ; ceci le demontre, au lieu de le supposer.
# --------------------------------------------------------------------------
integrite() {
  echo "Historique des effacements sur la table des detections"
  echo "Source : region-europe-west1.INFORMATION_SCHEMA.JOBS_BY_PROJECT"
  echo
  bq_query "
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', creation_time) AS quand_utc,
      statement_type,
      user_email,
      total_modified_partitions AS partitions_touchees
    FROM \`region-europe-west1\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
    WHERE statement_type IN ('DELETE','TRUNCATE_TABLE','DROP_TABLE')
      AND LOWER(query) LIKE '%detections%'
    ORDER BY creation_time DESC
    LIMIT 40"
}

# --------------------------------------------------------------------------
# Etat de conservation des preuves — a lancer regulierement.
# --------------------------------------------------------------------------
etat() {
  echo "Volumetrie et plage temporelle des tables de preuves"
  echo
  bq_query "
    SELECT 'detections (live)' AS table_source,
           COUNT(*) AS lignes,
           CAST(MIN(DATE(timestamp)) AS STRING) AS du,
           CAST(MAX(DATE(timestamp)) AS STRING) AS au
    FROM \`$PROJECT.$DATASET.detections\`
    UNION ALL
    SELECT 'detections (archive)', COUNT(*),
           CAST(MIN(DATE(timestamp)) AS STRING),
           CAST(MAX(DATE(timestamp)) AS STRING)
    FROM \`$PROJECT.$DATASET.$ARCHIVE\`
    UNION ALL
    SELECT 'alert_enrichment', COUNT(*),
           CAST(MIN(DATE(timestamp)) AS STRING),
           CAST(MAX(DATE(timestamp)) AS STRING)
    FROM \`$PROJECT.$DATASET.alert_enrichment\`
    UNION ALL
    SELECT 'security_events', COUNT(*),
           CAST(MIN(DATE(timestamp)) AS STRING),
           CAST(MAX(DATE(timestamp)) AS STRING)
    FROM \`$PROJECT.$DATASET.security_events\`
    ORDER BY table_source"
}

# --------------------------------------------------------------------------
# K02 — porte d analyse statique du 19/08/2026 : 612 regles sur 439 fichiers,
# 74 constats, code de sortie 1. Les journaux de la forge sont conserves
# 90 jours par defaut : l execution du 19/08 reste lisible jusque mi-novembre.
#
# NB : le rapport annoncait 438 fichiers ; le journal reel dit 439. Corrige
# dans le rapport le 28/08/2026 (registre C49).
# --------------------------------------------------------------------------
k02() {
  local run_id="${MENAL_CI_RUN_ID:-32265394559}"
  echo "Execution CI : $run_id (19/08/2026, « CI - Build & Deploy », en echec)"
  echo "Source : journaux de la forge logicielle"
  echo
  command -v gh >/dev/null 2>&1 || { echo "gh absent du PATH"; return 127; }
  gh run view "$run_id" --log 2>/dev/null \
    | grep -iE "Scanning [0-9]+ files|Scan Summary|Findings:|Ran [0-9]+ rules|Process completed with exit" \
    | sed 's/\t/  /g'
}

# --------------------------------------------------------------------------
# K16 — cloisonnement de l identite du locataire : deux roles exactement.
# Seule la PREMIERE moitie du protocole est automatisee ici. La tentative
# d usurpation reste manuelle a dessein : si elle reussissait, la commande
# imprimerait un jeton d acces, qu il ne faut ni afficher ni archiver.
# --------------------------------------------------------------------------
k16() {
  local sa="sa-elson@${PROJECT}.iam.gserviceaccount.com"
  echo "Roles projet du compte de service du locataire"
  echo "Compte : $sa"
  echo
  gcloud projects get-iam-policy "$PROJECT" \
    --flatten="bindings[].members" \
    --filter="bindings.members:$sa" \
    --format="value(bindings.role)"
  local rc=$?
  echo
  echo "Attendu : exactement deux roles — cloudsql.client et logging.logWriter."
  echo
  echo "Second volet du protocole, A LANCER A LA MAIN (non automatise ici) :"
  echo "  gcloud auth print-access-token --impersonate-service-account=$sa"
  echo "Il doit ECHOUER. S il reussit, ne capturez pas : un jeton s afficherait."
  return $rc
}

# --------------------------------------------------------------------------
# K14 — test T1 du pare-feu applicatif : trois charges d attaque refusees en
# 403, une requete de controle legitime en 200. Rejoue EN DIRECT contre la
# recette (elson.menal-sarl.com, derriere Cloud Armor). C est un test actif,
# mais borne a quatre requetes et dirige contre VOTRE propre infrastructure.
#
# Verifie en direct le 28/08/2026 : 3x403 + 1x200. Le rejeu donne la date du
# jour ; la legende de la figure 18 (datee 23/08) doit alors etre mise a jour.
# --------------------------------------------------------------------------
k14() {
  local target="${MENAL_WAF_TARGET:-https://elson.menal-sarl.com}"
  echo "Cible : $target (pare-feu applicatif Cloud Armor)"
  echo

  # Un tir robuste : jusqu a 3 tentatives si curl renvoie 000 (echec de
  # connexion transitoire — Cloud Armor coupe parfois la connexion plutot que
  # de repondre 403). On ne re-essaie JAMAIS un code HTTP reel (un 403 reste
  # un 403), seulement l absence de reponse.
  waf_probe() {
    local label="$1"; shift
    local code=000 body_type="" i
    for i in 1 2 3; do
      read -r code body_type < <(curl -s -o /dev/null --max-time 15 \
        -w '%{http_code} %{content_type}' "$@" "$target/" 2>/dev/null; echo)
      [ "$code" != "000" ] && break
      sleep 2
    done
    printf "%s -> HTTP %s (%s)\n" "$label" "$code" "$body_type"
  }

  waf_probe "[SQLi] charge d injection SQL     " -G --data-urlencode "id=1' OR '1'='1"
  waf_probe "[XSS ] charge de script inter-site" -G --data-urlencode "q=<script>alert(1)</script>"
  waf_probe "[LFI ] charge d inclusion locale  " -G --data-urlencode "page=../../../../etc/passwd"
  waf_probe "[ OK ] requete de controle legitime"
  echo
  echo "Attendu : trois 403 (charges refusees au perimetre) puis un 200 (controle)."
}

# --------------------------------------------------------------------------
# K15 (volet historique) — test T2 : refus repetes sur la verification du
# second facteur, le 19/08/2026. Le rapport annonce dix 422 puis un 429.
#
# IMPORTANT : le controle a CHANGE depuis. Au 19/08 le limiteur applicatif
# etait serre et le chemin /auth/mfa/verify n etait pas couvert par la regle
# Cloud Armor (qui ne visait alors que /auth/token et /api/login). Un rejeu
# aujourd hui ne reproduit donc PAS « dix 422 + 429 » : le limiteur applicatif
# a ete elargi a 60/min et Cloud Armor (10/min + ban 5 min) garde desormais ce
# chemin, renvoyant un 429 des la 11e requete mais un 401 (et non 422) sur les
# precedentes. La preuve honnete de T2 est donc la trace historique du 19/08,
# ci-dessous, et non un rejeu.
# --------------------------------------------------------------------------
k15() {
  echo "Statuts HTTP historiques sur /auth/mfa/verify le 19/08/2026"
  echo "Source : $DATASET.run_googleapis_com_requests (journal de la passerelle)"
  echo
  bq_query "
    SELECT
      httpRequest.status AS code_http,
      COUNT(*) AS nombre,
      MIN(FORMAT_TIMESTAMP('%H:%M:%S', timestamp)) AS premier_utc,
      MAX(FORMAT_TIMESTAMP('%H:%M:%S', timestamp)) AS dernier_utc
    FROM \`$PROJECT.$DATASET.run_googleapis_com_requests\`
    WHERE DATE(timestamp) = '2026-08-19'
      AND httpRequest.requestUrl LIKE '%/auth/mfa/verify%'
    GROUP BY code_http
    ORDER BY code_http"
  echo
  echo "Le 429 de la 11e tentative n apparait pas ici : au 19/08 il etait"
  echo "servi hors de ce journal. Aujourd hui il vient de Cloud Armor (10/min,"
  echo "ban 5 min) — verifiable en direct, mais avec des 401 et non des 422."
}

# --------------------------------------------------------------------------
# K07 — controle d isolation entre locataires : six verifications sur six.
# Rejoue le job en direct (source de verite), puis extrait sa sortie JSON.
# Verifie le 28/08/2026 : 6 checks ok, isolated=true.
# --------------------------------------------------------------------------
k07() {
  local job="elson-sql-isolation-check-staging"
  echo "Rejeu du controle d isolation : job $job"
  echo
  gcloud run jobs execute "$job" \
    --project="$PROJECT" --region="${MENAL_REGION:-europe-west1}" --wait 2>&1 \
    | grep -iE "successfully|failed|completed"
  echo
  echo "Resultat detaille (6 verifications) :"
  gcloud logging read "resource.labels.job_name=\"$job\"" \
    --project="$PROJECT" --limit=15 --freshness=10m --format=json 2>/dev/null \
    | python -c "import sys,json
d=json.load(sys.stdin)
for e in d:
    p=e.get('jsonPayload')
    if p and p.get('message')=='SQL_ISOLATION_CHECK':
        cs=p.get('checks',[])
        ok=sum(1 for c in cs if c.get('ok'))
        print(f'  isolated = {p.get(\"isolated\")}   ({ok}/{len(cs)} verifications reussies)')
        for c in cs:
            print(f'    [{\"OK\" if c.get(\"ok\") else \"KO\"}] {c.get(\"name\")}')
        break
else:
    print('  (sortie JSON pas encore ingeree ; relancer dans ~30 s)')" 2>&1
}

# --------------------------------------------------------------------------
# K23 — volet VERT de la figure 16 : porte d analyse statique « verte » le
# 16/08/2026 alors que Semgrep n a evalue AUCUNE regle. Preuve du faux vert.
# Verifie le 28/08 : etape Security Scans = success, mais Semgrep a leve
# « ValueError: invalid rule severity value: MEDIUM » (zero regle evaluee).
# --------------------------------------------------------------------------
k23() {
  local run_id="${MENAL_CI_GREEN_RUN_ID:-31969797991}"
  echo "Execution CI : $run_id (16/08/2026, « CI - Build & Deploy », VERTE)"
  echo "Source : journaux de la forge logicielle"
  echo
  command -v gh >/dev/null 2>&1 || { echo "gh absent du PATH"; return 127; }
  echo "Conclusion de l etape d analyse de securite :"
  gh run view "$run_id" --json jobs \
    --jq '.jobs[] | select(.name=="Security Scans") | "  Security Scans -> " + .conclusion' 2>/dev/null
  echo
  echo "Ce que la porte verte cachait (Semgrep n a evalue aucune regle) :"
  gh run view "$run_id" --log 2>/dev/null \
    | grep -iE "Traceback|ValueError.*severity|=== Running: SEMGREP" \
    | sed 's/\t/  /g;s/^ *Security Scans  UNKNOWN STEP  //' | head -4
}

# --------------------------------------------------------------------------
# K22 — planification d infrastructure sans difference : « No changes ».
# Verifie le 28/08/2026.
#
# Deux prerequis, sinon echec (constate) :
#  - Terraform 64 BITS : le binaire 32 bits (windows_386) plante sur
#    expiration_ms=7776000000. Chemin via MENAL_TF (defaut ci-dessous).
#  - Jeton du BON compte : le fichier ADC local pointe vers un autre compte
#    sans acces au bucket d etat (403). On force le compte gcloud actif.
# plan est en LECTURE SEULE (n applique rien).
# --------------------------------------------------------------------------
k22() {
  local tf="${MENAL_TF:-C:/Users/manso/terraform64/terraform.exe}"
  local dir="terraform/environments/staging"
  [ -x "$tf" ] || command -v "$tf" >/dev/null 2>&1 || {
    echo "Terraform 64 bits introuvable : $tf"
    echo "Telecharger terraform_1.14.9_windows_amd64.zip, ou definir MENAL_TF."
    return 127
  }
  echo "Terraform : $("$tf" version 2>/dev/null | head -1)"
  export GOOGLE_OAUTH_ACCESS_TOKEN
  GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null)
  [ -n "$GOOGLE_OAUTH_ACCESS_TOKEN" ] && echo "Jeton du compte actif : OK" || echo "Jeton : VIDE"
  echo
  "$tf" -chdir="$dir" init -input=false -reconfigure >/dev/null 2>&1 \
    && echo "init : OK" || { echo "init : ECHEC"; return 1; }
  echo
  "$tf" -chdir="$dir" plan -input=false -lock=false 2>&1 \
    | grep -iE "No changes|Plan: [0-9]|matches the configuration|Error:" | head -6
}

usage() {
  cat <<'USAGE'
Preuves automatisables depuis ce script (lecture seule) :

  k21        Alerte R2 du 19/08/2026 a 16:56:08 UTC, 13 requetes bloquees
             -> figure 21, page 63 du rapport (§6.7)
             SOURCE ARCHIVE : les lignes ont ete effacees le 24/08, cf. `integrite`

  k06        Rattachement du 19/08/2026 a 12:16:15 UTC, T1556.003, similarite 0,698
             -> figure 22, page 103 (annexe H)

  integrite  Historique des effacements subis par la table des detections
             (contre-preuve, non appelee par une figure : materiel de soutenance)

  etat       Volumetrie et plage temporelle des tables de preuves

  k02        Porte d analyse statique du 19/08/2026 (612 regles, 439 fichiers, 74 constats)
             -> figure 16 (panneau droit), page 51 (§5.10.2)

  k16        Deux roles exactement pour sa-elson ; volet usurpation reste manuel
             -> figure 19, page 55 (§6.2)

  all        k21 + k06 + k02 + k16 + integrite + etat

Preuves NON automatisables ici, et pourquoi :

  K07  Controle d isolation 6/6 — relancer
       elson-main/backend/src/scripts/sql-isolation-check.ts (job Cloud Run).
       La trace du 19/08 reste lisible dans Cloud Logging jusque vers le
       18/09/2026 (retention 30 jours du bucket _Default).

  K22  Planification d infrastructure — `terraform plan` sur la recette.
  K05  Vue des incidents — session navigateur sous un compte analyste.
  K14  Test T1 — envoi des charges d attaque depuis un poste externe.
  K15  Test T2 — onze requetes sur la verification du second facteur.
  K16  Deux roles + refus d usurpation — commandes IAM interactives.
  K20  Retour arriere par bascule de revision — operation sur le service.
  K23/K02  Executions de la chaine d integration — interface de la forge.

Variables d environnement : MENAL_PROJECT, MENAL_DATASET, MENAL_EVIDENCE_OUT.
USAGE
}

# --------------------------------------------------------------------------
# NOTE_RESTAURATION
# Les 646 lignes effacees ont ete sauvees dans la table d archive, mais ne sont
# PAS reinjectees dans `detections` par ce script : reecrire dans la table de
# preuves est une operation deliberee, qui doit rester un geste humain trace.
# La requete, idempotente, est la suivante :
#
#   INSERT INTO `<projet>.<dataset>.detections`
#   SELECT a.* FROM `<projet>.<dataset>.detections_archive_pre_20260824` a
#   WHERE NOT EXISTS (
#     SELECT 1 FROM `<projet>.<dataset>.detections` d WHERE d.id = a.id
#   )
# --------------------------------------------------------------------------

main() {
  if [ $# -eq 0 ]; then usage; exit 0; fi
  for arg in "$@"; do
    case "${arg,,}" in
      k21)       emit K21 "Alerte R2 du 19/08/2026 — 13 requetes bloquees en 15 min" k21 ;;
      k02)       emit K02 "Porte d analyse statique du 19/08/2026 — 612 regles, 439 fichiers, 74 constats" k02 ;;
      k16)       emit K16 "Deux roles exactement pour le compte du locataire" k16 ;;
      k14)       emit K14 "Test T1 du pare-feu applicatif — 3x403 + 1x200 (rejeu direct)" k14 ;;
      k15)       emit K15 "Test T2 — refus repetes sur le second facteur (trace 19/08)" k15 ;;
      k07)       emit K07 "Controle d isolation entre locataires — 6/6 (rejeu direct)" k07 ;;
      k23)       emit K23 "Faux vert de la porte SAST le 16/08 (Semgrep 0 regle)" k23 ;;
      k22)       emit K22 "Planification sans difference — No changes (64 bits + jeton)" k22 ;;
      k06)       emit K06 "Rattachement semantique du 19/08/2026 — T1556.003" k06 ;;
      integrite) emit INTEGRITE "Effacements subis par la table des detections" integrite ;;
      etat)      emit ETAT "Conservation des tables de preuves" etat ;;
      all)       main k21 k06 k02 k23 k16 k07 k14 k15 integrite etat ;;
      -h|--help|help) usage ;;
      *) echo "Preuve inconnue : $arg" >&2; usage >&2; RC_GLOBAL=1 ;;
    esac
  done
  exit $RC_GLOBAL
}

main "$@"
