#!/bin/bash
# =============================================================================
# SCRIPT DE CAPTURE — preuves des chaînes IAM, isolation BDD et données
# =============================================================================
# Compagnon de GUIDE_CAPTURE_PREUVES.md. Joue les plans P1 à P12 avec un titre
# et une PAUSE avant chacun (Entrée quand ta narration est prête).
#
# Tout est en LECTURE SEULE : aucune commande n'écrit, ne supprime ni ne
# déploie quoi que ce soit. Aucun jeton ni valeur de secret n'est affiché.
#
# Usage :   bash scripts/preuves-chaines.sh          (tous les plans)
#           bash scripts/preuves-chaines.sh P4       (un seul plan)
#           bash scripts/preuves-chaines.sh S3       (un segment : S2, S3 ou S4)
# Prérequis : gcloud + bq authentifiés sur mansour.cheikh2010@gmail.com.
# Écran : thème sombre, police ≥ 16 px, fenêtre ~110 colonnes.
# =============================================================================

PROJET="menal-zero-trust-staging"
REGION="europe-west1"
DS="menal_security_staging"
SAS="sa-api sa-cicd sa-pipeline sa-enrich-job sa-elson sa-dashboard-staging"
SERVICES="menal-api-staging menal-dashboard-staging elson-api-staging elson-web-staging menal-ml-embed-staging"

G='\033[1;32m'; R='\033[1;31m'; C='\033[1;36m'; Y='\033[1;33m'; B='\033[1m'; N='\033[0m'

SEL="${1:-ALL}"

pause() { echo ""; read -p "$(echo -e "${Y}   ↳ [Entrée] pour le plan suivant…${N}")" _; echo ""; }
titre() { clear; echo ""; echo -e "${C}══════════════════════════════════════════════════════════════${N}"; echo -e "${C}  $1${N}"; echo -e "${C}══════════════════════════════════════════════════════════════${N}"; echo ""; }
dire()  { echo ""; echo -e "   ${B}À dire :${N} $1"; }

# Joue le plan $1 s'il est sélectionné (tous, ce plan, ou son segment $2).
veut() { [ "$SEL" = "ALL" ] || [ "$SEL" = "$1" ] || [ "$SEL" = "$2" ]; }

bqq() { bq query --project_id="$PROJET" --use_legacy_sql=false --format="$1" "$2"; }

# -----------------------------------------------------------------------------
titre "PRÉPARATION — compte et projet (hors caméra)"
gcloud config set account mansour.cheikh2010@gmail.com 2>/dev/null
gcloud config set project "$PROJET" 2>/dev/null
gcloud config list 2>/dev/null | grep -E "account|project"
echo ""
echo -e "   ${G}Prêt.${N}  Tout ce qui suit est en lecture seule."
echo -e "   ${Y}RAPPEL : ne jamais exécuter 'gcloud auth print-access-token' ni${N}"
echo -e "   ${Y}'gcloud secrets versions access' pendant la captation.${N}"
pause

# ═══════════════════════════ SEGMENT S2 — CHAÎNE IAM ═════════════════════════

if veut P1 S2; then
titre "P1 — Sept identités nommées, aucune identité par défaut"
gcloud iam service-accounts list --project="$PROJET" --format="value(email)" | sort
dire "Chaque composant a sa propre identité. Aucun ne tourne sous le compte par défaut du projet."
pause
fi

if veut P2 S2; then
titre "P2 — Aucune clé de compte de service : il n'y a rien à voler"
for sa in $SAS; do
  n=$(gcloud iam service-accounts keys list --managed-by=user --project="$PROJET" \
        --iam-account="$sa@$PROJET.iam.gserviceaccount.com" --format="value(name)" 2>/dev/null | wc -l)
  if [ "$n" -eq 0 ]; then printf "   %-24s ${G}%s clé utilisateur${N}\n" "$sa" "$n"
  else                    printf "   %-24s ${R}%s clé(s) — À TRAITER${N}\n" "$sa" "$n"; fi
done
dire "Le risque classique d'une chaîne CI/CD, c'est le fichier de clé qui ne périme jamais."
echo -e "            Ici il n'y en a aucun : uniquement des jetons OIDC de courte durée."
pause
fi

if veut P3 S2; then
titre "P3 — Le jeton n'est accepté que pour UN dépôt et UNE branche"
echo -n "   "
gcloud iam workload-identity-pools providers describe menal-github-provider \
  --project="$PROJET" --location=global --workload-identity-pool=menal-github-pool \
  --format="value(attributeCondition)" 2>/dev/null | tr -d '\r'
echo ""
dire "Deux verrous, et ils sont portés par Google, pas par GitHub. Une branche de"
echo -e "            fonctionnalité n'obtient jamais l'identité de déploiement."
pause
fi

if veut P4 S2; then
titre "P4 — Neuf secrets, un seul lecteur autorisé pour chacun"
for s in $(gcloud secrets list --project="$PROJET" --format="value(name)" 2>/dev/null | tr -d '\r'); do
  printf "   %-34s :: " "$s"
  gcloud secrets get-iam-policy "$s" --project="$PROJET" --format=json 2>/dev/null \
    | grep -o 'serviceAccount:sa-[a-z-]*' | sed 's/serviceAccount://' | sort -u | tr '\n' ' '
  echo ""
done
dire "sa-elson ne lit aucun secret MENAL, sa-api aucun secret ELSON. Et sa-cicd,"
echo -e "            qui déploie les deux, n'en lit aucun — il n'apparaît nulle part."
pause
fi

if veut P5 S2; then
titre "P5 — Le WAF ne se contourne pas : les URL run.app sont fermées"
for s in $SERVICES; do
  ing=$(gcloud run services describe "$s" --project="$PROJET" --region="$REGION" \
          --format="value(metadata.annotations['run.googleapis.com/ingress'])" 2>/dev/null | tr -d '\r')
  printf "   %-28s ingress=${G}%s${N}\n" "$s" "$ing"
done
dire "Le seul chemin d'entrée est le répartiteur, donc Cloud Armor. L'encodeur ML,"
echo -e "            lui, est en 'internal' : il n'est pas joignable depuis Internet du tout."
pause
fi

# ══════════════════════ SEGMENT S3 — ISOLATION DES BASES ═════════════════════

if veut P6 S3; then
titre "P6 — L'instance PostgreSQL n'a pas d'adresse publique"
gcloud sql instances describe menal-db-staging --project="$PROJET" \
  --format="table[box](databaseVersion,settings.ipConfiguration.ipv4Enabled:label=IPV4_PUBLIQUE,settings.ipConfiguration.sslMode,ipAddresses[0].ipAddress:label=ADRESSE,ipAddresses[0].type)" 2>/dev/null
dire "Pas d'IPv4 publique, adresse privée, TCP en clair rejeté. Depuis un poste de"
echo -e "            travail cette base est injoignable — y compris pour moi."
pause
fi

if veut P7 S3; then
titre "P7 — L'isolation est revérifiée automatiquement toutes les 24 h"
gcloud run jobs executions list --project="$PROJET" --region="$REGION" \
  --job=elson-sql-isolation-check-staging --limit=5 \
  --format="table[box](metadata.name:label=EXECUTION,status.conditions[0].type:label=ETAT,status.succeededCount:label=OK,metadata.creationTimestamp:label=DATE)" 2>/dev/null
dire "L'isolation est appliquée au runtime, donc hors Terraform : un 'terraform plan'"
echo -e "            propre ne prouve rien à son sujet. D'où ce contrôle quotidien."
pause
fi

if veut P8 S3; then
titre "P8 — Les six contrôles, dont un test RÉEL de connexion croisée"
gcloud logging read 'resource.labels.job_name="elson-sql-isolation-check-staging"' \
  --project="$PROJET" --limit=6 --freshness=2d --format="value(jsonPayload)" 2>/dev/null \
  | sed 's/}, {/\n/g' | sed "s/[][{}']//g" | grep "name:" \
  | sed -E 's/^.*detail: (.*), name: ([a-z_]+), ok: (True|False).*$/\3|\2|\1/' \
  | awk -F'|' '{printf "   [%s] %-44s %s\n", ($1=="True"?"OK":"KO"), $2, $3}'
dire "Les cinq premiers interrogent le catalogue PostgreSQL. Le sixième OUVRE"
echo -e "            vraiment une connexion elson_user vers menal_db et vérifie qu'elle est"
echo -e "            refusée. Une politique peut mentir ; une connexion refusée, non."
pause
fi

# ═══════════════════ SEGMENT S4 — DONNÉES ET BIGQUERY ════════════════════════

if veut P9 S4; then
titre "P9 — L'entonnoir : 228 654 lignes brutes → 117 alertes qualifiées"
bqq csv 'SELECT "raw_logs" AS table_, COUNT(*) AS lignes FROM `menal_security_staging.raw_logs`
 UNION ALL SELECT "access_logs", COUNT(*) FROM `menal_security_staging.access_logs`
 UNION ALL SELECT "security_events", COUNT(*) FROM `menal_security_staging.security_events`
 UNION ALL SELECT "detections", COUNT(*) FROM `menal_security_staging.detections`
 UNION ALL SELECT "alert_enrichment", COUNT(*) FROM `menal_security_staging.alert_enrichment`
 UNION ALL SELECT "analyst_verdicts", COUNT(*) FROM `menal_security_staging.analyst_verdicts`
 ORDER BY lignes DESC' 2>/dev/null | column -s, -t | sed 's/^/   /'
dire "Un facteur de réduction d'environ 1 950 entre la trace brute et ce qu'un"
echo -e "            analyste doit regarder. C'est la valeur d'un SIEM, et elle se mesure."
pause
fi

if veut P10 S4; then
titre "P10 — Le VRAI chiffre du WAF (et la part de bruit, annoncée soi-même)"
bqq csv 'WITH par_ip AS (
   SELECT source_ip, COUNT(*) n, COUNT(DISTINCT target_path) chemins,
          REGEXP_CONTAINS(source_ip,
            r"^(34|35|104\.19[6-9]|130\.211|108\.170|136\.11[2-9]|136\.12[0-7])\.") AS google
   FROM `menal_security_staging.security_events` GROUP BY 1)
 SELECT CASE WHEN chemins >= 50 AND NOT google THEN "1. balayage EXTERNE (Internet)"
             WHEN chemins >= 50 AND google     THEN "2. balayage depuis nos plages GCP (auto-tests)"
             WHEN chemins  = 1                 THEN "3. sonde repetitive (1 seul chemin)"
             ELSE "4. intermediaire (2-49 chemins)" END AS profil,
        COUNT(*) AS sources, SUM(n) AS evenements
 FROM par_ip GROUP BY 1 ORDER BY profil' 2>/dev/null | column -s, -t | sed 's/^/   /'
dire "La table contient ~62 700 blocages. Les deux tiers sont les sondes de disponibilité"
echo -e "            de Google refusées par le géo-blocage, et 11 192 viennent de NOS PROPRES"
echo -e "            campagnes de test lancées depuis GCP. Le chiffre que je défends est"
echo -e "            celui-ci : ${B}7 154 requêtes de balayage, 24 sources externes.${N}"
echo -e "   ${Y}Plan à ne pas sauter : c'est lui qui rend tous les autres chiffres crédibles.${N}"
pause
fi

if veut P11 S4; then
titre "P11 — Une campagne de balayage réelle, venue d'Internet"
bqq csv 'SELECT source_ip, COUNT(*) AS requetes, COUNT(DISTINCT target_path) AS chemins,
        FORMAT_TIMESTAMP("%m-%d %H:%M", MIN(timestamp)) AS premier,
        FORMAT_TIMESTAMP("%m-%d %H:%M", MAX(timestamp)) AS dernier
 FROM `menal_security_staging.security_events`
 WHERE NOT REGEXP_CONTAINS(source_ip,
         r"^(34|35|104\.19[6-9]|130\.211|108\.170|136\.11[2-9]|136\.12[0-7])\.")
 GROUP BY 1 HAVING chemins >= 50 ORDER BY requetes DESC LIMIT 5' 2>/dev/null | column -s, -t | sed 's/^/   /'
dire "433 chemins distincts en une minute depuis une seule adresse : ce n'est pas un"
echo -e "            utilisateur, c'est un scanner. Cette adresse n'appartient pas au projet :"
echo -e "            elle vient réellement d'Internet, et elle a été bloquée."
echo ""
echo -e "   ${Y}Le filtre sur les plages Google n'est pas cosmétique : sans lui, les 3 premières${N}"
echo -e "   ${Y}lignes sont nos propres tests (signature identique 1848 req / 1203 chemins).${N}"
pause
fi

if veut P12 S4; then
titre "P12 — Le parcours d'une alerte : la règle, le modèle, puis l'humain"
bqq prettyjson 'SELECT d.timestamp, d.rule_id, d.rule_name, d.severity, d.entity,
        d.mitre_technique, e.technique_id AS ml_technique,
        ROUND(e.similarity,3) AS ml_similarity, e.model_version, v.verdict
 FROM `menal_security_staging.detections` d
 LEFT JOIN `menal_security_staging.alert_enrichment` e ON d.id = e.detection_id
 LEFT JOIN `menal_security_staging.analyst_verdicts`  v ON d.entity = v.entity
 WHERE v.verdict IS NOT NULL ORDER BY d.timestamp DESC LIMIT 1' 2>/dev/null | sed 's/^/   /'
dire "La règle dit T1498, le modèle propose T1204.003 avec une similarité de 0,437,"
echo -e "            donc faible. Elles divergent — et c'est exactement pour ça que le modèle"
echo -e "            écrit dans une table séparée : il propose, il ne tranche pas."
echo ""
echo -e "   ${Y}Piège : la jointure se fait sur 'entity', pas sur l'id de détection.${N}"
echo -e "   ${Y}Sans LIMIT 1, un verdict posé sur une IP duplique toutes ses lignes.${N}"
pause
fi

# -----------------------------------------------------------------------------
titre "FIN — les trois chiffres à retenir"
echo -e "   ${B}0${N}         clé de compte de service (plan P2)"
echo -e "   ${B}7 154${N}     requêtes de balayage EXTERNES bloquées, 24 sources (plan P10)"
echo -e "   ${B}228 654 → 117${N}   lignes brutes ramenées à des alertes qualifiées (plan P9)"
echo ""
echo -e "   Segment S5 (attaque live) :  ${C}bash scripts/demo-tournage.sh${N}"
echo ""
