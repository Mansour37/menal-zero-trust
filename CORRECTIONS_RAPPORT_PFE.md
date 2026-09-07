# Ce qu'il faut changer dans le rapport PFE pour qu'il soit solide et commercialisable

**Date :** 07/09/2026 · **Base :** audit complet du code + tests live sur `menal-zero-trust-staging`
**Principe directeur :** ton mémoire **sous-estime** ton propre système sur presque tout. Le code
réel est **plus riche** que le PDF (7 règles au lieu de 5, 8 identités au lieu de 6, 5 familles WAF
au lieu de 4, temps réel en plus). La bonne stratégie n'est donc **pas** de dégrader la démo, mais
de **réaligner le mémoire vers le haut, sur le réel qui est plus fort** — et de corriger les rares
points où le mémoire annonce mieux que le réel (sinon un jury qui teste te prend en défaut).

Trois niveaux de correction :
- **A — Contradictions à corriger absolument** (un jury peut les vérifier en 30 s ; une seule suffit à faire douter du reste)
- **B — Sous-estimations à relever** (remonter le niveau : ton système fait mieux que ce que tu écris)
- **C — Cohérence et nomenclature**
- **D — Le chemin vers le commercialisable**

Chaque ligne : **RAPPORT DIT** → **RÉEL (sourcé)** → **CORRECTION**.

---

## A. Contradictions à corriger absolument

### A1. « recette » et « production » — l'environnement n'existe pas sous ces noms
- **RAPPORT DIT** : environnement « recette », de topologie identique à la « production ».
- **RÉEL** : l'environnement s'appelle **`staging`** (`menal-zero-trust-staging`). Le projet **dev est désactivé** (19/08), et **`prod/` est vide** (`.gitkeep` seul). Il n'y a **pas de production**.
- **CORRECTION** : remplacer « recette » par « environnement de validation (staging), de topologie de production » partout. Dire clairement : « La production n'est pas encore instanciée ; le socle étant décrit en code, elle se déploie par un changement de variables (voir chemin de commercialisation). » **Ne jamais laisser croire qu'une production tourne.**

### A2. La traversée de chemin (T1) — le rapport dénonce un échec qui n'existe plus
- **RAPPORT DIT** : T1 **non conforme** — la traversée brute `....//` reçoit un **302** au lieu d'un refus.
- **RÉEL (live 07/09)** : `....//....//etc/passwd` → **403**, bloqué par la règle WAF **LFI (priorité 1200)**. Preuve dans les journaux du répartiteur.
- **CORRECTION** : soit tu **retires la non-conformité T1** (le WAF bloque bien la traversée aujourd'hui), soit — plus honnête et plus fin — tu **reformules la vraie limite** : le WAF bloque les motifs d'attaque, mais une requête anodine `?path=boot.ini` passe le WAF (ACCEPT priorité 1500) et n'est arrêtée que par l'**application** (403 applicatif). Les deux 403 sont de nature différente ; la seconde ligne (validation applicative) reste indispensable. **C'est un point qui te grandit** : tu montres que tu comprends la différence entre un blocage WAF et un blocage applicatif.

### A3. La boucle « le socle propose → l'humain décide » — incomplète dans le dashboard
- **RAPPORT DIT** : « l'administrateur enregistre le verdict » (UC5) et « le socle propose 3 techniques ATT&CK, l'humain décide » (apport principal).
- **RÉEL (avant le 07/09)** : deux trous logiques. (1) La table `analyst_verdicts` était **vide** et le dashboard **n'avait aucun bouton** de verdict. (2) Plus grave : les **candidats ATT&CK de la qualification assistée n'étaient affichés nulle part** dans la fiche incident — l'analyste qualifiait **à l'aveugle**, ce qui vidait de sens l'apport ML du projet.
- **CORRECTION (appliquée dans le code le 07/09)** : la fiche incident comporte désormais, **dans l'ordre logique** :
  1. **Card « Le socle propose — Techniques ATT&CK »** : les 3 candidats de l'enrichissement ML avec leur score de similarité et le nom du modèle (`attack-bert-onnx-fp32@v1.0`). *(nouvelle route backend `IncidentDetailOut.assisted_techniques` + composant `AssistedTechniques.tsx`)*
  2. **Card « UC5 — Décision humaine »** : le bouton de verdict (4 choix), append-only, rôle admin.
  Testé de bout en bout : requête SQL réelle (T1003.008 à 0,71 sur mon incident), verdict posé (201). Le dashboard **raconte enfin l'histoire complète** : détection → proposition ML → décision humaine. Captures `03-incident-verdict.png` et `04-qualification-assistee.png`.
- **À DÉPLOYER** : le backend `siem.py` doit être redéployé pour que le dashboard **live** montre les vrais candidats (sinon la Card affiche « qualification en cours »). Voir la commande de commit dans le récap.

### A4. « déploiement par empreinte sha256 »
- **RAPPORT DIT** : l'image est publiée et déployée **par son empreinte sha256**, pas par un tag mobile.
- **RÉEL** : la CI déploie l'image taguée **`:${{ github.sha }}`** (nom = SHA du commit, tag mutable dans Artifact Registry). Aucun `@sha256:` nulle part ; un tag `:latest` est même repoussé et référencé par Terraform.
- **CORRECTION** : reformuler en « chaque image porte **l'empreinte du commit** qui l'a produite, ce qui trace le build jusqu'au run ». **Ne pas parler de digest immuable.** Option d'amélioration à citer en perspective : épingler le digest (`docker inspect … RepoDigests`) — c'est un vrai durcissement supply-chain, 5 lignes de CI.

### A5. « deny egress par défaut »
- **RAPPORT DIT** : le réseau applique un **refus de sortie par défaut** au niveau du pare-feu.
- **RÉEL** : les 4 règles de pare-feu sont **toutes en INGRESS** ; **aucune règle EGRESS n'existe**. Le confinement de sortie est fait **côté Cloud Run** (`vpc_access.egress = PRIVATE_RANGES_ONLY`), sauf `menal-enrich-job` qui est en `ALL_TRAFFIC`.
- **CORRECTION** : dire « la sortie est confinée **au niveau de chaque service Cloud Run** (egress restreint aux plages privées), et non par une règle de pare-feu VPC ». C'est vrai et défendable. **Ne pas revendiquer un deny-egress VPC qui n'existe pas.** (Amélioration : ajouter une vraie règle egress deny + logs.)

### A6. La session admin à deux facteurs (EX5/T5)
- **RAPPORT DIT** : session administrateur à deux facteurs, jeton intermédiaire, TOTP obligatoire.
- **RÉEL** : le mécanisme MFA **existe et fonctionne** dans l'API (jeton `mfa_pending` 5 min sans rôle, TOTP, chiffrement Fernet du secret). **Mais** : (a) le compte admin de démo `admin@menal-sarl.mr` **n'a pas la MFA activée** (login → token direct), et (b) **aucune route n'exige la MFA** au niveau de la dépendance (le JWT post-TOTP est identique à un JWT sans MFA — pas de claim `amr`).
- **CORRECTION** : **activer la MFA sur l'admin de démo avant le tournage** (l'API a `/auth/mfa/setup` + `enable`). Puis le mémoire est exact. Sur le point (b), reformuler : « la MFA est une **porte à la connexion** ; l'ajout d'un claim `amr` pour exiger la MFA par route est une amélioration identifiée ». Ne pas prétendre que chaque route exige un second facteur.

---

## B. Sous-estimations à relever (ton système fait mieux — remonte le niveau)

### B1. Nombre de règles de détection : 5 → **7 (+2 temps réel)**
- **RAPPORT DIT** : 5 règles R1–R5.
- **RÉEL** : **7 règles R1–R7** en SQL BigQuery (`terraform/modules/detection/main.tf`), 7 requêtes planifiées séparées, + **2 règles temps réel** en base (RT-WAF, RT-RBAC). R6 = injection **CRITICAL** T1190, R7 = accès fichiers sensibles HIGH T1005.
- **CORRECTION** : passer à **7 règles**, tableau R1–R7 avec sévérité/technique **réelles** (voir table ci-dessous). Mentionner les deux détecteurs temps réel comme complément. **C'est un renforcement, pas un aveu.**

**Table réelle des règles (à recopier dans le mémoire) :**

| Règle | Nom | Sévérité | Technique | Tactique | Seuil / fenêtre |
|---|---|---|---|---|---|
| R1 | Force brute auth | HIGH | T1110 | TA0006 | >5 échecs / 15 min / IP |
| R2 | Pic WAF | MEDIUM | T1498 | TA0040 | >10 blocages / 15 min / IP |
| R3 | Path traversal | HIGH | T1190 | TA0001 | présence / 15 min |
| R4 | User-agent suspect | MEDIUM | T1046 | TA0007 | présence / 15 min |
| R5 | Latence anormale >5s | LOW | T1499 | TA0040 | >5000 ms / 15 min |
| R6 | Pattern injection | CRITICAL | T1190 | TA0001 | présence / 15 min |
| R7 | Accès fichier sensible | HIGH | T1005 | TA0009 | présence / 15 min |

### B2. R2 : corriger sévérité et technique
- **RAPPORT DIT** : R2 = HIGH, T1190.
- **RÉEL** : R2 « Pic WAF » = **MEDIUM, T1498** (déni de service réseau). C'est **R6** (injection) et **R3** (traversal) qui portent **T1190**.
- **CORRECTION** : dans tout le mémoire et la démo, R2 = MEDIUM/T1498. Le T1190 « exploitation d'application exposée » est porté par R3/R6. (Le message réel de R2 reste « N requêtes bloquées par Cloud Armor… en 15 min », parfait pour la démo.)

### B3. Comptes de service : 6 → **8, avec 0 clé**
- **RAPPORT DIT** : 6 comptes de service (dont `sa-detection`, `sa-enrich`, `sa-ci`).
- **RÉEL** : **8 comptes** (`sa-api`, `sa-cicd`, `sa-dashboard-staging`, `sa-elson`, `sa-enrich-job`, `sa-ml-embed`, `sa-pipeline`, + compute par défaut). **`sa-detection` n'existe pas** : les règles tournent sous **`sa-pipeline`**. **0 clé sur les 8** (vérifié live).
- **CORRECTION** : dire « sept identités applicatives dédiées + le compte par défaut, **zéro clé** ». Remplacer `sa-detection` par `sa-pipeline`, `sa-enrich` par `sa-enrich-job`, `sa-ci` par `sa-cicd`. Le point fort « 0 clé » est **plus fort** avec 8 comptes qu'avec 6.

### B4. Cloud Armor : 4 → **5 familles OWASP + geo-block + rate-limit**
- **RAPPORT DIT** : 4 règles OWASP.
- **RÉEL** : **5 familles préconfigurées** (sqli, xss, lfi, rce, rfi, sensibilité 1) + un **geo-block** (UE + Maghreb) + un **rate-based ban** (10 req/60 s, ban 300 s, sur les chemins d'auth) + un throttle global (1000/60 s). 8 règles au total.
- **CORRECTION** : passer à **5 familles OWASP** et **ajouter le rate-limiting** comme mécanisme distinct (il répond à EX2 mieux que ce qui est écrit). Mentionner le geo-block. C'est un net renforcement de la partie Zero Trust/WAF.

### B5. Tables BigQuery : 7 → **10**
- **RAPPORT DIT** : 7 tables.
- **RÉEL** : **10 tables déclarées** (`access_logs`, `security_events`, `raw_logs`, `detections`, `alert_enrichment`, `pending_embeddings`, `cve_findings`, `api_metrics`, `analyst_verdicts`, `attack_embeddings`).
- **CORRECTION** : passer à 10 et citer notamment `cve_findings` (chaîne CVE→SIEM) et `api_metrics`, qui montrent une supervision plus complète.

### B6. Qualification assistée : donner les chiffres RÉELS et retirer les chiffres inventés
- **RAPPORT DIT** : 872 vecteurs / 697 techniques ; candidats T1190(0,72), T1498(0,68), T1595(0,61) pour le 19/08.
- **RÉEL** : le **nombre de vecteurs n'est codé nulle part** — il dépend du bundle STIX MITRE téléchargé au build (une ligne par couple technique×tactique). Le modèle est bien **ATT&CK-BERT ONNX float32** (`attack-bert-onnx-fp32@v1.0`), int8 explicitement rejeté. 3 candidats, seuil 0,60. Exemple live réel (07/09) : LFI `/etc/passwd` → **T1003.008 (0,65)**, T1003.002 (0,64), T1556.003 (0,638).
- **CORRECTION** : soit tu **mesures et épingles** la version ATT&CK utilisée puis tu cites le nombre réel de vecteurs (reproductible), soit tu écris « ~N vecteurs (une entrée par couple technique×tactique de la matrice Enterprise vX.Y) ». **Remplace l'exemple 19/08 par un exemple réel** (le T1003.008 est excellent : il prouve la compréhension sémantique). Garde float32/int8-rejeté : c'est vrai et bien argumenté dans ton code.

### B7. Routes API : 9 → **21** (dont 9 sur `/siem`)
- **RAPPORT DIT** : 9 routes.
- **RÉEL** : **21 routes** (2 racine, 6 auth/MFA, 2 users, 1 logs, 1 alerts, **9 siem**). Le « 9 » correspond exactement au seul routeur `/siem`.
- **CORRECTION** : dire « 21 routes, dont 9 dédiées à la supervision SIEM ». Montre une API plus complète (auth, MFA, users, logs, alerts).

---

## C. Cohérence et nomenclature

| # | RAPPORT DIT | RÉEL | CORRECTION |
|---|---|---|---|
| C1 | 5 modules Terraform (network/run-service/database/security/supervision) | **16 modules** aux noms réels (vpc, cloud-run, cloud-sql, iam, kms, load-balancer, bigquery, logging, detection, ml-pipeline, monitoring, dashboard, app-service, artifact-registry, audit, workflow) | Lister les 16 modules réels, ou regrouper en 5 **couches** en précisant qu'elles agrègent 16 modules. Aucun module ne s'appelle « security » ni « supervision ». |
| C2 | Règles « Sigma » | `INSERT…SELECT` **SQL BigQuery** ; « Sigma » n'est qu'un mot de commentaire, aucun YAML Sigma | Dire « détection **comme du code**, règles SQL versionnées ». Ne pas revendiquer le format Sigma. |
| C3 | Cloud Workflow d'orchestration | **supprimé le 02/08** (100 % d'échecs) ; `workflows/security-pipeline.yaml` est du code mort | Retirer toute mention d'un Cloud Workflow actif. La normalisation se fait par **requêtes planifiées BigQuery** (5 min). |
| C4 | Instance Cloud SQL par app | **une instance partagée** `menal-db-staging` (bases `menal_db` + `elson_db`, users distincts) | Dire « une **base et un utilisateur** par app sur une instance partagée ; isolation logique vérifiée par un job quotidien ». |
| C5 | 8 étapes CI séquentielles, 3 portes | **6 jobs parallèles** ; ≥8 étapes bloquantes (Gitleaks, Semgrep, pytest, npm test, Trivy×2, smoke×2) | Décrire les jobs réels. Assumer les 4 neutralisations (`e2e-gcp` non bloquant, `npm run lint` non bloquant, chargement SIEM best-effort, tags `:latest` best-effort). |
| C6 | Détection « en 15 min » | 15 min = **fenêtre de requête** ; latence réelle = ingestion + ≤5 min (normalisation) + ≤5 min (règle) | Distinguer fenêtre (15 min) et latence (~5–10 min). L'enrichissement ajoute un cycle de 15 min. |
| C7 | PITR / RTO / RPO mesurés | Cloud SQL PITR activé (7 j), backups 7 j, HA REGIONAL | Vérifier que les chiffres RTO/RPO annoncés viennent d'un test réel daté (tu as un test d'isolation SQL quotidien ; le test de restauration doit être rejoué et chronométré pour être cité). |

---

## D. Le chemin vers le commercialisable

Ton mémoire vise « un socle qui peut devenir une offre d'hébergement sécurisé ». Voici, par ordre,
ce qui sépare aujourd'hui le socle d'un service vendable — chacun **s'ajoute sans refondre
l'architecture** :

1. **Sécuriser les secrets du dépôt** *(fait cette nuit)* : `credentials.txt` (mot de passe admin en
   clair) n'était **pas** couvert par `.gitignore` (`credentials*.json` seul). Ajouté `credentials*.txt`.
   **Action restante : changer ce mot de passe admin** (il a été lu en clair) et le stocker en
   gestionnaire de secrets.
2. **Activer la MFA sur l'admin** (S1) : aujourd'hui le compte de démo n'a pas de second facteur.
   `/auth/mfa/setup` + `enable`. Sans cela, le plan Zero Trust « session 2FA » est théorique.
3. **Alerter réellement** : la chaîne se termine par un écran. Il lui faut une **notification**
   (e-mail / webhook) vers une personne d'astreinte, sinon une détection nocturne attend le matin.
4. **Déploiement par digest immuable** : passer de `:${{ github.sha }}` à `@sha256:` (ferme la
   fenêtre entre le scan Trivy et le déploiement). ~5 lignes de CI.
5. **Vraie règle egress deny + logs** au niveau VPC (aujourd'hui seulement côté Cloud Run).
6. **Couverture de tests dashboard** : 3 % réel (le seuil 70 % de `jest.config` **n'est pas
   appliqué** — la CI lance `npm test`, pas `test:coverage`). Ne pas annoncer « 70 % ». Formulation
   honnête : « 22 tests unitaires bloquants + 22 scénarios Playwright (manuels) ; couverture 3 %,
   dette assumée et tracée en CI ». Remonter progressivement.
7. **Instancier une 2ᵉ application** pour **prouver** la multi-tenance (aujourd'hui « satisfait par
   conception, non éprouvé » : seul ELSON est hébergé). C'est le pas qui transforme « réutilisable »
   en « réutilisé ».
8. **Cloisonner le stockage d'objets** et **verrouiller la rétention** des journaux d'audit avant
   d'accueillir un client externe.

> **Message commercial défendable, aligné sur le réel :** « Le socle héberge ELSON pour ~41 €/mois,
> avec une sécurité et une supervision incluses (Zero Trust vérifié, DevSecOps à portes, 7 règles +
> qualification ATT&CK, verdict humain). Il est entièrement décrit en code : accueillir une seconde
> application revient à instancier les mêmes modules avec d'autres variables. »

---

## Récapitulatif — priorités d'action

| Priorité | Action | Statut |
|---|---|---|
| 🔴 1 | Changer le mot de passe admin (lu en clair) + retirer `credentials.txt` du poste | à faire (toi) |
| 🔴 2 | Corriger A1–A6 dans le mémoire (contradictions vérifiables) | à faire (toi, avec ce doc) |
| 🟠 3 | Activer la MFA sur l'admin de démo | à faire (toi) |
| 🟢 4 | Relever B1–B7 (ton système fait mieux) | à faire (toi, tables fournies) |
| 🟢 5 | Committer le bouton de verdict + AutoRefresh (UC5 réel) | code prêt, à committer |
| 🟢 6 | Aligner C1–C7 (nomenclature) | à faire (toi) |
