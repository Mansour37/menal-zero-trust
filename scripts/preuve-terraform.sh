#!/bin/bash
# =============================================================================
# PREUVE — Infrastructure as Code (Terraform)
# =============================================================================
# Repond a : « votre infrastructure est-elle vraiment decrite en code, et cette
# description est-elle fidele a ce qui tourne ? »
#
# Produit quatre pieces :
#   1. volumetrie du code      — fichiers, modules, lignes
#   2. inventaire de l'etat    — ressources par module et par type
#   3. securite du backend     — ou vit l'etat et comment il est protege
#   4. coherence code <-> etat — le backend declare est-il celui utilise ?
#
# Tout est en LECTURE SEULE. Aucun `apply`, aucun `init` qui migrerait l'etat.
#
# Usage :   bash scripts/preuve-terraform.sh
#           AVEC_PLAN=1 bash scripts/preuve-terraform.sh   (ajoute un plan reel)
# Sortie :  preuves/terraform-AAAA-MM-JJ/
# =============================================================================
set -uo pipefail

export PYTHONIOENCODING=utf-8

PROJET="menal-zero-trust-staging"
BUCKET_ETAT="menal-tf-state-staging"
PREFIXE="env/staging"
RACINE="terraform/environments/staging"
TF="${TF_BIN:-/c/terraform/terraform}"
DEST="preuves/terraform-$(date -u +%F)"

G='\033[1;32m'; R='\033[1;31m'; Y='\033[1;33m'; C='\033[1;36m'; N='\033[0m'
etape() { echo -e "\n${C}== $1${N}"; }

mkdir -p "$DEST"

# ── 1. Volumetrie du code ───────────────────────────────────────────────────
etape "1/4 — Le code"
# Terraform 32 bits : le provider google plante en lisant un horodatage en
# millisecondes (ex. 1786143883702), qui depasse l'entier signe 32 bits
# (2 147 483 647). Sur une machine 64 bits, installer la build windows_amd64.
ARCH_TF=$("$TF" version 2>/dev/null | sed -n '2p')
case "$ARCH_TF" in
  *386*) echo -e "   ${R}Terraform en $ARCH_TF — 32 bits : 'terraform plan' plantera${N}"
         echo -e "   ${Y}(strconv.ParseInt: value out of range sur un horodatage en ms).${N}"
         echo -e "   ${Y}Correctif : installer la build windows_amd64.${N}" ;;
  "")    : ;;
  *)     echo -e "   ${G}Terraform $ARCH_TF${N}" ;;
esac

NB_TF=$(find terraform -name "*.tf" | wc -l)
NB_MOD=$(ls -1 terraform/modules | wc -l)
NB_LIG=$(find terraform -name "*.tf" -exec cat {} + | wc -l)
{
  echo "indicateur,valeur"
  echo "fichiers_tf,$NB_TF"
  echo "modules,$NB_MOD"
  echo "lignes_tf,$NB_LIG"
} > "$DEST/code.csv"
printf "   %-28s %s\n" "fichiers .tf" "$NB_TF" "modules reutilisables" "$NB_MOD" "lignes de code" "$NB_LIG"

# ── 2. Inventaire de l'etat ─────────────────────────────────────────────────
etape "2/4 — L'etat : ce que Terraform gere reellement"
gcloud storage cp "gs://$BUCKET_ETAT/$PREFIXE/default.tfstate" "$DEST/etat.json" >/dev/null 2>&1 \
  || { echo -e "   ${R}etat illisible — compte gcloud sans acces au bucket ?${N}"; }

if [ -f "$DEST/etat.json" ]; then
python - "$DEST/etat.json" "$DEST" <<'PY'
import json, sys, csv, collections
s = json.load(open(sys.argv[1], encoding="utf-8")); dest = sys.argv[2]
res  = [r for r in s.get("resources", []) if r.get("mode") == "managed"]
data = [r for r in s.get("resources", []) if r.get("mode") == "data"]
inst = sum(len(r.get("instances", [])) for r in res)
mods = collections.Counter(r.get("module", "root").replace("module.", "") for r in res)
typs = collections.Counter(r["type"] for r in res)

print(f"   terraform {s.get('terraform_version')} · format d'etat v{s.get('version')} · serial {s.get('serial')}")
print(f"   {len(res)} ressources gerees · {inst} instances · {len(typs)} types · "
      f"{len(mods)} modules · {len(data)} sources de donnees")
print()
print("   modules les plus fournis :")
for m, n in mods.most_common(6):
    print(f"      {m:<22}{n:>4}")
print()
print("   types les plus frequents :")
for t, n in typs.most_common(6):
    print(f"      {t:<44}{n:>4}")

with open(f"{dest}/etat_resume.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["indicateur", "valeur"])
    for k, v in [("terraform_version", s.get("terraform_version")), ("serial", s.get("serial")),
                 ("ressources", len(res)), ("instances", inst), ("types", len(typs)),
                 ("modules", len(mods)), ("data_sources", len(data))]:
        w.writerow([k, v])
with open(f"{dest}/etat_par_module.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["module", "ressources"])
    for m, n in mods.most_common(): w.writerow([m, n])
with open(f"{dest}/etat_par_type.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["type", "ressources"])
    for t, n in typs.most_common(): w.writerow([t, n])
PY
  # L'etat contient des attributs sensibles (mots de passe generes) : on ne le
  # garde pas comme piece. Seuls les resumes agreges sont conserves.
  rm -f "$DEST/etat.json"
  echo -e "\n   ${Y}etat.json supprime apres analyse — il contient des secrets en clair${N}"
fi

# ── 3. Securite du backend ──────────────────────────────────────────────────
etape "3/4 — Ou vit l'etat, et comment il est protege"
gcloud storage buckets describe "gs://$BUCKET_ETAT" --project="$PROJET" --format=json 2>/dev/null \
  | python -c "
import sys, json, csv
d = json.load(sys.stdin)
champs = [('location','emplacement'), ('versioning_enabled','versioning'),
          ('uniform_bucket_level_access','acces uniforme (UBLA)'),
          ('public_access_prevention','blocage acces public'),
          ('default_kms_key','cle CMEK')]
w = csv.writer(open('$DEST/backend.csv','w',newline='',encoding='utf-8'))
w.writerow(['propriete','valeur'])
for cle, lib in champs:
    v = d.get(cle)
    v = 'aucune (chiffrement gere par Google)' if cle=='default_kms_key' and not v else v
    print(f'   {lib:<26} {v}')
    w.writerow([lib, v])
sd = d.get('soft_delete_policy') or {}
if sd.get('retentionDurationSeconds'):
    j = int(sd['retentionDurationSeconds'])//86400
    print(f'   {\"suppression differee\":<26} {j} jours')
    w.writerow(['suppression differee', f'{j} jours'])
" 2>/dev/null
echo -n "   dernier ecrit de l'etat     "
gcloud storage ls -l "gs://$BUCKET_ETAT/$PREFIXE/default.tfstate" 2>/dev/null \
  | awk 'NR==1{print $2}'

# ── 4. Coherence code <-> etat ──────────────────────────────────────────────
etape "4/4 — Le backend declare est-il celui reellement utilise ?"
DECLARE=$(grep -A3 'backend "gcs"' "$RACINE"/*.tf 2>/dev/null \
          | grep -oE 'bucket *= *"[^"]+"' | head -1 | sed 's/.*"\(.*\)"/\1/')
LOCAL=$(python -c "
import json
try:
    print(json.load(open('$RACINE/.terraform/terraform.tfstate',encoding='utf-8'))['backend']['config']['bucket'])
except Exception: print('(pas de .terraform local)')
" 2>/dev/null)
printf "   %-30s %s\n" "declare dans le code" "$DECLARE" "memorise en local" "$LOCAL" "reellement utilise" "$BUCKET_ETAT"
{ echo "source,bucket"; echo "code,$DECLARE"; echo "local,$LOCAL"; echo "reel,$BUCKET_ETAT"; } > "$DEST/backend_coherence.csv"

if [ "$DECLARE" != "$BUCKET_ETAT" ]; then
  echo -e "\n   ${R}ECART : le code declare un autre bucket que celui utilise.${N}"
  echo -e "   ${Y}Un 'terraform init' depuis un depot fraichement clone viserait '$DECLARE',${N}"
  echo -e "   ${Y}donc un etat different. Ca ne fonctionne aujourd'hui que grace au${N}"
  echo -e "   ${Y}repertoire .terraform/ local, qui n'est PAS sous suivi de version.${N}"
else
  echo -e "\n   ${G}coherent${N}"
fi

# ── Plan reel, optionnel ────────────────────────────────────────────────────
if [ "${AVEC_PLAN:-0}" = "1" ]; then
  etape "Bonus — plan reel (lecture seule, aucun apply)"
  echo -e "   ${Y}Deux obstacles, tous deux reels et a montrer :${N}"
  echo -e "   ${Y}  1. le bloc backend du code ne correspond pas au backend memorise —${N}"
  echo -e "   ${Y}     Terraform REFUSE de planifier tant qu'on ne reinitialise pas ;${N}"
  echo -e "   ${Y}  2. Terraform s'authentifie par ADC, qui n'est pas le compte gcloud actif.${N}"
  echo ""
  echo -e "   Reinitialisation vers le bucket DEJA utilise (aucune migration d'etat) :"
  ( cd "$RACINE" \
    && GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token 2>/dev/null)" \
       "$TF" init -reconfigure -input=false -no-color \
         -backend-config="bucket=$BUCKET_ETAT" -backend-config="prefix=$PREFIXE" 2>&1 | tail -4 )
  echo ""
  ( cd "$RACINE" && GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token 2>/dev/null)" \
      "$TF" plan -input=false -lock=false -no-color -detailed-exitcode 2>&1 | tail -25 )
  echo -e "\n   ${Y}Rappel a dire au jury : « aucun changement » ne prouve PAS l'absence de derive.${N}"
  echo -e "   ${Y}Les bindings IAM non autoritatifs ajoutes hors Terraform restent invisibles${N}"
  echo -e "   ${Y}au plan — cf. PREUVES_CHAINE_IAM.md §6.${N}"
fi

echo -e "\n${G}Termine.${N} Pieces dans ${C}$DEST/${N}"
