#!/bin/bash
# =============================================================================
# PREUVE DU CONTENU DES DEUX BASES — elson_db et menal_db
# =============================================================================
# Repond a la question du jury : « qu'est-ce que chaque base heberge, et
# comment savez-vous qu'elles ne se melangent pas ? »
#
# Produit, pour CHAQUE base, trois pieces :
#   1. inventaire   — toutes les tables, leur volume et leur taille disque
#   2. structure    — les colonnes des tables metier (la NATURE de la donnee)
#   3. isolation    — les droits CONNECT croises, vus depuis la base elle-meme
#
# Tout passe par l'API d'administration Google (`gcloud sql export csv`) : les
# instances restent en IP privee, aucune connexion reseau n'est ouverte. Les
# requetes sont des AGREGATS et des METADONNEES — aucune donnee personnelle
# n'est extraite.
#
# Usage :   bash scripts/preuve-contenu-bases.sh
# Sortie :  preuves/bases-AAAA-MM-JJ/*.csv
# =============================================================================
set -euo pipefail

# Python sous Windows ecrit en cp1252 par defaut et casse sur les caracteres
# non-ASCII : on force UTF-8 pour les blocs de restitution.
export PYTHONIOENCODING=utf-8

PROJET="menal-zero-trust-staging"
INSTANCE="menal-db-staging"
REGION="europe-west1"
BUCKET="menal-preuve-bases-$(date -u +%s)"
DEST="preuves/bases-$(date -u +%F)"

G='\033[1;32m'; Y='\033[1;33m'; C='\033[1;36m'; N='\033[0m'
etape() { echo -e "\n${C}== $1${N}"; }

nettoyer() {
  if gcloud storage ls "gs://$BUCKET" >/dev/null 2>&1; then
    gcloud storage rm -r "gs://$BUCKET" >/dev/null 2>&1 && echo -e "\n   ${G}bucket temporaire supprime${N}"
  fi
}
trap nettoyer EXIT

# ── Requetes ────────────────────────────────────────────────────────────────
# Inventaire : reltuples est l'estimation du planificateur — suffisante pour
# montrer les ordres de grandeur sans scanner les tables.
Q_INVENTAIRE="SELECT c.relname AS table_,
       c.reltuples::bigint AS lignes,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS taille,
       (SELECT count(*) FROM information_schema.columns col
          WHERE col.table_schema='public' AND col.table_name=c.relname) AS colonnes
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r'
 ORDER BY c.reltuples DESC, c.relname"

# Structure : ce que la base heberge REELLEMENT, colonne par colonne.
Q_STRUCTURE="SELECT table_name AS table_,
       string_agg(column_name, ', ' ORDER BY ordinal_position) AS colonnes
  FROM information_schema.columns
 WHERE table_schema='public'
 GROUP BY table_name ORDER BY table_name"

# Isolation : pg_has_role et has_database_privilege sont a l'echelle du
# CLUSTER — une seule connexion suffit donc a constater l'etat des deux roles,
# sans avoir a joindre la base d'en face (qui doit justement rester fermee).
Q_ISOLATION="SELECT r.role AS role_, r.db AS base_,
       has_database_privilege(r.role, r.db, 'CONNECT') AS peut_se_connecter
  FROM (VALUES ('elson_user','elson_db'), ('elson_user','menal_db'),
               ('api_user','menal_db'),   ('api_user','elson_db')) AS r(role, db)
 UNION ALL
SELECT t.rolname, 'EST cloudsqlsuperuser',
       pg_has_role(t.rolname, 'cloudsqlsuperuser', 'member')
  FROM (VALUES ('api_user'), ('elson_user')) AS t(rolname)"

mkdir -p "$DEST"

etape "1/4 — Bucket temporaire et droit d'ecriture"
gcloud storage buckets create "gs://$BUCKET" --project="$PROJET" \
  --location="$REGION" --uniform-bucket-level-access >/dev/null
SA=$(gcloud sql instances describe "$INSTANCE" --project="$PROJET" \
       --format="value(serviceAccountEmailAddress)" | tr -d '\r')
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin" >/dev/null
echo -e "   ${G}gs://$BUCKET${N} — compte SQL autorise"

exporter() { # $1 = base, $2 = nom, $3 = requete
  gcloud sql export csv "$INSTANCE" "gs://$BUCKET/$1_$2.csv" \
    --database="$1" --project="$PROJET" --query="$3" >/dev/null
  echo -e "   ${G}$1_$2.csv${N}"
}

# Comptage EXACT de TOUTES les tables, sans liste ecrite a la main.
#
# Pourquoi c'est indispensable : `reltuples` (utilise par l'inventaire) n'est
# qu'une estimation du planificateur — il annoncait 8 516 audit_logs pour 9 248
# reels — et il vaut -1 tant qu'une table n'a JAMAIS ete analysee. Or -1
# ne veut pas dire « vide » : lire -1 comme « table vide » fait passer a cote
# de donnees bien presentes. D'ou ce comptage exhaustif.
#
# `query_to_xml` execute un COUNT(*) par table depuis une seule requete SQL,
# sans avoir a enumerer les tables ni ouvrir de connexion psql.
Q_VOLUMES="SELECT table_name,
       (xpath('/row/c/text()', xml_count))[1]::text::bigint AS lignes
  FROM (SELECT table_name,
               query_to_xml(format('SELECT count(*) AS c FROM %I.%I',
                                   table_schema, table_name), false, true, '') AS xml_count
          FROM information_schema.tables
         WHERE table_schema='public' AND table_type='BASE TABLE') t
 ORDER BY lignes DESC, table_name"

# Activite reelle cote ELSON : ce que les tables peuplees racontent. Agrege par
# type d'action — ni identifiant d'utilisateur, ni adresse IP, ni empreinte.
Q_ACTIVITE_ELSON="SELECT 'audit_log' AS source, action AS quoi, count(*)::text AS n,
       to_char(min(created_at),'YYYY-MM-DD') AS du, to_char(max(created_at),'YYYY-MM-DD') AS au
  FROM audit_log GROUP BY action
 UNION ALL
SELECT 'user_events', type, count(*)::text,
       to_char(min(at),'YYYY-MM-DD'), to_char(max(at),'YYYY-MM-DD')
  FROM user_events GROUP BY type
 UNION ALL
SELECT 'email_verifications', 'code emis', count(*)::text,
       to_char(min(created_at),'YYYY-MM-DD'), to_char(max(created_at),'YYYY-MM-DD')
  FROM email_verifications
 UNION ALL
SELECT 'otp_codes', purpose, count(*)::text,
       to_char(min(created_at),'YYYY-MM-DD'), to_char(max(created_at),'YYYY-MM-DD')
  FROM otp_codes GROUP BY purpose
 UNION ALL
SELECT 'tags', category, count(*)::text, '', '' FROM tags GROUP BY category
 UNION ALL
SELECT 'competition_config', 'cles de configuration', count(*)::text, '', ''
  FROM competition_config
 ORDER BY 1, 3 DESC"

etape "2/4 — Exports (metadonnees et agregats uniquement)"
for base in elson_db menal_db; do
  exporter "$base" inventaire "$Q_INVENTAIRE"
  exporter "$base" structure  "$Q_STRUCTURE"
  exporter "$base" volumes    "$Q_VOLUMES"
done
exporter elson_db activite  "$Q_ACTIVITE_ELSON"
exporter elson_db isolation "$Q_ISOLATION"

etape "3/4 — Telechargement vers $DEST"
gcloud storage cp "gs://$BUCKET/*.csv" "$DEST/" >/dev/null 2>&1
echo -e "   ${G}$(ls "$DEST"/*.csv | wc -l) fichiers${N}"

etape "4/4 — Stockage objet : l'audio d'ELSON"
# grep -c renvoie 1 quand il ne compte rien : sans le `|| true`, le `set -e`
# et un `|| echo 0` ajoutaient une seconde ligne parasite au CSV.
n=$(gcloud storage ls -r "gs://$PROJET-elson-media/**" 2>/dev/null | grep -c "^gs://" || true)
o=$(gcloud storage du -s "gs://$PROJET-elson-media/" 2>/dev/null | awk '{print $1}' || true)
printf 'bucket,objets,octets\n%s,%s,%s\n' "$PROJET-elson-media" "${n:-0}" "${o:-0}" \
  > "$DEST/elson_media_bucket.csv"
sed 's/^/   /' "$DEST/elson_media_bucket.csv"

# ── Restitution lisible ─────────────────────────────────────────────────────
echo ""
for base in elson_db menal_db; do
  echo -e "${C}══ $base — ce que cette base heberge ══${N}"
  # `gcloud sql export csv` n'ecrit PAS de ligne d'en-tete : on lit donc les
  # colonnes par position, jamais par nom.
  python - "$DEST/${base}_inventaire.csv" "$DEST/${base}_volumes.csv" <<'PY'
import csv, sys, os

exact = {}
if os.path.exists(sys.argv[2]):
    for r in csv.reader(open(sys.argv[2], encoding="utf-8")):
        if len(r) >= 2:
            exact[r[0]] = r[1]

rows = [r for r in csv.reader(open(sys.argv[1], encoding="utf-8")) if len(r) >= 4]
if not rows:
    print("   (aucune table)"); raise SystemExit

# `exact` couvre desormais TOUTES les tables (COUNT(*) reel). reltuples ne sert
# plus que de repli, et son -1 signifie « jamais analysee », jamais « vide ».
def lignes(nom, est):
    if nom in exact:
        return exact[nom]
    return "?" if est.strip() in ("-1", "-1.0") else est

peuplees = [r for r in rows if lignes(r[0], r[1]) not in ("?", "0")]
vides = len(rows) - len(peuplees)

print(f"   {'table':<30}{'lignes':>10}{'taille':>12}{'colonnes':>10}")
for r in peuplees[:20] or rows[:6]:
    print(f"   {r[0]:<30}{lignes(r[0], r[1]):>10}{r[2]:>12}{r[3]:>10}")
print(f"   -- {len(rows)} tables, dont {len(peuplees)} peuplees et {vides} "
      f"reellement vides (COUNT(*) = 0)")
PY
  echo ""
done

echo -e "${C}══ Isolation constatee depuis elson_db ══${N}"
python - "$DEST/elson_db_isolation.csv" <<'PY'
import csv, sys
for r in csv.reader(open(sys.argv[1], encoding="utf-8")):
    if len(r) < 3:
        continue
    role, cible, val = r[0], r[1], r[2].strip().lower()
    oui = val in ("t", "true")
    if cible.startswith("EST "):
        print(f"   {role:<12} membre de cloudsqlsuperuser  "
              f"{'OUI — PROBLEME' if oui else 'non'}")
    else:
        # Chaque role n'a droit QU'A sa propre base — table explicite, car
        # deduire "api_user -> menal_db" d'une comparaison de chaines echoue :
        # le prefixe du role ne porte pas le nom de sa base.
        SIENNE = {"elson_user": "elson_db", "api_user": "menal_db"}
        attendu = SIENNE.get(role) == cible
        etat = "peut se connecter" if oui else "REFUSE"
        verdict = "conforme" if oui == attendu else "ANOMALIE"
        print(f"   {role:<12} -> {cible:<10} {etat:<18} {verdict}")
PY

echo ""
echo -e "${G}Termine.${N} Pieces dans ${C}$DEST/${N}"
echo -e "${Y}A dire : chaque base heberge son propre metier — ELSON les contributions et${N}"
echo -e "${Y}l'audio, MENAL les comptes du dashboard et le journal d'audit. Et le tableau${N}"
echo -e "${Y}d'isolation montre qu'aucun des deux roles ne peut joindre la base d'en face.${N}"
