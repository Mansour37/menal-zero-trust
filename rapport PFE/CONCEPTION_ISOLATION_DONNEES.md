# Conception de l'isolation des données — socle MENAL

**Statut : proposition.** Rien de ce document n'est appliqué. Il s'articule avec la
conception réseau cible (décision D15, `CONCEPTION_RESEAU_CIBLE.md`) sans la contredire :
là où le réseau s'arrête — sa propre §f.3 le dit — ce document commence.

**Sources de vérité :** le code (`terraform/modules/cloud-sql/`,
`terraform/modules/app-service/`, `terraform/environments/staging/elson.tf`,
`elson-main/backend/src/scripts/sql-isolation*.ts`, `.github/workflows/`). Le dossier
technique et le mémoire sont traités comme des affirmations à vérifier, pas comme des
faits. **Quand ils divergent du code, le code fait foi et la divergence est signalée.**

**Méthode sur les chiffres.** Aucun montant n'est une mesure de facture. Tous les tarifs
sont des **ordres de grandeur de tarification publique, explicitement présentés comme
tels**. Les seules valeurs mesurées citées ici sont celles du dépôt : RTO 32 min 45 s /
RPO 0 (test réel du 03/08/2026) et le contrôle du 19/08/2026 à six vérifications sur six.

---

## a) Diagnostic vérifié

### a.0 Ce que le code dit exactement, et qui n'est pas ce que la documentation dit

L'isolation logique n'est pas portée par « sept ordres ». Elle est portée par **dix
ordres répartis dans deux scripts distincts, qui doivent s'exécuter dans un ordre
imposé**, et dont **six seulement sont des révocations**.

| Script | Ordres | Nature |
|---|---|---|
| `sql-isolation.ts` | `REVOKE CONNECT ON DATABASE menal_db FROM PUBLIC` ; `… FROM elson_user` ; `GRANT CONNECT ON DATABASE menal_db TO api_user` ; `REVOKE CONNECT ON DATABASE elson_db FROM PUBLIC` ; `… FROM api_user` ; `GRANT CONNECT ON DATABASE elson_db TO elson_user` | 4 révocations, 2 restaurations |
| `sql-isolation-harden.ts` | `GRANT ALL ON SCHEMA public` (× 2, une par base) ; `REVOKE cloudsqlsuperuser FROM api_user` ; `… FROM elson_user` | 2 révocations, 2 restaurations |

Trois écarts, tous vérifiés ligne à ligne :

**Écart D-1 — la procédure publiée est incomplète, et l'incomplétude a une conséquence
de sécurité.** La liste de sept ordres du §16 étape 4 du dossier technique, reprise
telle quelle dans l'annexe B du mémoire, **omet `REVOKE cloudsqlsuperuser FROM
api_user`**. Or `cloudsqlsuperuser` est le rôle propriétaire des bases créées par l'API
d'administration : tant que `api_user` en est membre, il conserve `CONNECT` sur la base
du nouveau locataire **par héritage**, et le `REVOKE CONNECT … FROM api_user` de la
ligne 4 ne l'en prive pas — il ne retire qu'un droit direct qui n'était pas le chemin
utilisé. **Appliquée à la lettre à un troisième locataire, la procédure publiée produit
une isolation à sens unique** : le locataire ne lit pas MENAL, MENAL lit le locataire.
Le déploiement réel n'est pas dans cet état, parce que c'est le code qui a été exécuté,
pas la procédure. **C'est le document qui est faux, pas l'installation** — et c'est le
document qu'un troisième accueil suivrait.

**Écart D-2 — l'ordre d'exécution est un piège non documenté.** `sql-isolation.ts`
révoque le `CONNECT` croisé **en utilisant les privilèges qu'il s'apprête à faire
retirer** : la connexion s'ouvre en `elson_user`, et `REVOKE CONNECT ON DATABASE
menal_db FROM elson_user` n'est autorisé que parce que `elson_user` est encore membre de
`cloudsqlsuperuser`. Si l'on exécute `sql-isolation-harden.ts` en premier, la
membership disparaît et `sql-isolation.ts` **ne peut plus s'exécuter** — et il n'a
**aucun `try/catch` par ordre** : il lève, sort en 1, et laisse un état à moitié
appliqué. Conséquence directe et importante pour la suite : **l'identité qui applique
l'isolation perd, en l'appliquant, le pouvoir de la réappliquer.** C'est une porte à sens
unique, et c'est le fait qui commande la §e.

**Écart D-3 — le mémoire attribue à l'instance de base une propriété qu'elle n'a pas.**
`ch5_realisation.tex:1383-1384` écrit, dans la table de frontière de responsabilité :
« instance régionale, adresse privée, **chiffrement par clé gérée**, restauration à un
instant donné ». Le code ne porte **aucun** `encryption_key_name` sur
`google_sql_database_instance.postgres`, et le dossier technique §11.4 documente
pourquoi : le champ est immuable après création, un plan du 07/08 a donné « must be
replaced ». **Vérifié : la contrainte est réelle et l'affirmation du mémoire est une
erreur factuelle à corriger avant impression.** Le chiffrement par clé gérée couvre les
secrets et le stockage média d'ELSON, pas la base.

### a.1 Faiblesse 1 — « les sept ordres sont hors du code » : **confirmée, et pire que décrite**

Confirmée : aucun `postgresql_grant`, aucun `null_resource`, aucun `local-exec` dans
`terraform/`. Les scripts vivent dans le dépôt **du locataire** (`elson-main/backend/`),
pas dans celui du socle. Aucun `apply` ne les rejoue, aucune détection de dérive
Terraform ne les couvre — ils ne sont dans aucun `state`.

Ce que le diagnostic existant ne dit pas :

- **Le geste est dans le dépôt du locataire hébergé.** La frontière de sécurité entre
  deux locataires est appliquée par du code que l'un des deux locataires possède,
  modifie et livre. C'est une inversion de gouvernance : l'hébergeur ne détient pas le
  mécanisme qui matérialise sa propre frontière.
- **Le contrôle quotidien est dans la même position.** `elson-sql-isolation-check` tourne
  sur l'image `elson-backend:latest`, sous `module.elson_app[0].service_account_email`,
  c'est-à-dire **l'image et l'identité du locataire contrôlé**
  (`elson.tf`, ressource `google_cloud_run_v2_job.sql_isolation_check`). Le contrôle
  qui prouve la frontière est exécuté par la partie dont il faut se protéger. Une image
  compromise rend un verdict vert sans effort.
- **Le contrôle ne connaît que deux utilisateurs, écrits en dur.**
  `sql-isolation-check.ts` interroge `FROM (VALUES ('api_user'), ('elson_user'))`. Il
  n'énumère pas `pg_roles`. **Un troisième utilisateur créé par un `terraform apply`
  d'accueil est totalement invisible du contrôle** jusqu'à ce que quelqu'un modifie le
  TypeScript du locataire n°1. La recommandation du dossier — « cloner le contrôle
  quotidien » — ne suffit donc pas : ce n'est pas un contrôle clonable, c'est un
  contrôle à réécrire.
- **L'absence du contrôle est silencieuse.** L'alerte
  `google_monitoring_alert_policy.sql_isolation_drift` se déclenche sur
  `completed_execution_count` avec `result = "failed"`. Un ordonnanceur qui cesse de
  déclencher, un job supprimé, une image qui ne démarre plus : **zéro exécution, donc
  zéro échec, donc zéro alerte.** Il manque l'alerte symétrique — l'absence d'exécution
  **réussie** sur 48 h. C'est la défaillance silencieuse d'observabilité que le dossier
  dénonce ailleurs (`cloud_run_services`), reproduite ici sur le contrôle d'isolation
  lui-même.

### a.2 Faiblesse 2 — « une restauration les annule silencieusement » : **à corriger. Le mécanisme réel est différent, plus étroit sur un point et bien plus large sur un autre**

Le mémoire (`ch5_realisation.tex:1301-1303`), le dossier (§11.1, §16) et la grille de
notation (`ch6_validation.tex:897-899`) affirment tous qu'une restauration à un instant
donné annule les révocations. **Le mécanisme, tel qu'il découle du code et du test réel
du 03/08, n'est pas celui-là.**

Fait établi par le test du 03/08 : la restauration à un instant donné de Cloud SQL pour
PostgreSQL est une **opération de clonage vers une instance neuve** (mémoire de projet :
« opération `CLONE` PITR », RTO 32 min 45 s). Un clone emporte les catalogues du moteur
— `pg_database` et ses listes de contrôle d'accès, `pg_auth_members` et ses
appartenances de rôle — **au même titre que les données**.

Il en découle trois choses, et elles ne vont pas dans le même sens :

1. **Une restauration à un point postérieur au durcissement conserve les révocations.**
   Le durcissement date du 07-08/08/2026 ; la rétention est de 7 jours de sauvegardes et
   7 jours de journaux de transactions. **Toutes les cibles de restauration atteignables
   aujourd'hui sont postérieures au durcissement.** L'affirmation « une restauration
   annule la protection » est donc, sur l'installation actuelle, **fausse pour le chemin
   qu'elle décrit**. À corriger dans le mémoire : elle affaiblit un argumentaire qui n'a
   pas besoin de ça.
2. **La fenêtre de vulnérabilité réelle est un intervalle, pas un état permanent.** Elle
   vaut « durcissement appliqué il y a moins de sept jours ». Elle est **rouverte à
   chaque accueil de locataire** : pendant la semaine qui suit le durcissement d'un
   nouveau locataire, toute restauration à un point antérieur le défait. C'est étroit,
   c'est daté, c'est vérifiable — et c'est infiniment plus défendable que l'énoncé
   général.
3. **Le vrai chemin de perte est la réconciliation, pas la restauration.** Le clone porte
   un **nom neuf** (les noms d'instance sont immuables et un nom supprimé reste réservé).
   Or `google_sql_database` et `google_sql_user` sont ancrés sur
   `sql_instance_name = "menal-db-staging"` (`app-service/main.tf`, `cloud-sql/main.tf`).
   Remettre Terraform en accord avec l'instance restaurée impose de changer ce nom — et
   **un `apply` sur un nom d'instance neuf ne migre pas les utilisateurs : il les
   crée**. Un `google_sql_user` créé par l'API d'administration est membre de
   `cloudsqlsuperuser`. **C'est là, et seulement là, que la frontière tombe : pas dans la
   restauration, dans le retour de l'infrastructure décrite sur l'infrastructure
   restaurée.** Ce chemin n'a **aucune** borne temporelle : il vaut aussi bien un an
   après le durcissement.

Et surtout — le point que ni le dossier ni le mémoire ne tirent :

> **L'instance partagée rend l'unité de reprise partagée.** Un clone restaure
> `menal_db` **et** `elson_db` au même horodatage. Restaurer ELSON trois heures en
> arrière pour réparer un incident applicatif **fait reculer de trois heures la table
> `audit_logs` de MENAL**, c'est-à-dire la piste d'audit du socle de sécurité lui-même.
> Aucune révocation ne corrige cela, parce que ce n'est pas un problème de droits :
> c'est un problème de **rayon d'action**. Le dossier le mentionne en une ligne (§18.6,
> « le clone restaure les DEUX bases ») sans en tirer la conséquence. **La conséquence
> est qu'un socle qui vend une reprise mesurée ne peut pas la vendre par locataire tant
> que l'instance est partagée.**

### a.3 Faiblesse 3 — « la ségrégation réseau n'y change rien » : **confirmée, et la conception réseau le dit elle-même**

`CONCEPTION_RESEAU_CIBLE.md` §f.3 est explicite : `SQL_IP` est la **même constante** dans
les règles E1 et E2 ; le pare-feu autorise `sa-api` et `sa-elson` à joindre la même
adresse ; « le contrôle y est, et reste, au niveau du moteur de base ». Sa §g-1 range le
partage de l'instance dans « ce que la cible ne couvre pas ». Rien à corriger : c'est
juste, et c'est le point de raccord des deux conceptions (§g ci-dessous).

### a.4 Faiblesses supplémentaires trouvées

**D-4 — la portée de la frontière n'a jamais été mesurée au-delà de `CONNECT`.** Le
contrôle vérifie deux choses : l'appartenance à `cloudsqlsuperuser`, et le privilège
`CONNECT`. Il ne vérifie **aucun attribut de rôle**. Or l'instance est en
**`POSTGRES_15`** (vérifié : `cloud-sql/main.tf:27`), et sur PostgreSQL 15 un rôle
portant l'attribut `CREATEROLE` **peut accorder l'appartenance à n'importe quel rôle**,
y compris à lui-même — le durcissement de cette règle n'arrive qu'en PostgreSQL 16. Si
`api_user` ou `elson_user` porte `rolcreaterole = true`, alors `GRANT api_user TO
elson_user; SET ROLE api_user;` **contourne toute la frontière en deux ordres**, et le
contrôle quotidien continue de rendre six sur six. Les attributs de rôle ne s'héritent
pas par appartenance, donc le `REVOKE cloudsqlsuperuser` ne les retire pas.
**Non vérifié — commande en §k, V-04. C'est la vérification la plus urgente de tout ce
document : d'elle dépend la validité de l'affirmation « l'isolation tient ».**

**D-5 — la fenêtre d'accueil n'est couverte par rien.** Entre le `terraform apply` qui
crée `<app>_user` et l'exécution manuelle du durcissement, le nouvel utilisateur est
membre de `cloudsqlsuperuser` et lit toutes les bases. Durée : la latence d'un humain.
Détection : **aucune** (cf. a.1, contrôle à deux utilisateurs en dur). C'est le seul
trou de la conception actuelle qui soit **créé par la procédure elle-même**.

**D-6 — le contrôle confond « dérive » et « impossible à vérifier ».** Le `catch` global
de `sql-isolation-check.ts` émet `isolated: false` et sort en 1 sur n'importe quelle
erreur, y compris un délai de connexion (`connectionTimeoutMillis: 15000`) sur une
`db-f1-micro`. `max_retries = 0`. Une indisponibilité transitoire déclenche donc une
alerte d'atteinte à la frontière d'isolation. Des faux positifs sur une alerte de
sécurité usent la seule chose qu'un mono-opérateur n'a pas en réserve : l'attention.

**D-7 — `deletion_protection = false`** sur l'instance qui porte les deux bases
(`cloud-sql/main.tf:31`), sans `lifecycle { prevent_destroy }`. Confirmé. Remédiation à
coût nul, et **préalable obligatoire** à toute manipulation de ce module (§j étape 0).

**D-8 — le module `cloud-sql` n'est pas instanciable deux fois.** Confirmé :
`google_compute_global_address.private_ip_range` et
`google_service_networking_connection.private_vpc` (`main.tf:3-17`) sont des ressources
**de portée réseau, une par VPC**, câblées à l'intérieur d'un module de portée
**instance**. Une seconde instanciation tenterait de créer une seconde plage d'appairage
sur le même réseau. C'est l'écart M16, et c'est le verrou technique de l'option
« instance dédiée ».

**D-9 — l'exécution de `terraform apply` est manuelle.** Vérifié :
`.github/workflows/terraform.yml` ne contient **que** `fmt`, `validate` et un scan Trivy
de configuration ; son en-tête le dit lui-même (« les étapes plan/apply automatisées
viendront ensuite »). Il n'existe pas de `plan`/`apply` en intégration continue. Fait
déterminant pour la §f.

---

## b) Ce que l'isolation actuelle garantit réellement — et contre qui elle cède

C'est la section qui vaut le plus, et elle commence par une observation d'inventaire que
le débat sur les révocations a occultée.

### b.1 Ce que le franchissement de la frontière rapporte, dans chaque sens

La frontière n'a pas la même valeur dans les deux directions.

| Direction | Ce que l'attaquant obtient | Ce qu'il n'obtient pas |
|---|---|---|
| **ELSON → `menal_db`** | `users` (empreintes bcrypt, secret TOTP **chiffré** par une clé qu'il n'a pas), `roles`, `audit_logs` (traces d'accès), `api_keys` (**table morte**) | **L'entrepôt de supervision** : il est dans BigQuery, dont `sa-elson` n'a **aucun rôle** (ADR-0002, vérifié `modules/iam`). Le secret de signature des jetons : Secret Manager, liaison par secret |
| **MENAL → `elson_db`** | **Le numéro d'identité nationale, en clair.** Nom, prénom, date de naissance, WhatsApp, empreintes d'appareil, scores de fraude, `audit_log` JSONB truffé de données personnelles | **Les enregistrements vocaux eux-mêmes.** Ils sont dans le compartiment de stockage : `sa-api` n'a **aucun rôle de stockage** (vérifié : `modules/iam` ne lui donne que `cloudsql.client` et `logging.logWriter`), et les liens temporaires sont signés avec `elson-audio-url-secret`, dont `sa-api` n'est pas accesseur |

Deux conclusions, et elles orientent tout le reste :

1. **La donnée irréparable est asymétrique.** On ne change ni de voix ni de numéro
   national. La voix est protégée par **deux frontières d'identité indépendantes** de la
   base (IAM du compartiment, et le secret de signature). **Le numéro national, lui,
   n'est protégé que par la révocation** — il est en clair dans `elson_db`. La révocation
   qui compte est donc `api_user → elson_db`, et l'actif qu'elle protège est un
   identifiant officiel non chiffré.
2. **La direction qui compte est celle qui part de l'hébergeur.** Autrement dit : dans la
   configuration actuelle, **la compromission de la plateforme de sécurité est
   l'événement qui coûte le plus cher au locataire hébergé.** Une frontière de donnée
   qui protège le locataire de son hôte n'est pas un raffinement — c'est exactement ce
   qu'une frontière de responsabilité d'hébergement (§18.6) est censée fournir. C'est
   l'argument qui commande la recommandation.

### b.2 Matrice d'adversaires

| Adversaire | La frontière tient-elle ? | Ce qui la tient réellement |
|---|---|---|
| **Charge ELSON compromise** (exécution de code dans le backend Express) — l'attaquant détient le mot de passe `elson_user` et le chemin réseau | **Oui**, démontré par sonde comportementale le 19/08 (six vérifications sur six) — **sous réserve de D-4** | Le `REVOKE CONNECT` et le retrait de `cloudsqlsuperuser`. Rien d'autre |
| **Charge MENAL compromise** (exécution de code dans FastAPI) | **Oui**, symétriquement — **sous réserve de D-4** | Idem. C'est la direction coûteuse (§b.1) |
| **Fuite du mot de passe applicatif** (journaux, image — écart E9 : identifiants en clair dans l'image de production d'ELSON) | **Oui**, mêmes réserves. Le mot de passe ne donne accès qu'à sa propre base | La révocation, encore |
| **Opérateur détenant `roles/owner` ou `roles/cloudsql.admin`** | **Non. Et aucune conception de droits Postgres ne peut y répondre.** `gcloud sql export` lit n'importe quelle base de l'instance sans traverser le moteur d'autorisation ; la réinitialisation du mot de passe de n'importe quel utilisateur est un appel d'API | Rien. **Un `GRANT` n'est pas une défense contre le plan de contrôle qui l'héberge** |
| **`sa-cicd` compromis** (chaîne dépôt GitHub → fédération d'identité) | **Partiellement.** Il peut déployer une image arbitraire sous `sa-elson` et lire les secrets d'ELSON ; il ne peut pas lire ceux de MENAL | **Secret Manager, liaison par secret et par usage.** À souligner : **la frontière la plus solide du socle n'est pas dans Postgres, elle est dans l'IAM de Secret Manager** |
| **Restauration en place** (`backups restore` sur l'instance existante), point postérieur au durcissement | **Oui** — les catalogues sont restaurés avec les données (a.2) | Le hasard du calendrier de rétention |
| **Restauration à un point antérieur au durcissement** (fenêtre de 7 j après chaque accueil) | **Non**, silencieusement, jusqu'à 4 h UTC le lendemain | Rien |
| **Restauration par clonage + réconciliation Terraform** | **Non**, et sans borne temporelle : l'`apply` recrée les utilisateurs privilégiés (a.2, point 3) | Rien |
| **Restauration d'un locataire** (indépendamment des droits) | **Sans objet — et c'est le problème.** L'unité de reprise est l'instance : restaurer l'un fait reculer l'autre | Rien. Défaut structurel, pas défaut de droits |
| **Erreur de configuration** : `apply` qui recrée un `google_sql_user` (renommage, perte d'état, refonte de module) | **Non**, avec détection différée de ≤ 24 h | Le contrôle quotidien — **s'il tourne, et s'il connaît l'utilisateur** |
| **Accueil d'un nouveau locataire** (D-5) | **Non, et sans aucune détection** : le contrôle ne connaît que deux noms en dur | Rien |
| **Le contrôle lui-même** (image et identité du locataire contrôlé ; alerte sur échec seulement) | **Il peut mentir, et il peut se taire** | Rien |

### b.3 La formulation défendable en soutenance

> « L'isolation actuelle est une frontière **de moteur de base**, appliquée à
> l'exécution. Elle arrête l'adversaire pour lequel elle a été conçue — une charge
> applicative compromise — et elle a été démontrée par une tentative de connexion
> réelle, pas par une lecture de configuration. Elle ne prétend rien contre le plan de
> contrôle du fournisseur, et elle ne peut rien contre lui. Elle cède dans trois
> circonstances d'exploitation nommées : l'accueil d'un locataire, la réconciliation
> d'une infrastructure décrite avec une infrastructure restaurée, et sa propre
> disparition silencieuse. Ce sont trois circonstances d'exploitation, pas trois
> attaques — et c'est précisément pour cela qu'une frontière portée par un geste ne
> suffit pas. »

---

## c) Les options, classées, chiffrées

Base de comparaison, en ordres de grandeur de tarification publique `europe-west1` :
une `db-f1-micro` **zonale** avec ~10 Go de disque SSD ≈ **10 à 12 €/mois** ; la même en
**régionale** ≈ **19 à 24 €/mois** (la haute disponibilité double la machine *et* le
disque). L'instance existante est en régional : elle se situe donc dans la fourchette
haute. **À remplacer par un relevé de facture réel (§k, V-15).**

### O0 — Statu quo (référence)

Ce qui existe : base et utilisateur dédiés, dix ordres appliqués à la main, contrôle
quotidien en lecture seule. **0 €.** Arrête la charge compromise ; cède sur les sept
lignes marquées « Non » de la matrice §b.2. **Écartée** : elle est déjà notée 4/10 par le
mémoire lui-même, et la §a en a trouvé trois défauts de plus. Elle reste la référence de
coût.

### O1 — Isolation logique durcie, remise sous contrôle du code

Les dix ordres deviennent une **tâche idempotente déclarée en Terraform et rejouée** ;
le contrôle énumère les rôles au lieu d'en connaître deux ; une alerte de fraîcheur
couvre son absence ; la tâche est portée par une image et une identité du socle, pas du
locataire.

- **Garantit** : que les ordres existent, qu'ils sont versionnés, revus, rejoués à
  chaque livraison et à la fin de chaque restauration ; que l'accueil d'un locataire ne
  laisse plus de fenêtre humaine (D-5 fermé) ; que la disparition du contrôle est
  bruyante (D-6 partiellement, alerte de fraîcheur).
- **Coûte** : ≈ **0 €/mois** (une tâche Cloud Run déclenchée quelques fois par mois, plus
  une exécution quotidienne déjà en place). Effort ≈ **1 jour**.
- **Dégrade** : rien.
- **Arrête** : l'oubli, la dérive après `apply`, la dérive après restauration, la
  fenêtre d'accueil. **N'arrête pas** : l'opérateur, le clonage partagé, l'unité de
  reprise partagée, ni — c'est le point dur — **le fait que la frontière reste à un
  `GRANT` de distance** pour quiconque détient des privilèges de grappe à un instant
  donné.
- **Verdict** : nécessaire, jamais suffisante. **Retenue comme composant, pas comme
  réponse.**

### O2 — Un schéma par locataire, ou sécurité au niveau ligne, dans une base unique

- **Garantit** moins que ce qui existe : la frontière remonte d'un cran (de la base vers
  le schéma), et la sécurité au niveau ligne de PostgreSQL est contournable par le
  propriétaire des tables et inopérante contre un rôle portant `BYPASSRLS`.
- **Coûte** 0 €, mais impose une refonte des deux schémas applicatifs.
- **Écartée explicitement** : elle **dégrade** l'isolation actuelle tout en coûtant du
  travail applicatif chez le locataire. Aucune circonstance ne la justifie ici.

### O3 — Une instance de base dédiée par locataire (silo au plan de la donnée)

- **Garantit** : il n'existe plus de frontière inter-locataires **à l'intérieur** d'un
  moteur, donc plus rien à révoquer, plus rien à faire dériver. Deux grappes PostgreSQL
  distinctes, deux adresses privées distinctes, **deux unités de reprise distinctes**.
  Une restauration d'ELSON ne fait plus reculer la piste d'audit de MENAL. Les dix
  ordres se réduisent à un durcissement résiduel d'hygiène (`REVOKE CONNECT … FROM
  PUBLIC`) sans enjeu inter-locataire.
- **Débloque une propriété inaccessible autrement** : la nouvelle instance peut naître
  **avec le chiffrement par clé gérée**. Le champ est immuable après création — c'est
  précisément pourquoi il est hors d'atteinte sur l'existante, et c'est pourquoi il est
  atteignable sur une neuve, **à coût nul** (la clé régionale existe déjà et est déjà
  payée). Aucune autre option ne l'offre. *(À vérifier, §k V-08.)*
- **Coûte** : **+10 à +12 €/mois** en zonal, **+19 à +24 €/mois** en régional. Effort ≈
  **3 à 4 jours** dont une fenêtre de bascule.
- **Exige d'abord** de lever D-8 : sortir l'appairage du module `cloud-sql`. Chirurgie
  d'état Terraform, sans changement d'infrastructure si elle est faite juste — et
  **coupure des deux locataires si elle est faite faux** (§j étape 1).
- **Dégrade** : en variante zonale, **le locataire hébergé perd la bascule régionale
  automatique**, acquise le 08/08/2026. Il **conserve** la restauration à un instant
  donné. Voir §d, où ce point est tranché plutôt qu'esquivé.
- **Arrête** : tout ce qu'arrête O1, plus la fenêtre d'accueil par construction, plus la
  réconciliation après clonage, plus l'unité de reprise partagée, plus D-4 (l'escalade
  par `CREATEROLE` n'a plus de voisin à atteindre). **N'arrête pas** : l'opérateur
  `roles/owner`, qui exporte deux instances au lieu d'une.
- **Verdict** : c'est la seule option qui transforme la frontière **de discipline en
  structure**.

### O4 — Un projet Google Cloud par locataire (silo complet)

- **Garantit** la seule frontière que le fournisseur applique nativement : l'IAM de
  projet. Répond au dernier adversaire, l'opérateur.
- **Coûte** : la facture × N, et **exige une organisation Google Cloud**, établie comme
  hors d'atteinte. Casse en outre la proposition de valeur — un centre d'opérations
  unique qui voit toutes les applications (§17.5 du dossier).
- **Non écartée : posée comme cible conditionnée.** Elle est la bonne réponse au dernier
  adversaire et elle est hors budget et hors périmètre administratif. **Condition de
  déclenchement : le premier engagement contractuel d'hébergement de données d'un tiers.**
  On ne la présente pas comme un compromis à éviter, on la présente comme le palier
  suivant, avec son prérequis nommé.

### O5 — Isolation proportionnée à la sensibilité **(= O3 pour le locataire sensible, O1 pour le reste)**

Le principe : **le niveau d'isolation est indexé sur le caractère réparable de la
fuite**, pas sur l'égalité de traitement entre locataires. ELSON porte un identifiant
national et de la biométrie vocale : la fuite y est irréparable, par définition. La base
de MENAL porte des comptes d'analystes, des empreintes bcrypt et une piste d'audit :
sérieux, mais révocable — on change un mot de passe, pas un numéro national.

- **Garantit** : tout O3 pour ELSON. Et — conséquence qu'il faut nommer — **l'instance
  partagée cesse d'être partagée** : elle ne porte plus que `menal_db`. Il n'y a plus
  aucune frontière inter-locataires à défendre dans cette grappe.
- **Coûte** : le prix d'**une** instance supplémentaire, pas de N. **+10 à +12 €/mois**
  (zonal) ou **+19 à +24 €/mois** (régional), à comparer aux **11 à 13 €/mois** que
  libère la conception réseau (§i).
- **Dégrade** : cf. O3, variante zonale.
- **Arrête** : identique à O3 pour le locataire sensible ; identique à O1 pour un futur
  locataire non sensible.
- **Verdict** : c'est la recommandation.

### Complément, hors options — le chiffrement applicatif du numéro national

Aucune des options ci-dessus ne chiffre le numéro d'identité nationale. Une instance
dédiée le protège **du voisin**, pas de quiconque obtient une lecture de la base
d'ELSON. Le chiffrement applicatif du champ et le chiffrement des enregistrements sont
**la responsabilité de l'éditeur** — la table §18.6 du dossier le dit, et la conception
présente ne la déplace pas. **À dire tel quel en soutenance :** l'hébergeur peut rendre
une fuite improbable ; il ne peut pas la rendre inoffensive à la place de l'éditeur.

---

## d) Recommandation

> ### Retenir **O5 — isolation proportionnée** : une instance Cloud SQL dédiée pour le locataire qui porte la donnée irréparable, et le durcissement logique remis sous contrôle du code (O1) partout ailleurs, y compris sur l'instance résiduelle.
>
> ### Variante retenue pour l'instance dédiée : **zonale**, avec sauvegardes et restauration à un instant donné identiques à l'existante. Le passage en régional est **une variable, pas une refonte** : il se décide sur facture, pas sur architecture.

**L'argument, en quatre temps.**

**1. La frontière doit changer de nature, pas de qualité.** O1 rend le geste versionné,
rejoué, contrôlé — et il reste un geste. Après O1, la question « que se passe-t-il si
quelqu'un accorde `cloudsqlsuperuser` » a toujours une réponse embarrassante : « on le
voit sous 24 h ». Après O3/O5, elle n'a plus de sens : il n'y a plus de base voisine à
atteindre. **Un mémoire d'ingénieur doit préférer une frontière qui n'existe plus à une
frontière bien surveillée.**

**2. La sensibilité des données ne commande pas l'égalité de traitement, elle commande
la proportion.** Le mémoire fonde tout son niveau d'exigence sur la biométrie et
l'identifiant national. **Alors il faut en tirer la conséquence sur la conception, pas
seulement sur le discours.** Traiter les deux locataires identiquement, c'est soit
sur-payer pour MENAL, soit sous-protéger ELSON. La proportion se formule en critère
d'admission opposable, et non en appréciation :

> **Test d'admission d'un locataire — trois questions.**
> (i) La donnée traitée est-elle **irréversible** en cas de fuite (identifiant officiel,
> biométrie, santé, moyen de paiement) ?
> (ii) L'éditeur est-il un **tiers** de l'exploitant du socle ?
> (iii) Un engagement **contractuel** d'hébergement est-il pris ?
> **Une seule réponse « oui » ⇒ instance dédiée.** Aucune ⇒ base dédiée sur l'instance
> mutualisée, derrière la tâche de durcissement idempotente.
> ELSON répond oui à (i). Un troisième locataire répondrait très probablement oui à (ii)
> et (iii) — donc le critère est aussi la réponse à la question « et au troisième ? ».

**3. La bascule zonale échange une propriété non éprouvée contre une propriété
structurelle, à coût net nul — et il faut le dire dans ces termes.** La haute
disponibilité régionale d'ELSON a été acquise le 08/08/2026 ; **aucun test de bascule
n'existe dans le dépôt** — la seule reprise réellement exécutée est une restauration par
clonage (03/08, 32 min 45 s). Elle est portée par une `db-f1-micro`, un gabarit que le
fournisseur déconseille en production et que le dossier qualifie lui-même de combinaison
incohérente, « payée au tarif haute disponibilité double ». Elle protège d'une panne de
zone, événement dont le projet n'a aucune occurrence. En face : la lecture croisée d'un
numéro d'identité nationale, irréparable, dont trois circonstances d'exploitation
nommées ouvrent le chemin. **On échange une disponibilité théorique et jamais éprouvée
contre une confidentialité structurelle et démontrable, pour zéro euro net.** C'est un
arbitrage, il se défend, et il ne se cache pas.

**Ce que cela dégrade, énoncé sans détour** — le brief l'exige et le mémoire le doit :
l'instance dédiée d'ELSON, en zonal, **n'a pas de bascule régionale automatique**. La
propriété perdue est nommée : « bascule régionale, pour le locataire hébergé ». La
propriété conservée est nommée : « restauration à un instant donné, **la seule des deux
qui ait été mesurée** ». `availability_type` est une variable Terraform : la remonter
coûte un `apply` et 9 à 12 €/mois de plus, le jour où un engagement contractuel l'exige.
**Et la mesure de 32 min 45 s ne se transporte pas sur une instance où elle n'a pas été
faite : elle est à refaire sur la nouvelle instance (§k, V-13).**

**4. Le budget ne bloque pas — parce que la conception réseau paie.** §i.

---

## e) Le piège de la restauration, traité en propre

### e.1 Poser le problème correctement

Le piège n'est pas « la restauration annule les révocations » (a.2 : faux tel quel). Le
piège est en trois pièces :

- **P1** — une restauration à un point **antérieur** au durcissement le défait. Fenêtre :
  sept jours après chaque accueil.
- **P2** — la **réconciliation** de Terraform avec une instance clonée recrée les
  utilisateurs, donc les rend privilégiés. Sans borne temporelle. **C'est la pièce
  principale.**
- **P3** — l'unité de reprise est **partagée** : restaurer un locataire fait reculer
  l'autre. Aucune révocation n'y peut rien.

Effet de la recommandation, pièce par pièce : **P3 disparaît par construction** (deux
instances, deux unités de reprise) ; **P1 et P2 se réduisent à l'intérieur d'une
instance mono-locataire**, où « rouvrir l'accès croisé » n'a plus d'objet — il ne reste
qu'une hygiène (`REVOKE CONNECT … FROM PUBLIC`) sans conséquence inter-locataire.
**C'est l'argument le plus fort en faveur de O5 : il ne traite pas le piège, il le
supprime.**

Reste à traiter le résidu, car il ne faut pas se payer de mots : tant qu'un futur
locataire non sensible partagera l'instance de MENAL, P1 et P2 reviendront.

### e.2 Garantir que la frontière survit à une reprise : la déplacer dans la définition de « reprise terminée »

**La bonne réponse n'est pas de surveiller après, c'est de redéfinir la fin.**

> **Une restauration n'est pas déclarée terminée tant que la tâche de durcissement n'a
> pas été rejouée avec succès et que le contrôle n'a pas rendu un verdict vert.**

Concrètement, le mode opératoire de reprise se termine par deux étapes ajoutées :

```
gcloud run jobs execute menal-sql-isolation-apply-staging --region europe-west1 --wait
gcloud run jobs execute menal-sql-isolation-check-staging --region europe-west1 --wait
```

C'est exactement la forme que `elson-ci.yml` emploie déjà pour la migration de schéma
(`gcloud run jobs execute … --wait`, « le nouveau code n'est alors jamais déployé sur un
schéma en retard »). **Le motif existe, il est éprouvé, il est simplement appliqué à la
mauvaise chose : on l'utilise pour garantir la cohérence du schéma, pas celle de la
frontière.** Coût de l'ajout : deux lignes dans le mode opératoire, deux minutes sur un
RTO de 32 min 45 s — **soit environ 0,1 % de dégradation du RTO mesuré, à annoncer comme
telle plutôt que passée sous silence.**

Cela couvre P1 et P2 dans les deux cas de figure, et sans surveillance : la frontière
n'est plus une chose qui doit survivre à la reprise, elle est **une condition de fin de
reprise**.

### e.3 Le contrôle quotidien doit-il devenir un contrôle qui répare ? — **Non.**

**Pour :** la fenêtre de dérive tomberait de « ≤ 24 h + latence humaine » à « ≤ 24 h » ;
un mono-opérateur en vacances est couvert ; c'est peu de code, le script d'application
existe déjà.

**Contre — trois arguments, dont le premier est dirimant :**

**(1) La réparation exige les privilèges que la frontière retire.** Vérifié dans le code
(écart D-2) : `sql-isolation.ts` ne peut révoquer le `CONNECT` croisé **que tant que son
identité est encore membre de `cloudsqlsuperuser`**. Un réparateur permanent aurait donc
besoin d'une **identité PostgreSQL privilégiée à demeure**, avec son mot de passe dans
Secret Manager et un accès depuis une tâche planifiée. Autrement dit : **on créerait une
identité inter-bases permanente pour défendre une frontière inter-bases.** La cible
devient meilleure que l'objectif défendu — un attaquant qui compromet le réparateur
obtient exactement ce que la frontière interdit, en permanence, sans dérive à provoquer.
**C'est un net recul de sécurité, et cela suffit à trancher.**

**(2) Une réparation automatique détruit le signal.** Les deux causes possibles d'une
dérive sont un `apply` mal maîtrisé et une intrusion. Ce sont **les deux seuls
événements** qui doivent réveiller un humain. Une réparation silencieuse les transforme
en tableau de bord vert. Sur une frontière de confidentialité, **détecter et arrêter vaut
mieux que détecter et rapiécer** — la donnée déjà lue pendant la fenêtre ne se
« déréparé » pas.

**(3) Le réparateur ne sait pas distinguer une dérive d'un changement légitime.**
L'accueil d'un troisième locataire ressemble trait pour trait à une dérive, vu d'un
contrôle qui compare à un état attendu. Un réparateur automatique casserait un accueil en
cours, à 4 h du matin, sans témoin.

### e.4 Ce qu'il faut faire à la place — quatre modifications précises

| # | Modification | Pourquoi |
|---|---|---|
| **R1** | **Séparer application et contrôle**, et déclarer les deux en Terraform : une tâche `…-isolation-apply` **idempotente**, déclenchée par la livraison, par l'accueil et par le mode opératoire de reprise — **jamais par un ordonnanceur** ; une tâche `…-isolation-check` **en lecture seule**, quotidienne | La réparation devient un acte explicite, versionné, tracé, décidé par un humain. Elle a un journal d'exécution et un déclencheur nommé, ce qu'une réparation par cron n'a jamais |
| **R2** | **Rendre la tâche d'application tolérante et auto-limitée** : chaque ordre dans son propre `try/catch` (le durcissement le fait déjà, `sql-isolation.ts` **ne le fait pas** — à corriger), et **code de sortie piloté par les sondes comportementales**, pas par les ordres | Une réexécution après durcissement échouera sur les ordres devenus interdits : c'est normal, ce n'est pas un échec. **La capacité même de la tâche à appliquer les ordres est l'indicateur de dérive** : si elle réussit, il y avait dérive ; si elle est refusée, la frontière tenait |
| **R3** | **Alerte de fraîcheur** : absence d'exécution **réussie** du contrôle sur 48 h. En complément — et non en remplacement — de l'alerte sur exécution échouée | Aujourd'hui, un contrôle supprimé ou un ordonnanceur muet ne déclenche rien (a.1). L'absence de preuve n'est pas une preuve d'absence de dérive |
| **R4** | **Faire énumérer le contrôle** : `SELECT rolname FROM pg_roles WHERE rolcanlogin AND rolname NOT LIKE 'cloudsql%'`, au lieu des deux noms en dur ; **et y ajouter la vérification des attributs de rôle** (D-4) | Ferme D-5 (locataire invisible du contrôle) et D-4 (escalade par `CREATEROLE`). C'est ce qui rend le contrôle réellement clonable, ce que le dossier suppose à tort qu'il est |

---

## f) Remise sous contrôle du code : fournisseur supplémentaire ou tâche idempotente ?

> **Tranché : la tâche idempotente rejouée. Le fournisseur PostgreSQL est écarté sur
> preuve, pas sur préférence.**

**Pourquoi le fournisseur `cyrilgdn/postgresql` est impraticable ici — trois faits, tous
vérifiés dans le code :**

1. **Il n'y a aucun chemin réseau.** `ip_configuration.ipv4_enabled = false`
   (`cloud-sql/main.tf:38`) : l'instance n'a **pas d'adresse publique**. Un fournisseur
   Terraform ouvre une session TCP sur 5432 **depuis le processus qui exécute le plan**.
2. **Ce processus est un poste de travail.** `.github/workflows/terraform.yml`
   n'exécute que `fmt`, `validate` et un scan de configuration : **il n'y a ni `plan` ni
   `apply` en intégration continue** (D-9). Les `apply` sont lancés à la main, depuis un
   poste qui n'a ni appairage ni tunnel vers le réseau privé. Le mode opératoire
   d'accueil le dit d'ailleurs pour les ordres SQL eux-mêmes : « exécution obligatoire
   via un job Cloud Run sur le connecteur VPC — `cloud-sql-proxy` local ne joint pas
   l'instance ». **Ce qui est vrai du mode opératoire est vrai du fournisseur.**
3. **Le rendre praticable coûterait ce qu'on cherche à protéger** : soit une adresse
   publique sur l'instance (inacceptable), soit un rebond permanent (un composant de
   plus à entretenir — disqualifiant pour un mono-opérateur, c'est la contrainte posée),
   et dans tous les cas **des identifiants de base présents à l'étape de plan**, donc
   dans l'environnement du poste, à chaque `plan` — y compris ceux qu'on ne compte pas
   appliquer.

S'y ajoute l'argument de principe, qui ici n'a même pas besoin de servir : un fournisseur
supplémentaire se justifie par un besoin qu'aucun mécanisme existant ne couvre. **Ce
n'est pas le cas.**

**Pourquoi la tâche idempotente est la bonne réponse :**

- **Le motif existe déjà deux fois dans le dépôt, éprouvé.**
  `google_cloud_run_v2_job.migrate` du module `app-service`, exécutée par la livraison
  avec `--wait` avant tout déploiement ; et `google_cloud_run_v2_job.sql_isolation_check`
  avec son ordonnanceur et son alerte. **On ne crée pas un motif, on en instancie un
  troisième.**
- **Elle emprunte le seul chemin réseau qui existe** : une tâche Cloud Run sur le réseau
  privé — le chemin même que le mode opératoire impose déjà.
- **Ce que Terraform reprend réellement, et c'est là le gain :** non pas les ordres SQL,
  mais **la liste des locataires sur lesquels ils s'appliquent**. La tâche est déclarée
  avec un `for_each` **sur la même variable qui crée les bases et les utilisateurs**.
  Dès lors, **la source de vérité qui ouvre la porte est la source de vérité qui la
  referme** : il devient impossible de déclarer un locataire sans déclarer son
  durcissement. C'est exactement ce que D-5 réclame, et aucune quantité de mode
  opératoire ne l'obtient.
- **Coût** : ≈ 0 €/mois. Effort ≈ 1 jour, dont la fusion des deux scripts en un seul
  script idempotent (R2).
- **Ce que cela ne donne pas, et qu'il ne faut pas laisser croire :** un `terraform plan`
  **ne détectera toujours pas** une dérive des droits Postgres — l'état des `GRANT` reste
  hors du `state`. La détection reste le contrôle quotidien. **Le code reprend
  l'application et la déclaration, pas la détection de dérive.** Dire l'inverse serait
  revendiquer deux fois.

**Où la tâche doit vivre — et c'est une correction de gouvernance.** Dans le dépôt et
l'image **du socle**, sous une identité **du socle**, pas dans `elson-main/` sous
`sa-elson` (a.1). La frontière entre deux locataires est appliquée et contrôlée par
l'hébergeur, jamais par l'un des deux.

---

## g) Articulation avec la conception réseau — sans revendiquer deux fois

| Plan | Ce que la conception **réseau** apporte | Ce que la conception **donnée** apporte |
|---|---|---|
| Charge ↔ charge | **Tout** : sous-réseau par locataire, refus croisés nommés et journalisés, refus par défaut en sortie, signal exploitable dans `raw_logs` | **Rien.** Ne pas y revenir |
| Charge ↔ serveur de base | **Rien** : `SQL_IP` est la même constante dans E1 et E2 — sa §f.3 le dit | **Tout** : le serveur cesse d'être commun |
| Frontière entre les données | **Rien** | **Tout** |
| Unité de reprise | **Rien** | **La sépare** |
| Coût | **Libère 11 à 13 €/mois** | **Les consomme** (§i) |

**Ce que la conception donnée rend possible à la conception réseau — et qui n'existait
pas.** La table de règles cible pose `SQL_IP` comme une **constante unique**, partagée
par E1 et E2. Une fois ELSON sur sa propre instance, ce sont **deux constantes
disjointes** : E1 autorise `sa-api` vers `MENAL_SQL_IP/32` **seulement**, E2 autorise
`sa-elson` vers `ELSON_SQL_IP/32` **seulement**. Le pare-feu porte alors une frontière
de **plan de donnée** qu'il était structurellement incapable de porter avant — non parce
que les règles changent, mais parce que les destinations deviennent distinguables.
**C'est une composition, pas une redondance : le réseau gagne une expressivité qu'il ne
pouvait pas se donner lui-même.** À formuler ainsi et pas autrement.

**Ce que la conception donnée ne touche pas — et c'est délibéré.** La plage d'appairage
d'accès privé aux services est l'invariant le plus fragile de la conception réseau
(§b.1 : « ne peut pas être redéfinie sans détruire l'instance »). **Ajouter une seconde
instance Cloud SQL ne la redéfinit pas** : la seconde instance consomme une adresse
supplémentaire dans la plage `/16` déjà réservée, via la **même**
`google_service_networking_connection`. Aucun second appairage, aucun coût réseau, aucune
modification du plan d'adressage cible. *(À vérifier, §k V-06 — c'est la vérification
qui conditionne l'absence d'impact sur la conception réseau.)*

**Le seul point de couplage entre les deux conceptions** est D-8 : l'appairage doit
sortir du module `cloud-sql` pour rejoindre la couche réseau, à laquelle il appartient
par nature. C'est une chirurgie d'état, pas un changement d'infrastructure — et c'est
l'étape la plus dangereuse des deux plans réunis (§j étape 1). **Si les deux migrations
sont menées, celle-ci se fait une seule fois, et le réseau en est le propriétaire.**

---

## h) Ce que la cible ne couvre pas

1. **L'opérateur.** `roles/owner`, `roles/cloudsql.admin` : `gcloud sql export` lit
   n'importe quelle base de n'importe quelle instance, sans traverser le moteur
   d'autorisation. **Deux instances font deux opérations, pas une barrière.** Seule la
   séparation par projet répond, et elle exige une organisation (O4, cible conditionnée).
2. **L'exfiltration vers une destination légitime.** Un export vers un compartiment
   contrôlé par l'attaquant reste possible ; le contrôle qui y répond s'appelle périmètre
   de service et exige une organisation. Déjà nommé par la conception réseau (§g-3) :
   **on ne le compte pas deux fois, on constate qu'aucune des deux conceptions ne le
   ferme.**
3. **Le numéro d'identité nationale et les enregistrements restent en clair au niveau
   applicatif.** L'instance dédiée protège du voisin, pas du lecteur légitime de la base
   d'ELSON. Responsabilité de l'éditeur (§18.6), non traitée ici, non résolue.
4. **`sa-cicd`.** Il conserve `run.developer` et `artifactregistry.writer` au niveau
   projet, et l'usurpation des identités applicatives. Une image malveillante déployée
   sous `sa-elson` lit `elson_db` **par le chemin nominal** — aucune isolation de base ne
   s'y oppose. C'est le travail #7 du §17.4, hors périmètre.
5. **L'entrepôt de supervision reste un jeu de données unique**, sans clé de locataire
   fiable sur sept tables sur huit, sans cloisonnement au stockage. **Ce document ne
   traite que la base de production.** L'isolation du SIEM est un chantier distinct
   (travaux #1 à #3 du §17.4) et il ne faut pas laisser l'un passer pour l'autre.
6. **Le filtre de locataire du tableau de bord reste un cookie non signé.** Inchangé.
7. **Le chiffrement par clé gérée de l'instance existante reste impossible** — vérifié,
   structurel, définitif tant que l'instance n'est pas reconstruite. La cible ne le
   corrige **que pour la nouvelle instance**.
8. **Aucune détection de dérive par `terraform plan`** sur les droits Postgres (§f).
9. **La bascule régionale de l'instance dédiée**, en variante zonale (§d).
10. **Rien ici ne rend le contrôle infalsifiable** : il reste un programme qui interroge
    la base qu'il contrôle. Le rendre indépendant de l'image du locataire (R1) réduit le
    risque ; il ne l'annule pas.

---

## i) Impact sur le coût mensuel

**Ordres de grandeur de tarification publique, pas des mesures.** À remplacer par des
montants de facture (§k, V-15).

| Poste | Existant | Cible recommandée (ELSON zonal) | Variante régionale | Base du calcul |
|---|---|---|---|---|
| Instance partagée `menal-db` (`db-f1-micro`, régionale) | ≈ 19 à 24 € | **inchangé** | inchangé | Machine à cœur partagé ≈ 10-12 €, doublée en régional ; disque SSD ~10 Go ≈ 1,5-2 €, également doublé |
| **Instance dédiée ELSON** | — | **+10 à +12 €** | **+19 à +24 €** | Même gabarit, zonal / régional |
| Sauvegardes et journaux de transactions de la nouvelle instance | — | **≈ +0 à 1 €** | idem | Facturé au volume stocké ; ~10 Go |
| Chiffrement par clé gérée de la nouvelle instance | — | **≈ +0 €** | idem | Clé régionale **existante**, déjà facturée ; coût marginal = quelques centimes par version |
| Tâche d'application idempotente (quelques exécutions/mois) | — | **≈ 0 €** | idem | Tâche Cloud Run à la seconde de calcul |
| Contrôle quotidien | ≈ 0 € | **≈ 0 €** (une exécution de plus) | idem | Idem |
| Alerte de fraîcheur | — | **0 €** | idem | Politique d'alerte, non facturée |
| Appairage d'accès privé aux services | 0 € | **0 €** | idem | Réutilisé, non redéfini (§g) |
| **Sous-total isolation des données** | **0 €** | **+10 à +13 €** | **+19 à +25 €** | |
| **Économie libérée par la conception réseau (D15)** | — | **−11 à −13 €** | **−11 à −13 €** | Suppression du connecteur d'accès sans serveur, §h de la conception réseau |
| **Solde net des deux conceptions** | — | **≈ −1 à +2 €/mois** | **≈ +6 à +14 €/mois** | |

### La réponse à la question posée : **oui, l'économie réseau finance l'isolation des données — exactement, et une seule fois**

**Oui, et c'est l'argument majeur.** La suppression du connecteur d'accès sans serveur
libère 11 à 13 €/mois ; une instance zonale dédiée en coûte 10 à 12. **La conception
recommandée est neutre sur la facture, à un ou deux euros près.** Formulation pour le
mémoire :

> « La ségrégation réseau a rendu gratuit ce qui était chiffré à douze euros par
> locataire. Cette économie n'a pas été encaissée : elle a été **réinvestie** dans la
> seule frontière que le réseau ne pouvait pas porter — le serveur de base de données.
> Le socle passe d'une isolation de donnée portée par un geste à une isolation portée
> par la structure, **à budget constant**. »

**Et l'avertissement de méthode qui va avec, sans lequel l'argument serait malhonnête :**
**l'économie ne peut être encaissée qu'une fois.** La conception réseau annonce
« −11 à −13 €/mois » ; la conception donnée les consomme. **Le mémoire ne doit pas
présenter les deux conceptions comme apportant chacune un gain financier.** Le solde
combiné est ≈ 0 €, et c'est le chiffre à publier. La variante régionale, elle, coûte
réellement 6 à 14 €/mois nets — c'est une dépense, pas un arbitrage neutre, et elle doit
être présentée comme telle.

**Coût marginal d'un locataire supplémentaire, après la cible :** 0 €/mois s'il ne
franchit pas le test d'admission (§d) — une base sur l'instance mutualisée, derrière la
tâche idempotente ; 10 à 12 €/mois s'il le franchit. **Le critère devient donc aussi un
critère de tarification** : un locataire qui exige l'isolation forte la paie.

---

## j) Plan de migration

### Avertissement préalable, à lire avant l'étape 0

**Toute opération sur une base de données en service porte un risque de perte de
données.** Ce plan est construit autour d'un principe unique qui en découle :

> **Aucune étape n'écrit dans la base source, et aucune ne la supprime avant qu'un
> export vérifié n'existe ailleurs et qu'une période d'observation ne soit passée.**
> La copie se fait par **export en lecture** ; la source reste intacte et servable ; le
> retour arrière consiste à **repointer une variable d'environnement**, jamais à
> restaurer quoi que ce soit.

Deux mécanismes de maîtrise, tous deux éprouvés dans le dépôt :

- **L'export vers le stockage objet par l'API d'administration** ne demande **aucune
  connectivité réseau** — c'est la technique déjà employée et documentée lors du test de
  restauration du 03/08. C'est ce qui rend la copie possible sans exposer l'instance.
- **La vérification par comptage de lignes table à table**, à l'identique de la
  discipline du 03/08 (« 314 lignes attendues, 314 restaurées, 0 manquante, 0 en trop »).
  **Une bascule n'est pas déclarée réussie sur l'absence d'erreur : elle l'est sur une
  égalité de comptes.**

| # | Étape | Risque de coupure / de perte | Maîtrise |
|---|---|---|---|
| **0** | **Filets et invariants.** (a) `deletion_protection = true` **et** `lifecycle { prevent_destroy = true }` sur l'instance existante — ferme D-7 et le travail #8 du §17.4 ; (b) **copie locale explicite de l'objet d'état Terraform** (le versionnement du compartiment d'état est affirmé mais « la reprise n'a jamais été testée ») ; (c) relever : plage d'appairage, adresse privée, `pg_roles` complet avec attributs (V-04), comptes de lignes par table d'`elson_db`, taille d'export attendue | **Nul** — une seule écriture, protectrice ; le reste en lecture | Le `plan` de (a) doit montrer **une modification en place, zéro destruction**. Si `prevent_destroy` fait échouer un `plan` ultérieur, **c'est le filet qui fonctionne**, pas une panne |
| **1** | **Sortir l'appairage du module `cloud-sql`** vers la couche réseau (`terraform state mv` de `google_compute_global_address.private_ip_range` et `google_service_networking_connection.private_vpc`), puis paramétrer le module (nom d'instance, gabarit, type de disponibilité, clé de chiffrement, appairage reçu en dépendance) | **ÉLEVÉ. C'est l'étape dangereuse du plan.** Un déplacement d'état manqué fait détruire l'appairage à Terraform : **les deux locataires perdent la base instantanément.** Un champ mal recopié sur l'instance existante peut forcer un remplacement = **perte totale des deux bases** | (a) Le filet de l'étape 0 est déjà posé ; (b) après les `state mv`, `terraform plan` doit afficher **`0 to add, 0 to change, 0 to destroy`** — **toute autre sortie impose l'arrêt immédiat** ; (c) lire le plan **en entier**, jamais la fin seule — c'est la leçon inscrite dans le dossier ; (d) hors heures ouvrées ; (e) `prevent_destroy` rend l'erreur bruyante avant d'être fatale |
| **2** | **Créer l'instance dédiée d'ELSON, vide** : `db-f1-micro`, zonale, adresse privée sur le même appairage, `ssl_mode = ENCRYPTED_ONLY`, sauvegardes + restauration à un instant donné identiques à l'existante, **clé gérée** (V-08), `deletion_protection = true` | **Nul** — ajout pur, aucune ressource ne la référence | Le `plan` ne doit contenir que des créations. **C'est ici que le coût commence** |
| **3** | **Construire le schéma** : pointer le job `elson-migrate` existant sur la nouvelle instance, exécuter `--from-zero --wait` | **Nul** — instance vide | Le job est déjà idempotent et déjà éprouvé par la livraison |
| **4** | **Répétition à blanc de la copie** : export d'`elson_db` vers le stockage objet, import dans la nouvelle instance, **comparaison des comptes de lignes table à table** | **Nul pour la production** : l'export est une lecture. Charge accrue sur une `db-f1-micro` | Hors heures ouvrées. **C'est l'étape qui remplace le pari par la mesure** : elle établit la durée réelle de l'export/import, donc la longueur de la fenêtre de l'étape 5 |
| **5** | **Bascule.** Gel des écritures d'ELSON (service à zéro instance, ou révision de maintenance) → export final → import → comparaison des comptes → nouveau secret de mot de passe → repointage `DB_HOST` → redéploiement → test de fumée → dégel | **Coupure planifiée, de durée mesurée à l'étape 4. Risque de perte des écritures survenant pendant la fenêtre** | **Le gel est ce qui garantit un RPO nul** — sans lui, les écritures de la fenêtre sont perdues sans trace. ELSON tourne à instance unique (`min = max = 1`), le gel est donc simple et total. **Retour arrière : repointer `DB_HOST` sur l'ancienne adresse ; la donnée d'origine est intacte et servable.** La fenêtre est annoncée |
| **6** | **Fermer l'ancien accès** : `REVOKE CONNECT ON DATABASE elson_db FROM elson_user` sur l'instance partagée. **Ne rien supprimer** | **Nul** | `elson_db` reste en place, figée, comme filet de retour arrière |
| **7** | **Remplacer les deux scripts par une tâche unique idempotente** (R1, R2), déclarée en Terraform avec `for_each` sur la liste des locataires, sous image et identité du socle ; l'exécuter sur les deux instances | **Nul** — idempotente, pilotée par sondes | Le code de sortie est celui des sondes comportementales, pas des ordres (R2) |
| **8** | **Mettre le contrôle à niveau** (R3, R4) : énumération des rôles, vérification des attributs, alerte de fraîcheur ; déplacer le job hors de l'image du locataire | **Nul** | Vérifier que le contrôle rend un vert sur les deux instances **avant** de retirer l'ancien |
| **9** | **Inscrire les deux exécutions dans le mode opératoire de reprise** (§e.2) et **refaire le test de restauration sur la nouvelle instance** | **Nul** (test sur clone jetable) | **Ne pas transporter le chiffre de 32 min 45 s sur une instance où il n'a pas été mesuré.** Publier le nouveau, quel qu'il soit |
| **10** | **Après N jours d'observation (N ≥ 14) et un export vérifié conservé** : supprimer `elson_db` et `elson_user` sur l'instance partagée | **DESTRUCTION VOLONTAIRE DE DONNÉES. Seule étape irréversible du plan.** | Trois conditions cumulatives : (a) un export d'`elson_db` daté et vérifié par comptes de lignes, conservé hors de l'instance ; (b) N jours sans incident sur la nouvelle instance ; (c) une décision écrite. **Sans les trois, on ne supprime pas — laisser une base inerte coûte quelques centimes de disque** |
| **11** | **Rendre les deux adresses distinctes au pare-feu** (§g) : E1 vers `MENAL_SQL_IP/32`, E2 vers `ELSON_SQL_IP/32` | **Faible** | À faire **après** l'étape 5, sinon la nouvelle instance est injoignable. Un refus dans les journaux = une destination non inventoriée |

**Durée réaliste pour un mono-opérateur : 3 à 4 jours d'intervention étalés sur 3
semaines**, dont la période d'observation de l'étape 10. **Ordonnancement avec la
migration réseau : l'étape 1 ci-dessus et l'étape 1 de la migration réseau touchent la
même couche.** Les mener séparément, réseau d'abord (il est déjà planifié et son étape 0
est passée), donnée ensuite : deux chirurgies d'état simultanées sur le même `state`
n'ont aucun bénéfice et doublent le risque.

---

## k) Protocole de vérification

Une propriété par ligne, une commande qui l'établit. **Aucune ligne des §a à §j n'entre
dans le mémoire comme un fait avant que sa vérification soit passée.**

### k.1 Préalables — à exécuter avant d'écrire une ligne de code

| Réf. | Propriété à établir | Commande |
|---|---|---|
| **V-01** | La procédure publiée (§16 étape 4 / annexe B) omet bien `REVOKE cloudsqlsuperuser FROM api_user` (écart D-1) | Lecture croisée : `sed -n '2255,2275p' "rapport PFE/DOSSIER_TECHNIQUE_MENAL.md"` vs `elson-main/backend/src/scripts/sql-isolation-harden.ts`. **Passé — la divergence est établie ; reste à décider de la correction du document** |
| **V-02** | Le code applique dix ordres dans deux scripts, dont six révocations | `grep -nE "REVOKE\|GRANT" elson-main/backend/src/scripts/sql-isolation.ts elson-main/backend/src/scripts/sql-isolation-harden.ts`. **Passé** |
| **V-03** | Il n'existe ni `plan` ni `apply` Terraform en intégration continue (D-9, fonde la §f) | `grep -nE "terraform (plan\|apply)" .github/workflows/terraform.yml` → **vide. Passé** |
| **V-04** | **Aucun compte applicatif ne porte `CREATEROLE`, `CREATEDB`, `SUPERUSER` ni `BYPASSRLS`** (écart D-4 — **vérification la plus urgente du document**) | Depuis une tâche Cloud Run sur le réseau privé : `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolcanlogin;` → **`rolcreaterole` doit valoir `false`.** S'il vaut `true` sur PostgreSQL 15, **la frontière actuelle est contournable en deux ordres et l'affirmation « l'isolation tient » du mémoire doit être retirée jusqu'à correction** |
| **V-05** | Le durcissement d'aujourd'hui est plus ancien que la fenêtre de rétention, donc P1 est fermée sur l'installation actuelle (a.2) | `gcloud sql backups list --instance=menal-db-staging --format="table(windowStartTime)"` → la sauvegarde la plus ancienne doit être **postérieure au 08/08/2026** |
| **V-06** | **Une seconde instance Cloud SQL réutilise l'appairage existant sans en créer un second** (conditionne l'absence d'impact sur la conception réseau, §g) | `gcloud services vpc-peerings list --network=<vpc>` avant / après création d'une instance d'essai jetable → **une seule entrée, plage inchangée**. Puis supprimer l'instance d'essai |
| **V-07** | La plage `/16` a la capacité d'une adresse supplémentaire | `gcloud compute addresses list --global --filter="purpose=VPC_PEERING" --format="table(name,address,prefixLength)"` — **même commande que V17 de la conception réseau : la relever une fois, la publier une fois** |
| **V-08** | **Le chiffrement par clé gérée est réellement posable à la création** d'une instance neuve | `terraform plan` sur l'instance cible avec `encryption_key_name` renseigné → le champ doit apparaître **dans une création, jamais dans un `must be replaced`**. Préalable : liaison `roles/cloudkms.cryptoKeyEncrypterDecrypter` pour l'agent de service Cloud SQL sur la clé régionale |
| **V-09** | Le gabarit `db-f1-micro` accepte la restauration à un instant donné sur une instance zonale | `gcloud sql instances describe <instance-essai> --format="value(settings.backupConfiguration.pointInTimeRecoveryEnabled)"` → `True` |

### k.2 Après la bascule — propriétés fonctionnelles

| Réf. | Propriété | Commande |
|---|---|---|
| **V-10** | Aucune donnée perdue à la bascule | Comparaison des comptes de lignes table à table, source vs cible, **avant dégel**. Égalité exacte exigée, table par table — pas un total global |
| **V-11** | ELSON fonctionne sur la nouvelle instance | `curl -sf https://elson.menal-sarl.com/api/ready` → 200, puis une transaction métier réelle |
| **V-12** | La base d'ELSON n'est plus jointe sur l'ancienne instance | `gcloud logging read 'resource.type="cloudsql_database" AND resource.labels.database_id:"menal-db-staging"' --freshness=1d \| grep -c elson_db` → **0** |
| **V-13** | **La restauration à un instant donné est mesurée sur la nouvelle instance** | Rejouer le mode opératoire du 03/08 sur la nouvelle instance : clonage à un horodatage, export vers le stockage objet, comptage. **Publier le RTO obtenu, quel qu'il soit — et ne pas réutiliser 32 min 45 s** |
| **V-14** | Restaurer un locataire ne fait plus reculer l'autre (fermeture de P3) | Pendant le clonage de V-13, écrire dans `menal_db` et vérifier que l'écriture est présente après : **l'instance MENAL n'est pas touchée**. C'est la démonstration la plus parlante de la conception — à filmer pour la soutenance |

### k.3 Propriétés de sécurité revendiquées

| Réf. | Propriété revendiquée | Commande qui l'établit |
|---|---|---|
| **V-16** | **Une charge d'un locataire ne peut plus joindre le serveur de base de l'autre** — propriété structurelle, remplace la propriété par les droits | Depuis une révision d'essai portant l'identité `sa-elson` : `nc -zv -w5 <MENAL_SQL_IP> 5432` → **doit expirer**. À exécuter **après** l'étape 11 (règles de pare-feu par adresse) |
| **V-17** | Le durcissement résiduel tient sur chaque instance | `gcloud run jobs execute menal-sql-isolation-check-staging --region europe-west1 --wait` puis lecture du journal : `isolated: true`, et le nombre de vérifications **doit être supérieur à six** (énumération des rôles + attributs, R4) |
| **V-18** | **La tâche d'application est idempotente et auto-limitée** (R2) | L'exécuter deux fois de suite sur une instance déjà durcie → **code de sortie 0 les deux fois**, journal indiquant des ordres refusés et des sondes vertes. Une sortie non nulle sur une instance saine est un défaut de la tâche, pas une dérive |
| **V-19** | **L'absence du contrôle déclenche une alerte** (R3) | Désactiver l'ordonnanceur, attendre 48 h → l'alerte de fraîcheur doit se déclencher. **Sans ce test, l'alerte n'est pas une alerte, c'est une intention** |
| **V-20** | Le contrôle voit un utilisateur qu'il ne connaissait pas (fermeture de D-5) | Créer un rôle jetable `probe_user` avec droit de connexion, relancer le contrôle → il doit apparaître dans les vérifications. Supprimer le rôle |
| **V-21** | La déclaration d'un locataire entraîne mécaniquement son durcissement (§f) | `grep -n "for_each" terraform/modules/<module-isolation>/main.tf` → la boucle porte **sur la même variable** que celle qui crée bases et utilisateurs |
| **V-22** | Le contrôle n'est plus porté par l'image ni l'identité du locataire | `gcloud run jobs describe menal-sql-isolation-check-staging --format="value(template.template.serviceAccount,template.template.containers[0].image)"` → ni `sa-elson`, ni `elson-backend` |
| **V-23** | La protection contre la suppression est effective sur les deux instances (D-7) | `gcloud sql instances list --format="table(name,settings.deletionProtectionEnabled)"` → **`True` partout** ; et un `terraform plan` incluant une destruction d'instance doit **échouer** sur `prevent_destroy` |

### k.4 Propriétés de coût et d'exploitation

| Réf. | Propriété | Commande |
|---|---|---|
| **V-15** | **Les ordres de grandeur du §i sont remplacés par des montants réels** | Rapport de facturation, filtre sur les références de facturation Cloud SQL et `VPC Access`, comparaison du mois M−1 et du mois M+1. **Publier le solde net des deux conceptions, pas les deux gains séparément** |
| **V-24** | La nouvelle instance ne sature pas | Métriques d'utilisation processeur, mémoire et connexions ; `DB_MAX_CONNECTIONS = 20` face au `max_connections = 100` désormais **non partagé** — une marge à documenter, pas à consommer |
| **V-25** | La suppression finale (étape 10) est couverte par un export vérifié | `gcloud storage ls -l gs://<compartiment>/elson_db_*.sql.gz` → l'export existe, sa date et sa taille correspondent au relevé de l'étape 0 |

---

## Annexe — traçabilité des écarts

| Réf. | Écart | Confirmé dans le code ? | Traité par | Statut cible |
|---|---|---|---|---|
| **M19** | Isolation SQL hors Terraform | **Oui** — aucun `postgresql_grant`, aucun `local-exec` ; scripts dans le dépôt du locataire | §f : tâche idempotente déclarée, `for_each` sur la liste des locataires | **Fermé sur l'application et la déclaration ; ouvert sur la détection par `plan`, et c'est dit** |
| **M16** | Module `cloud-sql` non instanciable | **Oui** — `cloud-sql/main.tf:3-17` | §j étape 1 : appairage sorti du module | **Fermé** — préalable de la cible |
| **D-1** | Procédure publiée incomplète → isolation à sens unique | **Oui** — comparaison dossier §16 / `sql-isolation-harden.ts` | Correction documentaire + §f (le code devient la source) | **Fermé, et c'est une correction à faire avant impression** |
| **D-2** | Ordre d'exécution imposé, non documenté ; script non tolérant | **Oui** — `sql-isolation.ts` sans `try/catch` par ordre | R2 : fusion en une tâche tolérante, sortie pilotée par sondes | **Fermé** |
| **D-3** | Le mémoire prête un chiffrement par clé gérée à l'instance | **Oui** — aucun `encryption_key_name` dans le module | Correction documentaire ; la **nouvelle** instance l'obtient réellement (V-08) | **Fermé sur les deux plans** |
| **D-4** | Attributs de rôle jamais vérifiés ; escalade possible sur PostgreSQL 15 | **Non vérifié** | V-04, puis R4 | **Ouvert — vérification prioritaire** |
| **D-5** | Fenêtre d'accueil sans couverture ni détection | **Oui** — contrôle à deux noms en dur | §f (`for_each`) + R4 (énumération) | **Fermé** |
| **D-6** | Le contrôle confond dérive et indisponibilité | **Oui** — `catch` global → `isolated: false` | Distinguer les deux verdicts dans la charge utile ; ne pas alerter en sécurité sur une indisponibilité | **Fermé** |
| **D-7** | `deletion_protection = false` sur l'instance des deux bases | **Oui** — `cloud-sql/main.tf:31` | §j étape 0 | **Fermé, à coût nul** |
| **D-8** | Appairage câblé dans un module de portée instance | **Oui** | §j étape 1 | **Fermé** |
| **D-9** | Aucun `apply` en intégration continue | **Oui** — `terraform.yml` | Non corrigé ici ; **fonde** l'écart de la §f | **Constaté, assumé** |
| **P3** | Unité de reprise partagée entre locataires | **Oui** — clonage d'instance | §c O3/O5 : instances séparées | **Fermé par construction** |
| **—** | Opérateur `roles/owner` traversant toutes les frontières | **Oui** | Rien. O4, cible conditionnée | **Ouvert, et nommé** |
| **—** | Numéro national et enregistrements non chiffrés au niveau applicatif | **Oui** — §18.4(b) | Responsabilité de l'éditeur (§18.6) | **Ouvert, hors périmètre de l'hébergeur** |

---

*Fin du dossier de conception. C'est une proposition : son application relève de
l'auteur. Elle ne devient un fait du mémoire qu'après le protocole §k — et V-04 en
premier, parce que d'elle dépend la validité de ce que le mémoire affirme déjà.*
