# Cas d'utilisation — Plateforme MENAL

**Référencé par `01_HLD_MENAL.md` §9.** Reprend les flux nommés F1–F7 définis en HLD §4.1. Chaque cas d'utilisation décrit un flux nominal, ses variantes/erreurs, les contrôles Zero Trust exercés, et son statut de vérification réel (pas déclaratif). Dernière vérification : audit E2E du 07/08/2026 + remédiation Tier 0/1/2 du 07-08/08/2026 (`09_AUDIT_E2E_STAGING_2026-08-07.md`). Convention de statut : ✅ vérifié avec preuve live · 🟡 partiellement vérifié/écart connu · ❌ non vérifié / gap ouvert.

---

## UC1 — Un analyste SOC consulte le dashboard

**Flux :** F1 (utilisateur → DNS → ALB → Cloud Armor → Cloud Run dashboard) puis F2 (dashboard → API → BigQuery, lecture seule).

| Étape | Nominal | Alternatif / erreur | Contrôle exercé |
|---|---|---|---|
| 1 | `GET dash-staging.menal-sarl.com/` | — | TLS managé, Cloud Armor (géo-blocage UE+Maghreb+Mauritanie, exemption sur `/`, `/login`) |
| 2 | Redirection `307` vers `/login` si session absente | Session valide → accès direct | JWT-RBAC applicatif (rôles `admin`/`viewer`/`service`) |
| 3 | Authentification, JWT émis | Échec → `401`, tentative journalisée | Cloud Armor anti-bruteforce (10 req/min/IP sur `/auth/*`, ban 5 min) |
| 4 | Dashboard appelle `/siem/overview`, `/siem/detections`, `/siem/incidents` (API) | API down → page affiche un état d'erreur explicite | `sa-api` en lecture seule sur le dataset SIEM (`api_viewer`, jamais d'écriture) |
| 5 | API interroge BigQuery (tables partitionnées, filtrées sur le cutoff) | — | Isolation : le navigateur ne parle jamais directement à BigQuery ni à `ml-embed` (contrôle L3 du HLD) |

**Statut :** ✅ Endpoint vivant vérifié le 07/08 (`GET /siem/overview` sans token → `403` audité, pas un ping) ; ✅ le bug historique qui affichait "tout est nominal" pendant une panne API est corrigé (dashboard, toutes pages principales) ; 🟡 pic de latence mesuré (3,2–3,5s) sur `/siem/overview` dû à 5 requêtes BigQuery séquentielles — fonctionnel mais non optimal, non traité en Tier 0/1/2 (pas de vue matérialisée, écart E10 toujours ouvert).

---

## UC2 — Une attaque réseau est bloquée en périphérie (WAF)

**Flux :** F1 (rejet à Cloud Armor) puis F4 (le blocage lui-même devient une donnée de télémétrie).

| Étape | Nominal | Alternatif | Contrôle exercé |
|---|---|---|---|
| 1 | Requête malveillante (SQLi, brute-force) atteint l'ALB | — | Cloud Armor, règles préconfigurées OWASP + règle dédiée `/auth/*` (priorité 1450) |
| 2 | Armor bloque avant d'atteindre Cloud Run | Faux négatif → la requête atteint l'app, contrôles applicatifs prennent le relais | Défense en profondeur (Armor + validation applicative) |
| 3 | L'événement de blocage est journalisé | — | Sink dédié `security_events` (F4) |
| 4 | Visible sur le dashboard (`/siem/coverage`, alertes) | — | Aucune colonne service sur `security_events` : un blocage n'est pas attribuable à une app précise si plusieurs apps partagent le LB (gap tenant, non traité en Tier 0/1/2) |

**Statut :** ✅ Règle anti-bruteforce confirmée active en live (07/08) ; ⚠️ test automatisé **T11** (`tests/e2e/README.md`) a une assertion jugée trop permissive (accepte `200`) — à durcir avant de s'appuyer dessus comme preuve automatisée, inchangé par la remédiation.

---

## UC3 — Détection sémantique sans règle Sigma (ATTACK-BERT)

**Flux :** F5 (Scheduler → enrich-job → ml-embed → `VECTOR_SEARCH` → `alert_enrichment` → dashboard) — c'est le flux d'originalité de l'architecture (HLD §4.1).

| Étape | Nominal | Alternatif / erreur | Contrôle exercé |
|---|---|---|---|
| 1 | Cloud Scheduler déclenche `enrich-job` toutes les 15 min | — | `sa-scheduler` restreint à `run.invoker` sur ce job uniquement |
| 2 | `enrich-job` récupère les détections des 2h sans enrichissement | — | `sa-enrich-job` : lecture dataset, écriture limitée à `alert_enrichment` (ne peut pas modifier les preuves qu'il analyse — principe cardinal HLD §5) |
| 3 | Appel à `ml-embed` (jeton d'identité, ingress interne) | Timeout > 60s → tâche échoue d'un coup, aucun retry applicatif ; rattrapée au cycle suivant (fenêtre 2h) et par `max_retries=2` au niveau job | Isolation réseau : `ml-embed` en ingress interne, egress nul |
| 4 | Score et technique ATT&CK écrits dans `alert_enrichment` | — | Modèle réel ATTACK-BERT **fp32** (l'int8 a été testé et rejeté sur critère d'acceptation documenté, écart assumé E7) |
| 5 | Visible sur le dashboard (technique, score) | — | — |

**Statut :** ✅ Fonctionnel en staging (données fraîches confirmées le 07/08) ; ✅ **cause racine des 503 du 05/08 corrigée le 07/08 (Tier 0)** — budget de la sonde de démarrage élargi de 70s à 150s, largement au-dessus du pic de cold start observé (~94s) ; 🟡 le mismatch de timeout (60s côté service `ml-embed` vs 120s côté client `enrich-job`) est toujours présent dans le code — non corrigé, mais moins susceptible de se déclencher maintenant que les cold starts aboutissent de façon fiable dans le budget de la sonde.

---

## UC4 — Livraison logicielle via CI/CD

**Flux :** F3 (GitHub Actions → WIF → Artifact Registry → Cloud Run) + F6 (CVE Trivy → priorisation SIEM).

| Étape | Nominal | Alternatif / erreur | Contrôle exercé |
|---|---|---|---|
| 1 | Push sur `main`, filtré par `paths:` (menal/elson/terraform séparés) | Push sur une autre branche → le provider WIF refuse le jeton | Condition WIF `assertion.ref == 'refs/heads/main'` (vérifiée code + live le 07/08) |
| 2 | Gitleaks → Semgrep → build → Trivy (image, bloquant sur CRITICAL corrigeable) | Détection → pipeline rouge | Portes bloquantes T7/T8/T9 (CI verte, historiquement prouvées) |
| 3 | Push Artifact Registry, tag = `github.sha` | — | Traçabilité commit → artefact |
| 4 | Déploiement Cloud Run par ce tag SHA, puis re-tag `:latest` | — | — |
| 5 | Rapport Trivy chargé dans `cve_findings` (BigQuery), croisé avec les techniques ATT&CK observées | — | Boucle F6, argument central de l'architecture. `sa-cicd` scopé à cette seule table depuis le 08/08 (Tier 1) |

**Statut :** ✅ CI verte confirmée sur menal et Elson, versions Trivy/Gitleaks/Semgrep cohérentes entre les deux workflows ; ✅ **écart E24 partiellement fermé (Tier 1, 08/08)** — le chemin de reconstruction Terraform (`terraform apply`/bootstrap/disaster recovery) résout désormais l'image par digest via `data "google_artifact_registry_docker_image"` au lieu du tag `:latest` mutable, protégé sans effet sur le régime CI courant (`lifecycle.ignore_changes`, testé no-op). Le chemin CI lui-même continue de déployer par tag SHA (pas un digest cryptographique `@sha256:` explicite) — traçable au commit, mais pas fermé au sens strict de l'invariant LLD §10.3.

---

## UC5 — Évolution de l'infrastructure via Terraform

**Flux :** F7 (GitHub Actions → WIF → `terraform plan` → scan IaC → approbation → `apply`).

| Étape | Nominal | Alternatif / erreur | Contrôle exercé |
|---|---|---|---|
| 1 | `terraform fmt -check` + `validate` (dev + staging) | Échec → pipeline rouge | Bloquant, F7 |
| 2 | Scan IaC Trivy (config), bloquant sur CRITICAL | — | — |
| 3 | `plan`/`apply` | **Non automatisés** — geste manuel, décision IAM en attente | F7 partiel, documenté comme tel depuis le 02/08 |
| 4 | État distant GCS, versionné, verrouillé | — | Vérifié en live le 07/08 (`versioning_enabled: true`) |

**Statut :** 🟡 F7 confirmé partiel (inchangé) ; ❌ `.terraform.lock.hcl` toujours gitignoré — la CI de validation Terraform (`init -backend=false`) ne garantit toujours pas la même version de provider que les `apply` réels (E28, non traité en Tier 0/1/2, hors périmètre décidé).

---

## UC6 — Incident Cloud SQL : panne de zone / restauration

**Flux :** hors F1-F7, procédure d'exploitation (`08_RUNBOOK.md` §3).

**Changement majeur depuis le 08/08/2026 : l'instance est passée de zonale à régionale (Tier 2).** Les deux scénarios ci-dessous coexistent désormais.

### 6a — Panne de zone (nouveau scénario, HA régionale)

| Étape | Attendu | Statut |
|---|---|---|
| 1 | Panne de la zone hébergeant l'instance primaire | — |
| 2 | Bascule automatique vers le réplica synchrone (autre zone) | 🟡 Configuré (`availabilityType: REGIONAL` confirmé en live le 08/08), **mais un vrai failover n'a jamais été déclenché/chronométré** — seule la conversion zonal→régional a été testée, pas une panne réelle |
| 3 | Reprise de service sans intervention manuelle | 🟡 Attendu par design GCP (typiquement de l'ordre de la minute), non mesuré empiriquement sur cet environnement |

### 6b — Restauration PITR (corruption de données, suppression accidentelle — la HA régionale ne protège pas contre ça)

| Étape | Nominal | Mesuré réellement | Contrôle exercé |
|---|---|---|---|
| 1 | Détection de l'incident | — | Alerte Cloud Monitoring → **2 canaux d'alerte email depuis le 08/08** (Tier 0) |
| 2 | Décision de restaurer (point PITR) | — | — |
| 3 | `gcloud sql instances clone` | **32min45s** (test réel du 03/08, sur l'ancienne config zonale — à revalider sur la config régionale actuelle) | RPO mesuré = 0 |
| 4 | Bascule applicative vers l'instance restaurée | **Jamais chronométrée** | Le runbook l'admet explicitement |

**Statut :** ✅ SPOF zonal structurel fermé (décision utilisateur du 08/08, coût de l'instance doublé en connaissance de cause) ; ❌ le vrai comportement de failover automatique n'a jamais été observé en pratique — recommandé avant tout engagement client de déclencher un test de panne de zone réel (hors périmètre de cette session, coût/risque à annoncer explicitement si demandé) ; ⚠️ le chiffre de RTO PITR (32min45s) date d'avant le passage en régional, à revalider ; ❌ **gap toujours ouvert** : une restauration PITR restaure les deux bases (menal_db + elson_db) ensemble, et si elle intervient après le durcissement `REVOKE cloudsqlsuperuser` du 07/08, l'utilisateur restauré peut perdre ce durcissement — mais désormais **détecté automatiquement sous 24h** par le job `elson-sql-isolation-check-staging` (Tier 1) au lieu de rester silencieux indéfiniment.

---

## UC7 — Onboarding d'une application cliente sur le socle (cas réel : Elson)

**Flux :** instanciation du module `app-service` + routage LB (`extra_services`) + monitoring dédié.

| Étape | Nominal | Réel (Elson, au 08/08/2026) | Contrôle exercé |
|---|---|---|---|
| 1 | Nouveau fichier `.tf` sur le modèle d'`elson.tf` | Fait | SA dédié (`sa-elson-staging`), secrets ciblés |
| 2 | DNS + certificat managé | Fait, `elson.menal-sarl.com` | Doit précéder l'`apply` (piège documenté) |
| 3 | Base/utilisateur dédiés sur l'instance Cloud SQL partagée | Fait, `elson_db`/`elson_user` | Isolation runtime (REVOKE croisés) **désormais vérifiée automatiquement chaque jour** (Tier 1, job + alerte sur échec) au lieu d'un geste manuel one-shot |
| 4 | Monitoring (uptime, alertes, SLO) | Fait, 6 alertes actives + 1 uptime check, **+ 1 alerte de dérive d'isolation SQL** depuis le 08/08 | `for_each` générique du module monitoring, **2 canaux d'alerte** depuis le 08/08 |
| 5 | CI dédiée | Fait (`elson-ci.yml`), mais dupliquée à ~280 lignes | Pas de factorisation avec `ci.yml` (inchangé) |
| 6 | Chiffrement | Bucket média + tous les secrets Elson en **CMEK depuis le 08/08** (Tier 2) | Clé globale dédiée aux secrets, clé régionale pour le bucket |

**Statut :** ✅ Premier onboarding réel du socle multi-app, prouvé vivant le 07/08 ; ✅ **isolation SQL désormais auto-vérifiée** (dépendance connue : nécessite que l'image `elson-backend` déployée contienne `sql-isolation-check.ts`, à confirmer via un prochain push CI) ; ❌ gaps structurels toujours ouverts pour une 3ᵉ app : `modules/cloud-sql` non réinstanciable (peering VPC dans le module), aucune colonne tenant dans `detections`/`api_metrics` (sauf `access_logs`) — non traités, hors périmètre Tier 0/1/2.

---

## UC8 — Rollback d'un déploiement défectueux

**Flux :** hors F1-F7, procédure d'exploitation (`08_RUNBOOK.md` §1).

| Étape | Nominal | Statut réel |
|---|---|---|
| 1 | `gcloud run revisions list` | Procédure écrite |
| 2 | `gcloud run services update-traffic --to-revisions=<REV>=100` | ✅ **Testée réellement le 07/08 (Tier 0)** : bascule vers révision précédente 11,6s, retour vers la dernière révision 16,5s (avec cold start observé au retour) |
| 3 | Ne pas repasser par `terraform apply` (ramènerait `:latest`) | Piège documenté correctement dans le runbook, et **partiellement neutralisé depuis le 08/08** : un `apply` de reconstruction résout désormais un digest via Artifact Registry plutôt que `:latest` brut (UC4) |

**Statut :** ✅ **Gap fermé** : le rollback est prouvé fonctionnel et chronométré, pas seulement écrit. ❌ Toujours pas de canary/rollout progressif automatique en CI — le bloc `traffic` explicite ajouté en Tier 1 rend l'infra *prête* pour un rollout progressif piloté hors Terraform (`gcloud`), mais aucun mécanisme ne le déclenche encore automatiquement à chaque déploiement.

---

## Traçabilité vers le plan de tests automatisé

Ce document complète `tests/e2e/README.md` (plan T1–T18) : les cas ci-dessus sont la version narrative (flux, contrôles, alternatives) de ce que les tests T1–T18 vérifient mécaniquement. Voir ce fichier pour l'état d'automatisation détaillé, et `09_AUDIT_E2E_STAGING_2026-08-07.md` pour le détail des preuves de l'audit et de la remédiation Tier 0/1/2.
