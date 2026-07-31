# Guide de démonstration — Cas d'usage MENAL × Elson

**But :** un scénario concret, honnête et rejouable montrant comment la plateforme MENAL
Zero Trust apporterait une visibilité SOC à une application réelle (**Elson**), pour une
soutenance ou une démo. Ce guide ne déploie **pas** Elson sur GCP (voir §3) : il utilise
l'infrastructure MENAL réellement en place pour rejouer, à l'identique, ce qui se
passerait sur le trafic d'Elson une fois intégré.

---

## 1. Elson en une page

**Elson** est une plateforme de crowdsourcing gamifiée (ADST × RIM AI) qui construit des
jeux de données **texte + audio** pour l'arabe hassaniya (Mauritanie) : les contributeurs
traduisent des phrases, enregistrent leur voix, s'évaluent mutuellement ; les données
validées alimentent des modèles ASR/MT/TTS. Stack : Next.js + Express + PostgreSQL,
déployée aujourd'hui sur Hetzner (Docker Compose), avec authentification par mot de passe
(`POST /api/auth/login`, `elson-main/backend/src/routes/auth.ts:398`), OTP WhatsApp, rôles
admin/relecteur, et un corpus de données à forte valeur (voix + identité).

**Pourquoi c'est un bon cas d'usage pour MENAL** : c'est une application publique, avec
authentification, des rôles à privilèges (admin/relecteur), un actif à protéger clair (le
corpus), et — pendant les périodes de compétition (primes en MRU) — une forte incitation à
la fraude et au brute-force de comptes. C'est exactement le profil que les 7 règles Sigma
de MENAL (`terraform/modules/detection/main.tf`) sont conçues pour couvrir : force brute
(R1), pics WAF (R2), traversée de chemin (R3), user-agents suspects (R4), injections (R6).

## 2. État réel de l'intégration — à annoncer clairement

🔴 **Elson n'est pas hébergé sur GCP ni derrière MENAL aujourd'hui.** Il tourne sur son
propre socle (Hetzner + Caddy + Cloudflare). L'audit dédié
(`elson-main/DOCUMENTATION_ELSON.md`, section 14) est explicite : **l'application n'est
pas prête** pour un déploiement GCP sécurisé, avec 6 points bloquants (identifiants admin
par défaut en clair, `JWT_SECRET` unique pour 7 mécanismes, PgBouncer sans authentification,
état en mémoire/sur disque incompatible avec Cloud Run, schéma non reconstructible depuis
le dépôt). Chemin le plus court estimé : 11 à 21 semaines en 4 phases (même document,
§14.5). Rien de tout cela n'est traité ici — ce n'est pas l'objet de ce guide.

**Ce que ce guide démontre à la place** : le **même mécanisme de détection** (WAF → logs →
règle Sigma → détection → tableau de bord) qui protégerait Elson une fois ces points
traités, rejoué pour de vrai sur la plateforme MENAL réellement déployée, avec un trafic
qui imite le point d'entrée le plus sensible d'Elson (`/api/auth/login`).

## 3. Architecture cible (une fois Elson intégré)

```
Contributeur Elson ──HTTPS──> ALB + Cloud Armor (MENAL) ──> Cloud Run "app-elson"
                                     │                              │
                                     │ verdicts WAF                 │ logs applicatifs
                                     ▼                              ▼
                              sink LB → raw_logs              sink Cloud Run → access_logs
                                     │                              │
                                     └──────────► règles Sigma (5 min) ◄──────┘
                                                        │
                                                        ▼
                                                   detections (BigQuery)
                                                        │
                                          enrich-job (ATT&CK-BERT, 15 min)
                                                        │
                                                        ▼
                                              alert_enrichment + dashboard SOC
                                          (/detections, /incidents, /coverage)
```

Matrice de flux (même convention que `05_DOCUMENTS_COMPLEMENTAIRES.md` §1) :

| # | Source | Destination | Autorisé par | Authentifié par |
|---|---|---|---|---|
| E1 | Internet (contributeurs) | ALB MENAL | Cloud Armor (geo-block MR + Maghreb + UE, WAF OWASP) | TLS |
| E2 | ALB | Cloud Run `app-elson` | Ingress LB-only | — (auth applicative en aval) |
| E3 | `app-elson` | Cloud SQL Elson (IP privée) | Direct VPC egress + PSA | IAM + SSL |
| E4 | Logs Cloud Run + LB | `raw_logs`/`access_logs` | Sinks Cloud Logging | SA du sink |
| E5 | Règles Sigma | `detections` | Requêtes planifiées | `sa-pipeline` (écriture limitée) |

## 4. Scénario de démo — réalisable aujourd'hui, sur l'infra MENAL réelle

**Principe :** au lieu d'attaquer Elson (pas intégré), on génère un vrai dépassement du
seuil de la règle **R1 — force brute** (`> 5 échecs d'authentification / même IP / 5 min`,
`terraform/modules/detection/main.tf`) contre `POST /auth/token` de l'API MENAL — le même
type d'endpoint, le même mécanisme de détection que celui qui surveillerait
`POST /api/auth/login` d'Elson une fois derrière le même ALB. C'est exactement le test
`tests/e2e/test_04_pipeline_integration.py::test_t13_simulated_attack_pipeline`, réécrit
cette session pour ne plus être une tautologie (il générait avant un faux positif garanti,
voir `STATUT_DEV.md` §2.4).

### 4.1 Lancer la simulation

```bash
export GOOGLE_APPLICATION_CREDENTIALS=<clé ou ADC déjà active>
export E2E_RUN_SLOW=1
export GCP_PROJECT_ID=menal-zero-trust-dev   # ou -staging une fois promu
pytest tests/e2e/test_04_pipeline_integration.py::TestPipelineIntegration::test_t13_simulated_attack_pipeline -v -s
```

Ce que ça fait, dans l'ordre : 8 tentatives de connexion échouées contre `/auth/token`
depuis la même IP → dépassement du seuil R1 → attend (jusqu'à 12 min, sondé toutes les
30 s) l'apparition d'une ligne `detections` avec `rule_id = 'R1'`.

### 4.2 Ce que le jury voit, couche par couche

1. **Cloud Armor** : les tentatives passent (ce n'est pas du SQLi/XSS, juste des
   mauvais mots de passe) — normal, R1 est une détection applicative, pas une règle WAF.
2. **BigQuery `raw_logs`/`access_logs`** : les 8 requêtes apparaissent, normalisées
   depuis les vrais logs Cloud Run (`modules/logging/main.tf`, flux F4).
3. **BigQuery `detections`** : une ligne `rule_id = R1`, `severity = HIGH`,
   `mitre_tactic = TA0006`, `mitre_technique = T1110` apparaît (< 5 min après le
   dépassement de seuil).
4. **Dashboard MENAL** (`https://dash.menal-sarl.com/detections`) : la détection s'affiche
   en temps réel, mappée MITRE ATT&CK.
5. **`/incidents`** : si l'entité (IP) accumule d'autres signaux dans l'heure, un incident
   chaîné apparaît avec un score.
6. **`/coverage`** : la technique T1110 (Brute Force) passe à "observée" dans la
   couverture ATT&CK.

### 4.3 Variante rapide (sans attendre le cycle complet)

Pour une démo chronométrée, préparer la détection **avant** la présentation (lancer §4.1
10–15 min avant), puis en direct : ouvrir le dashboard, montrer la détection déjà présente,
cliquer sur l'incident, montrer le mapping MITRE et le lien runbook
(`05_DOCUMENTS_COMPLEMENTAIRES.md` §3, `RUNBOOK T1110.004`).

## 5. Script de présentation (15 min — aligné sur la Definition of Done, `04_METHODOLOGIE_IMPLEMENTATION.md` §7.6)

| # | Preuve | Support |
|---|---|---|
| 1 | Schéma HLD + où Elson s'intégrerait | §3 de ce guide |
| 2 | Attaque simulée (brute-force représentatif d'Elson) | §4.1 |
| 3 | Incident enrichi, mappé MITRE ATT&CK | Dashboard `/detections`, `/incidents` |
| 4 | Couverture ATT&CK mise à jour | Dashboard `/coverage` |
| 5 | Refus de pipeline (secret injecté volontairement dans une PR) | `.github/workflows/ci.yml` — étape Gitleaks (T7) |
| 6 | Chaîne de promotion dev → staging | `terraform/environments/{dev,staging}` + digest identique (T18) |

## 6. Limites à annoncer explicitement pendant la démo

- Le trafic est généré **contre l'API MENAL elle-même**, pas contre une instance
  d'Elson réelle — c'est un proxy volontaire et assumé, pas une simulation d'Elson en
  production.
- Le MFA (TOTP, cette session) protège les comptes MENAL ; Elson n'a **aucun** MFA
  aujourd'hui (`DOCUMENTATION_ELSON.md` §11.6) — point à citer comme axe d'amélioration
  si la question est posée.
- La détection sémantique (ATT&CK-BERT, couche L6) utilise encore un encodeur simulé côté
  précalcul (`scripts/precompute_attacks.py`) — à ne présenter que comme mécanisme
  fonctionnel, pas comme résultat sémantique validé (cf. audit initial de cette session).
