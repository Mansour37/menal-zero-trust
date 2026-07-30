# Documents complémentaires pour la phase d'implémentation
**Plateforme MENAL — v1.0 — Juillet 2026**

Point de vue d'architecte : au-delà du HLD/LLD, quatre documents font réellement gagner du temps en implémentation — et deux souvent proposés qui ne sont **pas nécessaires** ici. Les quatre utiles sont fournis ci-dessous **déjà remplis** pour ce périmètre (à maintenir comme documents vivants).

| Document | Verdict | Justification |
|---|---|---|
| 1. Matrice des flux réseau | ✅ Indispensable | C'est le contrat entre l'architecture et la configuration : chaque règle de pare-feu, d'ingress et d'egress doit correspondre à une ligne. Ce qui n'est pas dans la matrice est bloqué. |
| 2. Checklist de mise en service (go-live) | ✅ Indispensable | Transforme la recette en liste vérifiable ; évite l'oubli du « petit réglage console » non versionné. |
| 3. Runbooks d'incident | ✅ Indispensable | Le dashboard pointe vers eux (`runbook_url`) : sans runbooks, le bloc « runbooks » du schéma reste décoratif. Un modèle + un exemplaire complet ci-dessous. |
| 4. Modèle de menaces léger | ✅ Recommandé | Une page qui relie menaces → contrôles → tests. Donne au jury la preuve que les contrôles répondent à des menaces nommées, pas à une checklist générique. |
| Registre ADR | ✅ Déjà couvert | Intégré au HLD §6 — inutile de le dupliquer. |
| Matrice IAM | ✅ Déjà couverte | Intégrée au LLD §2.1 — même raison. |
| Spécification OpenAPI complète des 225 endpoints, RACI multi-équipes, plan de capacité | ❌ Non nécessaires | Documents d'industrialisation multi-équipes ; pour un PFE mono-porteur ils consomment du temps sans preuve supplémentaire. FastAPI génère l'OpenAPI de l'API plateforme automatiquement — cela suffit. |

---

## 1. Matrice des flux réseau (remplie)

Règle de lecture : **tout flux absent de cette matrice est interdit** (deny-by-default). Chaque ligne cite le mécanisme qui l'autorise et celui qui l'authentifie — un flux Zero Trust a toujours les deux.

| # | Source | Destination | Proto/Port | Autorisé par | Authentifié par | Flux HLD |
|---|---|---|---|---|---|---|
| N1 | Internet | ALB | TCP/443 | Frontend LB | TLS + Cloud Armor (filtrage) | F1 |
| N2 | ALB | `app-elson`, `api-platform`, `dash-secu` | HTTPS (NEG serverless) | Ingress `internal-and-cloud-load-balancing` | — (auth applicative en aval) | F1 |
| N3 | `app-elson` / `api-platform` | Cloud SQL (IP privée) | TCP/5432 | Direct VPC egress + PSA | IAM `cloudsql.client` + SSL | F2 |
| N4 | `api-platform` | BigQuery `siem` | API Google (Private Google Access) | PGA | IAM **lecture seule** | F2 |
| N5 | `enrich-job` | `ml-embed` | HTTPS interne | Ingress `internal` | Jeton d'identité `sa-enrich-job` (`run.invoker`) | F5 |
| N6 | `enrich-job` | BigQuery | API Google | PGA | IAM (écriture limitée à `alert_enrichment`, `pending_embeddings`) | F5 |
| N7 | Cloud Scheduler | `enrich-job` | HTTPS | Cible Cloud Run Job | Jeton `sa-scheduler` (`run.invoker`) | F5 |
| N8 | `app-elson` | SMTP fournisseur / APIs externes déclarées | TCP/587, 443 | **Cloud NAT — allow-list** | Credentials applicatifs (Secret Manager) | — |
| N9 | GitHub Actions | Artifact Registry / Cloud Run API | HTTPS | Internet → APIs Google | **WIF** (jeton 10 min) | F3 |
| N10 | Cloud Logging (sink) | BigQuery `raw_logs` | interne Google | Sink configuré | SA du sink (writer sur `raw_logs` uniquement) | F4 |
| ∅ | `ml-embed` | **toute destination Internet** | — | **AUCUN — egress nul** | — | contrôle L6 |
| ∅ | `dash-secu` (navigateur) | `ml-embed` ou BigQuery | — | **INTERDIT — passe par l'API** | — | contrôle L3 |

---

## 2. Checklist de mise en service (go-live)

**Infrastructure as Code (Terraform — source de vérité)**
- [ ] État distant dans le bucket GCS dédié : versioning actif, accès privé, réservé à `sa-ci-infra` + admin
- [ ] `terraform plan` **vide** sur l'environnement final (aucune dérive, aucune ressource créée hors IaC) — test T15 passé
- [ ] Pipeline infra F7 : refus du scan IaC démontré sur une ressource mal configurée (test T16), apply protégé par approbation
- [ ] Aucune valeur de secret dans le code Terraform ni dans l'état (seuls les conteneurs Secret Manager sont en IaC)
- [ ] Frontière F3/F7 en place : `lifecycle ignore_changes` sur l'image des services Cloud Run (pas de guerre d'états entre pipelines)
- [ ] Promotion validée : **digest prod = digest staging = digest scanné** (test T18) ; isolation inter-environnements prouvée (test T17)

**Fondation & identité**
- [ ] Politiques d'org actives : `restrictPublicIp`, `disableServiceAccountKeyCreation`, `publicAccessPrevention` (test T6 passé)
- [ ] 6 SAs créés, rôles conformes à la matrice IAM (LLD §2.1) ; SA Compute par défaut non utilisé
- [ ] 0 clé de SA existante dans le projet ; WIF restreint au dépôt et à la branche `main`
- [ ] Tous les secrets dans Secret Manager, **un par valeur** ; aucun secret en variable d'env d'image

**Réseau & données**
- [ ] Pare-feu : deny-by-default présent ; journaux activés sur les deny
- [ ] Cloud SQL : IP privée uniquement, `require_ssl`, PITR actif, sauvegarde testée par une restauration (leçon audit ELSON §11.11)
- [ ] BigQuery : partitionnement + expiration `raw_logs` ; filtres d'exclusion posés sur le sink
- [ ] Matrice des flux à jour = configuration réelle (revue croisée)

**Workloads & edge**
- [ ] Tous les services en ingress LB-only ou `internal` ; test T1 passé
- [ ] Déploiements par **digest** ; images multi-stage non-root
- [ ] Cloud Armor : règles en mode deny (fin de la période preview) ; test T11 passé
- [ ] `ml-embed` : `--no-allow-unauthenticated`, egress nul, `HF_HUB_OFFLINE=1`, empreinte `MODEL.sha256` vérifiée au build

**Pipeline & détection**
- [ ] Les 3 refus du pipeline (T7, T8, T9) documentés avec captures
- [ ] Règles de détection versionnées ; requêtes planifiées actives ; alerte de bout en bout testée (T13)
- [ ] Uptime checks verts ; politiques d'alerte notifiant un canal réel
- [ ] KPI du dashboard alimentés (dont taux `unmapped` et version du modèle)

**Documentation**
- [ ] Registre ADR à jour ; runbooks publiés et liés depuis le dashboard
- [ ] Rejeu complet depuis un projet vierge validé une fois (Definition of Done n°4)

---

## 3. Runbooks d'incident

### 3.1 Modèle (une page par famille de techniques)

```
RUNBOOK <ID-TECHNIQUE> — <Nom>
Déclencheur     : détection (règle Sigma <id> ou rattachement sémantique ≥ seuil)
Gravité type    : <basse|moyenne|élevée> — ajustée par le score d'incident
1. VÉRIFIER     : preuves à consulter (requête BigQuery fournie), faux positifs connus
2. CONTENIR     : actions immédiates réversibles
3. ÉRADIQUER    : actions correctives
4. RÉTABLIR     : retour au nominal + vérifications
5. CAPITALISER  : ce que la détection doit apprendre (nouvelle règle ? seuil ?)
Rôles           : analyste (1–2), admin (3–4)
```

### 3.2 Exemplaire rempli — T1078.004 « Valid Accounts: Cloud Accounts »

*(usage anormal d'un compte de service — le scénario de l'exemple d'incident du doc ATT&CK-BERT §10.2)*

1. **VÉRIFIER** — Dans le panneau d'incident : entité, fenêtre, techniques associées et leurs `similarity`. Requête sur `raw_logs` : dernières actions IAM/API du SA concerné, IP sources, comparaison à son comportement des 7 derniers jours. Faux positif connu : exécution du pipeline (activité de `sa-ci-deploy` pendant un déploiement).
2. **CONTENIR** — Désactiver le SA (`gcloud iam service-accounts disable`) **ou**, si le service est critique, restreindre d'abord par retrait du rôle le plus sensible. Noter l'heure exacte pour la timeline.
3. **ÉRADIQUER** — Identifier l'origine (secret exposé ? workload compromis ?). Faire tourner les secrets associés (Secret Manager, nouvelles versions), redéployer la révision Cloud Run.
4. **RÉTABLIR** — Réactiver avec rôles minimaux revalidés contre la matrice IAM ; vérifier T4/T5 sur ce SA.
5. **CAPITALISER** — Si la détection est venue du rattachement sémantique (source `semantic`), promouvoir le motif en règle Sigma explicite ; réévaluer le seuil si la `similarity` était limite.

---

## 4. Modèle de menaces léger (une page)

Menaces retenues (vocabulaire ATT&CK, cohérent avec le SIEM), contrôle principal et test qui le prouve :

| Menace | Technique ATT&CK type | Contrôle principal | Test |
|---|---|---|---|
| Exploitation d'une application exposée | T1190 | Cloud Armor WAF + correctifs priorisés (F6) | T11, UC-05 |
| Vol / abus d'identifiants cloud | T1078.004 | 0 clé de SA, WIF, moindre privilège, détection IAM | T6, T4, runbook §3.2 |
| Compromission de la chaîne d'approvisionnement | T1195 | Registre unique, digest, Gitleaks/Semgrep/Trivy, poids ML safetensors + empreintes | T7–T10 |
| Mouvement latéral interne | T1021 / T1580 | Ingress internes, IAM par appel, deny journalisés | T1, T3, T12 |
| Exfiltration de données | T1567 | Egress allow-listé, `ml-embed` sans egress, dashboard en lecture seule | T12, T5 |
| Altération des preuves de détection | (anti-forensics) | Séparation stricte écriture/lecture sur le SIEM | T4 |
| Manipulation du composant IA | (injection de prompt) | **Écartée par conception** : modèle non génératif, entrée tronquée, sortie = 768 flottants | — (argument doc ATT&CK-BERT §5.5) |

Chaque ligne se lit de gauche à droite : *menace nommée → contrôle nommé → preuve rejouable*. C'est la version condensée de toute la démarche.
