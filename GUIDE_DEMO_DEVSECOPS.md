# Guide de tournage — DevSecOps : la chaîne de livraison `app-delivery.yml`

> Suit **exactement les 2 diagrammes de séquence du rapport**. Les **jobs GitHub Actions se lisent
> comme le diagramme** : *Portes d'analyse → Build & scan (Trivy) → Déploiement (WIF, digest)*.
> - **Phase 1 — demande de fusion (PR)** : Portes d'analyse + Tests **+ Build & scan image**,
>   **aucune publication, aucun déploiement, aucune authentification cloud**.
> - **Phase 2 — fusion sur `main`** : **publication + déploiement par digest sha256** (WIF, sans clé)
>   + smoke test à travers le WAF.
>
> Chaîne unique : `.github/workflows/app-delivery.yml`. Vérifié en réel le 07/09 sur
> `menal-zero-trust-staging` / dépôt `Mansour37/menal-zero-trust`.

---

## 0. Ce que tu prouves

« Le code ne part en production que s'il **franchit toutes les portes** ; **chaque** porte
**arrête réellement** la chaîne face à une vraie faille ; et quand ça déploie, c'est **sans aucune
clé**, sur l'**empreinte sha256** exacte de l'image scannée. »

Les jobs (nomenclature du diagramme) :

| Job GitHub Actions | Rôle | Phase | Bloquant |
|---|---|---|---|
| **Portes d'analyse — Gitleaks & Semgrep** | secrets + SAST (612 règles, diff-aware) | 1 (PR) + 2 | oui |
| **Tests API (pytest)** | tests unitaires + contrat API | 1 (PR) + 2 | oui |
| **Tests dashboard (jest)** | tests dashboard | 1 (PR) + 2 | oui |
| **Build & scan image API (Trivy)** | build image + scan CVE CRITICAL | 1 (PR) + 2 | oui |
| **Build & scan image dashboard (Trivy)** | build image + scan CVE CRITICAL | 1 (PR) + 2 | oui |
| **Déploiement API (WIF, digest)** | publication + Cloud Run par digest | **2 (main)** | — |
| **Déploiement dashboard (WIF, digest)** | publication + Cloud Run par digest | **2 (main)** | — |
| **Tests E2E** | tests de bout en bout | 2 (main) | oui |

> Actions cloud (`auth`, `setup-gcloud`, `deploy-cloudrun`) **épinglées au SHA** (supply-chain).

---

## 1. Les runs réels à ouvrir (onglets)

| Onglet | Run | Montre |
|---|---|---|
| **A — Phase 1 : tout passe, rien n'est déployé** | [`34161067711`](https://github.com/Mansour37/menal-zero-trust/actions/runs/34161067711) (PR) | Portes d'analyse ✅ · Tests API ✅ · Tests dashboard ✅ · **Build & scan image API/dashboard ✅** → **Déploiement API/dashboard = skipped** |
| **B — Phase 2 : déploiement par digest** | [`34161242588`](https://github.com/Mansour37/menal-zero-trust/actions/runs/34161242588) (main) | **Déploiement API/dashboard (WIF, digest) ✅** — publication `@sha256:…`, deploy par digest, smoke via WAF |
| **C — chaque porte bloque** | tableau §3 | 5 runs rouges, une vraie faille par porte |

> Onglet A : le graphe montre les **Portes d'analyse** et **Build & scan** en vert, et les nœuds
> **Déploiement** en **gris (skipped)** → sur une PR, on scanne mais **on ne publie ni ne déploie**.

---

## 2. Déroulé filmé (calqué sur les 2 diagrammes)

### PHASE 1 — Demande de fusion : contrôles + build + scan, rien n'est déployé
`[ÉCRAN : Onglet A — run 34161067711]`
« Sur une demande de fusion, ma chaîne passe ses **portes d'analyse** — secrets, analyse statique,
tests — puis **construit et scanne les images** (Trivy). Tout est vert. Mais les nœuds de
**déploiement sont ignorés** : sur une PR, on contrôle **sans jamais déployer, ni même
s'authentifier au cloud**. »

### PHASE 2 — Fusion sur `main` : publication + déploiement par digest
`[ÉCRAN : Onglet B — run 34161242588]`
« À la fusion sur `main`, et seulement là, les nœuds **Déploiement** s'exécutent :
1. **Authenticate to GCP** — jeton OIDC signé par GitHub (dépôt **et** branche) → identité de courte
   durée `sa-cicd` : **fédération WIF**, aucune clé.
2. **Push + resolve digest** — l'image est publiée puis **résolue en empreinte sha256**
   (`menal-api@sha256:03e863e2…`).
3. **Deploy to Cloud Run (par digest)** — révision épinglée à **ce digest exact** ; le trafic bascule.
4. **Smoke Test** — appel du service **par le domaine public**, donc **à travers le WAF** → **200**. »

> **Rollback (diagramme, opt)** : « en cas d'échec de la sonde, l'admin rebascule le trafic sur la
> révision précédente en une commande » — à mentionner.

### PREUVE LIVE — 0 clé / 8 comptes `[ÉCRAN : terminal]`
```bash
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
for sa in $(gcloud iam service-accounts list --project=menal-zero-trust-staging --format="value(email)"); do
  n=$(gcloud iam service-accounts keys list --iam-account="$sa" --managed-by=user --format="value(name)" | wc -l)
  printf "%s clé(s)   %s\n" "$n" "$sa"
done
```
→ **8 lignes, toutes à 0** (dont `sa-cicd@…`, le compte de la chaîne).

---

## 3. Chaque porte bloque une VRAIE faille (prouvé)

Le kit [`demo/gate-tests/`](demo/gate-tests/) injecte une vraie faille par porte via une PR jetable.
**Les 5 portes ont été testées : toutes bloquent** (runs consultables) :

| Porte | Faille injectée | Job rouge | Run bloqué |
|---|---|---|---|
| **Secrets** (Gitleaks) | clé secrète haute entropie | Portes d'analyse — Gitleaks & Semgrep | [34162328049](https://github.com/Mansour37/menal-zero-trust/actions/runs/34162328049) |
| **SAST** (Semgrep) | `eval()` + `subprocess(shell=True)` | Portes d'analyse — Gitleaks & Semgrep | [34162352660](https://github.com/Mansour37/menal-zero-trust/actions/runs/34162352660) |
| **Tests API** (pytest) | `assert 1 == 2` | Tests API (pytest) | [34162365703](https://github.com/Mansour37/menal-zero-trust/actions/runs/34162365703) |
| **Tests dashboard** (jest) | `expect(1).toBe(2)` | Tests dashboard (jest) | [34162380747](https://github.com/Mansour37/menal-zero-trust/actions/runs/34162380747) |
| **CVE image** (Trivy) | `PyYAML==5.3.1` (CVE-2020-14343 CRITICAL) | Build & scan image API (Trivy) | [34162396705](https://github.com/Mansour37/menal-zero-trust/actions/runs/34162396705) |

Reproduire en direct :
```bash
bash demo/gate-tests/run-gate-test.sh sast     # (ou secret | pytest | jest | trivy)
# ... la porte visée passe au rouge, aucun déploiement
bash demo/gate-tests/run-gate-test.sh clean <branche-affichée>
```

> **2 points d'honnêteté FORTS (à raconter toi-même)** — ces tests ont révélé **deux vrais défauts
> que j'ai corrigés** :
> 1. La porte **Semgrep** était **silencieusement cassée** (action dépréciée qui plantait en vert).
>    Réparée en **diff-aware** (bloque les nouveaux findings, pas la dette triée).
> 2. Des **tags d'action mutables** (`@v2`) sur les jobs de déploiement → **épinglés au SHA**
>    (durcissement supply-chain).
> « Tester ses propres portes, trouver deux failles, les corriger » = la meilleure preuve de maîtrise.

---

## 4. Pièges du jury (réponse honnête)

| Piège | Réponse |
|---|---|
| « Vos portes bloquent **vraiment** ? » | Oui, **les cinq** — un run rouge par porte (§3), une vraie faille chacune. |
| « Déploiement par **tag mutable** ? » | Non : **par digest** `@sha256:…` (run 34161242588). L'empreinte du commit = tag de traçabilité. |
| « Actions non épinglées ? » | Les actions cloud (auth/setup-gcloud/deploy-cloudrun) sont **épinglées au SHA**. |
| « Trivy sur la PR ? » | Oui : **build & scan dès la PR** ; on ne publie qu'une image déjà scannée. |
| « Semgrep, 0 finding ? » | **612 règles**, **diff-aware** ; **74 findings historiques** triés/baseline ; une nouvelle faille bloque (prouvé). |
| « Trivy laisse passer des CVE ? » | `--ignore-unfixed` (CVE sans correctif) ; **bloquant sur CRITICAL corrigeable**. |
| « Job **rouge** e2e-gcp sur main ? » | `continue-on-error: true` : sonde trafic réel, informative, jamais bloquante. |
| « Un contributeur peut-il déployer ? » | Non : sur une PR, `if: main` faux → **aucune auth cloud**, aucun déploiement. |

---

## 5. Checklist pré-tournage

```bash
# Phase 1 : Portes d'analyse + Build & scan verts, Déploiement skipped
gh run view 34161067711 --json jobs \
  -q '.jobs[] | "\(.conclusion)  \(.name)"'
# attendu : success sur analyse/tests/build-scan ; skipped sur les 2 Déploiement

# Phase 2 : déploiements par digest
gh run view 34161242588 --json jobs \
  -q '.jobs[] | select(.name|test("Déploiement")) | "\(.conclusion)  \(.name)"'
# attendu : success  Déploiement API / Déploiement dashboard

# Chaque porte bloque (failure attendu pour chacune)
for r in 34162328049 34162352660 34162365703 34162380747 34162396705; do
  echo "$r -> $(gh run view $r --json conclusion -q .conclusion)"
done

# Preuve 0 clé : la commande du §2 -> 8 lignes à 0
```

Si tout passe : **DevSecOps prêt à filmer** — pipeline `app-delivery.yml` lisible comme le diagramme,
Phase 1 (contrôle+scan sans déployer) / Phase 2 (déploiement sans clé, par digest), **chaque porte
prouvée bloquante**.

---

## 6. Plan de prise GitHub Actions — écran par écran

> Onglet **Actions → App Delivery**. Débit calme, curseur visible. ~5 prises.

**PRISE 1 — la chaîne (≈8 s)** : `Actions → App Delivery`, liste des runs. « ma chaîne tourne à chaque commit ».

**PRISE 2 — Phase 1 : contrôle + scan, aucun déploiement (≈20 s)** : run
**[34161067711](https://github.com/Mansour37/menal-zero-trust/actions/runs/34161067711)**.
Montre le graphe : **Portes d'analyse ✅**, **Tests API/dashboard ✅**, **Build & scan image API/dashboard ✅**,
et **Déploiement API/dashboard en gris (skipped)**. Clique **Build & scan image API (Trivy)** →
*Build image ✅*, *Trivy ✅*. « on scanne, on ne déploie pas ».

**PRISE 3 — une porte bloque (≈15 s)** : run **SAST
[34162352660](https://github.com/Mansour37/menal-zero-trust/actions/runs/34162352660)** →
**Portes d'analyse ❌** ; clique dessus → *Semgrep - SAST* rouge ; Déploiement = skipped.
(Enchaîne 2 s sur les autres runs rouges du §3.)

**PRISE 4 — Phase 2 : déploiement sans clé, par digest (≈20 s)** : run
**[34161242588](https://github.com/Mansour37/menal-zero-trust/actions/runs/34161242588)**.
- Clique **Build & scan image API** → étape *Push + resolve digest (sha256)* → montre
  `menal-api@sha256:03e863e2…`.
- Clique **Déploiement API (WIF, digest)** → *Authenticate to GCP ✅*, *Deploy to Cloud Run (par digest) ✅*,
  *Smoke Test ✅*.

**PRISE 5 — preuve terminal 0 clé (≈12 s)** : la commande du §2 → **8 lignes à 0 clé**.

> Montage : 1→2→3 = « la chaîne contrôle et **bloque** » ; 4→5 = « et quand ça passe, ça **déploie
> sans clé, par empreinte** ». Tout est cliquable et re-vérifiable par le jury.
