# Guide de tournage — DevSecOps : la chaîne de livraison `app-delivery.yml`

> **Un job = une boîte du diagramme, même numéro, même ordre.** La chaîne
> `.github/workflows/app-delivery.yml` a été réorganisée pour se lire à l'écran exactement comme le
> diagramme du rapport — le jury suit ton schéma avec le doigt pendant que la chaîne s'exécute.
>
> - **Déclencheur A — demande de fusion (PR)** : étapes **2 → 6**. Aucune publication, aucun
>   déploiement, **aucune authentification cloud**.
> - **Déclencheur B — fusion sur `main`** : étapes **1 → 8**, jusqu'au déploiement par empreinte.
>
> Tout ce qui suit a été **exécuté en réel le 07/09/2026** sur `menal-zero-trust-staging`
> (dépôt `Mansour37/menal-zero-trust`). Aucun chiffre de ce guide n'est estimé : ils sortent tous
> des runs cités.

---

## 0. Ce que tu prouves

« Le code ne part en production que s'il **franchit toutes les portes** ; **chaque** porte
**arrête réellement** la chaîne face à une vraie faille ; et quand ça déploie, c'est **sans aucune
clé**, sur l'**empreinte sha256** exacte de l'image qui a été scannée. »

Les 8 maillons, tels qu'ils s'affichent dans l'onglet Actions (durées **mesurées** sur le run
[`34165407841`](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165407841)) :

| # | Job affiché | Rôle | Bloquant | Mesuré |
|---|---|---|---|---|
| 1 | *(étape de 7 et 8)* **Authentification fédérée (WIF, sans clé)** | jeton OIDC → identité courte durée | — | ~4 s |
| 2 | **2 · Recherche de secrets (Gitleaks)** | historique git complet | **oui** | 9 s |
| 3 | **3 · Analyse du code (Semgrep)** | `p/default`, diff-aware | **oui** | 19 s |
| 4 | **4 · Tests automatisés — API (pytest)** / **— dashboard (jest)** | unitaires + contrat d'API | **oui** | 23 s / 20 s |
| 5 | **5 · Construction de l'image (api\|dashboard)** | Docker multi-étape, non-root | — | 38 s / 1 min 26 |
| 6 | **6 · Analyse de l'image (Trivy) (api\|dashboard)** | CVE CRITICAL corrigeable | **oui** | 52 s / 56 s |
| 7 | **7 · Publication au registre (api\|dashboard)** | publication + empreinte sha256 | — | 1 min 07 / 48 s |
| 8 | **8 · Déploiement et vérification (api\|dashboard)** | Cloud Run par empreinte + sonde WAF | — | 54 s / 54 s |

**Total Phase 2 : 5 min 37 s** — dans la fourchette « 5 à 6 min » annoncée par le diagramme.

> **L'ordre n'est pas décoratif, il est appliqué** (`needs`) : chaque maillon attend le précédent.
> Un secret poussé est compromis dès sa publication → il est cherché **en premier**. On ne construit
> une image qu'après avoir validé le code. Et **entre l'étape 5 et la porte 6, l'image n'existe dans
> aucun registre** : elle transite en artefact interne au run. Il est donc *techniquement impossible*
> de publier une image non scannée.

---

## 1. Les 3 onglets à ouvrir avant de filmer

| Onglet | Run | Ce qu'il montre |
|---|---|---|
| **A — Phase 1 : tout passe, rien n'est déployé** | [`34165113605`](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165113605) (PR) | Portes 2·3·4 ✅, étapes 5·6 ✅ → **7 et 8 en gris** — 4 min 04 |
| **B — Phase 2 : déploiement par empreinte** | [`34165407841`](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165407841) (main) | les **8 maillons verts**, publication `@sha256:…`, déploiement, sonde — 5 min 37 |
| **C — chaque porte bloque** | tableau du §3 | 5 runs rouges, **une vraie faille par porte** |

---

## 2. Déroulé filmé

### PHASE 1 — Demande de fusion : on contrôle, on ne déploie pas
`[ÉCRAN : onglet A — run 34165113605]`

« Sur une demande de fusion, la chaîne déroule le diagramme de gauche à droite : **secrets**,
**analyse du code**, **tests**, puis elle **construit** et **scanne** les images. Tout est vert.
Maintenant regardez la fin de la chaîne : **Publication au registre** et **Déploiement** sont
**gris**. Sur une demande de fusion, on contrôle **sans jamais publier, sans jamais déployer — et
sans même s'authentifier au cloud**. »

> **Et c'est vérifiable dans le fichier, pas seulement à l'écran** : la permission `id-token`
> (celle qui permet de prendre une identité GCP) n'est accordée **qu'aux jobs 7 et 8**. Les jobs de
> la Phase 1 ne l'ont pas : ils sont *incapables* de s'authentifier, même en cas d'erreur humaine.

### PHASE 2 — Fusion sur `main` : publication + déploiement par empreinte
`[ÉCRAN : onglet B — run 34165407841]`

« À la fusion, et seulement là, les deux derniers maillons s'allument :

1. **1 · Authentification fédérée** — GitHub signe un jeton OIDC vérifié pour *ce dépôt* **et**
   *cette branche* ; GCP le convertit en identité de courte durée `sa-cicd`. **Aucune clé n'existe.**
2. **7 · Publication au registre** — l'image est publiée puis **relue en empreinte** :
   `menal-api@sha256:871e5da4…`
3. **8 · Déploiement et vérification** — la révision Cloud Run est épinglée à **cette empreinte
   exacte**, pas à un tag mutable. Puis la chaîne **sonde le service par le domaine public**, donc
   **à travers le WAF** → **200**. »

> **Retour arrière (prévu au diagramme)** : si la sonde échoue, le job affiche lui-même la commande
> à exécuter (~12 s) :
> `gcloud run services update-traffic menal-api-staging --region europe-west1 --to-revisions=<révision-précédente>=100`

### PREUVE LIVE 1 — 0 clé sur 8 comptes `[ÉCRAN : terminal]`
```bash
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
for sa in $(gcloud iam service-accounts list --project=menal-zero-trust-staging --format="value(email)"); do
  n=$(gcloud iam service-accounts keys list --iam-account="$sa" --managed-by=user --format="value(name)" | wc -l)
  printf "%s clé(s)   %s\n" "$n" "$sa"
done
```
→ **8 lignes, toutes à `0`** — dont `sa-cicd@…`, le compte qui déploie. *(vérifié le 07/09)*

### PREUVE LIVE 2 — l'empreinte du run est celle qui tourne en production `[ÉCRAN : terminal]`
C'est **la** preuve qui ferme le sujet « votre pipeline dit qu'il déploie, mais déploie-t-il ça ? »
```bash
gcloud run services describe menal-api-staging --project=menal-zero-trust-staging \
  --region=europe-west1 --format="value(spec.template.spec.containers[0].image)"
```
→ `…/menal-api@sha256:871e5da4433bdc5c104b26409b89bdadfd097da0c30f1dee44dc7a1677d33d9a`
**caractère pour caractère l'empreinte affichée à l'étape 7 du run B.** *(vérifié le 07/09)*

Dashboard : `…/menal-dashboard@sha256:bba6bf99b8460d12f2db66477694ea713e8fd9912affacaba4b0bb3f567cadfa`

---

## 3. Chaque porte bloque une VRAIE faille (prouvé, 5 runs)

Le kit [`demo/gate-tests/`](demo/gate-tests/) injecte **une vraie faille par porte** sur une PR
jetable. Les 5 portes ont été testées **contre la chaîne actuelle** : toutes bloquent.

| Porte | Faille réellement injectée | Ce que le run affiche | Run rouge |
|---|---|---|---|
| **2 · Secrets** | clé haute entropie dans `api/app/_leaked_config.py` | `generic-api-key` — fichier et ligne pointés | [34165824113](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165824113) |
| **3 · Code** | `eval()` + `subprocess(shell=True)` | **2 findings bloquants** (`eval-detected`, `subprocess-shell-true`), 290 règles exécutées | [34165832135](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165832135) |
| **4 · Tests API** | `assert 1 == 2` | pytest rouge | [34165841139](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165841139) |
| **4 · Tests dashboard** | `expect(1).toBe(2)` | jest rouge | [34165850179](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165850179) |
| **6 · Image** | `PyYAML==5.3.1` | `Total: 1 (CRITICAL: 1)` → CVE-2020-14343, corrigée en 5.4 | [34165859372](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165859372) |

### Le plan qui fait le plus d'effet : les 5 runs côte à côte
Ouvre les 5 dans 5 onglets et fais-les défiler. Le graphe dessine **un escalier** — la chaîne
s'arrête pile au maillon attaqué, et **tout ce qui suit est gris** :

| Run | 2 | 3 | 4 API | 4 dash | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| secrets | ❌ | · | · | · | · | · | · | · |
| code | ✅ | ❌ | · | · | · | · | · | · |
| tests API | ✅ | ✅ | ❌ | ✅ | · | · | · | · |
| tests dash | ✅ | ✅ | ✅ | ❌ | · | · | · | · |
| image | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ *(api)* | · | · |

« Une porte rouge ne fait pas qu'échouer : **elle éteint tout l'aval**. C'est la flèche
*"arrêt ; aucune image publiée"* de mon diagramme, en vrai. »

Rejouer en direct devant le jury (≈ 1 min pour les portes 2 et 3) :
```bash
bash demo/gate-tests/run-gate-test.sh sast     # (ou secret | pytest | jest | trivy)
bash demo/gate-tests/run-gate-test.sh clean <branche-affichée>
```

### Les points d'honnêteté (à raconter toi-même, ils valent des points)
Ces tests ont servi à **trouver des défauts dans mes propres portes**, et je les ai corrigés :

1. **La porte Semgrep était silencieusement cassée** — l'action dépréciée `semgrep-action@v1`
   plantait sur les règles récentes **tout en passant au vert**. Un « faux-vert » : la porte
   *paraissait* fonctionner. Réparée en mode **diff-aware** (bloque les nouveaux constats sans
   rejouer la dette déjà triée). Le run [34165832135](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165832135) est la preuve d'après réparation.
2. **Un libellé faux** : l'étape annonçait « 612 règles ». Le journal montre que `p/default` en
   charge **1074** et n'exécute que celles qui concernent les fichiers modifiés (85 sur un diff de
   2 fichiers, 290 sur le test SAST). Le nombre a été retiré du libellé — il varie, il n'a rien à
   faire figé dans un nom d'étape ; le compte exact reste lisible dans le journal.
3. **Un job rouge décoratif** : `e2e-gcp` tournait 12 min et finissait rouge **sans jamais bloquer**
   (`continue-on-error`). Un rouge qui n'arrête rien apprend à l'équipe à ignorer les rouges : il a
   été **retiré de la chaîne** (les tests restent lançables via `e2e.yml`). La chaîne est passée de
   ~15 min à **5 min 37**.

« Tester ses propres portes, y trouver trois défauts et les corriger » se défend mieux devant un
jury qu'un pipeline présenté comme parfait.

---

## 4. Pièges du jury — réponses honnêtes

| Piège | Réponse |
|---|---|
| « Vos portes bloquent **vraiment** ? » | Les **cinq**, un run rouge chacune (§3), avec une vraie faille et le constat affiché. |
| « Déploiement par **tag mutable** ? » | Non : **par empreinte** `@sha256:…`, et je vous montre que la révision en service porte la même (§2, preuve 2). |
| « À quoi sert le tag `latest` alors ? » | À **rien dans le déploiement**. Il est maintenu uniquement parce que Terraform le résout à la *création initiale* d'un service. |
| « Trivy passe-t-il dès la PR ? » | Oui : on construit **et** on scanne dès la PR. Mieux : entre la construction et le scan, **l'image n'est dans aucun registre** — publier une image non scannée est impossible. |
| « Semgrep, 0 finding, c'est louche ? » | `p/default` charge **1074 règles** ; en diff-aware seules les règles concernées tournent. Une nouvelle faille bloque — prouvé (2 findings, 290 règles, run C). |
| « Trivy laisse passer des CVE ? » | `--ignore-unfixed` : pas de blocage sur une CVE **sans correctif** (rien à faire pour la lever). **Bloquant sur toute CRITICAL corrigeable** — et l'image n'en a **aucune** hors injection. |
| « Un contributeur peut-il déployer via une PR ? » | Non, et pas seulement par convention : la permission `id-token` n'est **pas accordée** aux jobs de Phase 1. |
| « Vos actions sont-elles épinglées ? » | **Toutes** au SHA de commit (pas au tag mutable), y compris Gitleaks, Trivy et les actions Google. |
| « Il reste 2 avertissements jaunes sur l'étape 6 ? » | `actions/download-artifact` n'a pas encore de version Node 24 **chez GitHub** : c'est un avis de dépréciation de la plateforme, pas un défaut de la chaîne. Tout le reste est passé aux majeures courantes. |
| « Pourquoi les jobs 7 et 8 affichent `${{ matrix.app }}` en gris ? » | Parce qu'ils ont été **ignorés avant même d'être instanciés** — GitHub n'a pas eu à les dédoubler api/dashboard. C'est la preuve visuelle qu'ils n'ont pas tourné. |

---

## 5. Checklist pré-tournage (copier-coller)

```bash
# A — Phase 1 : portes + build + scan verts, publication/déploiement ignorés
gh run view 34165113605 --json jobs -q '.jobs[] | "\(.conclusion)  \(.name)"'
# attendu : success sur 2,3,4,5,6 ; skipped sur 7 et 8

# B — Phase 2 : les 8 maillons verts
gh run view 34165407841 --json conclusion,jobs -q '.conclusion, (.jobs[] | "\(.conclusion)  \(.name)")'
# attendu : success partout

# C — chaque porte bloque (failure attendu 5 fois)
for r in 34165824113 34165832135 34165841139 34165850179 34165859372; do
  echo "$r -> $(gh run view $r --json conclusion -q .conclusion)"
done

# Preuve 1 : 0 clé sur 8 comptes            -> commande du §2
# Preuve 2 : empreinte déployée == run B    -> commande du §2
```

---

## 6. Plan de prise, écran par écran

> Onglet **Actions → App Delivery**. Débit calme, curseur visible. ~5 prises.

**PRISE 1 — la chaîne (≈8 s)** — `Actions → App Delivery`. « Une seule chaîne, déclenchée à chaque
demande de fusion et à chaque fusion. »

**PRISE 2 — Phase 1 : on contrôle sans déployer (≈20 s)** — run
[34165113605](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165113605). Suis le graphe
**de gauche à droite avec le curseur** : 2 → 3 → 4 → 5 → 6 verts, puis **7 et 8 gris**. Ouvre
**6 · Analyse de l'image (Trivy) (api)** → le tableau Trivy. « On scanne. On ne publie pas. »

**PRISE 3 — l'escalier des portes (≈25 s)** — enchaîne les 5 runs du §3 en montrant à chaque fois
**où la chaîne s'éteint**. Termine par le run image : ouvre le job rouge → `Total: 1 (CRITICAL: 1)`,
`PyYAML 5.3.1 → CVE-2020-14343`. « Une seule CVE critique dans cette image : celle que j'y ai mise
exprès. La chaîne l'a arrêtée. »

**PRISE 4 — Phase 2 : sans clé, par empreinte (≈25 s)** — run
[34165407841](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165407841).
- **7 · Publication au registre (api)** → étape *Publier l'image et résoudre son empreinte sha256*
  → montre `menal-api@sha256:871e5da4…`
- **8 · Déploiement et vérification (api)** → *1 · Authentification fédérée* ✅, *Déployer la
  révision Cloud Run (par empreinte sha256)* ✅, *Sonder le service par le point d'entrée public* ✅

**PRISE 5 — les deux preuves terminal (≈20 s)** — 8 lignes à `0` clé, puis l'empreinte de la
révision en service **identique** à celle de la prise 4.

> Montage : 1→2→3 = « la chaîne contrôle et **arrête vraiment** » ; 4→5 = « et quand elle livre,
> c'est **sans clé, sur l'empreinte exacte qui a été scannée** ». Chaque affirmation est un lien
> cliquable que le jury peut rouvrir lui-même.
