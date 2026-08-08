# État Elson sur le socle MENAL (staging) — pour le test final

**Date :** 7 août 2026
**Environnement** : `menal-zero-trust-staging` (europe-west1), derrière le LB/WAF du socle MENAL
**Référentiels** : `08_RUNBOOK.md` (onboarding Elson §6), `GUIDE_DEMO_ELSON.md`, `STATUT_DEV.md` §8

---

## 1. Accès

| Endpoint | URL | Statut |
|---|---|---|
| Production app (LB + Armor + certs) | `https://elson.menal-sarl.com` | ✅ 200 |
| Health API | `https://elson.menal-sarl.com/api/health` | ✅ 200 |
| Ready (DB connectée) | `https://elson.menal-sarl.com/api/ready` | ✅ 200 (`db: connected`) |
| Front (Next.js standalone) | `https://elson.menal-sarl.com/` | ✅ 200 |

Smoke test exécuté le 07/08 : `health=200 ready=200 web=200` (LB → Cloud Armor → Cloud Run → Cloud SQL).

## 2. Composants déployés

| Composant | Service/job GCP | Image |
|---|---|---|
| API Express | `elson-api-staging` (Cloud Run) | `elson-backend:latest` |
| Web Next.js | `elson-web-staging` (Cloud Run) | `elson-frontend:latest` |
| Migration / scripts | `elson-migrate-staging` (Cloud Run job) | `elson-backend:latest`, commande par défaut `npx tsx src/scripts/migrate.ts --from-zero` (conforme `elson.tf`) |
| Base PostgreSQL | instance Cloud SQL (IP privée, `ENCRYPTED_ONLY` → `DB_SSL=true`) | `elson_db` (app), `menal_db` (socle) |
| Secrets | Secret Manager, référencés en `env` des services/job | — |

Les services sont créés par Terraform (`terraform/environments/staging/elson.tf`, module `elson_app`),
le tag `:latest` étant mis à jour manuellement après chaque passage CI main (retag du SHA immutable ;
les `apply` Terraform utilisent `ignore_changes` sur image/tag).

## 3. Isolation SQL (étape 6 du runbook) — TERMINÉE ET PROUVÉE

Principe : chaque app ne CONNECT que sur sa propre base ; plus aucun héritage `cloudsqlsuperuser`.

Applicé via le job (scripts versionnés dans `elson-main/backend/src/scripts/`), **pas** via
cloud-sql-proxy (instance sans IP publique — le proxy local ne la joint pas) :

1. `sql-isolation.ts` — REVOKE/GRANT croisés du runbook (`PUBLIC`, `api_user`, `elson_user`) :
   - `menal_db` : CONNECT → `api_user` uniquement (PUBLIC et `elson_user` révoqués)
   - `elson_db` : CONNECT → `elson_user` uniquement (PUBLIC et `api_user` révoqués)
2. `sql-isolation-harden.ts` — durcissement après une **vraie tentative croisée réussie** (le probe a montré que `REVOKE CONNECT` direct ne suffisait pas) :
   - `GRANT ALL ON SCHEMA public` à `elson_user` sur `elson_db`, à `api_user` sur `menal_db` (pour migrations/extensions futures sans superuser)
   - `REVOKE cloudsqlsuperuser FROM api_user` et `FROM elson_user`

**Preuve (logs des jobs) :**
- `api_user: member_of=[]`, `elson_user: member_of=[]` (plus de `cloudsqlsuperuser`)
- probe croisé (`elson_user` → `menal_db`) : **REJETÉ**
- accès propre (`elson_user` → `elson_db`) : **toujours OK**
- ACL registre : `menal_db` = CONNECT pour `api_user` seul ; `elson_db` = CONNECT pour `elson_user` seul

## 4. Surveillance (alignée socle MENAL)

| Contrôle | État |
|---|---|
| Uptime check `elson-api-staging-health` | ✅ créé |
| Alertes `[staging][elson]` (7 policies) | ✅ actives |
| Logs SIEM `access_logs` (BigQuery) | ✅ `service=elson-api-staging` bien ingéré |
| Règle Cloud Armor priorité 1450 (/api/auth) | ✅ active |
| Policies menal-api | ✅ intactes (non écrasées) |

## 5. CI/CD

- `Elson CI` (`.github/workflows/elson-ci.yml`) : **verte** sur main (Gitleaks + Semgrep + lint non bloquant + tsc + unit + db sandbox + Trivy + push AR via WIF).
- Gate de déploiement : `ELSON_DEPLOY_ENABLED=false` → le job "Migrate + Deploy" reste `skipping`. Les déploiements ont été **faits manuellement** (Terraform + retag `:latest`).
- ⚠️ Lint Elson en dette préexistante (erreurs eslint) : `continue-on-error: true`, à épurer avant de durcir la porte.

## 6. Procédure de passage en livraison auto (si souhaité après test final)

Si le test final valide, basculer `ELSON_DEPLOY_ENABLED=true` (variable GitHub) :
le déploiement devient automatisé (migrate AVANT deploy, smoke test par défaut).
À faire **en même temps** que `elson_enabled=true` reste côté Terraform (déjà le cas).
Ne pas oublier : la CI pousse `:latest` uniquement si le job deploy tourne (étape "Tag latest").

## 7. Restes connus / risques

- **Accès API directe interdit** : le service Cloud Run est de toute façon restreint à l'ingress LB-only (pas d'accès public direct).
- **Extensions** : `CREATE EXTENSION` (`uuid-ossp`, `pgcrypto`) fonctionnent encore en migration en tant que `elson_user` grâce aux `GRANT` public préalables (harden). Vérifier lors d'un futur `--from-zero`.
- **ELSON_DEPLOY_ENABLED=false** : pas d'écrasement automatique par la CI.
- **Smoke tests CI** (jobs `deploy`) : à valider une fois `ELSON_DEPLOY_ENABLED=true`.

## 8. Comment re-tester avant la soutenance

```bash
# Accès public (LB + WAF + certs + DB)
curl -s -o /dev/null -w "%{http_code}\n" https://elson.menal-sarl.com/api/ready   # 200
# SIEM
gcloud logging read 'resource.labels.service_name="elson-api-staging"' --project=menal-zero-trust-staging --limit=5
# Job migrate : logique/état (idempotent)
gcloud run jobs execute elson-migrate-staging --region=europe-west1 --wait
```