# Guide de tournage — Partie DevSecOps (chaîne 1)

> Segment vidéo **0:15 → 1:00** du script global. Objectif : prouver une **livraison
> sécurisée à portes bloquantes**, un **déploiement sans clé** (fédération WIF), et que
> **sur une PR rien ne s'authentifie au cloud**. Tout est vérifié en réel le 07/09 sur
> `menal-zero-trust-staging` / dépôt `Mansour37/menal-zero-trust`.

---

## 0. Ce que tu prouves (la thèse, en une phrase)

« Le code ne part en production que s'il **franchit des portes de sécurité** ; s'il en
échoue **une seule**, la chaîne **arrête tout et ne déploie rien** ; et quand elle déploie,
elle le fait **sans aucune clé stockée**, par identité fédérée de courte durée. »

Les **portes réelles** du workflow `ci.yml` (dans l'ordre) :

| # | Porte | Outil | Job | Bloquant ? |
|---|---|---|---|---|
| 1 | Secrets | **Gitleaks** | Security Scans | oui |
| 2 | SAST (code) | **Semgrep** | Security Scans | oui |
| 3 | Tests API | **pytest** | Unit Tests | oui |
| 4 | Tests dashboard | **jest** (`npm test`) | Dashboard Unit Tests | oui |
| 5 | CVE image | **Trivy** (CRITICAL) | Build & Deploy API | oui *(sur main)* |
| → | Déploiement | **WIF** (sans clé) → Cloud Run | Build & Deploy | seulement sur `main` |

---

## 1. Préparer 2 onglets navigateur AVANT de filmer

> **Une seule chaîne de livraison** (`ci.yml`). Les deux onglets ci-dessous ne sont **pas
> deux chaînes** : ce sont **deux exécutions de la MÊME chaîne**, avec deux issues (bloquée /
> réussie). C'est le message à tenir : *« voici ma chaîne quand une porte échoue, et la voici
> quand tout passe »*. (Les autres fichiers `.github/workflows/` ne sont pas des chaînes de
> livraison concurrentes : `terraform.yml` = infrastructure, `e2e.yml` = tests, `elson-ci.yml`
> = CI propre à l'app Elson. La livraison du socle, c'est **`ci.yml`, une seule**.)

**Onglet A — la porte qui BLOQUE (le run rouge) :**
`https://github.com/Mansour37/menal-zero-trust/actions/runs/32725635226`
→ Tu dois voir : **Security Scans = ❌ (Semgrep - SAST)**, et en dessous
**Build & Deploy API = ⏭️ skipped**, **Build & Deploy Dashboard = ⏭️ skipped**.
C'est **la preuve maîtresse** : une porte a échoué → le déploiement n'a **jamais** eu lieu.

**Onglet B — le run VERT (déploiement réussi) :**
`https://github.com/Mansour37/menal-zero-trust/actions/runs/34140119577`
→ Toutes les portes vertes → **Build & Deploy** exécuté. (C'est ton propre commit récent :
« le pipeline n'est pas raconté, il a tourné sur ce travail même ».)

> Astuce cadrage : dans l'onglet A, déplie le job **Security Scans** pour montrer la ligne
> rouge **Semgrep - SAST**, puis scrolle pour montrer les 2 jobs **skipped**. C'est le plan
> le plus parlant de tout le segment.

---

## 2. Le déroulé filmé — démonstration sur les DEUX runs de la même chaîne

> Idée : on montre la chaîne **quand tout valide** (chaque porte au vert), puis la **même
> chaîne quand une porte bloque**. Les portes de sécurité sont exactement les mêmes ; seule
> l'issue change.

### (a) 0:15–0:38 — Le run VERT : **toutes les portes valident** (onglet B)
`[ÉCRAN : Onglet B — run vert 34140119577, vue d'ensemble des jobs, puis on déplie]`
« Voici ma chaîne de livraison sur un vrai commit. Elle passe par toutes ses portes, et
**chacune est au vert** :
- recherche de **secrets** — Gitleaks : rien de compromis ;
- **analyse statique** du code — Semgrep : aucune faille ;
- **tests** — API et dashboard : au vert ;
- **analyse de l'image** — Trivy : aucune vulnérabilité critique.
Et **seulement parce que tout est vert**, la chaîne construit puis déploie. »

`[déplier "Security Scans" → montrer Gitleaks ✓ et Semgrep ✓ ; puis "Build & Deploy API"
→ montrer "Trivy - CVE Scan (bloquant sur CRITICAL) ✓" puis "Deploy to Cloud Run ✓"]`

> ⚠️ **Le ❌ que le jury va voir, à assumer en UNE phrase** : le dernier job,
> *« E2E Tests (pipeline réel, gcp/slow) »*, est **rouge**. C'est **voulu** : il est marqué
> `continue-on-error: true` dans `ci.yml` — c'est une sonde **de bout en bout sur le trafic
> réel** (BigQuery live), **informative, jamais bloquante**. Le déploiement ne dépend que de
> `security`, `test` et `dashboard-test` (voir les `needs:` dans `ci.yml`). Donc **un ❌ sur
> cette sonde ne peut pas laisser passer un déploiement** : les vraies portes, elles, sont vertes.
> Dis-le toi-même avant qu'on te le demande — ça te cote « honnête et maître de son pipeline ».

### (b) 0:38–0:52 — Le run ROUGE : **la même chaîne quand une porte bloque** (onglet A)
`[ÉCRAN : Onglet A — run rouge 32725635226]`
« Voici la **même** chaîne, sur un commit où l'analyse statique **Semgrep** détecte un
problème. Le job de sécurité échoue — et regardez : **Build & Deploy** est **ignoré**,
en gris. Rien n'est parti en production. La porte a réellement arrêté la chaîne. »

`[déplier "Security Scans" → Semgrep - SAST ❌ ; montrer "Build & Deploy API/Dashboard = skipped"]`

### (c) 0:52–1:05 — Le déploiement sans clé + preuve « 0 clé / 8 comptes » (LIVE)
`[ÉCRAN : rester sur le run vert, "Build & Deploy API" → étape "Authenticate to GCP", puis terminal]`
« Et ce déploiement se fait **sans aucune clé** : la chaîne présente un jeton signé par GitHub,
vérifié pour ce dépôt **et** cette branche, et reçoit une identité de courte durée — la
**fédération d'identité**. Je le prouve en direct : sur les huit comptes de service du projet,
l'inventaire des clés gérées par l'utilisateur renvoie **zéro** partout. »

```bash
# Preuve live : 0 clé user-managed sur les 8 comptes de service
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
for sa in $(gcloud iam service-accounts list --project=menal-zero-trust-staging --format="value(email)"); do
  n=$(gcloud iam service-accounts keys list --iam-account="$sa" --managed-by=user --format="value(name)" | wc -l)
  printf "%s clé(s)   %s\n" "$n" "$sa"
done
```
**Sortie attendue (8 lignes, toutes à 0) :**
```
0 clé(s)   110809493492-compute@developer.gserviceaccount.com
0 clé(s)   sa-enrich-job@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-pipeline@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-cicd@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-api@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-dashboard-staging@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-elson@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-ml-embed@menal-zero-trust-staging.iam.gserviceaccount.com
```

---

## 3. Le point fort à ne pas oublier (PR vs main)

Dans `ci.yml`, les jobs de déploiement portent `if: github.ref == 'refs/heads/main'`.
**Conséquence défendable :** sur une **PR**, la chaîne exécute toutes les portes mais **ne
s'authentifie jamais au cloud** — l'identité fédérée n'existe qu'à la fusion. Donc un
contributeur (ou un attaquant qui ouvrirait une PR) ne peut **rien** déployer, même en vert.
C'est exactement ce que montrent les 2 jobs **skipped** de l'onglet A.

---

## 4. Pièges du jury (et la bonne réponse, honnête)

| Piège probable | Réponse |
|---|---|
| « Vos portes bloquent **vraiment** ? » | Oui : run **32725635226**, **Semgrep** rouge → déploiement **skipped**. Blocage **réel et non provoqué**. |
| « Déploiement par **tag mutable**, pas digest ? » | Assumer : l'image porte **l'empreinte du commit** ; dire « empreinte du commit », **jamais** « digest immuable ». |
| « Trivy laisse passer des CVE ? » | Oui, `--ignore-unfixed` (CVE sans correctif amont) ; **bloquant sur CRITICAL corrigeable**. Honnête et documenté. |
| « Couverture de tests ? » | Basse côté dashboard (~3 %) — assumée ; les tests **existent et sont bloquants** (pytest + jest). Le sujet du projet est le **socle**, pas la couverture applicative. |
| « Il y a un job **rouge** sur votre run vert ! » | C'est `e2e-gcp`, marqué **`continue-on-error: true`** dans `ci.yml` : sonde de bout en bout sur trafic réel (BigQuery live), **informative, jamais bloquante**. Le déploiement dépend de `needs: [security, test, dashboard-test]` — pas d'elle. Un ❌ dessus **ne peut pas** laisser passer un déploiement. |
| « e2e bloquant ? » | Non — `continue-on-error: true`. Les **vraies** portes bloquantes sont Gitleaks, Semgrep, pytest, jest, Trivy CRITICAL. |

> **Règle d'or :** ne survends pas. « Portes bloquantes + 0 clé + PR qui ne déploie pas » est
> déjà fort **et** vrai. Chaque limite ci-dessus, tu l'assumes en une phrase — c'est ça qui te
> cote « solide » devant un jury.

---

## 5. Checklist pré-tournage (2 min)

```bash
# 1) Les 2 runs s'ouvrent bien (rouge + vert)
gh run view 32725635226 --json conclusion -q .conclusion   # -> failure
gh run view 34140119577 --json conclusion -q .conclusion   # -> success

# 2) La preuve 0 clé passe (copie la commande du §2c) -> 8 lignes à 0

# 3) reconfirmer la porte rouge (run rouge : Semgrep bloque)
gh run view 32725635226 --json jobs -q '.jobs[] | select(.name=="Security Scans") | .conclusion'  # -> failure

# 4) run VERT : toutes les portes BLOQUANTES vertes (le seul non-vert doit être e2e-gcp)
gh run view 34140119577 --json jobs \
  -q '.jobs[] | select(.name|test("Security Scans|Unit Tests|Dashboard Unit Tests|Build & Deploy")) | "\(.conclusion)  \(.name)"'
# attendu : "success" sur Security Scans, Unit Tests, Dashboard Unit Tests, Build & Deploy API, Build & Deploy Dashboard
```

Si tout passe : **la partie DevSecOps est prête à filmer** — une seule chaîne, montrée verte
(toutes portes valident) puis rouge (une porte bloque), + preuve live 0 clé.
