# Intégration d'un modèle IA open-source dans l'architecture SIEM Zero Trust

**Modèle retenu : ATT&CK-BERT (`basel/ATTACK-BERT`)**
Couche cible : **L6 — ML / Enrichissement sémantique**
Version du document : 1.0 — Juillet 2026

---

## 1. Verdict et positionnement

### 1.1 Ce que le modèle apporte réellement

| Axe | Verdict | Précision |
|---|---|---|
| **Sécurité — couverture de détection** | Gain réel et mesurable | Détection d'activités non couvertes par les règles Sigma |
| **Sécurité — investigation** | Gain réel | Corrélation sémantique multi-sources, réduction du MTTR |
| **Sécurité — priorisation** | Gain réel | Boucle fermée DevSecOps ↔ SIEM sur les CVE |
| **Performance de détection** | Gain réel | Rappel accru, MTTD réduit |
| **Performance de l'architecture** | **Aucun gain — coût net** | +1 service, +latence, +surface à durcir |
| **Innovation** | Modérée, à revendiquer correctement | L'approche est publiée ; l'originalité est l'intégration serverless |

### 1.2 Formulation à retenir pour la soutenance

> « L'ajout d'ATT&CK-BERT n'améliore pas les performances de l'infrastructure — il en consomme.
> Il améliore la **performance de détection** : le système identifie des comportements
> qu'aucune règle ne décrit, et rattache automatiquement chaque observation au
> référentiel MITRE ATT&CK. Le surcoût d'infrastructure est le prix de ce gain,
> et il est quantifié en section 6. »

Cette honnêteté est un atout d'évaluation, pas une faiblesse. Un projet qui annonce un gain
de performance sur tous les axes simultanément est immédiatement suspect.

### 1.3 Ce que l'on revendique comme original

1. Inférence vectorielle **déportée dans BigQuery** (`VECTOR_SEARCH`) plutôt que dans une base vectorielle dédiée — supprime un composant d'infrastructure entier.
2. Précalcul asymétrique : le côté référentiel (statique) est encodé hors ligne, seule l'alerte entrante passe par le modèle.
3. Choix délibéré d'un **modèle non génératif** comme contrôle de sécurité, documenté et justifié (section 5.5).
4. Traitement des poids du modèle comme **artefact de chaîne d'approvisionnement non fiable**, intégré au pipeline DevSecOps existant (section 9).

---

## 2. Le problème résolu

### 2.1 Situation initiale

L'architecture actuelle repose sur une détection par règles (Sigma → SQL BigQuery).
Ce modèle a deux angles morts structurels :

| Angle mort | Conséquence opérationnelle |
|---|---|
| Une règle ne détecte que ce qu'un humain a explicitement décrit | Toute variante non anticipée passe |
| Les alertes arrivent isolées, sans vocabulaire commun | L'analyste reconstruit manuellement la chronologie |
| Les CVE remontées par Trivy ne sont pas priorisées par la menace observée | On corrige par score CVSS, pas par risque réel |

### 2.2 Après intégration

```
AVANT :  log → règle Sigma → alerte (ou rien)

APRÈS :  log → règle Sigma → alerte ────────────┐
              │                                  ├→ technique ATT&CK
              └→ ATT&CK-BERT (sémantique) ───────┘   + tactique
                                                     + score de confiance
                                                          │
                                                          ▼
                                              corrélation par entité
                                              bonus kill-chain
                                              priorisation CVE
```

Le modèle produit le champ `technique_id` / `tactic`, qui devient la **clé de jointure
universelle** entre les alertes, les vulnérabilités et le référentiel de menaces.

---

## 3. Fiche d'identité du modèle

| Attribut | Valeur |
|---|---|
| Identifiant Hugging Face | `basel/ATTACK-BERT` |
| Type | Modèle d'embedding de phrases (sentence-transformers) |
| Architecture de base | MPNet (famille BERT) |
| Paramètres | ≈ 110 millions |
| Taille des poids | ≈ 420–440 Mo en `float32` / ≈ 110 Mo en ONNX `int8` |
| Dimension de sortie | 768 |
| Longueur maximale d'entrée | 512 tokens |
| Matériel requis | **CPU uniquement** — aucun GPU |
| Domaine | Cybersécurité — actions d'attaque |
| Outil de référence associé | SMET — `github.com/basel-a/SMET` |
| Publication scientifique | *SMET: Semantic Mapping of CVE to ATT&CK and Its Application to Cybersecurity* (Springer) |

### 3.1 Fonction du modèle

Le modèle projette une phrase décrivant une action d'attaque dans un espace vectoriel
de dimension 768, où la **similarité cosinus** entre deux vecteurs traduit la proximité
sémantique des actions décrites.

Exemple :

```
"Attacker takes a screenshot"     ─┐
                                   ├─→ similarité cosinus élevée
"Attacker captures the screen"    ─┘
```

Les deux phrases n'ont aucun mot-clé technique en commun, mais décrivent la même
technique ATT&CK (T1113 — Screen Capture). Une règle par mots-clés échoue ; le modèle
sémantique réussit. **C'est exactement l'angle mort décrit en 2.1.**

### 3.2 Ce que le modèle N'EST PAS

- Ce n'est **pas** un LLM. Il ne génère aucun texte.
- Il ne « décide » pas. Il retourne une distance numérique.
- Il ne remplace pas les règles Sigma. Il les complète.

Cette limitation est le fondement de sa sécurité (section 5.5).

---

## 4. Principe de fonctionnement

Le pipeline est **asymétrique** : le côté coûteux est calculé une seule fois, hors ligne.

### Phase A — Hors ligne (une fois, ou à chaque mise à jour ATT&CK)

```
Descriptions des ~600 techniques ATT&CK
              │
              ▼
      ATT&CK-BERT (local)
              │
              ▼
      600 vecteurs × 768 dims
              │
              ▼
   Table BigQuery `attack_embeddings` + index vectoriel
```

Coût : quelques minutes de CPU, une seule fois. Aucune charge récurrente.

### Phase B — En ligne (par alerte)

```
Texte de l'alerte / description d'événement
              │
              ▼
   Service Cloud Run `ml-embed` (ONNX int8, CPU)   ← ~30–50 ms
              │
              ▼
      1 vecteur × 768 dims
              │
              ▼
  BigQuery VECTOR_SEARCH (top_k = 3, COSINE)       ← SQL pur
              │
              ▼
  technique_id · tactic · score de similarité
              │
              ▼
  Table `alert_enrichment` → moteur de scoring → dashboard
```

**Point clé :** la recherche du plus proche voisin s'exécute dans BigQuery, pas dans le
service ML. Aucune base vectorielle supplémentaire (Vertex AI Matching Engine, pgvector,
Qdrant) n'est nécessaire. C'est ce qui rend l'ajout supportable pour l'architecture.

---

## 5. Apports côté sécurité

### 5.1 Couverture de détection au-delà des règles

Toute observation reçoit une technique ATT&CK inférée, même sans règle Sigma correspondante.
Un événement qui ne déclenche aucune règle mais dont la similarité sémantique avec une
technique dépasse le seuil devient un signal de faible poids — visible, traçable, corrélable.

**Effet mesurable :** rappel (recall) de détection, à comparer avant/après sur le même
jeu de logs.

### 5.2 Corrélation sémantique multi-sources

Deux alertes issues de sources différentes (Cloud Audit Log IAM et log applicatif FastAPI)
mais sémantiquement proches sont regroupées automatiquement en un incident unique.

**Effet mesurable :** nombre d'alertes brutes ÷ nombre d'incidents consolidés
(taux de consolidation). Réduction directe de la charge d'analyse.

### 5.3 Activation du bonus kill-chain

Le champ `tactic` produit par le modèle est ce qui permet la règle de corrélation :

> ≥ 2 tactiques ATT&CK distinctes, même entité, fenêtre d'une heure → +15 au score

Sans le modèle, ce champ n'existe que pour les événements couverts par une règle Sigma
explicitement annotée. Avec le modèle, il existe pour **tous** les événements.
Le modèle est donc la condition d'existence de la détection de progression d'attaque.

### 5.4 Priorisation des vulnérabilités — boucle DevSecOps ↔ SIEM

```
Trivy (pipeline CI) → liste de CVE
        │
        ▼
ATT&CK-BERT encode les descriptions CVE
        │
        ▼
VECTOR_SEARCH → techniques ATT&CK associées
        │
        ▼
Jointure avec les techniques OBSERVÉES dans les logs des 30 derniers jours
        │
        ▼
Priorité de correction = f(CVSS, exposition, technique activement observée)
```

**Résultat concret :** vous ne corrigez plus par score CVSS décroissant, mais par
risque réellement observé dans votre environnement. C'est la différence entre une
gestion de vulnérabilités théorique et une gestion informée par la menace.

C'est également le point qui relie vos deux blocs de schéma (pipeline DevSecOps et
couche DATA) qui étaient jusque-là indépendants.

### 5.5 Le modèle comme contrôle de sécurité (choix d'architecture)

Le choix d'un modèle **non génératif** est un contrôle de sécurité délibéré :

| Risque | LLM génératif auto-hébergé | ATT&CK-BERT |
|---|---|---|
| Injection de prompt via contenu de log | **Élevé** — l'attaquant contrôle une partie du prompt | **Nul** — pas de prompt |
| Hallucination dans un rapport d'incident | Possible | Structurellement impossible |
| Exfiltration via sortie générée | Possible | Sortie = 768 flottants |
| Reproductibilité forensique | Faible (échantillonnage) | Totale (déterministe) |
| Empreinte matérielle | GPU | 1 vCPU |

**Formulation pour le mémoire :**

> « Dans un SIEM, la sortie du modèle devient une preuve. Un modèle génératif produit
> une sortie non déterministe et manipulable par le contenu qu'il analyse — donc
> inutilisable comme preuve et constituant une surface d'attaque supplémentaire
> à l'intérieur même de l'outil de détection. Un modèle d'embedding produit une
> distance numérique reproductible : auditable, non manipulable, admissible. »

Ce raisonnement est cohérent avec le principe Zero Trust appliqué aux composants
internes, et non seulement au périmètre.

---

## 6. Impact sur les performances — analyse honnête

### 6.1 Ce qui est ajouté (coût)

| Élément | Impact |
|---|---|
| Service Cloud Run `ml-embed` | +1 composant à déployer, surveiller, durcir |
| Latence d'enrichissement | +30 à 50 ms par alerte (CPU) |
| Démarrage à froid | ≈ 2 à 4 s (image ONNX int8 ≈ 110 Mo) |
| Image conteneur | +110 Mo à scanner dans le pipeline |
| Stockage BigQuery | Négligeable (600 vecteurs + index) |
| Surface d'attaque | +1 endpoint interne à authentifier |

### 6.2 Choix d'ingénierie qui limitent ce coût

| Décision | Effet |
|---|---|
| Export ONNX quantisé `int8` | ÷4 sur la taille et la latence vs `float32` PyTorch |
| Référentiel ATT&CK précalculé hors ligne | Le modèle ne traite qu'un côté de la comparaison |
| `VECTOR_SEARCH` dans BigQuery | Supprime le besoin d'une base vectorielle dédiée |
| `min-instances = 0` | Coût nul en l'absence d'alertes |
| Traitement par lots (Cloud Run Job planifié) | Amortit le démarrage à froid sur N alertes |
| Cache des embeddings par hachage du texte | Les événements récurrents ne sont encodés qu'une fois |

Le cache est particulièrement efficace : dans un flux de logs cloud, la variété
sémantique réelle est faible. Un taux de succès de cache élevé est attendu, ce qui
réduit d'autant les inférences.

### 6.3 Ce qui est gagné (bénéfice)

| Métrique | Nature du gain |
|---|---|
| Rappel de détection | Détections supplémentaires hors périmètre des règles |
| Taux de consolidation d'alertes | Moins d'incidents à traiter pour le même volume brut |
| MTTD (temps moyen de détection) | Rattachement ATT&CK immédiat, sans analyse manuelle |
| MTTR (temps moyen de remédiation) | Contexte et runbook fournis dès l'ouverture de l'incident |
| Couverture ATT&CK mesurable | Matrice de couverture chiffrée, pas déclarative |

**Ces cinq métriques doivent être mesurées avant et après.** Un tableau comparatif
avant/après est le livrable qui donne sa valeur à toute la démarche.

### 6.4 Ordre de grandeur du coût financier

Sur un projet de démonstration, à volume modéré :

- Cloud Run avec `min-instances = 0` et traitement par lots : dans les paliers gratuits ou proche.
- BigQuery : le stockage des vecteurs et l'index sont négligeables face au volume de logs.
- Aucun GPU, aucun endpoint d'inférence managé, aucune base vectorielle facturée.

Le poste dominant reste l'ingestion des logs, indépendamment du modèle. Les filtres
d'exclusion au niveau du sink ont un impact bien supérieur à toute optimisation du modèle.

> À valider par mesure réelle sur votre projet avant de citer un chiffre en soutenance.

---

## 7. Limites à documenter explicitement

Un mémoire qui énonce ses limites est plus solide qu'un mémoire qui les masque.

1. **Dépendance linguistique.** Le modèle est entraîné sur de l'anglais. Les logs GCP
   sont en anglais, donc le cas d'usage est couvert — mais tout log applicatif francophone
   nécessiterait une traduction préalable ou un modèle multilingue.
2. **Calibration du seuil.** La similarité cosinus n'est pas une probabilité. Le seuil
   (≈ 0,6 en point de départ) doit être calibré sur vos données, et le choix justifié
   par une courbe précision/rappel.
3. **Faux rattachements.** Le modèle rattachera toujours quelque chose. La discipline
   `unmapped` sous le seuil est indispensable — on assume l'absence de résultat plutôt
   que de forcer une réponse.
4. **Pas de détection d'anomalie temporelle.** Le modèle est sémantique, pas statistique.
   Il ne détecte pas « ce compte agit anormalement par rapport à son historique ».
   Cette fonction reste couverte par `ML.DETECT_ANOMALIES` / `ARIMA_PLUS` en BigQuery ML.
5. **Modèle figé.** Aucun réentraînement prévu. Une évolution du référentiel ATT&CK
   nécessite seulement de régénérer les vecteurs de la phase A — mais pas d'adaptation
   du modèle à votre environnement spécifique.
6. **Le modèle n'est pas une source de vérité.** Il produit une hypothèse assortie d'un
   score. Toute décision de réponse à incident reste soumise à validation humaine.

---

## 8. Téléchargement et préparation

### 8.1 Environnement

```bash
python -m venv .venv && source .venv/bin/activate
pip install "sentence-transformers" "optimum[onnxruntime]" \
            "onnxruntime" "google-cloud-bigquery" "fastapi" "uvicorn"
```

### 8.2 Récupération des poids avec épinglage de version

Ne jamais télécharger depuis Hugging Face à l'exécution en production.
On récupère une fois, on épingle, on embarque dans l'image.

```bash
# Récupération avec révision épinglée (remplacer par le commit réel constaté)
huggingface-cli download basel/ATTACK-BERT \
  --revision <COMMIT_SHA> \
  --local-dir ./models/attack-bert

# Vérification : refuser les artefacts au format pickle
find ./models/attack-bert -name "*.bin" -o -name "*.pkl" -o -name "*.pt"
# → doit être vide. Seuls les fichiers .safetensors sont acceptés.

# Empreinte de référence à consigner dans le mémoire
find ./models/attack-bert -type f -exec sha256sum {} \; | sort > MODEL.sha256
```

**Justification du refus du format `.bin` :** un fichier PyTorch `.bin` est un pickle
Python. Son chargement exécute du code arbitraire. Refuser le pickle au profit de
`safetensors` sur un artefact tiers est un contrôle de chaîne d'approvisionnement
concret et vérifiable.

### 8.3 Export ONNX quantisé

```python
from optimum.onnxruntime import ORTModelForFeatureExtraction, ORTQuantizer
from optimum.onnxruntime.configuration import AutoQuantizationConfig
from transformers import AutoTokenizer

SRC = "./models/attack-bert"
DST = "./models/attack-bert-onnx-int8"

model = ORTModelForFeatureExtraction.from_pretrained(SRC, export=True)
tok = AutoTokenizer.from_pretrained(SRC)
model.save_pretrained(DST); tok.save_pretrained(DST)

qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=True)
ORTQuantizer.from_pretrained(DST).quantize(
    save_dir=DST, quantization_config=qconfig
)
```

**Validation obligatoire de la quantisation.** Comparer les embeddings `float32` et
`int8` sur un échantillon avant de valider :

```python
import numpy as np
# similarité cosinus moyenne entre les deux versions sur ~200 phrases de test
# critère d'acceptation : > 0.99
```

Si le critère n'est pas atteint, revenir à `float32` ou à une quantisation dynamique
moins agressive. **Ne jamais déployer une quantisation non validée.**

### 8.4 Précalcul des vecteurs du référentiel ATT&CK

```python
import json
from sentence_transformers import SentenceTransformer

m = SentenceTransformer("./models/attack-bert")

# techniques.json : issu du STIX ATT&CK Enterprise (MITRE, licence ouverte)
techniques = json.load(open("techniques.json"))
texts = [f"{t['name']}. {t['description']}" for t in techniques]

vecs = m.encode(texts, normalize_embeddings=True,
                batch_size=32, show_progress_bar=True)

rows = [
    {"technique_id": t["id"], "name": t["name"], "tactic": t["tactic"],
     "embedding": v.tolist()}
    for t, v in zip(techniques, vecs)
]
with open("attack_embeddings.jsonl", "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")
```

`normalize_embeddings=True` est important : avec des vecteurs normalisés, la distance
cosinus devient un simple produit scalaire, ce qui simplifie et accélère la recherche.

---

## 9. Intégration dans l'architecture

### 9.1 Position dans le schéma existant

```
┌──────────────────────────────────────────────────────────────────────┐
│  L1 — EDGE          DNS · Load Balancer · Cloud Armor · rate limit   │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────┐
│  L3 — WORKLOADS SERVERLESS                                           │
│  ┌────────────────────┐   ┌──────────────────────────────────────┐   │
│  │ Application        │   │ API FastAPI + Dashboard Next.js      │   │
│  │ éducative          │   │  GET /incidents                      │   │
│  │ (hors périmètre)   │   │  GET /incidents/{id}/attack   ◄──┐   │   │
│  └────────────────────┘   └──────────────────────────────────┼───┘   │
└─────────────────────────────────────────────────────────────┼────────┘
             ▲                                                 │
             │ L2 — IAM · comptes de service · KMS · JWT-RBAC   │
             │                                                 │
┌────────────┴─────────────────────────────────────────────────┼────────┐
│  L4 — RÉSEAU     VPC · subnet privé · PSA · Cloud NAT         │        │
└──────────────────────────────────┬───────────────────────────┼────────┘
                                   │                           │
┌══════════════════════════════════▼═══════════════════════════┼════════┐
│  L6 — ML / ENRICHISSEMENT SÉMANTIQUE          ★ NOUVEAU      │        │
│                                                              │        │
│   ┌──────────────────────────┐    ┌───────────────────────┐  │        │
│   │ ml-embed (Cloud Run)     │    │ enrich-job            │  │        │
│   │ ONNX int8 · CPU · 1 GiB  │◄───┤ (Cloud Run Job)       │  │        │
│   │ min-instances = 0        │    │ Cloud Scheduler /5min │  │        │
│   │ egress : AUCUN           │    └───────────┬───────────┘  │        │
│   └──────────────────────────┘                │              │        │
└═══════════════════════════════════════════════┼══════════════┼════════┘
                                                │              │
┌───────────────────────────────────────────────▼──────────────┼────────┐
│  L5 — DATA (BigQuery)                                        │        │
│   raw_logs  ──►  detections  ──►  alert_enrichment  ──►  incident_scores
│                                          ▲                            │
│                                 VECTOR_SEARCH                         │
│                                          │                            │
│                                  attack_embeddings (600 vecteurs)     │
│                                  + index vectoriel                    │
│   Cloud SQL PostgreSQL (HA/PITR) — état applicatif, runbooks           │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│  L7 — OBSERVABILITÉ   Cloud Logging · Monitoring · alerting · runbooks│
└──────────────────────────────────────────────────────────────────────┘
```

La nouvelle couche L6 s'insère **entre le réseau et les données**, et non en périphérie.
Elle n'est joignable que depuis l'intérieur du VPC.

### 9.2 Contrôles Zero Trust appliqués à L6

| Contrôle | Mise en œuvre |
|---|---|
| Authentification | `--no-allow-unauthenticated` ; jeton d'identité du compte de service appelant |
| Réseau | Serverless VPC Connector ; `--vpc-egress=all-traffic` ; **aucune route Internet sortante** |
| Identité | Compte de service dédié `sa-ml-embed` — aucun droit BigQuery |
| Séparation des privilèges | `sa-enrich-job` : `bigquery.dataViewer` sur `detections`, `bigquery.dataEditor` **uniquement** sur `alert_enrichment` |
| Intégrité des preuves | Le moteur d'enrichissement **ne peut pas** écrire dans `raw_logs` ni `detections` |
| Chiffrement | Poids et tables chiffrés CMEK via KMS (L2) |
| Provenance | Poids embarqués dans l'image Artifact Registry, révision épinglée, digest consigné |
| Limitation de ressources | Troncature stricte à 512 tokens ; taille de requête plafonnée ; concurrence bornée |
| Journalisation | Chaque inférence journalisée : hachage d'entrée, score, technique retenue, version du modèle |

Le principe **« un moteur de détection ne doit jamais pouvoir modifier les preuves
qu'il analyse »** est le point d'architecture le plus important de cette section.

### 9.3 Dockerfile durci

```dockerfile
FROM python:3.12-slim AS base
RUN useradd -u 10001 -m appuser
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Poids embarqués — jamais téléchargés à l'exécution
COPY models/attack-bert-onnx-int8/ /app/model/
COPY MODEL.sha256 /app/MODEL.sha256
COPY app/ /app/app/

# Vérification d'intégrité au build
RUN cd / && sha256sum -c /app/MODEL.sha256 --quiet

ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 OMP_NUM_THREADS=1
USER 10001
EXPOSE 8080
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080","--workers","1"]
```

`HF_HUB_OFFLINE=1` garantit qu'aucun appel réseau vers Hugging Face n'est possible,
même en cas d'erreur de code. Défense en profondeur au niveau applicatif, en complément
du blocage réseau.

Le pipeline DevSecOps existant scanne cette image comme les autres : Trivy sur les
dépendances et le système de base, Semgrep sur le code du service.

### 9.4 Schéma BigQuery

```sql
-- Référentiel ATT&CK vectorisé (rempli hors ligne, lecture seule en production)
CREATE TABLE `siem.attack_embeddings` (
  technique_id STRING NOT NULL,
  name         STRING,
  tactic       STRING,
  description  STRING,
  embedding    ARRAY<FLOAT64>,
  model_version STRING,
  loaded_at    TIMESTAMP
);

CREATE VECTOR INDEX idx_attack
ON `siem.attack_embeddings`(embedding)
OPTIONS(index_type='IVF', distance_type='COSINE');

-- Résultat de l'enrichissement — seule table en écriture pour sa-enrich-job
CREATE TABLE `siem.alert_enrichment` (
  alert_id      STRING NOT NULL,
  entity        STRING,
  technique_id  STRING,
  tactic        STRING,
  similarity    FLOAT64,
  status        STRING,      -- 'mapped' | 'unmapped'
  model_version STRING,
  input_hash    STRING,      -- SHA256 du texte encodé : traçabilité + cache
  enriched_at   TIMESTAMP
)
PARTITION BY DATE(enriched_at)
CLUSTER BY entity, tactic;
```

### 9.5 Requête d'enrichissement

```sql
DECLARE threshold FLOAT64 DEFAULT 0.60;

INSERT INTO `siem.alert_enrichment`
SELECT
  q.alert_id,
  q.entity,
  IF(1 - r.distance >= threshold, r.base.technique_id, NULL) AS technique_id,
  IF(1 - r.distance >= threshold, r.base.tactic,       NULL) AS tactic,
  1 - r.distance                                             AS similarity,
  IF(1 - r.distance >= threshold, 'mapped', 'unmapped')      AS status,
  'attack-bert-onnx-int8@<SHA>'                              AS model_version,
  q.input_hash,
  CURRENT_TIMESTAMP()
FROM VECTOR_SEARCH(
  TABLE `siem.attack_embeddings`, 'embedding',
  TABLE `siem.pending_embeddings`,      -- écrit par enrich-job
  query_column_to_search => 'embedding',
  top_k => 1,
  distance_type => 'COSINE'
) AS r
JOIN `siem.pending_embeddings` q USING (alert_id);
```

Le seuil est **déclaré explicitement en tête de requête**, pas enfoui dans du code.
Il est ainsi auditable et modifiable sans redéploiement.

### 9.6 Requête de corrélation kill-chain

```sql
CREATE OR REPLACE VIEW `siem.v_killchain` AS
SELECT
  entity,
  TIMESTAMP_TRUNC(enriched_at, HOUR) AS window_hour,
  ARRAY_AGG(DISTINCT tactic IGNORE NULLS ORDER BY tactic) AS tactics,
  COUNT(DISTINCT tactic)                                  AS tactic_count,
  COUNT(DISTINCT tactic) >= 2                             AS chained,
  IF(COUNT(DISTINCT tactic) >= 2, 15, 0)                  AS killchain_bonus,
  MAX(similarity)                                         AS best_confidence,
  ARRAY_AGG(STRUCT(alert_id, technique_id, similarity)
            ORDER BY similarity DESC LIMIT 20)            AS evidence
FROM `siem.alert_enrichment`
WHERE status = 'mapped'
  AND enriched_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY entity, window_hour;
```

Le champ `evidence` est essentiel : le score n'est jamais présenté sans les alertes
qui l'ont produit. Aucun score orphelin dans le dashboard.

---

## 10. API FastAPI

### 10.1 Service d'inférence `ml-embed`

```python
# app/main.py — service interne, jamais exposé publiquement
import hashlib, numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer

MODEL_DIR = "/app/model"
MODEL_VERSION = "attack-bert-onnx-int8@<SHA>"
MAX_TOKENS, MAX_BATCH = 512, 64

app = FastAPI(title="ml-embed", docs_url=None, redoc_url=None)
tok = AutoTokenizer.from_pretrained(MODEL_DIR)
model = ORTModelForFeatureExtraction.from_pretrained(MODEL_DIR)


class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=MAX_BATCH)


def mean_pool(last_hidden, mask):
    m = np.expand_dims(mask, -1).astype("float32")
    return (last_hidden * m).sum(1) / np.clip(m.sum(1), 1e-9, None)


@app.post("/embed")
def embed(req: EmbedRequest):
    texts = [t[:8000] for t in req.texts]          # garde-fou en amont
    if not any(t.strip() for t in texts):
        raise HTTPException(400, "empty input")

    enc = tok(texts, padding=True, truncation=True,
              max_length=MAX_TOKENS, return_tensors="np")
    out = model(**enc)
    v = mean_pool(out.last_hidden_state, enc["attention_mask"])
    v = v / np.clip(np.linalg.norm(v, axis=1, keepdims=True), 1e-9, None)

    return {
        "model_version": MODEL_VERSION,
        "dim": int(v.shape[1]),
        "items": [
            {"input_hash": hashlib.sha256(t.encode()).hexdigest(),
             "embedding": vec.tolist()}
            for t, vec in zip(texts, v)
        ],
    }


@app.get("/healthz")
def healthz():
    return {"status": "ok", "model_version": MODEL_VERSION}
```

`docs_url=None` : pas de documentation OpenAPI exposée sur un service interne.
Le `input_hash` retourné permet le cache et la traçabilité forensique.

### 10.2 Endpoints exposés au dashboard

Ces endpoints sont sur votre **API FastAPI existante** (L3), protégés par le JWT-RBAC
de L2. Le dashboard n'appelle jamais `ml-embed` directement.

```python
@router.get("/incidents/{incident_id}/attack")
def attack_context(incident_id: str, user = Depends(require_role("analyst"))):
    """Contexte ATT&CK d'un incident. Lecture BigQuery uniquement."""
    ...

@router.get("/coverage/attack-matrix")
def coverage_matrix(days: int = 30, user = Depends(require_role("analyst"))):
    """Matrice de couverture : techniques observées vs référentiel complet."""
    ...

@router.get("/vulnerabilities/prioritized")
def prioritized_cves(user = Depends(require_role("analyst"))):
    """CVE Trivy priorisées par technique ATT&CK observée."""
    ...
```

Contrat JSON de `/incidents/{id}/attack` :

```json
{
  "incident_id": "INC-2026-0714-0031",
  "entity": "sa-api-prod@projet.iam.gserviceaccount.com",
  "score": 82,
  "severity": "high",
  "killchain": {
    "chained": true,
    "tactics": ["Credential Access", "Discovery", "Exfiltration"],
    "bonus_applied": 15
  },
  "techniques": [
    {
      "technique_id": "T1078.004",
      "name": "Valid Accounts: Cloud Accounts",
      "tactic": "Defense Evasion",
      "similarity": 0.81,
      "source": "semantic",
      "runbook_url": "/runbooks/T1078.004"
    },
    {
      "technique_id": "T1580",
      "name": "Cloud Infrastructure Discovery",
      "tactic": "Discovery",
      "similarity": 0.74,
      "source": "sigma_rule",
      "rule_id": "gcp_iam_enum_001",
      "runbook_url": "/runbooks/T1580"
    }
  ],
  "unmapped_count": 3,
  "model_version": "attack-bert-onnx-int8@<SHA>",
  "evidence": [
    {"alert_id": "a-9931", "ts": "2026-07-14T09:12:04Z", "similarity": 0.81}
  ]
}
```

Trois champs sont non négociables pour la crédibilité du dashboard :

- `source` — distingue une détection par règle d'une détection sémantique. L'analyste doit savoir d'où vient l'information.
- `similarity` — toujours affichée. Un rattachement à 0,62 n'a pas le même statut qu'un rattachement à 0,91.
- `unmapped_count` — le nombre d'observations que le modèle n'a pas su rattacher. Afficher son propre taux d'échec est une marque de sérieux.

---

## 11. Intégration dans le dashboard de supervision

Quatre composants à ajouter au dashboard Next.js. Aucun ne nécessite d'appel au modèle
depuis le navigateur : tout passe par l'API FastAPI, qui lit BigQuery.

### 11.1 Matrice de couverture ATT&CK

Grille des tactiques en colonnes, techniques en cellules, coloration selon le nombre
d'observations sur la période. Les cellules non couvertes restent vides.

**Pourquoi c'est le composant le plus important :** il rend visible ce que le système
**ne détecte pas**. Un dashboard qui n'affiche que ses succès n'informe personne.
C'est aussi le visuel qui portera votre soutenance.

### 11.2 Timeline kill-chain par entité

Axe horizontal = temps, bandes horizontales = tactiques ATT&CK. Chaque alerte est un point
placé sur la bande de sa tactique. Une progression visible sur plusieurs bandes matérialise
la chaîne d'attaque, et justifie visuellement le bonus de +15.

### 11.3 Panneau d'investigation d'incident

```
┌────────────────────────────────────────────────────────────┐
│ INC-2026-0714-0031          Score 82 · ÉLEVÉ               │
│ Entité : sa-api-prod@...                                   │
├────────────────────────────────────────────────────────────┤
│ Progression kill-chain     ✔ 3 tactiques    (+15)          │
│                                                            │
│ Techniques rattachées                                      │
│  T1078.004  Valid Accounts: Cloud Accounts                 │
│             ████████░░  0.81   [sémantique]   → runbook    │
│  T1580      Cloud Infrastructure Discovery                 │
│             ███████░░░  0.74   [règle Sigma]  → runbook    │
│                                                            │
│ ⚠ 3 observations non rattachées (sous le seuil de 0.60)     │
│                                                            │
│ Modèle : attack-bert-onnx-int8@<SHA>                       │
│ Preuves : 12 alertes                       [Voir le détail]│
└────────────────────────────────────────────────────────────┘
```

Chaque technique est cliquable vers son runbook. C'est la concrétisation du bloc
« runbooks » déjà présent dans votre couche observabilité, jusqu'ici non relié.

### 11.4 Vulnérabilités priorisées par la menace

Tableau des CVE Trivy, trié non par CVSS mais par technique ATT&CK observée dans
l'environnement au cours des 30 derniers jours.

| CVE | CVSS | Technique associée | Observée ? | Priorité |
|---|---|---|---|---|
| CVE-2026-XXXX | 7.5 | T1190 | **Oui (14×)** | **1** |
| CVE-2026-YYYY | 9.8 | T1210 | Non | 2 |

Le fait qu'une CVE à 7,5 passe devant une CVE à 9,8 est **la démonstration visuelle**
de la valeur du système. C'est le tableau à montrer en soutenance.

### 11.5 Indicateurs d'exploitation

Une bande de KPI en haut du dashboard :

| Indicateur | Ce qu'il démontre |
|---|---|
| MTTD / MTTR | Le système est opéré, pas seulement construit |
| Taux de consolidation (alertes ÷ incidents) | Réduction effective du bruit |
| % détections sémantiques vs règles | Contribution mesurée du modèle |
| Taux `unmapped` | Transparence sur les limites |
| Latence p95 de `ml-embed` | Maîtrise de la performance ajoutée |
| Version du modèle en production | Traçabilité |

---

## 12. Évaluation du modèle

### 12.1 Jeux de données

| Jeu | Usage |
|---|---|
| **TRAM** (Center for Threat-Informed Defense) | Phrases CTI annotées par technique ATT&CK |
| **CTI-to-MITRE** | Second jeu public de rattachement CTI → technique |
| Vos propres Cloud Audit Logs | Validation en conditions réelles |

Ces deux jeux sont publics et directement alignés sur la tâche de rattachement de
phrases de renseignement sur la menace vers les techniques ATT&CK.

### 12.2 Métriques

| Métrique | Ce qu'elle mesure |
|---|---|
| Recall@1 | La bonne technique est-elle le premier résultat ? |
| Recall@3 / Recall@5 | Est-elle dans les trois / cinq premiers ? |
| MRR (Mean Reciprocal Rank) | Qualité du classement global |
| Courbe précision/rappel selon le seuil | **Justifie le choix du seuil** |

### 12.3 Baselines de comparaison obligatoires

| Baseline | Rôle |
|---|---|
| TF-IDF + similarité cosinus | Montre l'apport du sémantique sur le lexical |
| `all-MiniLM-L6-v2` (généraliste) | **Montre l'apport de la spécialisation cybersécurité** |
| `ehsanaghaei/SecureBERT` | Autre encodeur spécialisé sécurité |

Le second est le plus important : si ATT&CK-BERT ne surpasse pas un modèle généraliste
sur vos données, il faut le dire. Un résultat négatif rigoureusement établi vaut mieux
qu'un résultat positif non vérifié.

### 12.4 Modèle de repli

`sarahwei/MITRE-v16-tactic-bert-case-based` : classifieur multi-label affiné pour
identifier la tactique ATT&CK d'une phrase. Prêt à l'emploi, sans seuil de similarité
à calibrer, mais granularité plus grossière (tactique et non technique).
À retenir si la calibration du seuil d'ATT&CK-BERT s'avère instable sur vos données.

---

## 13. Plan de mise en œuvre

| Jour | Tâche | Livrable |
|---|---|---|
| 1 | Téléchargement, épinglage, vérification `safetensors`, empreintes | `MODEL.sha256` |
| 1 | Export ONNX int8 + validation de la quantisation (> 0,99) | Modèle validé |
| 2 | Précalcul des vecteurs ATT&CK, chargement BigQuery, index | `attack_embeddings` |
| 2 | Service `ml-embed` : FastAPI + Dockerfile durci | Image Artifact Registry |
| 3 | Déploiement Cloud Run, IAM, VPC Connector, blocage egress | Service opérationnel |
| 3 | `enrich-job` + Cloud Scheduler + requête d'enrichissement | `alert_enrichment` alimentée |
| 4 | Vue kill-chain, jointure CVE, endpoints FastAPI | API complète |
| 5–6 | Quatre composants du dashboard Next.js | Dashboard opérationnel |
| 7 | Évaluation TRAM + baselines + calibration du seuil | Tableau de résultats |
| 8 | Mesure avant/après des cinq métriques opérationnelles | Tableau comparatif |

**Durée : 8 jours ouvrés. Aucun GPU. Une seule dépendance de modèle.**

---

## 14. Synthèse — arguments pour la soutenance

1. **Un seul modèle, un seul service ajouté.** Pas d'empilement technologique.
2. **CPU uniquement.** Le coût reste compatible avec un projet de démonstration.
3. **Le choix du non-génératif est un contrôle de sécurité argumenté**, pas une contrainte budgétaire.
4. **L'inférence vectorielle est déportée dans BigQuery**, ce qui supprime un composant d'infrastructure entier.
5. **Les poids sont traités comme un artefact non fiable** : `safetensors` imposé, révision épinglée, empreintes consignées, image scannée.
6. **Séparation des privilèges stricte** : le moteur d'enrichissement ne peut pas altérer les preuves.
7. **Le modèle relie deux blocs jusque-là disjoints** de l'architecture : le pipeline DevSecOps et la couche de données SIEM.
8. **Les limites sont documentées et quantifiées**, y compris le coût de performance ajouté.
9. **Les résultats sont mesurés contre des baselines publiées**, pas affirmés.
10. **La couverture de détection est affichée avec ses trous**, pas seulement ses succès.

---

## 15. Références

| Ressource | Localisation |
|---|---|
| Modèle ATT&CK-BERT | `huggingface.co/basel/ATTACK-BERT` |
| Outil SMET | `github.com/basel-a/SMET` |
| Publication SMET | *SMET: Semantic Mapping of CVE to ATT&CK and Its Application to Cybersecurity*, Springer |
| Modèle de repli — tactiques | `huggingface.co/sarahwei/MITRE-v16-tactic-bert-case-based` |
| Encodeur alternatif | `huggingface.co/ehsanaghaei/SecureBERT` |
| Baseline généraliste | `huggingface.co/sentence-transformers/all-MiniLM-L6-v2` |
| Règles de détection | `github.com/SigmaHQ/sigma` · `github.com/SigmaHQ/pySigma` |
| Référentiel ATT&CK (STIX) | MITRE ATT&CK Enterprise |
| Jeu de données TRAM | Center for Threat-Informed Defense |

---

*Les valeurs de latence, de taille et de coût sont des ordres de grandeur à confirmer
par mesure sur l'environnement cible avant citation en soutenance.*
