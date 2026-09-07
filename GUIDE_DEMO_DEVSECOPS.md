# Guide de tournage — DevSecOps : la chaîne de livraison `app-delivery.yml`

> Suit **exactement les 2 diagrammes de séquence du rapport** :
> - **Phase 1 — demande de fusion (PR)** : contrôles **+ build + scan**, **aucune publication,
>   aucun déploiement, aucune authentification cloud**.
> - **Phase 2 — fusion sur `main`** : **publication au registre + déploiement par digest sha256**
>   (WIF, sans clé) + smoke test à travers le WAF.
>
> **Une seule chaîne** : `.github/workflows/app-delivery.yml`. Tout est **vérifié en réel** le 07/09
> sur `menal-zero-trust-staging` / dépôt `Mansour37/menal-zero-trust`.

---

## 0. Ce que tu prouves

« Le code ne part en production que s'il **franchit toutes les portes** ; **chaque** porte
**arrête réellement** la chaîne face à une vraie faille ; et quand ça déploie, c'est **sans aucune
clé**, sur l'**empreinte sha256** exacte de l'image scannée. »

Portes réelles (`app-delivery.yml`) — **612 règles Semgrep**, alignées sur le diagramme :

| # | Porte | Outil | Phase | Bloquant |
|---|---|---|---|---|
| 1 | Secrets | **Gitleaks** | 1 (PR) + 2 | oui |
| 2 | SAST | **Semgrep** (`semgrep`, diff-aware) | 1 (PR) + 2 | oui |
| 3 | Tests API | **pytest** | 1 (PR) + 2 | oui |
| 4 | Tests dashboard | **jest** | 1 (PR) + 2 | oui |
| 5 | CVE image | **Trivy** (CRITICAL, `--ignore-unfixed`) | **1 (PR) + 2** | oui |
| → | Publication + déploiement **par digest** | Artifact Registry + Cloud Run (WIF) | **2 (main)** | — |

---

## 1. Les runs réels à ouvrir (onglets)

| Onglet | Run | Montre |
|---|---|---|
| **A — Phase 1 : tout passe, rien n'est déployé** | [`34156599935`](https://github.com/Mansour37/menal-zero-trust/actions/runs/34156599935) (PR) | Gitleaks ✅ Semgrep ✅ pytest ✅ jest ✅ + **Build image ✅ + Trivy ✅** → **Authenticate/Push/Deploy/Smoke = skipped** |
| **B — Phase 2 : déploiement par digest** | [`34156759064`](https://github.com/Mansour37/menal-zero-trust/actions/runs/34156759064) (main) | **Authenticate to GCP (WIF)** → **Push + resolve digest (sha256)** → **Deploy to Cloud Run (par digest)** → **Smoke Test** — tous ✅ |
| **C — chaque porte bloque** | tableau §3 | 5 runs rouges, une vraie faille par porte |

> Onglet A = le job **Build & Deploy API** : déplie-le pour montrer *Build image ✅*, *Trivy ✅*,
> puis les étapes *Authenticate / Push / Deploy / Smoke* **toutes grises (skipped)** → sur une PR,
> **on construit et on scanne, mais on ne publie ni ne déploie, et on ne s'authentifie jamais au cloud**.

---

## 2. Déroulé filmé (calqué sur les 2 diagrammes)

### PHASE 1 — Demande de fusion : contrôles + build + scan, rien n'est déployé
`[ÉCRAN : Onglet A — run 34156599935]`
« Sur une demande de fusion, ma chaîne exécute ses portes — secrets, analyse statique,
tests — **et** elle construit puis **scanne l'image** (Trivy). Tout est vert. Mais regardez le
bas : les étapes d'**authentification, de publication et de déploiement sont ignorées**. Sur une
PR, la chaîne **contrôle sans jamais déployer, ni même s'authentifier au cloud**. »

### PHASE 2 — Fusion sur `main` : publication + déploiement par digest
`[ÉCRAN : Onglet B — run 34156759064, job "Build & Deploy API"]`
« À la fusion sur la branche principale, et seulement là :
1. **Authenticate to GCP** — jeton OIDC signé par GitHub (vérifié pour ce dépôt **et** cette
   branche) → identité de courte durée `sa-cicd` : la **fédération WIF**, aucune clé.
2. **Push + resolve digest** — l'image est publiée puis **résolue en empreinte sha256** :
   `menal-api@sha256:33a6b5fd…`.
3. **Deploy to Cloud Run (par digest)** — la révision est épinglée à **ce digest exact** (pas un
   tag mutable) ; le trafic bascule.
4. **Smoke Test** — la chaîne interroge le service **par le domaine public**, donc **à travers le
   WAF** → **200**. Livraison confirmée de bout en bout. »

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
| **Secrets** (Gitleaks) | clé secrète haute entropie | Security Scans | [34156975237](https://github.com/Mansour37/menal-zero-trust/actions/runs/34156975237) |
| **SAST** (Semgrep) | `eval()` + `subprocess(shell=True)` | Security Scans | [34157964162](https://github.com/Mansour37/menal-zero-trust/actions/runs/34157964162) |
| **Tests API** (pytest) | `assert 1 == 2` | Unit Tests | [34156988890](https://github.com/Mansour37/menal-zero-trust/actions/runs/34156988890) |
| **Tests dashboard** (jest) | `expect(1).toBe(2)` | Dashboard Unit Tests | [34157004008](https://github.com/Mansour37/menal-zero-trust/actions/runs/34157004008) |
| **CVE image** (Trivy) | `PyYAML==5.3.1` (CVE-2020-14343 CRITICAL) | Build & Deploy API | [34157018479](https://github.com/Mansour37/menal-zero-trust/actions/runs/34157018479) |

Reproduire en direct :
```bash
bash demo/gate-tests/run-gate-test.sh sast     # (ou secret | pytest | jest | trivy)
# ... la porte visée passe au rouge, Build/Deploy ne se produit jamais
bash demo/gate-tests/run-gate-test.sh clean <branche-affichée>
```

> **Point d'honnêteté FORT (à raconter toi-même)** : ce test a révélé que la porte **Semgrep**
> était **silencieusement cassée** (l'action dépréciée `semgrep-action@v1` plantait sur les règles
> récentes **tout en passant au vert** — un « faux-vert »). Je l'ai **réparée** (mode diff-aware :
> bloque les **nouveaux** findings sans rejouer la dette déjà triée). Montrer qu'on **teste ses
> propres portes et qu'on corrige** vaut plus, devant un jury, qu'un pipeline « parfait ».

---

## 4. Pièges du jury (réponse honnête)

| Piège | Réponse |
|---|---|
| « Vos portes bloquent **vraiment** ? » | Oui, **les cinq** — un run rouge par porte (§3), une vraie faille chacune. |
| « Déploiement par **tag mutable** ? » | Non : **déploiement par digest** `menal-api@sha256:…` (run 34156759064). L'empreinte du commit sert de tag de traçabilité. |
| « Trivy sur la PR ? » | Oui : on **construit et scanne dès la PR** ; on ne publie qu'une image déjà scannée. |
| « Semgrep, 0 finding, c'est louche ? » | Non : **612 règles** tournent ; la chaîne est **diff-aware** (bloque les nouveaux findings) et **74 findings historiques** sont triés/baseline. Une nouvelle faille, elle, bloque (prouvé). |
| « Trivy laisse passer des CVE ? » | `--ignore-unfixed` (CVE sans correctif) ; **bloquant sur CRITICAL corrigeable**. |
| « Job **rouge** e2e sur le run main ? » | `e2e-gcp`, `continue-on-error: true` : sonde trafic réel, informative, jamais bloquante. |
| « Un contributeur peut-il déployer ? » | Non : sur une PR, `if: main` est faux → **aucune auth cloud**, aucun déploiement. |

---

## 5. Checklist pré-tournage

```bash
# Phase 1 : tout passe, rien déployé (build+Trivy verts, deploy skipped)
gh run view 34156599935 --json jobs \
  -q '.jobs[] | select(.name=="Build & Deploy API") | .steps[] | "\(.conclusion)  \(.name)"'
# attendu : Build image + Trivy = success ; Authenticate/Push/Deploy/Smoke = skipped

# Phase 2 : déploiement par digest
gh run view 34156759064 --json conclusion -q .conclusion         # -> success

# Chaque porte bloque (doit afficher failure pour chacune)
for r in 34156975237 34157964162 34156988890 34157004008 34157018479; do
  echo "$r -> $(gh run view $r --json conclusion -q .conclusion)"
done

# Preuve 0 clé : la commande du §2 -> 8 lignes à 0
```

Si tout passe : **DevSecOps prêt à filmer** — une chaîne `app-delivery.yml`, Phase 1 (contrôle+scan
sans déployer) / Phase 2 (déploiement sans clé, par digest), et **chaque porte prouvée bloquante**.

---

## 6. Plan de prise GitHub Actions — écran par écran (ce que tu cliques et filmes)

> Ouvre `github.com/Mansour37/menal-zero-trust` → onglet **Actions** → workflow **App Delivery**
> (colonne de gauche). Débit calme, curseur visible. ~5 prises courtes.

**PRISE 1 — la chaîne existe (≈8 s)**
`Actions → App Delivery` : on voit la **liste des runs** (verts sur `main`, l'historique). Dis :
« voici ma chaîne de livraison, elle tourne à chaque commit ».

**PRISE 2 — Phase 1 : une PR contrôle + scanne, mais ne déploie pas (≈20 s)**
Ouvre le run **[34156599935](https://github.com/Mansour37/menal-zero-trust/actions/runs/34156599935)**.
1. Montre le **graphe des jobs** : Security Scans ✅, Unit Tests ✅, Dashboard Unit Tests ✅, Build & Deploy API ✅.
2. Clique **Build & Deploy API** (colonne gauche) → déroule les étapes :
   - **Build image (local)** ✅ et **Trivy - CVE Scan** ✅ (vertes) ;
   - puis **Authenticate to GCP / Push + resolve digest / Deploy to Cloud Run / Smoke Test** →
     **toutes en gris « skipped »**.
   Dis : « sur une PR, on construit et on scanne, mais **rien n'est publié ni déployé, et on ne
   s'authentifie même pas au cloud** ».

**PRISE 3 — une porte bloque (≈15 s)**
Ouvre un run rouge, p.ex. **Semgrep [34157964162](https://github.com/Mansour37/menal-zero-trust/actions/runs/34157964162)**.
- Graphe : **Security Scans ❌** ; Build & Deploy = **skipped**.
- Clique **Security Scans** → l'étape **Semgrep - SAST** est **rouge**.
Dis : « une vraie faille SAST → la porte échoue → **aucun déploiement** ». (Tu peux enchaîner en
2 s sur les autres runs rouges du §3 : Gitleaks, pytest, jest, Trivy.)

**PRISE 4 — Phase 2 : fusion `main` → déploiement sans clé, par digest (≈20 s)**
Ouvre le run **[34156759064](https://github.com/Mansour37/menal-zero-trust/actions/runs/34156759064)**
→ clique **Build & Deploy API** → déroule :
- **Authenticate to GCP** ✅ (WIF, aucune clé) ;
- **Push + resolve digest (sha256)** ✅ → déroule la ligne pour montrer
  `Deploiement par digest : …menal-api@sha256:33a6b5fd…` ;
- **Deploy to Cloud Run (par digest)** ✅ ; **Smoke Test (API via LB)** ✅ (200 via le WAF).

**PRISE 5 — preuve terminal 0 clé (≈12 s)**
Bascule sur le terminal, lance la commande du §2 → **8 lignes à 0 clé**.

> Montage : PRISE 1→2→3 = « la chaîne contrôle et bloque » ; PRISE 4→5 = « et quand ça passe, ça
> déploie sans clé, par empreinte ». Aucune de ces images n'est mise en scène : tout est cliquable
> et re-vérifiable par le jury.
