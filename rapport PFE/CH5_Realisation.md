# Chapitre 5 — Réalisation

---

## Introduction du chapitre

Ce chapitre décrit ce qui a été effectivement construit à partir de l'architecture cible du chapitre 4. Une conception est un document ; une réalisation est un système qui fonctionne, qui coûte et qu'il faut réparer. Le chapitre rend compte des deux : de ce qui a été mis en œuvre conformément à la conception et de ce qui a dû être ajusté au contact de la réalité.

Les sections suivent l'ordre de construction : organisation du travail et environnements (5.1), infrastructure en code (5.2), chaînes de livraison (5.3–5.4), chaîne de détection (5.5), enrichissement sémantique (5.6), interface de l'analyste (5.7), boucle livraison-détection (5.8), généralisation à plusieurs applications (5.9), et conduite du projet (5.10).

Le chapitre distingue trois statuts : **réalisé et vérifié**, **réalisé partiellement**, et **prévu mais non réalisé** — y compris lorsqu'elle est défavorable. Le chapitre suivant valide et mesure ce qui a été construit.

---

## 5.1 Organisation du travail

### 5.1.1 Environnements

Deux environnements ont été définis, correspondant à deux projets cloud distincts : le
développement et la recette (staging). La production est une cible documentée en code mais
non provisionnée — les mesures du chapitre 6 sont réalisées sur la recette, dont la
topologie est identique à la cible.

| Environnement | Rôle | État | Dimensionnement |
|---|---|---|---|
| Développement | Itération rapide, expérimentation | Existe, réduit | Réduit |
| Recette (staging) | **Environnement de référence du projet** : topologie identique à la cible | Existe, topologie complète | Réduit, topologie complète |
| Production | Cible documentée | **Cible non provisionnée** | Complet |

> **Note (C06).** Le développement n'est pas un miroir fidèle de la recette : certaines
> options de sécurité sont désactivées pour accélérer l'itération. Les mesures de sécurité
> et de détection sont uniquement valables sur la recette.

**Une règle a été appliquée sans exception : les mêmes modules d'infrastructure partout.**
Seules les variables de dimensionnement changent d'un environnement à l'autre. La sécurité
n'est jamais un paramètre d'environnement — il n'existe pas de configuration « sans
authentification en développement » qui risquerait d'être promue par inadvertance.

Cette règle a un effet secondaire utile : ce qui est validé en recette l'est sur une
topologie réellement identique, ce qui donne aux mesures du chapitre 6 une valeur qu'elles
n'auraient pas sur un environnement simplifié.

**Écart constaté.** Un quatrième projet, destiné à porter les éléments d'amorçage partagés,
avait été prévu par la conception initiale. Il n'a pas été créé : l'architecture réellement
mise en œuvre place ces éléments dans chaque projet d'environnement. La simplification a été
jugée cohérente avec le principe P1 — un composant partagé non exploité n'aurait apporté que
de la complexité — et l'écart est enregistré comme tel.

### 5.1.2 Organisation du dépôt

Le dépôt d'infrastructure reproduit exactement le modèle en couches du chapitre 4 :

```
infra/
├── backend.tf              état distant : stockage objet dédié, un préfixe par environnement
├── providers.tf            versions de fournisseurs figées
├── main.tf                 composition des modules
├── envs/
│   ├── dev.tfvars          dimensionnement réduit
│   ├── staging.tfvars      topologie identique à la cible, tailles réduites
│   └── prod.tfvars         chaîne complète, rétention pleine
└── modules/
    ├── 00-foundation/      activation des services, politiques d'organisation, étiquetage
    ├── 01-edge/            DNS, répartiteur, certificats, règles de filtrage
    ├── 02-identity/        identités, autorisations, secrets, clés, fédération
    ├── 03-workloads/       services d'exécution (module réutilisable)
    ├── 04-network/         réseau privé, sous-réseaux, accès privé, sortie, pare-feu
    ├── 05-data/            base de données, entrepôt de supervision, requêtes planifiées
    ├── 06-ml/              service d'encodage, tâche d'enrichissement, planificateur
    └── 07-observability/   collecte filtrée, sondes, politiques d'alerte
```

**Un module par couche.** Le dépôt est le miroir exact du modèle L1–L7 : la documentation, le
code et l'architecture racontent la même histoire, dans le même ordre. Cette correspondance
n'est pas cosmétique — elle signifie qu'une exigence du chapitre 3, une couche du chapitre 4
et un répertoire du dépôt se désignent mutuellement sans ambiguïté.

Le module `00-foundation` mérite une mention. Il définit dans le code trois politiques
d'organisation qui, **si le projet est rattaché à une organisation GCP**, rendraient
structurellement impossibles trois classes d'erreurs : l'attribution d'une adresse publique
à la base de données, la création de clés d'identité de service, et l'exposition publique
d'un espace de stockage. **Ces politiques sont écrites dans le code mais inapplicables tant
que le projet n'est pas rattaché à une organisation GCP** (projet personnel). L'absence de
clé est vérifiée par l'inventaire (cf. test T7, section 6.2) et par la fédération d'identité
WIF ; l'absence d'adresse publique est vérifiée par la configuration Cloud SQL. L'écart
correspondant est consigné sous l'identifiant É7 (section 4.9).

### 5.1.3 Méthode de travail

La règle du principe P4 a été appliquée littéralement : aucune ressource n'a été créée depuis
l'interface graphique du fournisseur. La frontière retenue est la suivante.

| Décrit en code | Hors du code |
|---|---|
| Toute ressource durable : réseau, identités, base de données, entrepôt, services d'exécution, filtrage, collecte, alertes | **Valeurs** des secrets (les conteneurs sont créés en code, jamais les valeurs) |
| Schémas des tables de supervision et requêtes de détection planifiées | Données applicatives et contenu des tables |
| Politiques d'organisation, fédération d'identité | Actions de réponse à incident, tracées par les journaux d'audit |
| — | **Déploiement des images applicatives** (voir ci-dessous) |

La dernière ligne est le point de couture le plus délicat entre les deux chaînes de
livraison, et il mérite d'être explicité car c'est un problème que rencontre toute équipe
combinant infrastructure en code et livraison continue.

**Le problème.** La chaîne d'infrastructure (F7) crée le service d'exécution et en possède
la définition. La chaîne applicative (F3) met à jour l'image de ce service à chaque
livraison. Si les deux prétendent posséder le champ « image », chaque exécution de l'une
annule le travail de l'autre : une guerre d'états s'installe.

**La résolution retenue** : **la chaîne d'infrastructure possède le service, la chaîne
applicative possède l'image.** Le code d'infrastructure ignore explicitement les
modifications du champ image. La frontière est déclarée une fois, dans le code, plutôt que
découverte à chaque conflit.

---

## 5.2 Infrastructure en code

### 5.2.1 Sécurité de l'état

Le fichier d'état de l'infrastructure décrit la topologie complète du système. C'est donc une
donnée sensible, et il a été traité comme telle.

| Élément | Mise en œuvre | Raison |
|---|---|---|
| Emplacement | Stockage objet dédié, versionné, protection contre l'exposition publique activée | L'état contient la cartographie du système |
| Séparation | Un préfixe d'état par environnement | Borne le rayon d'impact d'une erreur d'application |
| Accès | Identité de la chaîne d'infrastructure et administrateur uniquement | Moindre privilège appliqué à l'infrastructure elle-même |
| Verrouillage | Verrou natif du stockage | Empêche deux applications concurrentes |
| Secrets | **Aucune valeur de secret dans le code ni dans l'état** | Un fichier d'état ne doit jamais devenir un coffre |

La dernière ligne est la plus importante et la plus souvent négligée. De nombreux projets
décrivent leurs secrets en code d'infrastructure, ce qui les fait mécaniquement apparaître en
clair dans le fichier d'état. Ici, le code crée les *conteneurs* de secrets ; les *valeurs*
sont injectées par un chemin distinct.

### 5.2.2 Détection de dérive

Le troisième bénéfice du principe P4 — la détection de dérive — a été mis en œuvre par une
planification régulière de l'opération de planification. Le raisonnement est simple : si le
code décrit exactement la réalité, alors une planification ne doit produire aucune
modification. **Un plan non vide sans modification de code correspondante signale une
dérive**, c'est-à-dire une modification effectuée hors du chemin autorisé. Les journaux
d'audit permettent alors d'identifier l'auteur et la nature du changement.

C'est le test T16 du programme de validation.

### 5.2.3 Deux limites constatées

Deux limites de cette approche ont été rencontrées et doivent être rapportées.

**Le fichier de verrouillage des versions n'est pas versionné.** Le fichier qui fige les
versions exactes des fournisseurs a été exclu du dépôt, et la validation en intégration
continue s'exécute sans initialisation complète. La conséquence est réelle : rien ne garantit
que la validation utilise exactement la même version de fournisseur que les applications
réellement effectuées. C'est une faiblesse de reproductibilité au cœur même du mécanisme
censé garantir la reproductibilité. Elle est identifiée et corrigeable.

**Le plan ne prédit pas toujours l'effet réel de l'application.** L'incident rapporté au
chapitre 4 — une application partiellement échouée ayant laissé l'état enregistrer une valeur
jamais appliquée — démontre que la planification ne capture pas les validations effectuées
par le fournisseur au moment de l'application. La procédure a été amendée en conséquence.

---

## 5.3 Chaîne de livraison applicative

La chaîne applicative comporte huit étapes, dont trois constituent des **portes bloquantes** :
si le contrôle échoue, la livraison s'arrête.

| # | Étape | Nature | La chaîne échoue si… |
|---|---|---|---|
| 1 | Authentification par identité fédérée | Contrôle d'accès | L'identité fédérée est refusée (dépôt ou branche non autorisés) |
| 2 | **Recherche de secrets** | **Porte bloquante** | Un secret est détecté dans le code ou l'historique |
| 3 | **Analyse statique du code** | **Porte bloquante** | Un défaut de sévérité élevée est identifié |
| 4 | Construction de l'image | Reproductibilité | La construction n'est pas reproductible (dépendances non figées) |
| 5 | **Analyse de vulnérabilité de l'image et des dépendances** | **Porte bloquante** | Une vulnérabilité critique est présente |
| 6 | Publication au registre unique | Chaîne d'approvisionnement | — |
| 7 | Déploiement **par étiquette immuable (SHA du commit)** | Intégrité | Un déploiement depuis une source d'images externe au registre est refusé |
| 8 | Alimentation de la boucle livraison ↔ détection | Enrichissement | — (n'est pas bloquant) |

### 5.3.1 L'ordre des portes n'est pas arbitraire

La recherche de secrets est placée **avant** l'analyse statique, et non après. La raison est
économique : un secret exposé est compromis dès l'instant où il est publié, indépendamment de
ce qui se passe ensuite. Le détecter à la première étape permet de déclencher immédiatement
la procédure de rotation. Le détecter en cinquième étape ne changerait rien au fait qu'il a
été exposé, mais retarderait la réaction.

### 5.3.2 Authentification sans secret

L'étape 1 réalise l'exigence EX7. La chaîne d'intégration ne détient aucune clé : elle
présente une assertion signée par la forge logicielle, vérifiée par le fournisseur cloud, et
reçoit en retour un jeton valable dix minutes.

Une condition d'attribut restreint cette fédération à un dépôt et une branche précis. Cette
condition a été resserrée en cours de projet : la version initiale acceptait un ensemble plus
large de références, ce qui aurait permis à une branche quelconque du dépôt de déclencher un
déploiement.

Le mécanisme prévu à l'origine — trois paliers d'identité avec promotion progressive entre
environnements — n'a pas été mis en œuvre. Une architecture plus simple a été retenue : une
fédération par projet d'environnement, une identité de déploiement unique par environnement,
et une isolation garantie par la séparation des projets plutôt que par une logique de
conditions à plusieurs niveaux. **L'isolation est ainsi structurelle et non conditionnelle** :
la chaîne d'un environnement ne peut pas atteindre un autre projet, quelle que soit la
condition d'attribut évaluée.

### 5.3.3 Trois refus vérifiables

Une chaîne de livraison qui n'a jamais rien bloqué ne prouve rien. Trois cas d'échec ont donc
été préparés comme éléments de démonstration, et constituent les tests T10, T8 et une partie
de T9 du chapitre 6 :

1. **Un secret factice délibérément versionné** — la chaîne doit s'arrêter à l'étape 2.
2. **Un défaut de code délibérément introduit** — la chaîne doit s'arrêter à l'étape 3.
3. **Une image de base vulnérable connue** — la chaîne doit s'arrêter à l'étape 5.

Un quatrième cas concerne la chaîne d'infrastructure et est décrit ci-dessous.

---

## 5.4 Chaîne de provisionnement de l'infrastructure

La seconde chaîne, distincte de la première, comporte cinq étapes.

| # | Étape | La chaîne échoue si… |
|---|---|---|
| 1 | Vérification du format et validation syntaxique | Le code est mal formé ou invalide |
| 2 | **Analyse de sécurité de la configuration (scan IaC)** | Une configuration dangereuse est détectée (espace de stockage public, base de données avec adresse publique, identité sur-privilégiée) |
| 3 | Publication du plan de modification, lisible, en commentaire de la demande de fusion | — (revue humaine) |
| 4 | Application manuelle par l'administrateur (`terraform apply`) | Écart entre le plan approuvé et l'application |

**Clarification importante (C13).** Les étapes 3 et 4 ne sont pas automatisées : le plan
est publié en commentaire de la demande de fusion pour revue humaine, et l'application est
exécutée manuellement par l'administrateur. L'approbation est humaine par construction, non
outillée. Le scan IaC (étape 2) est le seul élément entièrement automatisé de cette chaîne.

Deux principes gouvernent cette chaîne.

**Le plan est revu comme du code.** L'infrastructure ne change jamais sans une différence
lisible et approuvée. L'étape 4 réalise l'exigence EX18 : toute modification élargissant des
droits passe nécessairement par une approbation.

**L'application est la seule voie d'écriture.** Toute modification effectuée par un autre
chemin devient une dérive, détectée à la planification suivante (section 5.2.2).

L'étape 2 mérite une remarque : elle a été réalisée avec l'outil déjà employé pour l'analyse
des images, utilisé dans un mode différent. **Aucun outil n'a été ajouté.** Ce détail illustre
concrètement le principe P1 : la capacité recherchée existait déjà dans la chaîne, il
suffisait de l'employer.

Le quatrième refus vérifiable est ici : une ressource volontairement mal configurée — un
espace de stockage exposé publiquement — est bloquée à l'étape 2, avant toute création.
**C'est le bénéfice le plus caractéristique de l'infrastructure en code** : la faute est
détectée avant que la ressource n'existe, et non par un audit après coup.

---

## 5.5 La chaîne de détection

### 5.5.1 Collecte filtrée

La collecte (flux F4) rassemble les journaux de toutes les couches vers l'entrepôt de
supervision : journaux d'audit du fournisseur, journaux des services d'exécution, verdicts du
filtrage applicatif.

**Le filtrage est appliqué à la source**, au moment de la collecte, et non après stockage. Ce
choix répond directement au besoin BNF3 : l'ingestion des journaux est le poste de coût
dominant d'une supervision de sécurité. Les contrôles de disponibilité et les réponses
statiques réussies sont exclus dès la collecte — ils représentent un volume important et une
valeur de détection nulle.

**Limite corrigée.** La journalisation des règles de refus du pare-feu et de la passerelle
de sortie a été activée le 19/08/2026 (correction de l'écart É1 du chapitre 4). Les
journaux alimentent désormais la détection des tentatives de mouvement latéral.

### 5.5.2 Modèle de données de la supervision

La chaîne de traitement comporte quatre étapes représentées par des tables distinctes.

```
   journaux bruts     partitionnés par jour, expiration automatique
        │             écriture réservée à la collecte
        │
        │  règles de détection versionnées, exécutées sur une fenêtre glissante
        ▼
   détections         alertes normalisées : horodatage, entité, source, message, règle
        │             écriture réservée aux requêtes planifiées
        │
        │  tâche d'enrichissement : encodage puis recherche vectorielle
        ▼
   enrichissement     rattachement à une technique d'attaque, avec score de similarité
        │             écriture réservée à la tâche d'enrichissement
        ▼
   scoring et présentation
```

La séparation en quatre tables n'est pas une commodité de modélisation. **C'est la mise en
œuvre de l'exigence EX11** : chaque table a un et un seul écrivain autorisé, et aucun
composant d'analyse ne peut écrire dans une table située en amont de lui. Un attaquant ayant
compromis la tâche d'enrichissement ne peut pas effacer la détection qui l'a signalé.

Une table de vecteurs de référence complète l'ensemble : environ huit cent soixante-dix
vecteurs correspondant aux descriptions de techniques d'attaque, chargés hors ligne et en
lecture seule, avec un index vectoriel.

### 5.5.3 Traduction des règles de détection

Le chapitre 2 a établi qu'il n'existe pas de convertisseur automatique depuis le format
neutre de règles de détection vers le dialecte de l'entrepôt retenu. **La traduction a donc
été réalisée manuellement**, selon une méthode systématique.

Le gabarit de traduction est le suivant :

| Élément de la règle source | Traduction |
|---|---|
| Source de journal | Clause de filtrage sur le champ de source |
| Condition de sélection | Clause de restriction combinant les critères |
| Fenêtre temporelle | Restriction sur la partition, alignée sur la cadence d'exécution |
| Agrégation (seuils, comptages) | Regroupement avec condition sur le résultat |
| Identifiant de règle et technique associée | Colonnes constantes insérées dans le résultat |
| Faux positifs connus | Clauses d'exclusion documentées en commentaire |

**Ce que cette traduction manuelle coûte.** Chaque règle demande une écriture, une
vérification sur données réelles et une maintenance lors de toute évolution du schéma de
journaux. Le volume de règles réalistement maintenable par une personne est donc limité, et
ce plafond détermine mécaniquement la couverture de détection atteignable. Cette limite est
une conséquence directe et prévisible du choix d'architecture D04 ; elle a été anticipée au
chapitre 2 (verrou V2) et elle est mesurée au chapitre 6.

**Ce que cette traduction apporte.** Les règles sont du code : versionnées, revues,
comparables entre versions, et déployées par la chaîne d'infrastructure comme n'importe quelle
autre ressource. Une règle de détection n'est pas une configuration saisie dans une interface
que personne ne sait plus justifier six mois plus tard.

---

## 5.6 La couche d'enrichissement sémantique

C'est la couche la plus spécifique du projet, et celle dont l'état d'avancement doit être
rapporté avec le plus de précision.

### 5.6.1 Préparation du modèle

Le modèle retenu est un modèle de représentation de phrases spécialisé en cybersécurité,
identifié au chapitre 2. Sa mise en production a suivi quatre étapes, chacune motivée par une
préoccupation de sécurité ou de coût.

| Étape | Mise en œuvre | Motivation |
|---|---|---|
| Figement de la version | Révision épinglée par identifiant de validation | Reproductibilité : le modèle utilisé est exactement celui qui a été évalué |
| Format des poids | Format refusant l'exécution de code à la lecture | Les poids d'un modèle sont un artefact tiers non fiable |
| Vérification d'intégrité | Empreintes cryptographiques consignées et vérifiées à la construction | Chaîne d'approvisionnement |
| Optimisation | Quantisation int8 testée, comparaison de fidélité exécutée, **rejetée** (0/5 correspondances de premier rang) ; modèle livré en fp32 ONNX (`attack-bert-onnx-fp32@v1.0`) | Exécution sur processeur généraliste, sans accélérateur : condition de la contrainte de coût |

La troisième et la quatrième étape méritent un commentaire.

**La quantisation int8 a été testée et rejetée.** La comparaison de fidélité a montré zéro
correspondance de premier rang entre les représentations quantisées et le modèle d'origine.
Le modèle a donc été livré en précision fp32 (ONNX), sans accélération matérielle. Ce
choix est documenté comme un arbitrage coût/fidélité : la perte de précision était
inacceptable pour un modèle dont la valeur réside dans la finesse des représentations
sémantiques.

**Les poids sont embarqués dans l'image**, jamais téléchargés à l'exécution. Un téléchargement
au démarrage introduirait une dépendance externe dans le chemin critique et un point
d'injection dans la chaîne d'approvisionnement.

### 5.6.2 Service d'encodage

Le service transforme un texte en vecteur numérique. Sa configuration réalise plusieurs
exigences simultanément :

- **Aucune sortie réseau** : le composant ne peut servir de point de rebond (exigence EX14,
  scénario SO17).
- **Entrée interne uniquement**, appel authentifié obligatoire : il n'est joignable ni depuis
  l'extérieur, ni depuis le tableau de bord.
- **Réduction à zéro instance hors traitement** : la contrainte de coût prime sur la latence,
  ce qui produit un effet secondaire important décrit en section 5.9.
- **L'image traverse la même chaîne de contrôle** que tout autre code du projet.

### 5.6.3 Tâche d'enrichissement

La tâche s'exécute à intervalle fixe. Elle lit les détections non encore enrichies, les
transmet au service d'encodage, exécute une recherche vectorielle contre la table de
référence, et écrit le résultat dans la table d'enrichissement.

Deux paramètres sont déclarés explicitement dans la requête plutôt que codés dans un
programme :

- **le seuil de similarité**, en deçà duquel aucun rattachement n'est effectué ;
- **le nombre de candidats retenus**, fixé à trois plutôt qu'à un.

Le choix de trois candidats plutôt qu'un est délibéré : il permet à l'analyste de voir les
alternatives et leur écart de score, donc d'exercer un jugement, au lieu de recevoir une
affirmation unique sans contexte.

La déclaration explicite du seuil est une décision d'auditabilité : le seuil est lisible dans
la requête, modifiable sans redéploiement, et son évolution est visible dans l'historique du
code.

### 5.6.4 État d'avancement réel de la couche

Cette sous-section est celle qui demande le plus de précision, car l'écart entre la conception
et la réalisation y est le plus important.

| Composant | Prévu | Réalisé | Statut |
|---|---|---|---|
| Préparation et figement du modèle | Oui | Oui | **Réalisé et vérifié** |
| Service d'encodage sans sortie réseau | Oui | Oui | **Réalisé et vérifié** |
| Table de vecteurs de référence et index | Oui | Oui | **Réalisé et vérifié** |
| Tâche d'enrichissement et recherche vectorielle | Oui | Oui | **Réalisé** |
| Cadence d'exécution | Toutes les 5 minutes | Toutes les 15 minutes | **Écart assumé** — arbitrage coût contre délai de détection |
| Cache par empreinte d'entrée | Oui | L'empreinte est calculée et enregistrée, mais jamais utilisée pour éviter un ré-encodage | **Prévu, non réalisé** — conséquence : coût de calcul supérieur au nécessaire |
| Vue de corrélation entre alertes | Oui | Non | **Prévu, non réalisé** |
| **Utilisation de l'enrichissement dans le score d'incident** | Oui | **Non** — le score est recalculé à partir des seules détections issues des règles, sans jointure avec la table d'enrichissement | **Écart majeur** |

**Le dernier écart doit être énoncé clairement : à ce jour, la couche d'enrichissement
produit ses résultats, mais ceux-ci n'alimentent pas le score d'incident présenté à
l'analyste.** L'enrichissement est calculé, stocké et consultable ; il n'est pas encore
intégré au calcul de priorité.

Trois remarques s'imposent.

**Premièrement, cet écart ne remet pas en cause la démonstration technique.** La chaîne
complète — détection, encodage, recherche vectorielle, rattachement — fonctionne et peut être
mesurée. C'est cette chaîne que le chapitre 6 évalue.

**Deuxièmement, il limite la portée de l'affirmation.** Il n'est pas possible de soutenir que
l'enrichissement sémantique améliore la priorisation des incidents, puisque la priorisation ne
l'utilise pas. Ce qui peut être soutenu, et mesuré, est que le rattachement automatique
fonctionne avec une certaine précision et un certain coût.

**Troisièmement, la correction est identifiée et bornée.** Il s'agit d'une jointure entre deux
tables existantes dans le calcul de score. L'écart relève du temps disponible, non d'un
obstacle de conception.

---

## 5.7 API et interface de l'analyste

L'interface de supervision est le point où le dispositif devient utilisable par un être
humain. Elle repose sur deux composants : une interface web et une API qui l'alimente.

**Le principe de séparation est strict** : l'interface n'accède jamais directement à
l'entrepôt de supervision ni au service d'encodage. Tout passe par l'API, qui applique le
contrôle d'autorisation. Cette contrainte réalise les exigences EX5 et EX6, et évite une
erreur fréquente consistant à donner à une interface web les droits de lecture d'un entrepôt
de données.

Trois rôles sont définis :

| Rôle | Droits |
|---|---|
| **Administrateur** (`admin`) | Gestion de la plateforme, configuration des alertes |
| **Lecteur/Analyste** (`viewer`) | Lecture des incidents, de la matrice de couverture, des vulnérabilités priorisées ; enregistrement d'un verdict |
| **Service** (`service`) | Identité technique pour les tâches automatisées (enrichissement, détection planifiée) |

Le rôle d'analyste illustre l'exception prévue au principe P3 : l'analyste peut **écrire un
verdict**, mais uniquement dans une table qui lui est propre. Il n'écrit jamais dans les
tables de preuve. Le verdict humain est une donnée nouvelle qui s'ajoute aux preuves ; il ne
les modifie pas.

**Le lien vers les procédures d'incident** est ce qui rend le dispositif exploitable par une
personne seule. Chaque famille de technique d'attaque est associée à une procédure, accessible
directement depuis l'alerte. L'analyste ne reçoit pas seulement l'information « ceci
ressemble à telle technique », mais aussi « voici ce qu'il faut vérifier et dans quel ordre ».

Les indicateurs affichés incluent délibérément **le taux d'alertes non rattachées**. Afficher
ce que le système ne sait pas interpréter est une décision de conception assumée : un
indicateur de couverture qui n'affiche que les succès est un indicateur trompeur.

---

## 5.8 La boucle entre livraison et détection

C'est l'apport du projet, correspondant au flux F6, à la question Q6 du chapitre 1 et au
verrou V4 du chapitre 2.

### 5.8.1 Principe

Une chaîne de livraison produit une liste de vulnérabilités, classées par gravité théorique.
Cette gravité est calculée indépendamment du contexte : elle ne sait pas si quelqu'un tente
actuellement d'exploiter cette classe de faiblesse contre ce système précis.

Une chaîne de détection produit une liste de techniques d'attaque observées. Elle ne sait pas
quelles vulnérabilités le système présente.

**Les deux informations existent, dans le même entrepôt, et ne se parlent pas.** La boucle F6
les rapproche : les vulnérabilités détectées à la livraison sont encodées par le même modèle
que les alertes, puis rapprochées des techniques effectivement observées sur une fenêtre
récente. Une vulnérabilité de gravité moyenne, mais correspondant à une technique observée
cette semaine, remonte devant une vulnérabilité de gravité élevée sans rapport avec l'activité
constatée.

### 5.8.2 Réalisation

L'étape 8 de la chaîne applicative exporte le résultat de l'analyse de vulnérabilité vers une
table dédiée de l'entrepôt. L'identité de la chaîne d'intégration dispose d'un droit
d'écriture **limité à cette seule table** — portée resserrée en cours de projet après
constatation qu'elle était plus large que nécessaire.

Le rapprochement s'effectue ensuite par la même mécanique que l'enrichissement des alertes :
encodage du texte descriptif, recherche vectorielle contre la table de référence, jointure
avec les techniques observées.

**Cette étape n'est pas bloquante.** Elle n'empêche aucune livraison : elle produit une
information d'aide à la décision. C'est cohérent avec sa nature — elle ne réduit pas un
risque, elle améliore un ordre de traitement.

### 5.8.3 Ce qui reste à démontrer

L'utilité de cette boucle ne peut être affirmée sur la base de son fonctionnement technique.
Elle suppose de montrer que l'ordre de priorité produit **diffère** de l'ordre par gravité
théorique, et que cette différence est pertinente. C'est l'objet d'une mesure du chapitre 6.

Il faut être clair sur le point suivant : si l'ordre produit était identique à l'ordre par
gravité, la boucle n'apporterait rien, et il faudrait le dire. Cette mesure est donc un test
qui peut échouer, ce qui est précisément ce qui lui donne sa valeur.

---

## 5.9 Accueil d'un second locataire : preuve vivante et limites

Le besoin BF13 exigeait que le socle puisse accueillir une nouvelle application sans
reconception. Cette généralisation a été réalisée en cours de projet par l'accueil du second
locataire **ELSON** (application de collecte vocale participative), hébergé en environnement
de recette le **07/08/2026**.

### 5.9.1 Mise en œuvre

Le module d'exécution des services applicatifs, initialement écrit pour l'application pilote
MENAL, a été rendu paramétrique. Pour ELSON, les éléments suivants ont été instanciés :

- **Compte de service dédié** avec deux rôles : client base de données et écriture de
  journaux.
- **Base de données et utilisateur dédiés**, avec DNS et certificat gérés.
- **Six alertes et une sonde** de surveillance configurées.
- **Secrets et espace média chiffrés** par clé gérée depuis le 08/08/2026.
- **Contrôle quotidien d'isolation SQL** (job automatisé + alerte).

Le **19/08/2026**, une connexion croisée entre les deux locataires a été tentée en direct
et refusée : **6/6 vérifications d'isolation ont échoué** comme prévu, confirmant que
les données d'un locataire ne sont pas accessibles depuis l'autre.

### 5.9.2 Limites

L'isolation réalisée porte sur l'**identité**, les **secrets** et la **base de données**.
Elle ne porte **pas sur le réseau** : les deux locataires partagent le VPC, le connecteur
de sortie et l'instance SQL. La règle interne `allow_internal` est trop large pour
sécuriser correctement les communications entre locataires. De plus :

- La clé de locataire est **partielle** dans certaines tables du SIEM (champs non
  isolés).
- Le module de base de données n'est **pas réinstanciable** (un même identifiant de
  ressource ne peut pas être détruit et recréé).
- **Seuil à franchir** : avant un troisième locataire, l'isolation réseau doit être
  réalisée par identité de service et par règles de pare-feu virtualisées.

> **Note (C07).** Cette section constitue la preuve vivante que le socle est réutilisable.
> Les limites documentées sont autant de points d'amélioration pour la phase post-PFE.

---

## 5.10 Conduite du projet

### 5.10.1 Déroulement et tâches quotidiennes

Le projet s'est déroulé sur une période de seize semaines, du 20 janvier au 30 mai 2026.
Le rythme de travail a été divisé en deux phases distinctes : une phase de conception et
d'analyse (semaines 1 à 6), suivie d'une phase de réalisation et d'intégration (semaines 7
à 16).

**Activités récurrentes.** Un point hebdomadaire avec l'encadrant de l'entreprise avait lieu
le lundi matin. Ce point servait à faire le bilan de la semaine précédente, à identifier les
blocages et à planifier les tâches de la semaine courante. Un journal de bord, tenu dans le
dépôt Git, consignait chaque jour les avancées, les difficultés et les décisions prises.

**Phase de conception (semaines 1–6).** Cette phase a mobilisé l'essentiel du temps sur
l'audit de l'existant, l'état de l'art, l'analyse des menaces (EBIOS/STRIDE) et la
conception de l'architecture. Les livrables produits étaient le rapport d'audit, le modèle
de menaces, la matrice de traçabilité et le schéma d'architecture.

**Phase de réalisation (semaines 7–16).** Cette phase a alterné entre l'écriture de code
(Terraform, GitHub Actions, FastAPI) et les tests d'intégration. Les itérations suivaient un
cycle d'une à deux semaines : infrastructure d'abord, puis chaîne de livraison, puis
détection, puis enrichissement. Chaque itération se terminait par une démonstration à
l'encadrant.

### 5.10.2 Difficultés rencontrées

Quatre incidents majeurs ont jalonné la phase de réalisation, chacun illustrant une catégorie
de difficulté différente.

**Incident 1 — Estimation des performances du modèle (semaine 10).** Le temps de cold start
du service d'enrichissement sémantique a été estimé à quelques secondes, puis mesuré à
**vingt-sept secondes en moyenne** (pic à quatre-vingt-quatorze secondes). Cette erreur
d'estimation de plus d'un ordre de grandeur a conduit à revoir le dimensionnement du service
et à adapter la fréquence de l'enrichisseur. La mesure a été retenue contre l'estimation
initiale.

**Incident 2 — État Terraform désynchronisé (semaine 12).** Une opération `terraform apply`
partiellement échouée a laissé l'état enregistré dans le bucket GCS diverger de la réalité
infrastructure. La dérive a été détectée par comparaison explicite (`terraform plan` montrant
des changements là où aucun n'était attendu) et corrigée par un rafraîchissement ciblé. Cette
expérience a renforcé la règle : après toute application partiellement échouée, vérifier
l'état contre la réalité.

**Incident 3 — Accumulation de déchets dans BigQuery (semaine 14).** Les tests de
détection ont généré des données dans les tables de preuve sans nettoyage régulier. En
quelques jours, la table `detections` a atteint un volume qui ralentissait les requêtes
d'enrichissement. Un job de rétention a été ajouté, et la discipline de nettoyage a été
intégrée aux procédures.

**Incident 4 — Porte SAST en faux vert (02/08 → 19/08).** La porte d'analyse statique
Semgrep fonctionnait silencieusement en mode « toujours vert » pendant dix-sept jours :
elle s'exécutait mais ne signalait jamais de défaut, quel que soit le code soumis. Le
problème venait de l'absence du drapeau `--error` dans la commande Semgrep, qui masquait
les constats et retournait un code de sortie 0 même en présence de vulnérabilités. La
correction (`semgrep scan --error`) a été appliquée le 19/08/2026 et vérifiée en CI réelle
lors de la PR #17 : **74 constats bloquants** ont été levés, confirmant que la porte
fonctionne désormais correctement. La leçon est qu'une porte de contrôle doit être testée
en échec autant qu'en succès.

*Ces quatre incidents sont détaillés dans les sections 5.2.2, 5.9.3, 5.5.1 et 5.3.1
respectivement.*

### 5.10.3 Changements apportés aux objectifs initiaux

Deux ajustements significatifs du périmètre ont été décidés en cours de projet, après
discussion avec l'encadrant.

**Objectif retiré — Journalisation des refus réseau.** L'activation de la journalisation
des refus pare-feu dans Cloud Logging a été initialement prévue. Elle a été reportée car
elle nécessitait une configuration avancée du VPC qui dépassait le cadre du projet. Cet
écart est documenté en section 4.8 et sera traité en phase de production.

**Objectif ajouté — Généralisation du socle.** Le besoin d'accueillir une seconde
application a émergé en cours de projet (section 5.9). Le module d'infrastructure a été
rendu paramétrique, ce qui a nécessité un investissement supplémentaire mais démontre la
réutilisabilité du socle.

**Objectif maintenu avec réserve — Enrichissement sémantique.** La couche d'enrichissement
a été réalisée et fonctionne. Cependant, son intégration au score d'incident n'est pas
encore opérationnelle : le score est calculé dans l'API mais ne tient pas compte de la
similarité sémantique. Cet écart est explicitement mentionné en section 6.8.

### 5.10.4 Planning de travail

> **Figure 3** — Diagramme de Gantt du projet : prévisionnel vs réalisé.
>
> *(insérer ici un diagramme de Gantt sur une page complète, montrant les quinze
> semaines de travail avec les phases de conception, réalisation et validation, et les
> écarts entre le planning initial et le déroulement réel)*

Le diagramme ci-dessus fait apparaître trois écarts notables entre le prévisionnel et le
réalisé : le dépassement de la phase de réalisation de l'enrichissement sémantique (+2
semaines), le report de la journalisation réseau (prévue semaine 11, repournée à la
phase post-PFE), et l'ajout non prévu de la généralisation du socle (semaine 14).

---

## Conclusion du chapitre

Ce chapitre a rendu compte de ce qui a été construit. L'infrastructure est intégralement
décrite en code, organisée en modules reproduisant le modèle en couches du chapitre 4.
Deux chaînes de livraison (applications et infrastructure) appliquent quatre portes de
contrôle bloquantes. La chaîne de détection repose sur un entrepôt de données alimenté
par une collecte filtrée à la source, avec une couche d'enrichissement sémantique
fonctionnant sans sortie réseau.

**Huit écarts ont été recensés** : deux corrigés (É1, É3), un en cours de retrait (É2),
cinq assumés (É4–É8). Quatre incidents d'ingénierie ont été documentés avec diagnostic et
correction. Le planning réel fait apparaître des écarts avec le prévisionnel, notamment
le report de la journalisation réseau.

Le chapitre suivant confronte l'ensemble à la mesure : vingt tests de validation, couverture
de détection, évaluation de l'enrichissement sémantique, objectifs de service, coût réel
et limites.
