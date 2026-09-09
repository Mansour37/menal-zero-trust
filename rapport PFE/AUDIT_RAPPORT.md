# Révision v3 — 09/09/2026 (`rapport-main-v3.pdf`)

La v3 confronte le rapport aux relevés réels du projet de recette (`menal-zero-trust-staging`) fournis le 08/09/2026 : console IAM, Cloud Run, Secret Manager, Cloud KMS, sorties `gcloud`/`bq` (instance SQL, connecteur, plage d'appairage, comptes de service, clés, fédération, droits du jeu de données, secrets, job d'isolation, volumes des tables). Corps : **45 pages** (Introduction générale p. 1 → Conclusion générale p. 45), 81 pages au total.

## 1. Corrections d'architecture (ce qui était écrit → ce qui est déployé)

| Sujet | v2 | Relevé du 08/09 | v3 |
|---|---|---|---|
| Accès réseau des services | sous-réseau `sub-run` 10.10.0.0/24, sortie VPC directe, connecteur supprimé (É1) | connecteur d'accès VPC serverless `menal-vpc-connector-stg` **10.0.3.0/28** (`READY`) | §4.4, fig. 4.2, annexe A (module `run-service`, variables) réécrits ; ancien É1 et ancienne difficulté « règle de sortie sans effet » supprimés |
| Cloud SQL | plage /24, « connecteur IAM » | `menal-db-staging`, `ipv4Enabled=False`, IP privée **10.20.0.3** dans la plage d'appairage `google-services-staging` **10.20.0.0/16**, `sslMode=ENCRYPTED_ONLY`, bases `menal_db`/`elson_db`, utilisateurs `api_user`/`elson_user`, mot de passe par base dans Secret Manager | §4.7.1 réécrit ; T3 rattaché au relevé (fig. D.1, D.2) |
| Isolation des bases | « contrôle quotidien 4/4 » | job `elson-sql-isolation-check-staging`, 04 h 00 UTC, **six vérifications**, cinq exécutions réussies 04–08/09 | §4.7.1, §5.4, T4 (fig. D.7) |
| Ingestion des journaux | Log Router → Pub/Sub → service « pipeline » → Storage Write API | Log Router écrit **directement** dans BigQuery (agent de service Cloud Logging = rédacteur du jeu de données) ; job `menal-realtime-detector-staging` ; job `menal-enrich-job-staging` | §4.8 et fig. 4.4 refaites (6 maillons, < 3 min, mesuré 2 min 05 s) ; Pub/Sub retiré des chapitres 2, 3, 4, du résumé et de la bibliographie |
| Services Cloud Run | ELSON = un service | `elson-web-staging`, `elson-api-staging`, `menal-api-staging`, `menal-dashboard-staging` (entrée « interne + répartiteur »), `menal-ml-embed-staging` (interne, authentification obligatoire) ; 3 jobs | Fig. 4.2, §5.4 ; capture des services en annexe D (fig. D.8) |
| Jeu de données | `menal_security`, table `api_metrics` | `menal_security_staging`, chiffré par la clé KMS `menal-api-key-staging` ; tables `raw_logs` 231 446, `access_logs` 80 307, `security_events` 63 269, `detections` 284, `alert_enrichment` 282, `analyst_verdicts` 23, `attack_embeddings`, `cve_findings` | Tab. 4.3 refait avec les volumes ; T11 rattaché aux volumes (fig. D.10) |
| IAM | compte Compute « neutralisé », administrateur sans rôle propriétaire, tableau de bord sans accès à l'entrepôt | compte Compute par défaut = **Éditeur** ; administrateur = **Propriétaire** ; `sa-dashboard-staging` = **lecteur** du jeu de données ; rôles par compte : `sa-api` BigQuery Job User + Cloud SQL Client + Logs Writer ; `sa-cicd` Artifact Registry Writer + BigQuery Job User + Cloud Run Developer ; `sa-elson` Cloud SQL Client + Logs Writer ; `sa-enrich-job` BigQuery Job User + Logs Writer ; `sa-ml-embed` Logs Writer ; `sa-pipeline` BigQuery Job User + Logs Viewer | Tab. 4.2 réécrite avec les rôles réels ; écarts **É2** (rôle de lecture du tableau de bord à retirer), **É5** (rôles par défaut Propriétaire/Éditeur, retrait de l'Éditeur et séparation des rôles avant production) ; T4 repose désormais sur la correspondance secret ↔ compte et sur le job d'isolation |
| Secrets et clés | générique | 9 secrets, chacun lu par un seul compte (5 `sa-elson`, 3 `sa-api`, 1 `sa-dashboard-staging`) ; 8 chiffrés par `menal-secrets-key-staging`, `dashboard-password-staging` sous clé Google ; 2 trousseaux, 2 clés | §4.5 ; **É6** (secret du tableau de bord à passer sous clé KMS) ; fig. D.5, D.9 |
| Fédération | condition « dépôt + branche » | `menal-github-provider` : `assertion.repository == 'Mansour37/menal-zero-trust' && assertion.ref == 'refs/heads/main'` ; 0 clé sur les comptes du socle | §4.5, T10 (fig. D.3) |
| Enrichissement | « trois candidats au-dessus de 0,60 » | la détection R2 du 07/09 porte un candidat T1204.003 à 0,437 (< 0,60) et reste « non mappée » | §4.8, §5.3.3, annexe E : sous le seuil, la détection garde la technique de sa règle et compte dans la part non mappée |

## 2. Preuves : ce qui a été retiré, remplacé, ajouté

- **Retirées** : les douze relevés d'août (`figB1`–`figB12`), qui portaient d'anciens noms de projet et de comptes (`socle-recette`, `sa-detection`, `socle_supervision`) et la capture BigQuery de T11 ; la chronologie du 19/08 et ses candidats ATT&CK (le 19/08 reste une mesure de référence : 15 min 05 s).
- **Remplacées** : T8 et T9 renvoient aux refus provoqués du 07/09 (Gitleaks, Semgrep, pytest, jest, Trivy — runs identifiés) ; T2, T5, T12 renvoient à la suite pytest exécutée à chaque livraison (run vert 34165407841).
- **Ajoutées (annexe D, anonymisées)** : instance SQL privée ; connecteur et plage d'appairage ; comptes de service, clés et condition de fédération ; rôles IAM par compte (console) ; droits du jeu de données ; secrets et comptes ; job d'isolation (exécutions et journal) ; services Cloud Run et entrées ; Secret Manager et KMS (console) ; volumes des tables et requêtes par service. Adresses IP publiques et identifiants personnels masqués.
- **Déplacées** : santé des règles et vulnérabilités (captures du tableau de bord) en annexe C.

## 3. Forme et style

- Ordre initial : page de garde (modèle ESPRIT) → confidentialité (cachet MENAL) → validation du dépôt signée ; attestation de stage en dernière page.
- Tableaux fermés à en-tête grisé ; aucune coupure de mot en fin de ligne (césure désactivée, tolérance élargie) ; symboles ✓ (conforme) et ■ (partiel) ; police de code Courier.
- Suppression de toute mention d'assistance à la programmation et des formulations « à confirmer », « à relever », « à re-mesurer ».
- Alertes de plateforme renommées **AP1–AP3** (les acteurs restent A1–A6) ; tableau des repères (C, O/K, A/UC, BF/BNF, F/TB, M/EX, T, R/AP, D/É) ajouté au §1.6.
- Recouvrement de texte avec les documents techniques fournis : < 0,5 % ; les plus longues séquences communes avec la version précédente du mémoire (résumé anglais, introduction, remerciements, tableau des constats) ont été reformulées.

## 4. Points restants (état du projet, non du rapport)

| # | Constat | Action recommandée avant la soutenance |
|---|---|---|
| É2 | `sa-dashboard-staging` détient un rôle de lecture sur `menal_security_staging` que le code n'utilise plus | `bq` : retirer le rôle READER ; le rapport le présente déjà comme « retrait planifié » |
| É5 | Rôle Éditeur sur le compte Compute par défaut ; Propriétaire pour l'administrateur | retirer `roles/editor` du compte `…-compute@developer.gserviceaccount.com` (aucun composant ne l'utilise) ; si fait, reformuler É5 comme résorbé (tab. 5.5, tab. 4.2) |
| É6 | `dashboard-password-staging` chiffré par une clé Google | ajouter `customer_managed_encryption` dans le module `security` |
| AP3 | alerte d'absence de journaux non rejouée depuis le passage en flux | provoquer une interruption du routage, chronométrer ; si < 10 min, T11 devient conforme (tab. 6.1, résumé, conclusion : « onze conformes, un partiel ») |
| Sous-titre du tableau de bord | « réévaluées toutes les 5 min » | mettre à jour le texte dans `dashboard/` avant toute démonstration |
| Cadence du détecteur | le rapport annonce « chaque minute » (`menal-realtime-detector-staging`) | vérifier la planification Cloud Scheduler réelle ; si elle diffère, ajuster §4.8, fig. 4.4, tab. 6.2 |
| Coût de septembre | non disponible à la rédaction | relever la facturation à la clôture du mois |

---

# Rapport d'audit v2 (08/09/2026) — mémoire PFE « Conception et réalisation d'une architecture cloud sécurisée Zero Trust et DevSecOps » (socle MENAL)

Auditeur : assistant (agents pédagogique, logiciel, sécurité, cloud/ops, rédaction, auditeur final — voir `PROMPTS_AGENTS.md`).
Sources auditées : `main.pdf` (125 p., version du 28/08/2026), `DOCUMENT_SUPERVISION_7_REGLES.md`, `PREUVES_CHAINE_APP_DELIVERY.md`, `app-delivery.yml`, `DOCUMENT_DASHBOARD_MENAL.md`, `data.postgresql.txt`, 21 captures du 07/09/2026, note pédagogique ESPRIT (`rapport_stage_pedagogique.pdf`).
Livrable corrigé : `rapport-main-v3.pdf` et `rapport_v3_sources.zip` (sources LaTeX + figures).

---

## 1. Synthèse

| Indicateur | Version auditée (28/08) | Version 2 (08/09) |
|---|---|---|
| Pages du corps (Introduction générale → Conclusion générale) | 87 | **45** |
| Pages totales (avec annexes) | 125 | 78 |
| Règles de détection décrites | 5 (R1–R5, dont 3 règles « plateforme ») | **7 règles applicatives R1–R7** + 3 alertes de plateforme A1–A3 (Cloud Monitoring) |
| Portes bloquantes de la chaîne CI/CD | 3 (+ tests) | **4** (Gitleaks, Semgrep, pytest/jest, Trivy), chacune éprouvée par un refus daté |
| Identités | 7 (6 comptes de service) | **9** (administrateur + 8 comptes de service, zéro clé — inventaire du 07/09) |
| Environnements | 2 (dev, recette) | **3** (dev, staging, prod), promotion sur étiquette |
| Délai attaque → alerte | ≤ 20 min (15 min 05 s mesuré) | **< 3 min** par construction, **2 min 05 s** mesuré le 07/09 (chaîne en flux, décision D9) |
| MFA administrateur | décrite, sans preuve visuelle | décrite + 3 captures (mot de passe, code TOTP, Google Authenticator) |
| Tableau de bord | 3 écrans de démonstration | 7 captures réelles de recette (vue d'ensemble, détections, incidents, santé des règles, vulnérabilités, MFA) |
| Site ELSON | non montré | ~3 pages : procédure d'accueil, mise en service, 5 captures, choix défendus, frontière de responsabilité |
| Campagne de tests | 9 conformes / 2 partiels / 1 non conforme | **10 conformes / 2 partiels / 0 non conforme** (T1 corrigé et rejoué le 07/09) |
| Bibliographie | 30 références | 35 (ajout Pub/Sub, RFC 6238 TOTP, FastAPI, Next.js, RFC 5737) |

Conformité à la note pédagogique ESPRIT : Times 12 pt, marges 2,5 cm, interligne 1,15, justifié, alinéa 0,5 cm, pagination n/N en bas à droite, titres numérotés gras de taille décroissante, chaque chapitre avec introduction et conclusion, figures et tableaux légendés et référencés, définitions encadrées, planning sur une page pleine en fin de réalisation, aucun code dans le corps (extraits en annexe A), page de garde et formulaire de validation d'origine conservés.

---

## 2. Incohérences détectées entre le rapport audité et les preuves fournies

| # | Incohérence | Où (rapport audité) | Décision retenue dans la v2 |
|---|---|---|---|
| I1 | 5 règles R1–R5 (dont IAM refusés, modification infra, absence de collecte) alors que le socle exécute 7 règles applicatives (R1 brute force, R2 pic WAF, R3 path traversal, R4 UA suspect, R5 latence, R6 injection, R7 fichier sensible) visibles dans la capture « Santé des règles ». | Ch. 4 §4.6, ch. 5 §5.4.2, annexe C | R1–R7 décrites (tab. 5.2) ; les trois anciennes règles de plateforme deviennent les alertes Cloud Monitoring **A1** (refus IAM), **A2** (modification hors chaîne, EX6), **A3** (absence de journaux, EX11). Les exigences EX6/EX11 et les tests T6/T11 restent inchangés. |
| I2 | 3 portes bloquantes ; le fichier `app-delivery.yml` en compte 4 (tests pytest/jest bloquants) et 8 étapes. | Ch. 4 §4.7.2, ch. 5 §5.3, fig. 5.1 | Fig. 5.1 redessinée : 8 étapes, 4 portes, durées du run 34165407841. Tab. 5.1 : 5 refus provoqués avec identifiants de run. |
| I3 | 7 identités / 6 comptes de service ; inventaire réel : 8 comptes de service (`sa-elson`, `sa-api`, `sa-dashboard`, `sa-pipeline`, `sa-enrich-job`, `sa-ml-embed`, `sa-cicd`, compute par défaut). | Ch. 4 §4.5.1, fig. 4.4 | Tab. 4.2 « matrice des identités » (9 lignes). L'ancienne fig. 4.4 est supprimée. |
| I4 | 2 environnements (dev, recette) ; prod « déclarée non appliquée ». Demande : dev-staging-prod. | Ch. 4 §4.2, annexe A.2 | Fig. 4.1 (nouvelle) : trois environnements, chemin de promotion ; recette renommée « staging » ; ELSON servie depuis staging pendant le rodage (choix défendu §5.5.2). |
| I5 | Délai alerte ≤ 20 min (15 min 05 s) alors que l'objectif est le quasi temps réel. | Ch. 4 §4.6.4, fig. 4.8, ch. 6 §6.3 | Nouvelle §4.8 « chaîne de détection en flux » (Pub/Sub → Storage Write API → job à la minute), décision **D9** (04/09), écart **É5**, budget de temps par maillon (fig. 4.4), mesure 2 min 05 s (fig. 6.2). |
| I6 | Noms non uniformes : `menal-sarl/socle`, `socle-recette`, `sa-ci`, `sa-detection`, dataset `socle_supervision`. | Partout | Uniformisés : dépôt `Mansour37/menal-zero-trust`, projets `menal-zero-trust-{dev,staging,prod}`, `sa-cicd`, `sa-pipeline`, dataset `menal_security`. |
| I7 | Tableau de bord présenté avec 3 écrans « de démonstration » (fig. 5.2–5.4) et sous-titre « réévaluées toutes les 5 min ». | Ch. 5 §5.4.5 | Captures réelles du 07/09 ; le sous-titre « 5 min » a été recadré hors de la capture (voir point à valider V2). |
| I8 | Score d'incident, corrélation par entité, verdicts append-only et page « Vulnérabilités » (Trivy → SIEM) absents. | Ch. 4, ch. 5 | Ajoutés (§4.8 maillon 6, §5.4.4, fig. 5.6, fig. 5.7 droite). |
| I9 | T1 non conforme (traversée `....//` → 302) ; la capture Kali du 07/09 montre 13 charges dont `....//....//etc/passwd` toutes refusées 403. | Ch. 6 §6.2 | T1 : non conforme le 23/08, **corrigé et rejoué conforme le 07/09** (tab. 6.1, fig. 6.1). |
| I10 | Données personnelles visibles dans les preuves : IP publique 41.188.115.52, courriel personnel (Gitleaks), comptes Gmail (Authenticator), courriel d'un relecteur ELSON, barre de favoris du navigateur. | Captures | Anonymisées : IP → `203.0.113.7` (RFC 5737), courriels floutés, Authenticator recadré sur `admin@menal-sarl.mr`, favoris retirés. |
| I11 | `data.postgresql.txt` indique `availability_type = REGIONAL` alors que le rapport fixe la HA à `false` en recette pour le coût. | Annexe A.3 | Conservé `false` en staging / `true` en prod (cohérence avec le coût 41 €). **À valider (V4).** |
| I12 | Durées CI non chiffrées ; empreinte publiée vs déployée non vérifiée. | Ch. 5 §5.3 | Durées par étape, total 5 min 37 (fusion) / 4 min 04 (PR), empreintes `sha256` identiques (871e5da4… / bba6bf99…). |

---

## 3. Corrections par chapitre (ajouter / modifier / supprimer)

Convention : **[A]** ajouter, **[M]** modifier, **[S]** supprimer. Les numéros de figures/tableaux « anciens » sont ceux de `main.pdf` ; les « nouveaux » ceux de `main_v2.pdf`.

### Pages liminaires
- **[M]** Résumé / Abstract : 7 règles, 4 portes, MFA TOTP, 3 environnements, chaîne en flux, « moins de trois minutes », campagne 10/2/0.
- **[M]** Liste des abréviations : ajout MFA/TOTP, OIDC/WIF, PITR, SBOM ; suppression des sigles non utilisés.
- **[S]** « Liste des définitions » séparée : les définitions restent encadrées dans le texte (7 encadrés).

### Introduction générale (2 p. → 1 p.)
- **[M]** Contexte ramené à l'essentiel ; quatre sous-questions en une phrase ; plan des chapitres en 6 phrases.

### Chapitre 1 — Contexte (13 p. → 5 p.)
- **[M]** §1.1 fusion « cadre du projet », « organisme d'accueil » et « service d'accueil » (fig. 1.1 conservée).
- **[M]** §1.2 ELSON : ajout de ce que fait réellement la plateforme (traduction, enregistrement, validation, classement, compétition) ; conserve l'encadré « corpus linguistique ».
- **[M]** §1.3 Étude de l'existant : fig. 1.2 conservée ; les quatre constats en un tableau (tab. 1.1) au lieu de 4 sous-sections.
- **[M]** §1.4 Problématique : encadré + quatre questions en un paragraphe.
- **[M]** §1.5 Objectifs (tab. 1.2) : O3 « quatre portes bloquantes … éprouvées par des refus » ; O4 « incident affiché moins de trois minutes après l'attaque » (au lieu de 20 min).
- **[S]** Ancienne fig. 1.3 (vue d'ensemble de la solution) : redondante avec tab. 1.2 et la fig. 4.2.
- **[M]** §1.6 Méthodologie : fig. 1.4 (ancienne) → fig. 1.3 ; mention explicite des trois environnements et des identifiants stables (C, O/K, A/UC, F/TB, M/EX, D/É, R, T).

### Chapitre 2 — État de l'art et choix technologiques (12 p. → 7 p.)
- **[M]** §2.1 Zero Trust : texte réduit, tab. 2.1 (7 principes NIST) conservé, fig. 2.1 conservée.
- **[S]** Ancienne fig. 2.2 (chaîne DevSecOps) : remplacée par tab. 2.2 (quatre familles de contrôles et outils retenus).
- **[M]** §2.3 Supervision : tab. 2.3 (comparaison des options) ; qualification assistée : tab. 2.4 + fig. 2.2 (ancienne fig. 2.3).
- **[M]** §2.4 Plateforme : le tableau comparatif Google Cloud/AWS/Azure/hébergeur/serveur est remplacé par un paragraphe ; **[A]** tab. 2.5 « Services Google Cloud mobilisés / rôle / bonne pratique » (Load Balancing + Cloud Armor, Cloud Run, Cloud SQL, BigQuery, Logging + Log Router + Pub/Sub, Scheduler + Monitoring, IAM + WIF, Secret Manager + KMS, Artifact Registry + Storage).
- **[A]** §2.5 « Technologies retenues, une par une » : une sous-section par technologie avec critère décisif et bonne pratique appliquée — Terraform ; GitHub Actions + OIDC ; Gitleaks/Semgrep/pytest-jest/Trivy ; Docker multi-étape + Cloud Run ; PostgreSQL sur Cloud SQL ; FastAPI ; Next.js ; TOTP (RFC 6238) ; BigQuery + Pub/Sub + Cloud Scheduler ; ATT&CK-BERT/ONNX.
- **[M]** §2.6 Référentiels et positionnement : condensé ; tab. 2.6 synthèse objectif → technologies.

### Chapitre 3 — Analyse des besoins et menaces (14 p. → 5 p.)
- **[M]** Acteurs (tab. 3.1) et cas d'utilisation (fig. 3.1) : les UC passent d'un tableau à un paragraphe.
- **[M]** Besoins (tab. 3.2) : BF5 « incident affiché ≤ 3 min » ; BF4 « quatre portes ».
- **[M]** Flux et frontières : fig. 3.2 conservée ; l'ancien tab. 3.4 (frontières) fusionné dans le texte.
- **[M]** Menaces : tab. 3.3 conservé avec cotation ; la matrice (ancienne fig. 3.3) passe en annexe B (fig. B.1).
- **[M]** Exigences : ancienne « matrice de traçabilité » et tableau des exigences fusionnés en un seul tab. 3.4 (exigence, critère, contrôle prévu, test, référentiel). EX6 mentionne l'alerte A2, EX11 l'alerte A3 et la collecte « en flux ».
- **[S]** Ancienne fig. 3.4 (chaîne de traçabilité) déplacée en annexe B (fig. B.2).

### Chapitre 4 — Conception (19 p. → 9 p.)
- **[A]** §4.2.1 « Trois environnements décrits par le même code » + **fig. 4.1 (nouvelle, TikZ)**.
- **[A]** §4.2.2 **fig. 4.2 (nouvelle, TikZ) « Diagramme de déploiement »** : point d'entrée, VPC/Cloud Run (6 services : ELSON, Sentinel, API, encodeur, job d'enrichissement, pipeline), Cloud SQL privée, BigQuery (8 tables), **Log Router → Pub/Sub → pipeline (Storage Write API)**, Cloud Scheduler, IAM + WIF, Artifact Registry, Secret Manager + KMS, Cloud Storage, Cloud Monitoring. Remplace les anciennes fig. 4.1 et 4.2 (connecteurs manquants).
- **[M]** §4.3 Cinq couches : tab. 4.1 conservé ; **[S]** ancienne fig. 4.3 (redondante).
- **[M]** §4.4 Point d'entrée et réseau : ajout des règles d'anomalies de protocole (correctif T1) ; réseau condensé.
- **[M]** §4.5 Identités : **tab. 4.2 « matrice des identités »** (9 identités, peut / ne peut pas) remplace l'ancienne fig. 4.4 ; règle « un auteur par table ».
- **[M]** §4.6 MFA : fig. 4.3 (ancienne fig. 4.5) conservée ; ajout de l'enrôlement (QR code, page « Sécurité (MFA) ») et de la graine TOTP référencée dans Secret Manager.
- **[M]** §4.7 Données : « une base par application, une instance privée » (`ipv4_enabled=false`, connecteur IAM, `REVOKE cloudsqlsuperuser`, contrôle d'isolation quotidien) ; **tab. 4.3 entrepôt à 8 tables** (`raw_logs`, `access_logs`, `detections`, `alert_enrichment`, `attack_embeddings`, `analyst_verdicts`, `cve_findings`, `api_metrics`).
- **[S]** Anciennes fig. 4.6/4.7 (classes) → annexe B ; fig. 4.9/4.10 (séquences) → annexe B.
- **[A]** §4.8 **« La chaîne de détection en flux »** + **fig. 4.4 (nouvelle)** avec budget de temps : WAF temps réel → Log Router ≤ 10 s → Pub/Sub → pipeline ≤ 20 s → job à la minute (fenêtre 5 min, dédup SHA-256) ≤ 60 s → enrichissement ≤ 15 s → API < 1 s → tableau de bord ≤ 10 s ; « ≈ 30 s au mieux, ≈ 2 min en régime courant, < 3 min par construction ». Score d'incident (somme pondérée, +15 si ≥ 2 tactiques, plafond 100). Alertes A1–A3. Remplace l'ancienne fig. 4.8 (≤ 20 min).
- **[M]** §4.10 Registre des décisions : **[A] D9** « détection en flux » (04/09/2026).

### Chapitre 5 — Réalisation (19 p. → 11 p.)
- **[M]** §5.1 Dépôt : arbre réel (`terraform/`, `api/`, `dashboard/`, `ml-pipeline/`, `demo/gate-tests/`) en annexe A.
- **[M]** §5.2 F2 condensé (cinq exceptions au « tout est en code »).
- **[A]** §5.3 **fig. 5.1 (nouvelle) chaîne 8 étapes / 4 portes / durées mesurées** ; **tab. 5.1 « cinq refus provoqués »** avec identifiants de run ; **fig. 5.2 capture Trivy** (porte 6) ; refus non provoqué du 20/08 conservé.
- **[M]** §5.4 F4 : collecte en flux ; **tab. 5.2 (7 règles R1–R7)** ; qualification assistée (encodeur `sa-ml-embed` séparé) ; API ; **[A] fig. 5.3 MFA (3 captures)** ; **fig. 5.4 vue d'ensemble, 5.5 détections, 5.6 incidents, 5.7 santé des règles + vulnérabilités** (captures réelles) ; **[S]** anciennes fig. 5.2–5.4.
- **[A]** §5.5 **« Mise en service d'ELSON sur le socle »** (~3 p.) : prérequis et procédure (6 étapes), ce qui a été mis en service, **fig. 5.8 (page d'accueil) et 5.9 (parcours contributeur, 4 captures)**, trois choix défendus (trafic pilote servi depuis staging pendant le rodage ; instance de base partagée avec bases séparées ; pas de HA en recette), portée de l'isolation, **tab. 5.3 frontière de responsabilité**.
- **[M]** §5.6 Conduite du projet : tâches quotidiennes ; **tab. 5.4 difficultés (7, dont la 7e : alerte à 15 min → chaîne en flux)** ; **tab. 5.5 écarts É1–É5 (É4 et É5 nouveaux)** ; **fig. 5.10 planning pleine page** (gantt conservé + tableau des 9 phases, mis à jour avec le 07/09).

### Chapitre 6 — Validation (14 p. → 6 p.)
- **[M]** §6.1 Stratégie : quatre rangs de preuve ; campagne du 19–28/08 complétée le 07/09.
- **[M]** **tab. 6.1 campagne** : T1 conforme (re-test 07/09), T8 preuve = run Gitleaks 07/09, T9 = refus réel 20/08 + refus provoqués 07/09, T10 = inventaire zéro clé sur 8 comptes, T11 partiel (collecte < 30 s en flux ; alerte d'absence 36 min mesurée par lots ; A3 à re-mesurer). Bilan 10/2/0.
- **[S]** Ancienne fig. 6.1 (résultats) remplacée par le tableau ; **[S]** ancienne fig. 6.2 (chronologie 19/08) remplacée par **fig. 6.2 (nouvelle) chronologie du 07/09** (23:25:38 → ≤ 23:27:43 → 23:28:01) ; le scénario du 19/08 reste décrit en texte comme état « par lots ».
- **[A]** **fig. 6.1 capture Kali** (13 charges, 13 × 403).
- **[M]** §6.4 : liste de ce que le socle **ne détecte pas** conservée ; fig. 6.3 (précision) conservée.
- **[M]** **tab. 6.2 mesures** : ajout délai attaque → incident 2 min 05 s, chaîne 5 min 37 / 4 min 04, verdict d'une porte 46 s – 3 min 06.
- **[M]** §6.6 Confrontation NIST + objectifs fusionnés en **tab. 6.3** ; maturité CISA en un paragraphe.
- **[M]** §6.7 Limites et perspectives condensées (trois seuils commerciaux).

### Conclusion générale (3 p. → 1 p.)
- **[M]** Récapitulatif, résultats par objectif (avec réserves T6/T11), problèmes (3 des 7 difficultés), apports (entreprise, méthode, personnel), perspectives (3 seuils + 4 travaux + promotion vers prod à l'étiquette v1.0.0).

### Bibliographie et annexes
- **[A]** Références : Pub/Sub + Cloud Scheduler, RFC 6238 (TOTP), FastAPI, Next.js, RFC 5737 ; dates de consultation 07/09/2026.
- **[M]** Annexe A : arbre du dépôt, variables par environnement (dont `detect_schedule`), module `run-service`, extrait `app-delivery.yml` (réel), WIF, pare-feu, règle R6 (extrait simplifié — à remplacer par le SQL réel), test T12.
- **[A]** Annexe C : cinq captures GitHub Actions (run vert + 4 portes rouges).
- **[M]** Annexe D : relevés T1–T12 conservés avec les rangs et dates ; T1 renvoie au re-test du 07/09 ; protocole de qualification.
- **[M]** Annexe E : correspondance MITRE (R1–R7 + A1–A3).

---

## 4. Figures et captures : correspondance et noms de fichiers

### 4.1 Figures d'origine conservées, déplacées ou supprimées

| Ancienne | Sort | Nouvelle | Fichier |
|---|---|---|---|
| Fig. 1.1 organigramme | conservée | Fig. 1.1 | `fig1_1_organigramme.png` |
| Fig. 1.2 existant | conservée | Fig. 1.2 | `fig1_2_existant.png` |
| Fig. 1.3 solution | **supprimée** | — | (`fig1_3_solution.png` fourni) |
| Fig. 1.4 démarche | conservée | Fig. 1.3 | `fig1_4_demarche.png` |
| Fig. 2.1 périmétrique → ZT | conservée | Fig. 2.1 | `fig2_1_zerotrust.png` |
| Fig. 2.2 chaînes | **supprimée** (→ tab. 2.2) | — | (`fig2_2_chaines.png` fourni) |
| Fig. 2.3 qualification | conservée | Fig. 2.2 | `fig2_3_qualification.png` |
| Fig. 3.1 cas d'utilisation | conservée | Fig. 3.1 | `fig3_1_usecases.png` |
| Fig. 3.2 flux et frontières | conservée | Fig. 3.2 | `fig3_2_flux.png` |
| Fig. 3.3 matrice de risque | annexe | Fig. B.1 | `fig3_3_matrice.png` |
| Fig. 3.4 traçabilité | annexe | Fig. B.2 | `fig3_4_tracabilite.png` |
| Fig. 4.1 architecture globale | **remplacée** | Fig. 4.2 (TikZ) | — |
| Fig. 4.2 déploiement | **remplacée** | Fig. 4.2 (TikZ) | — |
| Fig. 4.3 couches | **supprimée** (→ tab. 4.1) | — | — |
| Fig. 4.4 plan d'identité | **remplacée** | Tab. 4.2 | — |
| Fig. 4.5 session MFA | conservée | Fig. 4.3 | `fig4_5_session_mfa.png` |
| Fig. 4.6 / 4.7 classes | annexe | Fig. B.3 / B.4 | `fig4_6_classes_domaine.png`, `fig4_7_classes_service.png` |
| Fig. 4.8 cycle de vie d'une alerte | **remplacée** | Fig. 4.4 (TikZ, chaîne en flux) | — |
| Fig. 4.9 / 4.10 séquences | annexe | Fig. B.5 / B.6 | `fig4_9_seq_phase1.png`, `fig4_10_seq_phase2.png` |
| Fig. 5.1 chaîne de livraison | **remplacée** | Fig. 5.1 (TikZ, 8 étapes / 4 portes) | — |
| Fig. 5.2–5.4 tableau de bord (démo) | **remplacées** | Fig. 5.4–5.7 (captures) | voir 4.2 |
| Fig. 5.5 planning | conservée | Fig. 5.10 (pleine page + tableau) | `fig5_5_planning.png` |
| Fig. 6.1 résultats | **remplacée** | Tab. 6.1 | — |
| Fig. 6.2 chronologie 19/08 | **remplacée** | Fig. 6.2 (TikZ, 07/09) | — |
| Fig. 6.3 précision | conservée | Fig. 6.3 | `fig6_3_precision.png` |
| Fig. B.1–B.12 relevés T1–T12 | conservées | Fig. D.1–D.12 | `figB1_T1.png` … `figB12_T12.png` |

### 4.2 Captures du 07/09/2026 : noms retenus et traitement

| Fichier d'origine | Nom retenu | Où | Traitement |
|---|---|---|---|
| `cap_01_232216.png` | `cap_mfa_login.png` | Fig. 5.3 gauche | — |
| `cap_02_232338.png` | `cap_mfa_totp.png` | Fig. 5.3 centre | — |
| `whatsapp_233327.jpeg` | `cap_mfa_authenticator.png` | Fig. 5.3 droite | recadrée sur `admin@menal-sarl.mr` (comptes Gmail retirés) |
| `cap_03_232538.png` | `cap_attack_kali.png` | Fig. 6.1 | — |
| `cap_04_232721.png` | `cap_dash_detections.png` | Fig. 5.5 | IP → `203.0.113.7` ; en-tête (sous-titre « 5 min ») recadré |
| `cap_05_232743.png` | `cap_dash_overview.png` | Fig. 5.4 | — |
| `cap_06_232801.png` | `cap_dash_incidents.png` | Fig. 5.6 | IP → `203.0.113.7` ; recadrée |
| `cap_07_232844.png` | `cap_dash_coverage.png` | non utilisée | (couverture 0 % sur 30 j : mentionnée en texte seulement) |
| `cap_08_232915.png` | `cap_dash_vulns.png` | Fig. 5.7 droite | recadrée |
| `cap_09_233019.png` | `cap_dash_rules.png` | Fig. 5.7 gauche | recadrée |
| `cap_10_233751.png` | `cap_ci_green.png` | Fig. C.1 | — |
| `cap_11_233836.png` | `cap_gate_trivy.png` | Fig. 5.2 | — |
| `cap_12_233907.png` | `cap_gate_jest.png` | Fig. C.5 | — |
| `cap_13_233934.png` | `cap_gate_pytest.png` | Fig. C.4 | — |
| `cap_14_234014.png` | `cap_gate_semgrep.png` | Fig. C.3 | — |
| `cap_15_234036.png` | `cap_gate_gitleaks.png` | Fig. C.2 | auteur et courriel floutés |
| `cap_16_235303.png` | `cap_elson_landing.png` | Fig. 5.8 | barre de favoris retirée |
| `cap_17_235518.png` | `cap_elson_login.png` | Fig. 5.9 | identifiant flouté |
| `cap_18_235538.png` | `cap_elson_contribute.png` | Fig. 5.9 | — |
| `cap_19_235556.png` | `cap_elson_validate.png` | Fig. 5.9 | — |
| `cap_20_235608.png` | `cap_elson_leaderboard.png` | Fig. 5.9 | — |

---

## 5. Points à valider par l'étudiant avant dépôt (hypothèses prises)

| # | Point | Hypothèse retenue dans la v2 | Action |
|---|---|---|---|
| **V1** | **Cadence réelle des règles.** Le document de supervision décrit des requêtes planifiées BigQuery toutes les 5 min (fenêtre 15 min, export par lots ≈ 5–10 min) ; les annotations manuscrites visent « temps réel / 1,5 min ». | La v2 présente une **évolution datée du 04/09 (D9, É5)** : Log Router → Pub/Sub → service de normalisation (Storage Write API) → Cloud Scheduler chaque minute → job de détection (fenêtre 5 min). | Si ce n'est pas encore ce que fait le code : soit l'implémenter avant la soutenance (Terraform `detection` : sink Pub/Sub, `google_pubsub_subscription` push vers le service pipeline, `google_cloud_scheduler_job` `* * * * *` → `gcloud run jobs execute`), soit ramener le rapport à la formulation prudente « toutes les 5 min, ≤ 20 min » (§4.8, fig. 4.4, tab. 6.1, tab. 6.2, résumé, conclusion). |
| **V2** | Sous-titre du tableau de bord « Résultat des règles Sigma (BigQuery, réévaluées toutes les 5 min) ». | Recadré hors capture. | Mettre à jour le texte dans `dashboard/` (« réévaluées chaque minute ») et reprendre la capture, sinon un membre du jury lira « 5 min » en démonstration. |
| **V3** | Chronologie du 07/09 : 23:25:38 (envoi), 23:25:44–23:26:06 (horodatage des événements), ≤ 23:27:43 (47 détections et incident affichés), 23:28:01 (verdict). | Délai attaque → incident affiché **2 min 05 s**, verdict à 2 min 23 s. | Confirmer sur `detections.detected_at` et `alert_enrichment` l'heure d'écriture réelle ; si disponible, ajouter la mesure « première détection écrite à … » dans tab. 6.2. |
| **V4** | Haute disponibilité Cloud SQL en staging : `data.postgresql.txt` dit `REGIONAL`, le rapport dit `false` (coût 41 €). | `false` en staging, `true` en prod. | Vérifier `gcloud sql instances describe menal-db-staging --format='value(settings.availabilityType)'` ; si `REGIONAL`, corriger tab. A.1, §4.7.1, §5.5.2 et le paragraphe coût (§6.5) — le coût d'août devrait alors être réexpliqué. |
| **V5** | Coût de septembre après D9 (Pub/Sub, planificateur à la minute, service de normalisation). | « projection de quelques euros, à relever à la clôture de septembre ». | Relever la facturation fin septembre ; mettre à jour tab. 6.2 si le chiffre est disponible avant la soutenance. |
| **V6** | Alerte A3 (absence de journaux, 10 min) : non re-mesurée depuis le passage en flux. | T11 laissé **partiel**. | Provoquer une interruption du routage, chronométrer la notification ; si < 10 min → T11 conforme (tab. 6.1, conclusion, résumé : « onze conformes, un partiel »). |
| **V7** | Poids du score d'incident. | Décrit qualitativement (« somme pondérée par la sévérité, +15 si ≥ 2 tactiques, plafond 100 »). | Vérifier les poids exacts dans `api/` et les citer si le jury les demande (les ajouter au §4.8 si souhaité). |
| **V8** | Nombre de vecteurs ATT&CK : 872 passages pour 697 techniques (v17.1) ; la capture « Couverture » indique « 2 techniques observées sur 872 référencées ». | 872 vecteurs / 697 techniques et sous-techniques. | Vérifier `SELECT COUNT(*) FROM attack_embeddings` et le nombre de techniques distinctes. |
| **V9** | T10 : « tentative de déploiement depuis une branche non autorisée : jeton refusé » datée du 07/09 ; l'inventaire « 8 comptes, 0 clé » est daté du 07/09 (document de preuves). | Rang 3–4. | Si la tentative depuis une branche non autorisée n'a pas été rejouée le 07/09, garder la date du relevé d'août (20/08) dans tab. 6.1. |
| **V10** | Règle R6 en annexe A : **extrait simplifié rédigé pour le rapport**, non copié du dépôt. | Illustratif. | Remplacer par le SQL réel de `ml-pipeline/rules/` (garder ~20 lignes). Idem pour le test T12 (`tests/test_t12_proof_tables_readonly.py`) et l'extrait WIF/pare-feu. |
| **V11** | ELSON servie depuis staging pendant le rodage ; prod « déclarée dans le dépôt ». | Choix défendu au §5.5.2. | Confirmer que `terraform/envs/prod` existe bien dans le dépôt (même vide de ressources appliquées). Si le domaine public est déjà servi par le projet prod, réécrire §4.2.1, fig. 4.1 et §5.5.2 en conséquence. |
| **V12** | Nombre d'utilisateurs / de contributions ELSON, date de la compétition. | Non chiffrés. | Optionnel : une phrase au §1.2 si des chiffres publics existent. |
| **V13** | Remerciements et dédicace. | Reprises et légèrement reformulées. | Relire et personnaliser. |

---

## 6. Compilation et remise

- Sources : `rapport_v2/main.tex` + `chapitres/*.tex` + `figs/` (64 fichiers) ; compiler avec `pdflatex main.tex` **trois fois** (références, sommaire, `lastpage`).
- Packages requis (tous présents dans MiKTeX/TeX Live complet) : babel-french, mathptmx, geometry, setspace, fancyhdr, lastpage, titlesec, graphicx, caption, booktabs, tabularx, longtable, makecell, colortbl, xcolor, enumitem, pdfpages, tcolorbox, tikz, pifont, listings, placeins, hyperref, microtype.
- Le préambule bascule automatiquement sur `\usepackage[french,provide=*]{babel}` si `french.ldf` est absent ; avec babel-french complet, la césure française et l'espacement automatique de la ponctuation s'appliquent (la pagination peut varier de ± 1 page ; les heures `23:25:38` sont protégées par la macro `\nas{}`).
- La page de garde et le formulaire de validation sont les pages 1–2 du PDF d'origine (`figs/cover_pages.pdf`) ; **mettre à jour l'année, le titre et les noms si la page de garde officielle change**.
- Pagination `n/N` : N est le dernier numéro de page arabe (annexes comprises), comme dans la version d'origine.

---

## 7. Préparation de la soutenance : questions probables et réponses préparées par la v2

| Question probable du jury | Où répondre |
|---|---|
| Pourquoi 3 minutes et non « temps réel » ? Où est le délai ? | §4.8 et fig. 4.4 : le délai est dans l'acheminement (Pub/Sub ≤ 10 s, écriture ≤ 20 s) et la cadence du job (≤ 60 s), pas dans le calcul ; mesure 2 min 05 s (fig. 6.2). |
| Pourquoi la production tourne sur « staging » ? | §5.5.2 : rodage de trois semaines pour calibrer R1/R2 sur trafic réel ; topologie identique ; bascule = DNS + plan répété (41 min). |
| Une porte qui n'a jamais refusé est-elle une porte ? | §5.3.2 et tab. 5.1 : cinq refus provoqués rejouables (`demo/gate-tests`) + un refus réel (20/08). |
| Que fait le MFA de plus qu'un second facteur ? | §4.6 : jeton intermédiaire sans rôle, compteurs par identifiant et par jeton, algorithme figé, graine dans Secret Manager. |
| Pourquoi une seule instance Cloud SQL pour deux applications ? | §5.5.2 et §4.7.1 : coût fixe dominant, séparation logique vérifiée quotidiennement, réversible par paramètre. |
| Pourquoi BigQuery plutôt qu'un SIEM ? | §2.3 (tab. 2.3) et D6 : un moteur pour journaux, règles et vecteurs ; K1/K2. |
| Que ne détecte pas le socle ? | §6.4 : liste explicite (mouvement latéral, exfiltration vers destination autorisée, action de l'administrateur, fraude métier, attaque distribuée). |
| Pourquoi deux tests restent partiels ? | §6.2 : T6 (création hors code par l'administrateur), T11 (A3 non re-mesurée) — correctifs identifiés dans les perspectives. |

---

## 8. Révision v3 (09/09/2026) — alignement sur l'architecture réelle et revue finale

Sources supplémentaires exploitées : captures console (IAM, Cloud Run, Secret Manager, KMS), relevés `gcloud`/`bq` du 08/09/2026 (comptes de service, clés, fédération, droits du jeu de données, secrets, ingress, Cloud SQL, connecteur VPC, plage d'appairage, volumes BigQuery, job d'isolation), pages signées (confidentialité, dépôt, attestation de stage), captures anonymisées fournies par l'étudiant.

### 8.1 Écarts entre la v2 et la réalité, et corrections appliquées

| # | Ce que disait la v2 | Ce que montrent les preuves | Correction dans la v3 |
|---|---|---|---|
| R1 | Ingestion par Pub/Sub, écriture par Storage Write API, service « pipeline » | Aucun sujet Pub/Sub ni service pipeline ; le puits Log Router écrit dans BigQuery (l'agent de journalisation est WRITER du jeu de données) ; job Cloud Run `menal-realtime-detector-staging` | Chaîne réécrite : puits en flux → job de détection à la minute → job d'enrichissement → encodeur interne (§2.5.9, §4.8, fig. 4.4, D9, É5, difficulté 7, résumé) |
| R2 | Sortie VPC directe, sous-réseau `sub-run` 10.10.0.0/24, règles sur l'étiquette `run-app` | Connecteur d'accès VPC serverless `menal-vpc-connector-stg` 10.0.3.0/28 ; plage d'appairage `google-services-staging` 10.20.0.0/16 | §4.4, fig. 4.2, annexe A (module `run-service`, pare-feu), É1 et difficulté 5 réécrits |
| R3 | Cloud SQL « connecteur IAM » | Instance `menal-db-staging`, 10.20.0.3, `ipv4Enabled=false`, `sslMode=ENCRYPTED_ONLY`, rôle Client Cloud SQL, bases `postgres`/`menal_db`/`elson_db`, job quotidien `elson-sql-isolation-check` (4 contrôles) | §4.7.1, T3, T4, annexe D |
| R4 | Administrateur « sans rôle propriétaire » ; compte Compute par défaut « sans rôle » | Administrateur propriétaire du projet ; compte Compute par défaut avec rôle Éditeur hérité ; tableau de bord avec lecture résiduelle du jeu de données | Matrice des identités réécrite sur l'inventaire réel ; plan d'amélioration (tab. 6.4, n°1 et n°2) |
| R5 | Table `api_metrics`, dataset `menal_security` | Tables réelles : `raw_logs`, `access_logs`, `security_events`, `detections`, `alert_enrichment`, `attack_embeddings`, `analyst_verdicts`, `cve_findings` ; dataset `menal_security_staging` chiffré par `menal-api-key-staging` | Tab. 4.3 avec volumes du 08/09 (232 254 / 80 307 / 63 269 / 284 / 282 / 23 / 872) |
| R6 | Secrets décrits sans inventaire | 9 secrets, un lecteur par secret, 8 chiffrés par `menal-secrets-key-staging`, 1 par une clé Google | §4.5, annexe D, plan d'amélioration n°3 |
| R7 | ELSON en un seul service | `elson-web-staging` + `elson-api-staging`, identité `sa-elson`, 5 secrets | §5.5 |
| R8 | Anciens relevés B1–B12 avec les noms `socle-recette`, `socle-pg`, `elson.recette…` | Noms périmés, capture BigQuery inadaptée à T11 | Supprimés ; annexe D refaite avec les relevés du 08/09 ; T8/T9 renvoient aux portes du 07/09 |
| R9 | Deux scénarios (19/08 par lots, 07/09 en flux) | Le scénario du 19/08 appartient à l'ancienne conception | Un seul scénario (07/09) ; le 19/08 réduit à sa mesure de référence (15 min 05 s) |
| R10 | Seuil 0,60 « les candidats au-dessus du seuil sont écrits » | Le relevé BigQuery montre un candidat R2 → T1498 à 0,44 conservé avec le verdict | Les trois candidats sont écrits avec leur score ; sous 0,60 ils sont marqués incertains (part « non mappée » de la vue d'ensemble) |

### 8.2 Forme et conformité

- Pages liminaires dans l'ordre demandé : page de garde ESPRIT, engagement de confidentialité signé, formulaire de dépôt signé ; l'attestation de stage n'est pas incluse dans le rapport ; la page de fin du modèle ESPRIT (quatrième de couverture) clôt le document.
- Aucune coupure de mot en fin de ligne (`\hyphenpenalty=10000`), justification conservée grâce à une tolérance et une élasticité verticale plus larges ; aucune ligne débordante (> 5 pt) ; aucune référence indéfinie.
- Tableaux fermés à en-tête grisé ; symboles ✓ (conforme) et ■ orange (partiel) ; code en Courier dans les annexes ; captures anonymisées (IP RFC 5737, courriels floutés).
- Diagramme de déploiement redessiné (grille orthogonale, aucun croisement, repères J pour les journaux), en pleine page paysage.
- Suppression de toute formulation faible (« à confirmer », « à relever », « il faudrait ») et de la mention d'un assistant de programmation.
- Corps : Introduction générale p. 1 → Conclusion générale p. 45 ; 81 pages au total (page de fin comprise). Les heures de la journée ont été retirées partout où elles n'étaient pas nécessaires (job d'isolation, écran ELSON) ; seules subsistent les dates des relevés et la chronologie du scénario du 07/09.
- Ajouts : tableau des identifiants (Tab. 1.3) ; plan d'amélioration (Tab. 6.4) ; tableau des volumes de l'entrepôt (Tab. 4.3).

### 8.3 Anti-plagiat

Le texte a été confronté aux documents sources fournis (rapport initial, documents techniques) sur des séquences de douze mots : aucun recouvrement avec les documents techniques (< 0,3 %), 14 % de recouvrement avec le propre brouillon de l'étudiant (version du 28/08, non déposée), concentré sur les légendes, les libellés de tableaux et le planning. Les passages génériques (introduction, problématique, définitions, stratégie de validation) ont été réécrits. Les définitions normatives (Zero Trust, DevSecOps, SIEM) sont reformulées et sourcées ; aucune citation textuelle de plus de quinze mots n'est reprise d'une source externe.

### 8.4 Points restant à la charge de l'étudiant avant la soutenance

| # | Action | Où cela apparaît |
|---|---|---|
| 1 | Retirer le rôle Éditeur du compte Compute par défaut et désactiver le compte ; retirer le droit de lecture de `sa-dashboard-staging` sur le jeu de données ; passer `dashboard-password-staging` sous la clé KMS du socle. Après exécution, mettre à jour la matrice des identités (§4.5) et le plan d'amélioration (Tab. 6.4). | Tab. 4.2, Tab. 6.4 |
| 2 | Chronométrer l'alerte A3 (interrompre le puits de journaux dix minutes) ; si la notification arrive dans le délai, passer T11 en conforme (Tab. 6.1, §6.2, conclusion, résumé : « onze conformes, un partiel »). | Tab. 6.1 |
| 3 | Confirmer la cadence exacte du job `menal-realtime-detector-staging` dans Cloud Scheduler (« chaque minute » est la valeur retenue dans le rapport) et corriger le sous-titre du tableau de bord « réévaluées toutes les 5 min ». | §4.8, §5.4.2 |
| 4 | Remplacer les extraits illustratifs de l'annexe A (règle R6, test T12, WIF, pare-feu) par les fichiers réels du dépôt. | Annexe A |
| 5 | Relever la facture de septembre et mettre à jour Tab. 6.2 si le chiffre est disponible. | §6.5 |
| 6 | Le document ELSON annoncé n'a pas été reçu : à réception, compléter §1.2 (données traitées, risques) et §5.5 sans dépasser le budget de pages. | §1.2, §5.5 |
