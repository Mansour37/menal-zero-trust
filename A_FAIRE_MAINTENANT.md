# À faire maintenant — pas à pas (Git Bash)

## ÉTAPE 1 — Déployer le détecteur temps réel (une seule fois, ~3 min)
```bash
cd "/c/Users/manso/OneDrive - ESPRIT/Bureau/menal-zero-trust-main"
bash scripts/deploy-realtime-detector.sh
```
**Ce que tu dois voir à la fin :** `✓ Détecteur temps réel DÉPLOYÉ et PLANIFIÉ`.
- À l'étape « 2/4 Test manuel » : soit `RT-WAF: N détection(s) écrite(s)`, soit
  `RT-WAF: aucun blocage sur la fenêtre` (normal si tu n'as pas attaqué récemment).
- **Si une ERREUR rouge apparaît → copie-la-moi**, je corrige (ce sera un détail de parsing).

---

## ÉTAPE 2 — Répétition à blanc (vérifier que la détection tombe)
**a) Lance une attaque** (6 requêtes, dont /etc/passwd) :
```bash
BASE="https://elson.menal-sarl.com"
for u in "file=/etc/passwd" "path=/etc/passwd" "file=../../etc/passwd" \
         "q=' OR 1=1" "file=/etc/passwd" "path=../../etc/passwd" ; do
  curl -s -o /dev/null -w "%{http_code} " "$BASE/api/search?$u" ; done ; echo
# attendu : 403 403 403 403 403 403
```
**b) Attends ~1 à 2 minutes** (le détecteur tourne chaque minute).

**c) Vérifie que les détections sont écrites (tes vraies règles R6/R3/R2) :**
```bash
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
MYIP=$(curl -s https://ifconfig.me)
bq query --project_id=menal-zero-trust-staging --use_legacy_sql=false --format=csv "
SELECT rule_id, mitre_technique, FORMAT_TIMESTAMP('%H:%M:%S',timestamp) AS heure, message
FROM \`menal-zero-trust-staging.menal_security_staging.detections\`
WHERE entity='$MYIP' AND rule_id IN ('R2','R3','R6') ORDER BY timestamp DESC LIMIT 5"
```
→ **Tu dois voir des lignes `R6 … T1190`, `R3 … T1190`, `R2 … T1498`.** Si oui : ✅ ça marche.

---

## ÉTAPE 3 — Filmer (suis GUIDE_DEMO_TOTAL.md)
1. Ouvre le dashboard **https://dashboard.menal-sarl.com** (connexion admin).
2. Lance ton attaque **depuis Kali** (le « show » de crédibilité).
3. **~1 min plus tard**, la détection tombe **toute seule** au dashboard (auto-refresh).
4. Montre : **Détections** → **Incidents** (ton IP) → « Le socle propose » **T1003.008** → clic **« Vrai positif »**.

---

## Si ça rate
- **Le scheduler tourne-t-il ?**
  ```bash
  gcloud scheduler jobs list --location europe-west1 --project menal-zero-trust-staging
  ```
- **Voir le dernier run du détecteur :**
  ```bash
  gcloud run jobs executions list --job menal-realtime-detector-staging --region europe-west1 --project menal-zero-trust-staging --limit 3
  ```
- **Repartir propre entre essais :** `bash scripts/demo-reset.sh backup` (1 fois) puis `wipe` avant chaque essai, `restore` à la fin.
- **Toute erreur → copie-la-moi.**

---

## Rappel des 2 règles à l'oral (cohérence)
- **Lis l'écran** (l'heure et le nombre affichés), ne récite pas de mémoire.
- **Formulations prudentes** : R2 = « signal volumétrique » (pas « DoS ») ; le +15 = « 2 tactiques
  distinctes » (pas « kill-chain multi-étapes »). T1190 et T1003.008 sont imprenables.
