# Statut — Plateforme MENAL Zero Trust (environnement dev)

**Date :** 31 juillet 2026
**Projet GCP :** `menal-zero-trust-dev` (europe-west1)
**Référentiels :** `01_HLD_MENAL.md`, `02_LLD_MENAL.md`, `04_METHODOLOGIE_IMPLEMENTATION.md`,
`05_DOCUMENTS_COMPLEMENTAIRES.md`, `indexe-dev.md` (revue précédente, 30 juillet 2026)

## 1. Résumé

Le dev est **opérationnel et validé par des tests E2E réels** (10/10, exécutés depuis une IP
mauritanienne réelle, sans tolérance masquée). Le MFA (TOTP) est implémenté et déployé sur
l'API et le dashboard. Le dashboard Next.js (cible ADR 0001) est déployé en lieu et place du
dashboard Streamlit. Un squelette Terraform pour **staging** existe, mais **aucun projet GCP
staging n'a été provisionné** — ne pas confondre « code prêt » et « environnement promu ».

## 2. Travaux de cette session (chronologie, avec preuve)

### 2.1 Audit initial
Six domaines audités en parallèle (Terraform/zero-trust, API, dashboard, CI/CD, documentation/
SIEM, couverture de tests). Fondations confirmées solides (IAM moindre privilège, WIF, réseau
privé, Cloud Armor) mais bloquants réels identifiés : pas d'environnement staging, gates CI
non bloquantes, `scripts/hotfix.sh` contournant toute la chaîne CI, MFA absent, quasi aucun
test sur le code le plus récent.

### 2.2 MFA — TOTP (commit `7dd8d79`)
- API : `POST /auth/mfa/{setup,enable,disable,verify}`, `GET /auth/mfa/status` ; claim JWT
  `typ` (`access` vs `mfa_pending`) pour qu'un challenge MFA non vérifié ne puisse jamais
  servir d'access token.
- Dashboard : connexion en deux étapes (identifiants puis code), page d'activation
  `/settings/security`.
- 13 tests unitaires nouveaux (`api/tests/test_mfa.py`) ; correction au passage d'un vrai
  blocage (hang) de la suite existante — le middleware d'audit appelait une vraie connexion
  Cloud SQL sur chaque requête de test non mockée (`api/tests/conftest.py`).

### 2.3 Environnement staging (commit `7dd8d79`)
`terraform/environments/staging/{main,variables,outputs}.tf` + `terraform.tfvars.example`,
même câblage de modules que dev, state GCS séparé (`env/staging`). `terraform validate` OK.
**Aucun `terraform apply` n'a été fait : le projet GCP staging n'existe pas.**

### 2.4 Bugs réels trouvés en testant pour de vrai (commits `f2585d1`, `91c084b`)
- **Geo-block Cloud Armor excluait la Mauritanie** — le pays de MENAL SARL elle-même.
  Confirmé par un vrai 403 depuis une IP mauritanienne, corrigé, appliqué.
- `/health` exempté du geo-block (endpoint de liveness sans donnée sensible, doit rester
  vérifiable depuis n'importe quelle région — moniteurs d'uptime, CI).
- 4 défauts logiques corrigés dans la suite E2E : les checks de santé toléraient un blocage
  WAF (403) comme un "succès" (masquait le bug ci-dessus), un test exigeait littéralement
  `"streamlit"` dans la page, T13/T14 étaient des tautologies qui ne pouvaient jamais échouer.
- Conflit Terraform/CI découvert en plein déploiement : CI déploie par tag SHA immuable
  (bonne pratique « build once, promote by digest »), mais Terraform pointait encore vers le
  tag mutable `:latest` — un futur `apply` aurait silencieusement fait revenir en arrière le
  déploiement CI. Corrigé (`lifecycle.ignore_changes` sur `modules/cloud-run` et
  `modules/dashboard`).

### 2.5 Réconciliation du dépôt (commit `e8922d2`)
~90 fichiers déjà modifiés et déjà déployés (travail de la revue `indexe-dev.md` du 30
juillet) mais jamais committés : IAM resserré, pipeline SIEM réparé (tournait à vide), JWT
secret câblé via Secret Manager au lieu du défaut codé en dur, dashboard Streamlit sécurisé,
4 nouvelles pages Next.js (détections/incidents/couverture/vulnérabilités).

### 2.6 Déploiement réel — pas seulement du code committé
- `terraform apply` ×2 sur dev (fix geo-block, puis exemption `/health` + lifecycle).
- Push → CI déclenchée, verte de bout en bout (scans, build, deploy, E2E) — run
  `30593805587`.
- **Découverte en déployant** : la table `users` n'existait pas du tout dans la base réelle —
  la migration 001 (schéma initial) n'avait jamais été jouée. Migrations 001 puis 002
  appliquées via un job Cloud Run ponctuel (créé, exécuté, vérifié, supprimé).
- Dashboard Next.js buildé et déployé manuellement (`scripts/hotfix.sh dashboard` — la CI ne
  build pas encore l'image dashboard). `dash.menal-sarl.com/login` sert désormais Next.js
  (vérifié par le contenu réel de la page, plus par un simple code HTTP).

## 3. État live vérifié (dev, au 31 juillet)

| Composant | État | Preuve |
|---|---|---|
| `menal-api-dev` | MFA en ligne | image `menal-api:e8922d2...`, CI run `30593805587` success |
| `menal-dashboard-dev` | Next.js en ligne | page `/login` contient "Connexion"/"MENAL Zero Trust", plus "streamlit" |
| Base `menal-db-dev` | Schéma à jour | `alembic_version = 002` ; logs du job : `-> 001` puis `001 -> 002` |
| Geo-block Cloud Armor | Corrigé | MR ajouté à l'allowlist, `/health` exempté ; 200 confirmé depuis IP mauritanienne réelle |
| E2E rapide (10 tests) | 10/10 PASSED | exécution réelle du 31/07 depuis IP mauritanienne, sans tolérance masquée |
| CI (`ci.yml`) | Verte | scans + build + deploy + E2E tous en succès |

## 4. Ce qui n'a PAS été fait (backlog assumé, pas oublié)

| # | Item | Pourquoi pas maintenant |
|---|---|---|
| 1 | Provisionner réellement `menal-zero-trust-staging` (projet GCP + `terraform apply`) | Le code existe, l'environnement non — création du projet GCP à décider |
| 2 | Gates CI bloquantes (Gitleaks/Semgrep/Trivy) | Différé par choix explicite en cours de session |
| 3 | `scripts/hotfix.sh` (contournement CI) | Réutilisé cette session faute de job CI pour le dashboard — toujours un contournement documenté, pas supprimé |
| 4 | Tests sur `siem.py` / `bigquery.py` / nouvelles pages dashboard | Différé par choix explicite |
| 5 | `README.md` | Toujours supprimé (cf. `indexe-dev.md` §6.5) |
| 6 | CMEK Cloud SQL / BigQuery | Différé, documenté comme acceptable en dev |
| 7 | Décommissionner `api/dashboard/` (Streamlit) | Code mort (plus déployé) mais pas supprimé — ADR 0001 demande une validation du nouveau dashboard d'abord ; pas de vrai login testé faute de credentials réels |
| 8 | CI ne build pas l'image dashboard | Toujours vrai — le déploiement dashboard reste manuel |

## 5. Prochaine étape recommandée

Tester une vraie connexion (avec MFA) sur https://dash.menal-sarl.com avec un compte réel,
pour lever le point #7 et pouvoir décommissionner Streamlit en confiance. Puis statuer sur la
priorité entre P8 (staging réel) et la fermeture des items 2–4 du backlog.
