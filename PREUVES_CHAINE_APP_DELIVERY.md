# Preuves — chaîne de livraison `app-delivery.yml`

**Toutes les données de la chaîne, mesurées, avec les preuves.**
Ce fichier répond à trois questions : *combien de temps prend chaque étape quand tout passe ?*,
*que se passe-t-il exactement quand une porte se ferme ?*, et *quel type de faille chaque porte
sait détecter ?*

| | |
|---|---|
| Chaîne | [`.github/workflows/app-delivery.yml`](.github/workflows/app-delivery.yml) — 8 étapes enchaînées (`needs`) |
| Dépôt | `Mansour37/menal-zero-trust` |
| Environnement | `menal-zero-trust-staging` (europe-west1) |
| Date des mesures | **07/09/2026** |
| Nature | Aucune valeur estimée. Chaque chiffre et chaque message vient d'un run cité, rejouable. |

---

## 1. La chaîne quand tout est vert

### 1.1 Les 8 étapes

L'étape **1** n'est pas un job : c'est la **première étape des jobs 7 et 8**. Elle n'existe donc
qu'en Phase 2 — sur une demande de fusion, la chaîne ne s'authentifie **jamais** au cloud, et n'en a
même pas la permission (`id-token` n'est accordé qu'aux jobs 7 et 8).

| # | Job tel qu'il s'affiche | Outil / action | Porte bloquante | Ce qu'il garantit |
|---|---|---|---|---|
| 1 | *(étape de 7 et 8)* Authentification fédérée | WIF / OIDC | — | identité de courte durée `sa-cicd`, **aucune clé** |
| 2 | `2 · Recherche de secrets (Gitleaks)` | Gitleaks | **OUI** | aucun secret dans le code **ni dans l'historique git** |
| 3 | `3 · Analyse du code (Semgrep)` | Semgrep `p/default` | **OUI** | aucun nouveau motif de code dangereux |
| 4 | `4 · Tests automatisés — API (pytest)` | pytest | **OUI** | comportement + contrat d'API conformes |
| 4 | `4 · Tests automatisés — dashboard (jest)` | jest | **OUI** | comportement du dashboard conforme |
| 5 | `5 · Construction de l'image (api\|dashboard)` | Docker multi-étape | — | image minimale, utilisateur non-root |
| 6 | `6 · Analyse de l'image (Trivy) (api\|dashboard)` | Trivy | **OUI** | aucune CVE **CRITICAL corrigeable** dans l'image |
| 7 | `7 · Publication au registre (api\|dashboard)` | Artifact Registry | — | image publiée **et relue en empreinte sha256** |
| 8 | `8 · Déploiement et vérification (api\|dashboard)` | Cloud Run + sonde | — | révision épinglée à l'empreinte, service joignable par le WAF |

### 1.2 Temps mesurés, étape par étape

Run de référence Phase 2 (`main`) :
[**34165407841**](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165407841) — **tout vert**.

| # | Étape | api | dashboard |
|---|---|---|---|
| 2 | Recherche de secrets | **9 s** | *(commune)* |
| 3 | Analyse du code | **19 s** | *(commune)* |
| 4 | Tests automatisés | **23 s** | **20 s** |
| 5 | Construction de l'image | **38 s** | **1 min 26** |
| 6 | Analyse de l'image (Trivy) | **52 s** | **56 s** |
| 7 | Publication au registre | **1 min 07** | **48 s** |
| 8 | Déploiement et vérification | **54 s** | **54 s** |
| | **TOTAL de bout en bout** | **5 min 37** | **5 min 37** |

Run de référence Phase 1 (demande de fusion) :
[**34165113605**](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165113605) —
étapes 2 → 6 vertes, **7 et 8 ignorées** : **4 min 04**.

> Les étapes 4 à 8 se dédoublent api / dashboard et tournent **en parallèle** entre elles : le total
> n'est pas la somme de la colonne, c'est le chemin le plus long.

### 1.3 Pourquoi cet ordre

L'ordre est **appliqué**, pas décoratif : chaque job attend le précédent (`needs`).

1. Un **secret** poussé est compromis à la seconde où il est publié → on le cherche **en premier**,
   et le verdict tombe en 9 s.
2. On ne dépense pas 90 s de construction d'image pour du code qui n'a pas passé l'analyse.
3. Entre l'étape **5** et la porte **6**, l'image ne transite qu'en **artefact interne au run** :
   elle n'existe dans **aucun registre**. Publier une image non scannée est donc *techniquement*
   impossible, pas seulement interdit.

---

## 2. Ce qui se passe quand une porte se ferme

Règle unique, valable pour les 4 portes :

> **La porte passe au ROUGE, et TOUS les maillons suivants passent en `skipped` (gris).**
> Aucune image n'est publiée, aucun déploiement n'a lieu, et la chaîne ne s'authentifie même pas
> au cloud. C'est la flèche « **arrêt ; aucune image publiée** » du diagramme, littéralement.

Vu de l'onglet Actions, les 5 scénarios dessinent **un escalier** — la chaîne s'éteint pile au
maillon attaqué :

| Scénario | 2 secrets | 3 code | 4 API | 4 dash | 5 image | 6 Trivy | 7 registre | 8 déploiement |
|---|---|---|---|---|---|---|---|---|
| Secret injecté | ❌ | gris | gris | gris | gris | gris | gris | gris |
| Code dangereux | ✅ | ❌ | gris | gris | gris | gris | gris | gris |
| Test API cassé | ✅ | ✅ | ❌ | ✅ | gris | gris | gris | gris |
| Test dashboard cassé | ✅ | ✅ | ✅ | ❌ | gris | gris | gris | gris |
| CVE dans l'image | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ *(api)* | gris | gris |

---

## 3. Les 5 scénarios — faille injectée, type détecté, preuve

Chaque scénario a été rejoué **contre la chaîne actuelle** via
[`demo/gate-tests/`](demo/gate-tests/) : une PR jetable, **une seule vraie faille**, le reste du
dépôt intact.

### Porte 2 — Recherche de secrets (Gitleaks)

| | |
|---|---|
| **Faille injectée** | une clé haute entropie générée dans `api/app/_leaked_config.py` |
| **Type détecté** | **secret exposé** — règle `generic-api-key` |
| **Verdict rendu en** | **46 s** (job rouge en 6 s) |
| **Run** | [34165824113](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165824113) |
| **Aval** | étapes 3 → 8 toutes `skipped` |

```
Finding:     secret_key = "REDACTED"
File:        api/app/_leaked_config.py
Fingerprint: 011ca9c5...:api/app/_leaked_config.py:generic-api-key:2
```
> Gitleaks scanne l'**historique complet** (`fetch-depth: 0`) : un secret ajouté puis « retiré » dans
> un commit suivant reste détecté — c'est justement le cas dangereux.

### Porte 3 — Analyse du code (Semgrep)

| | |
|---|---|
| **Faille injectée** | `eval()` sur entrée utilisateur + `subprocess(..., shell=True)` |
| **Type détecté** | **exécution de code arbitraire** et **injection de commande** |
| **Verdict rendu en** | **37 s** (job rouge en 20 s) |
| **Run** | [34165832135](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165832135) |
| **Aval** | étapes 4 → 8 toutes `skipped` |

```
❯❱ python.lang.security.audit.eval-detected.eval-detected
❯❯❱ python.lang.security.audit.subprocess-shell-true.subprocess-shell-true
   Found 'subprocess' function 'check_output' with 'shell=True'...
     16┆ return subprocess.check_output(cmd, shell=True)
 • Findings: 2 (2 blocking)
 • Rules run: 290
```
> Mode **diff-aware** : `p/default` charge **1074 règles** et Semgrep n'exécute que celles qui
> concernent les fichiers modifiés (**290** ici, 85 sur un diff de 2 fichiers). La porte bloque les
> **nouveaux** constats sans rejouer la dette historique déjà triée.

### Porte 4 — Tests automatisés (API, pytest)

| | |
|---|---|
| **Faille injectée** | une régression fonctionnelle (`assert 1 == 2`) |
| **Type détecté** | **régression de comportement / contrat d'API rompu** |
| **Verdict rendu en** | **1 min 23** (job rouge en 24 s) |
| **Run** | [34165841139](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165841139) |
| **Aval** | étapes 5 → 8 toutes `skipped` |

```
tests/test_gate_block.py::test_gate_block_demo FAILED                   [  3%]
>       assert 1 == 2, "porte pytest : echec volontaire pour la demonstration"
E       assert 1 == 2
```

### Porte 4 — Tests automatisés (dashboard, jest)

| | |
|---|---|
| **Faille injectée** | une régression front (`expect(1).toBe(2)`) |
| **Type détecté** | **régression de comportement du dashboard** |
| **Verdict rendu en** | **1 min 09** (job rouge en 25 s) |
| **Run** | [34165850179](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165850179) |
| **Aval** | étapes 5 → 8 toutes `skipped` |

```
FAIL src/__tests__/gateBlock.test.ts
    Expected: 2
    Received: 1
      at Object.toBe (src/__tests__/gateBlock.test.ts:5:15)
Tests:       1 failed, 22 passed, 23 total
```
> `1 failed, 22 passed` : **un seul** test tombe, les 22 autres passent. La porte réagit à la
> régression précise, elle ne casse pas en bloc.

### Porte 6 — Analyse de l'image (Trivy)

| | |
|---|---|
| **Faille injectée** | dépendance vulnérable `PyYAML==5.3.1` dans `api/requirements.txt` |
| **Type détecté** | **CVE CRITICAL corrigeable dans l'image livrable** |
| **Verdict rendu en** | **3 min 06** (job rouge en 33 s) — la chaîne a traversé 2, 3, 4, 5 d'abord |
| **Run** | [34165859372](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165859372) |
| **Aval** | étapes 7 et 8 `skipped` — **aucune image publiée** |

```
Total: 1 (CRITICAL: 1)
│ PyYAML (METADATA) │ CVE-2020-14343 │ CRITICAL │ fixed │ 5.3.1 │ 5.4 │ PyYAML: incomplete fix for CVE-2020-1747 │
```
> **`Total: 1`** : la CVE injectée est la **seule** critique de l'image — l'image de production n'en
> a aucune. Trivy tourne avec `--ignore-unfixed` : il ne bloque pas sur une CVE **sans correctif**
> (rien à faire pour la lever), mais bloque sur **toute CRITICAL corrigeable**.
> Ici le correctif existe (5.4), donc la chaîne s'arrête.

---

## 4. Preuves de livraison (Phase 2)

### 4.1 Déploiement par empreinte, pas par tag

Empreintes publiées par le run [34165407841](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165407841) :

```
menal-api@sha256:871e5da4433bdc5c104b26409b89bdadfd097da0c30f1dee44dc7a1677d33d9a
menal-dashboard@sha256:bba6bf99b8460d12f2db66477694ea713e8fd9912affacaba4b0bb3f567cadfa
```

Empreintes **réellement en service** sur Cloud Run (vérifié le 07/09) :

```bash
gcloud run services describe menal-api-staging --project=menal-zero-trust-staging \
  --region=europe-west1 --format="value(spec.template.spec.containers[0].image)"
```
→ `…/menal-api@sha256:871e5da4433bdc5c104b26409b89bdadfd097da0c30f1dee44dc7a1677d33d9a`

**Identiques caractère pour caractère.** L'image scannée par la porte 6 est exactement celle qui
sert le trafic. Le tag `latest` est encore poussé, mais **ne sert jamais au déploiement** : il n'est
maintenu que parce que Terraform le résout à la *création initiale* d'un service.

### 4.2 Zéro clé de compte de service

```bash
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
for sa in $(gcloud iam service-accounts list --project=menal-zero-trust-staging --format="value(email)"); do
  n=$(gcloud iam service-accounts keys list --iam-account="$sa" --managed-by=user --format="value(name)" | wc -l)
  printf "%s clé(s)   %s\n" "$n" "$sa"
done
```

Résultat vérifié le 07/09 — **8 comptes, 8 fois `0`** :

```
0 clé(s)   110809493492-compute@developer.gserviceaccount.com
0 clé(s)   sa-enrich-job@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-pipeline@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-cicd@menal-zero-trust-staging.iam.gserviceaccount.com     <-- le compte qui déploie
0 clé(s)   sa-api@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-dashboard-staging@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-elson@menal-zero-trust-staging.iam.gserviceaccount.com
0 clé(s)   sa-ml-embed@menal-zero-trust-staging.iam.gserviceaccount.com
```

### 4.3 Retour arrière

Si la sonde de l'étape 8 échoue, le job affiche lui-même la commande (~12 s) :

```bash
gcloud run services update-traffic menal-api-staging --region europe-west1 \
  --to-revisions=<révision-précédente>=100
```

---

## 5. Tout revérifier en une minute

```bash
# Phase 1 (PR) : 2→6 verts, 7 et 8 ignorés
gh run view 34165113605 --json jobs -q '.jobs[] | "\(.conclusion)  \(.name)"'

# Phase 2 (main) : les 8 maillons verts
gh run view 34165407841 --json conclusion,jobs -q '.conclusion, (.jobs[] | "\(.conclusion)  \(.name)")'

# Les 5 portes bloquent (failure attendu 5 fois)
for r in 34165824113 34165832135 34165841139 34165850179 34165859372; do
  echo "$r -> $(gh run view $r --json conclusion -q .conclusion)"
done

# Rejouer une porte en direct (PR jetable, puis nettoyage)
bash demo/gate-tests/run-gate-test.sh sast      # secret | sast | pytest | jest | trivy
bash demo/gate-tests/run-gate-test.sh clean <branche-affichée>
```

---

## 6. Récapitulatif chiffré

| Mesure | Valeur |
|---|---|
| Étapes de la chaîne | **8** (1 job = 1 boîte du diagramme) |
| Portes bloquantes | **4** (secrets, code, tests, image) — la porte 4 se dédouble API / dashboard |
| Chaîne complète, tout vert (Phase 2) | **5 min 37** |
| Chaîne sur demande de fusion (Phase 1) | **4 min 04** |
| Verdict le plus rapide | **46 s** (secrets) |
| Verdict le plus lent | **3 min 06** (image, en fin de chaîne) |
| Portes testées avec une vraie faille | **5 / 5**, toutes bloquantes |
| Règles Semgrep chargées / exécutées | **1074** / 85 à 290 selon le diff |
| CVE CRITICAL dans l'image hors injection | **0** |
| Clés de comptes de service | **0** sur **8** comptes |
| Actions épinglées au SHA de commit | **100 %** |
| Permission `id-token` en Phase 1 | **aucune** — une PR ne peut pas s'authentifier à GCP |

### Les limites, assumées

- `actions/download-artifact` n'a pas encore de version Node 24 **chez GitHub** → 2 avertissements
  jaunes sur l'étape 6. Avis de dépréciation de la plateforme, pas un défaut de la chaîne.
- Le tag `latest` est poussé en best-effort (`|| true`) — requis par Terraform à la création
  initiale d'un service, jamais utilisé pour déployer.
- La suite E2E a été **sortie de la chaîne** : elle affichait un job rouge de 12 min qui ne bloquait
  rien (`continue-on-error`). Elle reste lançable manuellement via `e2e.yml`.

> Scénario de tournage et argumentaire de soutenance : [`GUIDE_DEMO_DEVSECOPS.md`](GUIDE_DEMO_DEVSECOPS.md).
