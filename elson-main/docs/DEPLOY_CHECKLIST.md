# Checklist de déploiement Elson — exécutable

Version cible : **Phase 1 (P0) + Phase 2 (industrialisation) — Hetzner Docker
Compose**. Ce checklist est l'ordre exact des opérations et de leurs tests.
Chaque `✅` est un assert dont l'échec doit **arrêter** le déploiement.

> Prérequis d'accès : SSH `deploy@SERVER -p 2222`, dossier `/opt/hassaniya`.
> Tous les blocs `LOCAL` s'exécutent sur la machine de dev, `REMOTE` sur le
> serveur. Les commandes marquées `[1 seule fois]` ne se rejouent pas.

---

## 0. Préparation locale (machine de dev)

```bash
# 0.1  Rebuild le frontend avec la vraie URL API (figé au build — §13.1)
cd elson-main
      # si FRONTEND_URL/NEXT_PUBLIC_API_URL ont changé :
      #   docker compose build frontend
```

```bash
# 0.2  Générer les 4 secrets (jamais réutiliser ceux d'un autre env)
openssl rand -hex 64    # → JWT_SECRET
openssl rand -hex 64    # → API_KEY_SECRET
openssl rand -hex 64    # → AUDIO_URL_SECRET
openssl rand -hex 64    # → OTP_PEPPER
```

```bash
# 0.3  Depuis la PROD : exporter le schéma réel (⚠️ P1-1 — à faire UNE fois)
# Le port 5432 n'est pas exposé hors du compose → dump via le conteneur postgres :
ssh -p 2222 deploy@SERVER "cd /opt/hassaniya && \
  docker compose exec -T postgres pg_dump -U hassaniya --schema-only --no-owner" \
  > /tmp/prod_schema.sql
# ⚠️ Éviter de faire transiter ce fichier par PowerShell (encodage UTF-8/CRLF) :
# faire tourner la comparaison DANS un shell Linux (ou monter le fichier dans
# un conteneur, comme le fait deploy/compare-schema.sh).

# Option recommandée UNE commande : dump + comparaison automatique
# (fait le pg_dump par SSH, l'écrit en /tmp SANS conversion d'encodage, puis
# lance compare-schema.sh)
./deploy/fetch-schema.sh deploy@SERVER
# Cible :
#   ✅ DIFF NUL → prod ET dépôt structurellement identiques (GO déploiement)
#   ⚠️ DIFF NON NUL → inspecter /tmp/schema-compare/diff_canonical.txt :
#       - objets §4.4.2 (votes, votable_phrases, season0_contributors,
#         profiles.total_votes) présents côté prod = parité OK
#       - colonnes/contraintes en plus côté prod = dérive non versionnée → à
#         concilier (migration v77 ou abandonnée si réversible)
#       - colonnes manquantes côté prod manquantes dans le dépôt = À CORRIGER
#         avant d'aller plus loin
```

```bash
# 0.4  Vérifs locales (doivent être vertes)
cd backend && npm run build && npm run db:schema    # tsc + schema.sql régénéré
```

---

## 1. Pré-vol automatisé — `deploy/preflight.sh`

Le script `deploy/preflight.sh` exécute tous les asserts ci-dessous et échoue
sur le premier manquant.

```bash
# LOCAL : copier une fois le script sur le serveur
scp -P 2222 elson-main/deploy/preflight.sh deploy@SERVER:/opt/hassaniya/deploy/preflight.sh

# REMOTE : lancer le pré-vol (à rejouer à chaque déploiement)
ssh -p 2222 deploy@SERVER "bash /opt/hassaniya/deploy/preflight.sh"
```

Le pré-vol contrôle (ordre critique du script) :

| # (script) | Contrôle | Fait échouer si | Action si échec |
|---|---|---|---|
| 1 | `docker compose config` | secrets requis absents | compléter `.env` |
| 1b | `.env` lisible, fins de ligne `\r` tolérées | `.env` absent | `cp .env.example .env` |
| 2 | les **4 secrets** positionnés et non placeholders | `change-me-*` ou vide | `openssl rand -hex 64` |
| 3 | `MIGRATE_MODE` vaut `auto`/`baseline`/`off` | absent ou inconnu | voir §2 |
| 4 | postgres `pg_isready` via compose | base arrêtée | `docker compose up -d postgres` |
| 5 | `schema_migrations` existe ; nb tracées ≥ 72 | jamais adoptée | voir §2 (baseline une fois) |
| 6 | migrations `v74`/`v75`/`v76` tracées | absent 1 | relancer le runner, redéployer |
| 7 | objets §4.4.2 (`votes`, `votable_phrases`, `season0_contributors`) | manquant | valider le diff §0.3 |
| 8 | admin en base (`role IN ('admin','superadmin')`) | 0 ligne | `npm run create-admin` (conteneur) |
| 9 | `/api/health` répond 200 (`node fetch` interne) | non-200 | `docker compose logs backend` |

Le script échoue **avant tout redémarrage** si un assert est rouge.

---

## 2. Adoption de l'outil de migration — UNE fois par base

> À faire **avant** le premier `deploy.sh` qui embarque le runner. Choisis `A`.

### 2.1 Cas A — base prod existante (72 migrations manuelles appliquées)
```bash
REMOTE: cd /opt/hassaniya && docker compose exec backend sh -c \
  'MIGRATE_MODE=baseline npx tsx src/scripts/migrate.ts --baseline'
# ATTENDU : "Baseline posée : 85 migrations enregistrées comme appliquées."
# Ceci n'exécute RIEN sur la base — il enregistre le fait que les 72+ sont déjà là.
```

### 2.2 Cas B — base neuve (rien à préserver)
```bash
REMOTE : cd /opt/hassaniya && docker compose up -d postgres
# attendre service_healthy, puis :
#    MIGRATE_MODE=auto (défaut) suffit : l'entrypoint du backend applique
#    init.sql (monté sur postgres) + les 85 migrations au premier boot.
```
> ⚠️ Dans ce cas, le contrôle §5 du preflight (`schema_migrations` ≥ 72) est
> ATTENDU rouge **tant que le backend n'a pas démarré une fois** — c'est le
> signal que l'adoption n'a pas encore eu lieu. Déploie d'abord (§3), puis
> relance le preflight : il doit passer ensuite.

### 2.3 Vérification commune
```bash
REMOTE : docker compose exec -T postgres psql -U hassaniya -d hassaniya -c \
  "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 3;"
# → doit lister v74 … v76 (les 3 derniers fichiers du dépôt)
```

---

## 3. Déploiement du code

```bash
# LOCAL
./deploy/deploy.sh deploy@SERVER -p 2222   # (utilise la clé SSH + rsync)
# Le script exécute : backup DB → rsync → docker compose build → down → up -d
```

⚠️ `deploy/deploy.sh:43` fait `docker compose down` avant `up -d` (P1-12 non
réglé) : mini temps mort, sans perte de données (volume `pg_data` persistant).

---

## 4. Post-déploiement — asserts d'exploitation

```bash
REMOTE (ou local via domain) :

# 4.1 API saine
curl -fsS https://api.DOMAIN/api/health
# → 200, body JSON attendu

# 4.2 Migrations au boot : zéro en attente (idempotence)
docker compose exec -T backend  sh -c 'MIGRATE_MODE=auto npx tsx src/scripts/migrate.ts'
# → "0 en attente" — aucune migration ne doit ressortir la seconde fois

# 4.3 Objets de référence présents (§4.4.2)
docker compose exec -T postgres psql -U hassaniya -d hassaniya -c \
  "SELECT to_regclass('votes'), to_regclass('votable_phrases'), to_regclass('season0_contributors');"
# → trois entrées non-NULL

# 4.4 Connexion directe sans PgBouncer (P0-4) — le pool marche
docker compose exec -T backend node -e \
  "fetch('http://localhost:4000/api/health').then(r=>console.log(r.status))"

# 4.5 Admin présent et pas de compte par défaut (P0-1)
docker compose exec -T postgres psql -U hassaniya -d hassaniya -c \
  "SELECT role, count(*) FROM users WHERE role IN ('admin','superadmin') GROUP BY role;"

# 4.6 Sessions/OTP liées aux secrets — relogge un utilisateur normalement
#     (déconnecte-toi/reconnecte-toi sur FRONTEND ; les filtres d'export dataset)
```

---

## 4b. Sécurité immédiate post-GO

1. **Retirer `ADMIN_BOOTSTRAP=true`** du `.env` dès que l'admin est connecté.
2. Vérifier que **`permitRootLogin no`** est bien actif (`ssh -p 2222 root@SERVER` doit refuser).
3. `ufw status` : uniquement 2222, 80, 443.
4. **Ne jamais committer `.env`** — `git check-ignore .env` doit renvoyer la ligne.

---

## 5. Ce qui N'est PAS ce déploiement

| Cible | Statut | Raison |
|---|---|---|
| **GCP Cloud Run / Cloud SQL** | ❌ Non prêt | §13.1 : état sur disque, caches mémoire, IPC cluster, workers `setInterval`, jobs >32 Mo — refonte applicative requise |
| **Redis (plafonds globaux)** | ❌ Backlog | P1-8, prérequis de scalabilité horizontale |
| **Sauvegardes chiffrées + restauration testée** | ❌ Backlog | P1-3 — à faire avant la mise en service grand public |
| **Auth forte (lockout, MFA admin)** | ❌ Backlog | P1-2 — non bloquant le déploiement initial |

---

## 6. Garde-fous (ce qui va bloquer si tu court-circuites)

| Tu es tenté de… | Risque | Le garde-fou |
|---|---|---|
| Déployer sans preflight | Redémarrage sur une base non bâclée → v76 non tracée, replay possible | le pré-vol §1 arrête le déploiement |
| Importer un dump prod périmé | Perte de données post-dump | re-differ le schéma, re-valider 0.3 |
| Réutiliser les 4 secrets = même valeur | Annulation du P0-2 | `openssl rand -hex 64` × 4 distincts |
| Poser `MIGRATE_MODE=off` et déployer | Le runner ne corrigera pas une régression de schéma | remettre `auto` AVANT le déploiement |
| Modifier la base prod directement (via psql) | Divergence définitive avec `schema_migrations` | toute évolution passe par `backend/sql/migration_vNN_*.sql` |

---

_Déploiement **neuf** (aucune base existante) : le §0.3 n'a pas lieu d'être, et
le parcours est intégralement automatisable — voir `DEPLOY_START.md`.
Le §0.3 (diff du schéma de référence) reste l'unique prérequis **non
automatisé**, mais il ne concerne que le cas « prod déjà en ligne »._