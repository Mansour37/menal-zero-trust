# Déploiement Elson — Démarrer (serveur neuf)

> Guide exécutable pour un **déploiement neuf** (aucune base existante).
> Le cas « prod déjà en ligne » suit `DEPLOY_CHECKLIST.md` (§0.3 incl., non automatisé).
> Temps total estimé : ~30 min. Chaque ✅ = assert qui **arrête** en cas d'échec.

---

## 0. Prérequis / adresses à avoir sous la main

| Variable | Valeur | Où la trouver |
|---|---|---|
| `IP` | IP publique du serveur Hetzner | console Hetzner, après création |
| `SERVER` | `deploy@IP` | créé automatiquement par `setup-server.sh` |
| `DOMAIN` | sous-domaine API (ex. `api.hassaniya.tn`) | ton DNS |
| clé SSH | c'est celle sur la machine dev | `ssh-keygen` si absente |

> ⚠️ Si tu ne connais pas encore l'IP : le point [1. Création du serveur](#1-créer-le-serveur-chez-hetzner)
> est le seul endroit où l'IP apparaît. Le reste peut se préprer d'avance.

---

## 1. Créer le serveur chez Hetzner

1. Console Hetzner → **Create Project** → **Server** :
   - Image : **Ubuntu 24.04 LTS**
   - Datacenter : quelques un dans l'UE (Francfort ou Nuremberg pour la latence)
   - **Firewall** : ouvrir **22, 80, 443** (+ 2222 si tu le pivoteras après setup)
   - Récup **l'IP publique** dans l'écran du serveur.
2. Ajouter ta clé SSH publique (`~/.ssh/id_rsa.pub` ou `id_ed25519.pub`).

```bash
# 1b. Vérifier que tu peux rentrer en root :
ssh root@IP
```

---

## 2. Provisionner le serveur (UNA FOIS)

Automatise l'OS : user `deploy`, SSH port 2222, ufw restreint, docker, compose.

```bash
# LOCAL — copie le script puis l'exécute au serveur
ssh root@IP "bash -s" < elson-main/deploy/setup-server.sh
# ATTENDU : sortie [1/9]…[9/9], la dernière ligne rappelle l'accès :
#   ssh -p 2222 deploy@IP
```

Si `setup-server.sh` plante à l'étape docker :
```bash
ssh -p 2222 deploy@IP "curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker deploy"
```

Vérifier (acquisition attendue une fois) :

```bash
ssh -p 2222 deploy@IP "docker --version && docker compose version"
```

---

## 3. Préparer le dossier + `.env` (UNA FO fois)

```bash
# LOCAL
ssh -p 2222 deploy@IP "sudo mkdir -p /opt/hassaniya/deploy && sudo chown -R deploy:deploy /opt/hassaniya"
scp -P 2222 elson-main/deploy/preflight.sh  deploy@IP:/opt/hassaniya/deploy/preflight.sh
# les 4 secrets, EN DIVERS (jamais les mêmes qu'ailleurs) :
openssl rand -hex 64    # → JWT_SECRET
openssl rand -hex 64    # → API_KEY_SECRET
openssl rand -hex 64    # → AUDIO_URL_SECRET
openssl rand -hex 64    # → OTP_PEPPER

# REMOTE — poser le .env (avec les 4 valeurs + DOMAIN + MIGRATE_MODE=auto)
ssh -p 2222 deploy@IP "cat > /opt/hassaniya/.env" <<ENV
# ... 4 secrets ... (cf. §0.2)
POSTGRES_USER=hassaniya
POSTGRES_PASSWORD=CHANGE-STRONG
MIGRATE_MODE=auto
ENV
```

> Le `.env` restera **hors git** : `deploy.sh` l'exclut du rsync (`--exclude '.env'`).

---

## 4. Pré-vol automatisé

```bash
# REMOTE
ssh -p 2222 deploy@IP "bash /opt/hassaniya/deploy/preflight.sh"
```

LECTURE du résultat sur une base **neuve** (cas B) :
- ✅ compatibles : `docker compose config`, `.env`, 4 secrets, `MIGRATE_MODE=auto`, `pg_isready`.
- ⚠️ **§5 ATTENDU rouge** (`schema_migrations ≥ 72`) **tant que le backend n'a pas booté une fois** —
  c'est normal, l'outil n'a pas encore été adopté. Voir §5 ici.
- ⚠️ §7 et §8 rouges tant que rien n'a été déployé.

> Ne pas s'affoler : ces trois rouges vont appasser dès le premier `deploy.sh` OK.

---

## 5. Déploiement lui-même (ADOPTION + CODE)

En base neuve, `MIGRATE_MODE=auto` suffit : l'entrypoint du backend applique
`init.sql` (monté sur postgres) **plus** les 85 migrations au premier boot.

```bash
# LOCAL — copy + build + down/up (mini temps mort, PG data persiste)
./deploy/deploy.sh deploy@IP -p 2222
# Modifier config si l'IP est nouvelle : écrire deploy@IP directement.
```

SUIVI du premier boot :
```bash
# REMOTE — dans un composé on clique les logs backend quelques secondes
ssh -p 2222 deploy@IP "cd /opt/hassaniya && docker compose logs -f backend"
# ATTENDU : [migrations] … 85 appliquées … "server started"
```

---

## 6. POST-GO — asserts d'exploitation

```bash
# 6.1 API saine
curl -fsS https://api.VOTREDOMAINE/api/health

# 6.2 Migrations idempotentes : y trer algo 0 en attente
ssh -p 2222 deploy@IP "cd /opt/hassaniya && docker compose exec -T backend sh -c 'MIGRATE_MODE=auto npx tsx src/scripts/migrate.ts'"
# → « 0 en attente »

# 6.3 Objets de référence v76
ssh -p 2222 deploy@IP "cd /opt/hassaniya && docker compose exec -T postgres psql -U hassaniya -d hassaniya -c \"SELECT to_regclass('votes'), to_regclass('votable_phrases'), to_regclass('season0_contributors');\""
# → trois lignes NON NULL

# 6.4 Admin (P0-1) — bootstrap, puis verrou en §9
ssh -p 2222 deploy@IP "cd /opt/hassaniya && docker compose exec -T backend npx tsx src/scripts/create-admin.ts"
```

Rejouer le preflight **une fois déployés** → tous vérifs vertes sauf... désormais

```bash
ssh -p 2222 deploy@IP "bash /opt/hassaniya/deploy/preflight.sh"
```

---

## 7. Sécurité immédiate post-GO

1. Enlever `ADMIN_BOOTSTRAP=true` du `.env` (si utilisé pour créer l'admin).
2. `ssh -p 2222 root@IP` **doit refuser** (setup `permitRootLogin no`).
3. `ufw status` : uniquement 2222/80/443.
4. `git::ignore` `.env` : `els-on main/.gitignore` → vérifie qu'il est couvert.

---

## 8. En cas de pépin (première ligne de débug)

| Symptome | Cause probable | Fix |
|---|---|---|
| Containers redémarre en boucle | L'entrypoint échoue (SQL en migration) | `docker compose logs backend` → voir la migration qui casse |
| Base à moitié adoptée | boot coupé pendant migration | rejouer `MIGRATE_MODE=auto` — runner idempotent |
| 80 en attente après install | ERROR en migration non marquée | trace dans les logs de `backend` |
| API 502 | Caddy attend le cert, port backend pas prêt | attendre 30 s, `docker compose logs caddy` |
| 5432 fermé hors compose | voulu (le dump passe via `docker compose exec`) | ne pas exposer |

---

## 9. Garde-fous (ce qui bloque si tu court-circuites)

| Tentation | Risque | Garde-fou |
|---|---|---|
| Lancer `deploy.sh` sans preflight | boot sur base non rejetée → replay → duplication | preflight §1 arrête |
| Mettre `MIGRATE_MODE=off` | le runner ne réparera plus les regressions | remettre `auto` AVANT le déploiement |
| `psql` direct sur la base prod | divergence définitive avec `schema_migrations` | toute évolution passe par `backend/sql/migration_vNN_*.sql` |
| Réutiliser les 4 secrets | entraîne l'équité du P0-2 | `openssl rand -hex 64` × 4 |
| Ouvrir 5432 dans le ufw | attaque sur postgres accessible par Internet | jamais ; dump via conteneur |