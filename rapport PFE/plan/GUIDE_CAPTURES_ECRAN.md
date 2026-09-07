# Guide de capture d'écran — Mémoire PFE MENAL

Document de travail — **à supprimer avant remise du mémoire** (il ne fait pas partie du mémoire).

Ce guide est la feuille de route pratique pour produire **toutes** les captures nécessaires au mémoire : les 27 figures du corps + les 16 preuves de l'annexe C. Chaque fiche indique la commande à exécuter, ce qui doit apparaître à l'écran, ce qui doit être masqué, et le nom de fichier à utiliser.

---

## 1. Règles générales (à lire avant toute capture)

### 1.1 Ce qui doit TOUJOURS être masqué

| Élément | Traitement |
|---|---|
| Identifiants de projet (`menal-prod-123456`) | Remplacer par `menal-prod` |
| Adresses IP réelles | Remplacer par `203.0.113.x` (documentation) |
| Adresses mail complètes des SA | Ne garder que le nom court (`sa-cicd`) |
| **Valeurs de secrets, jetons, clés** | **Masquer intégralement** — même factices |
| Empreintes d'images | Tronquer à 12 caractères |
| Données personnelles dans les alertes | Valeurs d'exemple cohérentes |
| Noms de personnes | Remplacer par « l'opérateur », « l'analyste » |

**Méthode de masquage : rectangle opaque noir, jamais de floutage.**

### 1.2 Ce qui doit TOUJOURS être visible

- **Horodatage** (une capture non datable n'est pas une preuve)
- **Code de retour / statut** (distingue un refus d'un échec technique)
- **Contexte suffisant** pour identifier l'outil

### 1.3 Format et nommage

- PNG, largeur ≥ 1200 px, texte lisible sans zoom
- Nommage : `FIG4-02_ma-trice-iam.png` → `FIG<chapitre>-<numéro>_<description>.png`
- Dossier de dépôt : `rapport PFE/latex/figures/`
- Légende obligatoire sous la figure : `Figure N — Titre. Source : <outil>, <date>.`

### 1.4 Capturer au moment de l'exécution

Ne jamais reconstituer une capture après coup. Exécuter le test, vérifier la capture (masquages inclus), **puis** passer au test suivant. Une campagne = une journée d'exécution + 30 min de contrôle par capture.

---

## 2. Ordre de travail recommandé (5 étapes)

| Étape | Contenu | Effort |
|---|---|---|
| **1** | Les 4 captures critiques (5.3, 6.2, 6.4, 6.8) | 1 jour |
| **2** | Captures immédiatement disponibles (10 figures) | 0,5 jour |
| **3** | Schémas à produire (1.2, 4.1, 5.6, 6.5, 6.6) | 1 jour |
| **4** | Annexe C — 16 preuves, pendant l'exécution des tests | 1 jour |
| **5** | Contrôle final de conformité de chaque capture | 0,5 jour |

---

## 3. LES 4 CAPTURES CRITIQUES (priorité absolue)

Ces quatre captures portent le mémoire à elles seules. Si le temps manque, ce sont celles-ci qu'il faut réussir.

### ⭐ CAPTURE 5.3 — La chaîne bloquée par un secret (Gitleaks)

**Ce qu'elle prouve :** les portes sont réellement bloquantes (carence C3).

**Protocole :**
1. Créer une branche de test dans le dépôt applicatif.
2. Ajouter un fichier contenant un secret factice au format reconnaissable (ex. `aws_access_key_id = AKIA…`, clé privée `-----BEGIN RSA PRIVATE KEY-----`, ou jeton `ghp_…`).
3. `git push origin branche-test`
4. Capturer l'écran GitHub Actions : l'étape **Gitleaks doit être en rouge (échec)**, et le pipeline doit s'arrêter là.

**À l'écran :** nom du workflow, étape Gitleaks en échec, message d'erreur, horodatage.
**À masquer :** la valeur du secret (même factice) — la capture doit montrer qu'il est *détecté*, jamais sa valeur.

**Attention :** ne pas montrer la ligne de code contenant le secret. Cadrer sur le résumé du workflow (l'étape rouge suffit).

---

### ⭐ CAPTURE 6.2 — L'écriture refusée dans les tables de preuve (T11)

**Ce qu'elle prouve :** le principe le plus distinctif — un moteur de détection ne peut pas modifier les preuves qu'il analyse (EX11).

**Protocole :**
1. Activer l'identité de la tâche d'enrichissement : `gcloud auth activate-service-account sa-enrich-job@menal-recette.iam.gserviceaccount.com --key-file=…` (avec une clé temporaire jetable, voir note).
2. Tenter une écriture dans `siem.raw_logs` :
   ```
   bq query --use_legacy_sql=false "INSERT INTO \`menal-recette.siem.raw_logs\` (…) VALUES (…)"
   ```
3. Tenter une suppression dans `siem.detections` :
   ```
   bq query --use_legacy_sql=false "DELETE FROM \`menal-recette.siem.detections\` WHERE 1=1"
   ```
4. **Capturer le refus** : message `Access Denied` / `Permission denied` de BigQuery, avec l'identité dans le message.
5. Contre-preuve : tenter l'écriture dans `siem.alert_enrichment` — elle **doit réussir** (capture séparée ou en bas du même écran).

**À l'écran :** l'identité utilisée, la requête, le message d'échec, l'horodatage.
**À masquer :** toute valeur de secret ; l'identifiant complet du projet si apparu.

> **Note sur la clé temporaire :** si WIF est utilisé côté CI, la création d'une clé pour ce test est elle-même un écart — utiliser un compte de service temporaire `sa-test-t11` créé *ad hoc*, et le supprimer après le test (capture de suppression = preuve bonus).

---

### ⭐ CAPTURE 6.4 — La dérive détectée et attribuée (T16)

**Ce qu'elle prouve :** les DEUX moitiés de la réponse au point bloquant B5 — la modification hors code est détectée **et** son auteur est identifié.

**Protocole :**
1. Créer manuellement une ressource depuis la console GCP (ex. une règle de pare-feu `drift-test-ingress-443`), en étant connecté avec un compte identifiable.
2. Exécuter `terraform plan` dans le dépôt d'infrastructure.
3. **Capture n°1** : le plan affichant la création/ajout de la ressource dérivée (`+ resource "google_compute_firewall" …`), avec le commentaire de dérive (ex. import d'un changement hors code).
4. **Capture n°2** : dans Cloud Logging, requête sur les journaux d'audit :
   ```
   protoPayload.methodName="v1.compute.firewalls.insert"
   ```
   montrant le `principalEmail` de l'auteur et l'horodatage.

**À l'écran :** les deux moitiés (détection + attribution). Les montrer dans des captures côte à côte dans le mémoire si possible.
**À masquer :** l'adresse IP d'origine de la session (remplacer par `203.0.113.x`).

---

### ⭐ CAPTURE 6.8 — La reconstruction complète chronométrée (T6.8)

**Ce qu'elle prouve :** la réponse directe à la dette n°1 de l'audit (reproductibilité).

**Protocole :**
1. Détruire l'environnement de recette : `terraform destroy` (capture du début, horodatée).
2. Relancer : `terraform apply`, **en mesurant le temps total** (commande `Measure-Command` sous PowerShell ou `time`).
3. Capturer la fin de l'apply : le code de sortie `0` + le tableau récapitulatif des ressources créées + le temps total affiché.
4. Vérification applicative : capturer le résultat de l'uptime check / `curl -I https://api.menal.dev` en succès.
5. **Idéal : filmer l'ensemble** (démo soutenance) — la capture fixe seule suffit pour le mémoire.

**À l'écran :** horodatage début et fin, durée totale, code de sortie.
**À masquer :** empreintes complètes de ressources si apparues.

---

## 4. FICHES PAR CHAPITRE

## Chapitre 1 — Cadre général (3 figures)

### Fig. 1.1 — Modèle de sécurité avant le projet *(déjà produit : slide de soutenance)*
Format : schéma, pas de capture. Rien à faire.

### Fig. 1.2 — Répartition des 41 critères de préparation *(schéma à produire)*
Format : graphique en barres empilées (4 statuts : satisfait / partiel / insatisfait / non évalué) à partir du tableau d'audit. Produire avec Python/Matplotlib ou un tableur.

### Fig. 1.3 — Extrait du rapport d'audit — matrice de synthèse
**Protocole :** ouvrir le rapport d'audit (tableau des 41 critères avec statuts).
**À l'écran :** 8-10 lignes du tableau avec les colonnes critère / statut / commentaire.
**À masquer :** noms de personnes, données personnelles.

---

## Chapitre 4 — Conception (3 figures)

### Fig. 4.1 — Modèle en couches et plans transversaux *(schéma à produire)*
Format : schéma (Mermaid fourni : `fig5_architecture_layers.mmd`). Exporter en PNG/PDF propre (voir section 7).

### Fig. 4.2 — Matrice des autorisations telle que provisionnée (IAM) — **disponible**
**Protocole :**
1. Console GCP → IAM → ouvrir la liste des membres du projet de recette.
2. Cadrer sur les comptes de service avec leurs rôles (sa-app-elson, sa-api-platform, sa-ml-embed, sa-enrich-job, sa-cicd).
**À l'écran :** colonnes Membre / Rôle / Conditions (s'il y en a) / Horodatage de la capture.
**À masquer :** identifiants complets de projets (`menal-recette` suffit), adresses mail complètes → ne garder que les noms courts des SA (ou masquer le domaine).

### Fig. 4.3 — Extrait du registre des décisions *(disponible)*
Capture de la table du registre des décisions dans le document de conception (Google Docs / Notion / le dépôt). Masquer le reste de l'écran par un rectangle.

---

## Chapitre 5 — Réalisation (12 figures)

### Fig. 5.1 — Arborescence du dépôt d'infrastructure *(disponible)*
**Protocole :** exécuter dans le dépôt `infra/` :
```
tree -L 3 --dirsfirst   # ou : Get-ChildItem -Recurse -Name (PowerShell)
```
Capturer la sortie.
**À masquer :** aucun secret dans cette vue — vérifier que le fichier `terraform.tfstate` n'apparaît PAS.

### Fig. 5.2 — Exécution complète de la chaîne de livraison *(disponible)*
**Protocole :** pipeline vert complet sur GitHub Actions (toutes les étapes vertes jusqu'au déploiement).
**À l'écran :** toutes les étapes visibles (Gitleaks → Semgrep → build → Trivy → push → deploy), success.

### Fig. 5.3 — ⭐ Refus n°1 — secret détecté → *voir section 3*

### Fig. 5.4 — Refus n°2 et 3 — analyse statique + vulnérabilité
**Protocole :**
1. **SAST :** injecter un code avec une vulnérabilité factice (ex. `eval(user_input)` Python) dans une branche de test, push, capturer Semgrep en rouge avec le finding `ERROR`.
2. **Trivy :** construire une image de test avec une dépendance vulnérable (ex. pinner une vieille version de `log4j` ou équivalent), push, capturer Trivy en rouge avec la CVE critique listée.
**À l'écran :** étape en échec + détail du finding (rule/severity) + horodatage.

### Fig. 5.5 — Chaîne d'infrastructure — plan et approbation en attente
**Protocole :** ouvrir une PR Terraform, capturer : le commentaire de `terraform plan` (résumé : `Plan: X to add…`) **et** l'état « awaiting approval » de l'environnement GitHub.
**À l'écran :** les deux éléments dans une seule capture si possible.

### Fig. 5.6 — Modèle de données de la supervision *(schéma à produire)*
Format : schéma des 4 tables SIEM (raw_logs → detections → alert_enrichment + attack_embeddings), avec les écrivains autorisés par table. Produire avec Mermaid/visio.

### Fig. 5.7 — Règle de détection et sa traduction, côte à côte *(disponible)*
**Protocole :** écran partagé : à gauche la règle Sigma, à droite sa traduction SQL. Capturer.
**À masquer :** tout identifiant réel de projet.

### Fig. 5.8 — Validation de fidélité après optimisation *(disponible)*
**Protocole :** exécuter le script de validation de similarité float32↔int8 du modèle ; capturer la sortie avec les métriques (> 0,99).

### Fig. 5.9 — Interface de l'analyste — vue des incidents *(disponible)*
**Protocole :** ouvrir le dashboard d'un compte `analyste`, capturer la vue liste des incidents.
**À masquer :** données personnelles dans les alertes (remplacer par valeurs d'exemple), adresses IP réelles.

### Fig. 5.10 — Alerte enrichie — technique et procédure *(disponible)*
**Protocole :** ouvrir le détail d'une alerte enrichie : technique ATT&CK rattachée + procédure recommandée affichée.

### Fig. 5.11 — Vulnérabilités réordonnées par menace observée
**Protocole :** ouvrir la vue de la boucle F6 (priorisation des CVE selon les techniques observées). Capturer l'ordre affiché.
**À l'écran :** le réordonnancement visible (comparaison avant/après si l'UI le permet).

### Fig. 5.12 — Démarrage à froid sur sept jours *(disponible — supervision)*
**Protocole :** Cloud Monitoring → graphique des latences de démarrage de ml-embed sur 7 jours.
**À l'écran :** le graphique avec l'échelle temporelle, moyenne ≈ 27 s, pic ≈ 94 s visible.

---

## Chapitre 6 — Validation (9 figures)

### Fig. 6.1 — T4 : refus de connexion directe aux données — **À exécuter**
**Protocole :**
1. Inventaire : `gcloud sql instances list` → capturer la colonne IP publique **vide**.
2. Depuis un hôte externe : `psql "host=<203.0.113.99> port=5432 dbname=postgres"` ou `openssl s_client -connect <ip>:5432` → **timeout / refus**. Capturer le message d'erreur de connexion.
**À l'écran :** les deux captures (inventaire + échec de connexion), horodatées.

### Fig. 6.2 — ⭐ T11 : écriture refusée → *voir section 3*

### Fig. 6.3 — T7 : inventaire vide et refus de création de clé — **À exécuter**
**Protocole :**
1. `gcloud iam service-accounts keys list --iam-account=sa-cicd@menal-recette.iam.gserviceaccount.com` → capturer la sortie « Listed 0 items ».
2. `gcloud iam service-accounts keys create key.json --iam-account=sa-cicd@…` → capturer le **refus** (politique d'organisation).
**À l'écran :** la sortie `0 items` + le message de refus, horodatés.

### Fig. 6.4 — ⭐ T16 : dérive → *voir section 3*

### Fig. 6.5 — Matrice de couverture des techniques *(graphique à produire)*
Format : graphique. Répartition des 188 techniques ATT&CK : détectées / partiellement / non détectées, avec dénominateur déclaré. Produire avec Python/Matplotlib.

### Fig. 6.6 — Comparaison des trois méthodes de rattachement *(graphique à produire)*
Format : graphique comparant (1) correspondance exacte, (2) mot-clé, (3) sémantique (ATT&CK-BERT) — précision top-1 / top-3. Produire avec Python/Matplotlib à partir du jeu d'évaluation (annexe F).

### Fig. 6.7 — Objectifs de service observés *(disponible)*
**Protocole :** Cloud Monitoring → uptime checks de la période d'observation.
**À l'écran :** disponibilité (%) + latence p95, sur la période.

### Fig. 6.8 — ⭐ Reconstruction complète → *voir section 3*

### Fig. 6.9 — Facturation réelle par poste *(disponible)*
**Protocole :** console GCP → Billing → rapport du mois, groupé par SKU/service.
**À l'écran :** chaque poste (Cloud Run, Cloud SQL, BigQuery, ect.) avec montant. **Masquer les montants exacts** si sensible : le jury a besoin des *postes*, pas du chiffre précis ? → **décision : montrer les montants**, c'est une preuve de maîtrise du coût ; masquer uniquement les totaux mensuels cumulés si trop élevés.

---

## 5. ANNEXE C — 16 preuves (une par test restant)

Chaque test produit **au minimum une capture sommaire** : commande + résultat. C'est le *volume* de l'annexe C qui démontre que la campagne a réellement eu lieu.

| Test | Commande / action | Capture attendue |
|---|---|---|
| **T1** | `curl` avec payload XSS/SQLi depuis l'extérieur | Réponse **403** de Cloud Armor (statut visible) |
| **T2** | Répétition d'échecs d'auth (ex. `curl -u mauvais:mot`) | Réponse **429** + alerte dans BigQuery (2 captures) |
| **T3** | Charge > seuil global (ab/ou script) | Service toujours **200** + trace dans les logs |
| **T4** | Voir Fig. 6.1 (hors annexe) | — |
| **T5** | `bq query` lecture `siem` avec SA d'app hébergée | Refus `Access Denied` |
| **T6** | `curl` ml-embed sans jeton, depuis le VPC | Refus 403 / 401 |
| **T7** | Voir Fig. 6.3 (hors annexe) | — |
| **T8** | Push image vulnérable → pipeline | Trivy en rouge, CVE listée |
| **T9** | `gcloud run deploy --image=docker.io/…` | Refus / image introuvable ; déploiement par tag refusé |
| **T10** | Push secret factice en tête de pipeline | Gitleaks rouge (cf. 5.3) |
| **T11** | Voir Fig. 6.2 (hors annexe) | — |
| **T12** | Stopper le sink 30+ min | Alerte émise (Cloud Monitoring) |
| **T13** | Action privilégiée (ex. apply) | Audit log avec `principalEmail` |
| **T14** | `curl https://example.com` depuis ml-embed | Échec connexion / timeout |
| **T15** | Injection de 10× volume nominal | Fin de job sans perte + durée |
| **T16** | Voir Fig. 6.4 (hors annexe) | — |
| **T17** | `gsutil ls gs://tf-state-menal` avec identité non autorisée | Refus `AccessDenied` |
| **T18** | PR élargissant les droits | Blocage « awaiting approval » |
| **T19** | Charge CPU anormale (ex. `stress`) | Alerte émise |
| **T20** | `curl` destination non autorisée depuis workload | Échec + (absence de trace = résultat attendu, le dire) |

> **Règle annexe C :** une capture par ligne = une ligne de tableau dans l'annexe. Garder le gabarit fiche de test (annexe E) rempli pour chaque test.

---

## 6. Checklist de conformité (à remplir pour CHAQUE capture)

| Exigence | ✅ |
|---|---|
| Horodatage visible | ☐ |
| Code de retour / statut visible | ☐ |
| Outil identifiable | ☐ |
| Aucune valeur de secret visible | ☐ |
| Pas d'adresse IP réelle | ☐ |
| Pas d'identifiant complet de projet | ☐ |
| Pas de nom de personne | ☐ |
| Pas de floutage (rectangles opaques uniquement) | ☐ |
| Largeur ≥ 1200 px | ☐ |
| Nommage conforme (`FIG5-03_gitleaks-echec.png`) | ☐ |
| Figure appelée dans le texte du chapitre | ☐ |
| Légende `Figure N — Titre. Source : <outil>, <date>.` | ☐ |

---

## 7. Export des schémas (Mermaid) en image

Les schémas sont fournis en `.mmd` dans `rapport PFE/latex/figures/` :

| Fichier .mmd | Figure du mémoire |
|---|---|
| `fig4_use_cases.mmd` | Fig. 4 — Cas d'utilisation (CH3) |
| `fig5_architecture_layers.mmd` | Fig. 4.1 — Modèle en couches (CH4) |
| `fig6_fluxes.mmd` | Fig. 4.2… (vue dynamique F1-F7) |
| `fig7_deployment.mmd` | Vue de déploiement (CH4/CH5) |
| `seq_cicd_pipeline.mmd` | Séquence CI/CD (CH5) |
| `seq_detection_flow.mmd` | Séquence détection (CH5) |
| `gantt_planning.mmd` | Fig. 3 — Gantt (5.10.4) |

**Export :**
```
npx -y @mermaid-js/mermaid-cli -i fig5_architecture_layers.mmd -o fig5_architecture_layers.png -w 1600
```
Ou, si `puppeteer` pose problème sous Windows : utiliser l'éditeur en ligne mermaid.live → copier le code → `Export PNG`. Vérifier ensuite la lisibilité (taille de police) et refaire les masquages éventuels.

---

## 8. État d'avancement (à cocher au fil de la campagne)

| # | Figure | Statut |
|---|---|---|
| 1 | Fig. 1.1 (déjà produite) | ✅ |
| 2 | Fig. 1.2 (graphique) | ☐ |
| 3 | Fig. 1.3 (audit) | ☐ |
| 4 | Fig. 4.1 (schéma) | ☐ |
| 5 | Fig. 4.2 (IAM) | ☐ |
| 6 | Fig. 4.3 (registre) | ☐ |
| 7 | Fig. 5.1 (arborescence) | ☐ |
| 8 | Fig. 5.2 (pipeline vert) | ☐ |
| 9 | **Fig. 5.3 (Gitleaks)** | ☐ |
| 10 | Fig. 5.4 (Semgrep/Trivy) | ☐ |
| 11 | Fig. 5.5 (plan + approbation) | ☐ |
| 12 | Fig. 5.6 (schéma données) | ☐ |
| 13 | Fig. 5.7 (Sigma↔SQL) | ☐ |
| 14 | Fig. 5.8 (fidélité) | ☐ |
| 15 | Fig. 5.9 (dashboard) | ☐ |
| 16 | Fig. 5.10 (alerte enrichie) | ☐ |
| 17 | Fig. 5.11 (priorisation CVE) | ☐ |
| 18 | Fig. 5.12 (cold start 7j) | ☐ |
| 19 | Fig. 6.1 (T4 refus direct) | ☐ |
| 20 | **Fig. 6.2 (T11 refus écriture)** | ☐ |
| 21 | Fig. 6.3 (T7 clés) | ☐ |
| 22 | **Fig. 6.4 (T16 dérive)** | ☐ |
| 23 | Fig. 6.5 (graphique couverture) | ☐ |
| 24 | Fig. 6.6 (graphique comparatif) | ☐ |
| 25 | Fig. 6.7 (SLO) | ☐ |
| 26 | **Fig. 6.8 (reconstruction)** | ☐ |
| 27 | Fig. 6.9 (facturation) | ☐ |
| A1-A16 | Annexe C — 16 preuves | ☐ |

---