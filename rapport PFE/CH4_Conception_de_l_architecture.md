# Chapitre 4 — Conception de l'architecture

---

## Introduction du chapitre

Ce chapitre présente l'architecture qui réalise les vingt exigences de sécurité dérivées du chapitre 3. Une architecture se juge à la cohérence de son modèle, la justification de ses choix et la transparence de ses écarts — c'est l'ordre suivi ici.

Les sections couvrent les principes directeurs (4.1), les vues statique et dynamique (4.2–4.3), le détail des couches (4.4), le plan d'identité comme mécanisme de segmentation (4.5), la vérification de couverture des exigences (4.6), le registre des décisions (4.7), les composants écartés (4.8) et les écarts constatés (4.9). Documenter les refus et les écarts distingue une architecture délibérée d'une architecture accumulée.

Le chapitre suivant décrit la réalisation concrète de cette architecture.

---

## 4.1 Principes directeurs

Quatre principes ont guidé l'ensemble des décisions. Ils sont énoncés ici parce qu'ils
permettent de comprendre chaque choix ultérieur — et parce qu'ils rendent les décisions
contestables, ce qui est une qualité.

### P1 — Tout composant doit justifier son existence

Un composant ajouté est un composant à configurer, à mettre à jour, à surveiller et à payer.
Dans un contexte où une seule personne exploite le système, chaque composant supplémentaire
dégrade la sécurité réelle même s'il améliore la sécurité théorique.

La règle appliquée est la suivante : **un composant n'est retenu que s'il couvre une menace
identifiée au chapitre 3 qu'aucun composant existant ne couvre déjà.** La section 4.8
recense sept composants évalués selon cette règle puis écartés.

### P2 — L'identité est le plan de contrôle, pas une couche

Dans un modèle périmétrique, la segmentation est réalisée par le réseau : des zones, des
pare-feux entre les zones. Dans le modèle retenu, elle est réalisée par l'identité : chaque
charge de travail possède sa propre identité, et ses droits définissent ce qu'elle peut
atteindre.

La conséquence est structurelle et sera développée en section 4.2.2 : **l'identité ne peut
pas être dessinée comme une couche parmi d'autres.** Une couche est traversée ; un plan de
contrôle est consulté à chaque saut. Représenter l'identité comme une couche latérale
reviendrait à retomber, sous une autre forme, dans le modèle périmétrique.

### P3 — Un moteur de détection ne doit jamais pouvoir modifier les preuves qu'il analyse

Ce principe traduit directement la valeur métier VM5 et l'exigence EX11 du chapitre 3. Il a
des conséquences précises sur la matrice d'autorisations (section 4.5) et constitue l'un des
tests de validation les plus discriminants du chapitre 6.

Sa portée dépasse le composant d'enrichissement. Il s'applique également au tableau de bord
de l'analyste : celui-ci consulte les preuves, il ne les modifie pas. Une exception unique
et explicite est prévue — l'enregistrement du verdict humain, qui est une donnée nouvelle et
non une modification d'une preuve existante.

### P4 — Rien n'existe dans l'infrastructure qui n'existe d'abord dans le code

Ce principe répond à la carence C2 et au point bloquant B5 de l'audit. Il produit trois
effets, dont le troisième est le moins évident et le plus utile :

1. **Reproductibilité** : un environnement se reconstruit intégralement depuis le dépôt.
2. **Contrôle avant existence** : la configuration d'infrastructure peut être analysée
   statiquement *avant* que la ressource ne soit créée.
3. **Détection de dérive** : toute modification effectuée hors du code devient visible par
   comparaison.

Les commandes interactives sont réservées aux opérations d'exploitation ponctuelles —
rotation d'un secret, réponse à un incident — et jamais au provisionnement.

---

## 4.2 Vue logique : le modèle en couches

### 4.2.1 Structure retenue

L'architecture est organisée en sept couches numérotées, dont deux sont des plans
transversaux.

| Couche | Nom | Rôle | Nature |
|---|---|---|---|
| **L1** | Périmètre d'entrée | Point d'entrée unique, filtrage applicatif, limitation de débit | Couche |
| **L2** | **Identité et sécurité** | Identités, autorisations, secrets, clés, fédération de la chaîne d'intégration | **Plan transversal** |
| **L3** | Charges de travail | Exécution des applications, de l'API et du tableau de bord | Couche |
| **L4** | Réseau | Réseau privé, accès privé aux données, sortie contrôlée | Couche |
| **L5** | Données | Base de données applicative et entrepôt de supervision | Couche |
| **L6** | Enrichissement sémantique | Modèle de représentation, tâche d'enrichissement, recherche vectorielle | Couche |
| **L7** | **Observabilité** | Collecte, supervision, alertes, procédures | **Plan transversal** |

Cette numérotation résulte d'une révision de la conception initiale, qui présentait deux
défauts : une numérotation non ordonnée comportant deux couches portant le même numéro, et
l'absence de la couche d'enrichissement. Un modèle en couches n'a de valeur que si sa
numérotation est unique et ordonnée : c'est ce qui permet à la documentation, au code et aux
tests de désigner la même chose.

### 4.2.2 Pourquoi deux plans transversaux

C'est le point de conception le plus structurant du chapitre, et il mérite d'être développé.

**Le plan d'identité (L2).** Dans la conception initiale, l'identité était dessinée comme un
bloc latéral pointant vers les charges de travail. Cette représentation sous-entend que
l'identité protège les charges de travail — et seulement elles. Elle est fausse dans une
architecture Zero Trust : l'identité est vérifiée à *chaque* saut, du périmètre vers la
charge de travail, de la charge de travail vers les données, de la chaîne d'intégration vers
le registre d'images, de la tâche d'enrichissement vers le modèle. Représenter l'identité
comme une couche latérale revient à admettre qu'il existe des chemins où elle n'est pas
consultée — ce qui est exactement la définition de la confiance implicite.

**Le plan d'observabilité (L7).** Dans la conception initiale, l'observabilité était la
dernière couche, isolée en bas du schéma. Ce placement produisait une incohérence
immédiatement visible : l'entrepôt de supervision, situé en L5, n'avait aucune source de
données. Le lien manquant est le flux de collecte, qui part de *toutes* les couches et
alimente L5. Sans ce lien, le bloc de supervision est un composant sans entrée.

Ces deux corrections illustrent une règle de lecture des schémas d'architecture : **un
schéma dans lequel un composant n'a aucune entrée est un schéma incomplet, quelle que soit
la qualité des composants choisis.**

### 4.2.3 Représentation

```
                    UTILISATEURS                      ANALYSTE / ADMIN
                         │  F1                             │  F1
   ┌─────────────────────▼─────────────────────────────────▼──────────────────┐
   │ L1  PÉRIMÈTRE — DNS · répartiteur HTTPS · filtrage applicatif            │
   │     règles WAF en blocage direct · limitation de débit · géo-restriction │
   └──────────┬──────────────────────────────────────┬────────────────────────┘
              │                                      │
   ┌──────────▼──────────────────┐   ┌───────────────▼─────────────────────────┐
   │ L3  Application hébergée    │   │ L3  API de supervision · Tableau de bord │
   │     entrée : répartiteur    │   │     entrée : répartiteur · rôles JWT     │
   └──────────┬──────────────────┘   └───────────────┬─────────────────────────┘
              │  F2                                  │  F2
   ┌──────────▼──────────────────────────────────────▼────────────────────────┐
   │ L4  RÉSEAU — réseau privé · refus par défaut · accès privé aux données    │
   │     sortie contrôlée et limitée à des destinations connues                │
   └──────────┬───────────────────────────────────────┬───────────────────────┘
              │                                       │  interne uniquement
   ┌──────────▼──────────────────┐   ┌────────────────▼────────────────────────┐
   │ L5  Base de données         │   │ L6  Modèle d'encodage (sans sortie)      │
   │     adresse privée · PITR   │   │     tâche d'enrichissement planifiée     │
   ├─────────────────────────────┤   └────────────────┬────────────────────────┘
   │ L5  Entrepôt de supervision │◄───────────────────┘  F5
   │  journaux → détections →    │
   │  enrichissement → scoring   │
   └──────────▲──────────────────┘
              │  F4 (collecte filtrée)
   ┌──────────┴───────────────────────────────────────────────────────────────┐
   │ L7  OBSERVABILITÉ (plan transversal) — collecte depuis toutes les couches │
   │     supervision · politiques d'alerte · procédures d'incident             │
   └───────────────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────────────┐
   │ L2  IDENTITÉ ET SÉCURITÉ (plan transversal) — consulté à chaque saut       │
   │     une identité par charge de travail · droits minimaux · secrets · clés  │
   │     identité fédérée de la chaîne d'intégration, sans clé exportée         │
   └───────────────────────────────────────────────────────────────────────────┘
```

> **Figure 4.1** — Modèle en couches et plans transversaux.

---

## 4.3 Vue dynamique : les sept flux

La vue en couches décrit ce qui existe ; la vue en flux décrit ce qui se passe. Les sept
flux constituent le vocabulaire commun de toute la documentation : le chapitre 3 les a
utilisés pour l'analyse de menace, le chapitre 5 pour la réalisation, le chapitre 6 pour les
tests.

| Flux | Chemin | Nature | Exigences concernées |
|---|---|---|---|
| **F1** | Utilisateur → périmètre → filtrage → charge de travail | Requête applicative | EX1, EX2, EX3 |
| **F2** | Charge de travail → réseau privé → base de données | Accès aux données | EX4, EX5, EX6 |
| **F3** | Dépôt → chaîne d'intégration → registre → déploiement | Livraison logicielle | EX7 à EX10 |
| **F4** | Toutes les couches → collecte → entrepôt de supervision | Télémétrie de sécurité | EX11, EX12, EX13 |
| **F5** | Planificateur → enrichissement → modèle → recherche vectorielle | Détection et enrichissement | EX11, EX14, EX15 |
| **F6** | Vulnérabilités de la livraison → encodage → rapprochement → priorisation | Boucle livraison ↔ détection | — (apport) |
| **F7** | Dépôt → plan → contrôle → approbation → application | Provisionnement | EX16, EX17, EX18 |

**Le flux F6 est le point d'originalité de l'architecture.** Il relie deux ensembles
habituellement disjoints : la chaîne de livraison, qui produit une liste de vulnérabilités
classées par gravité théorique, et la chaîne de détection, qui observe les techniques
d'attaque effectivement dirigées contre le système. Le rapprochement des deux permet de
réordonner les correctifs : une vulnérabilité de gravité moyenne, mais correspondant à une
technique observée en production cette semaine, devient prioritaire sur une vulnérabilité de
gravité élevée sans rapport avec l'activité constatée.

Ce flux ne couvre aucune exigence de sécurité du chapitre 3 : il ne réduit pas un risque, il
améliore une décision. C'est pour cette raison qu'il est présenté comme un apport et non
comme un contrôle.

---

## 4.4 Conception par couche

Chaque couche est décrite selon le même gabarit : composants, contrôles apportés, exigences
couvertes, et point de vigilance.

### L1 — Périmètre d'entrée

| Élément | Conception |
|---|---|
| **Composants** | Zone DNS publique, répartiteur de charge applicatif global, certificats gérés, moteur de filtrage applicatif |
| **Exposition** | HTTPS exclusivement ; redirection du trafic clair. Deux domaines distincts : applicatif et supervision |
| **Filtrage applicatif** | Cinq familles de règles préconfigurées, en **blocage direct** et non en observation |
| **Restriction géographique** | Autorisation limitée aux zones où se trouvent les utilisateurs et l'entreprise, avec exceptions pour les sondes de disponibilité |
| **Limitation de débit** | **Deux niveaux** : un seuil strict sur les seuls chemins d'authentification, avec bannissement temporaire ; un seuil global élevé contre la saturation |
| **Exigences couvertes** | EX1, EX2, EX3 |

Deux points de conception méritent d'être explicités.

**Le mode blocage plutôt qu'observation.** Un moteur de filtrage en mode observation
enregistre ce qu'il aurait bloqué sans rien bloquer. C'est utile pour calibrer les règles,
mais un dispositif laissé indéfiniment en observation ne protège de rien. Le passage en
blocage direct est une décision assumée, dont la contrepartie — le risque de faux positifs —
est mesurée au chapitre 6.

**La limitation de débit à deux niveaux.** Un seuil unique appliqué à l'ensemble du trafic
crée un problème que la conception initiale n'avait pas anticipé : lorsque le tableau de bord
appelle l'API, les deux services partagent une adresse de sortie ; un seuil serré déclenche
alors un blocage collectif à partir de l'activité d'un seul utilisateur. La séparation en
deux niveaux — strict sur l'authentification, permissif ailleurs — résout ce problème.

**Point de vigilance.** La limitation par adresse IP est peu discriminante dans un contexte
où de nombreux abonnés partagent un petit nombre d'adresses publiques, ce qui est le cas de
la zone géographique visée. Le seuil global est donc volontairement large, et la protection
fine reste assurée par les limiteurs applicatifs. **Aucun composant n'est ajouté pour
traiter ce point** : ce serait contraire au principe P1.

### L3 — Charges de travail

| Élément | Conception |
|---|---|
| **Composants** | Quatre services d'exécution de conteneurs : l'application hébergée, l'API de supervision, le tableau de bord, le service d'encodage |
| **Entrée** | Tous les services publics n'acceptent le trafic que depuis le répartiteur : les adresses directes du fournisseur sont neutralisées |
| **Identité** | Une identité de service distincte par charge de travail |
| **Déploiement** | Par étiquette immuable égale au SHA du commit : ce qui s'exécute est exactement ce qui a été contrôlé ; l'empreinte (digest) est résolue lors des reconstructions Terraform |
| **Exigences couvertes** | EX6, EX9 |

Le point le plus important de cette couche tient en une phrase : **contourner le périmètre
est impossible, et non simplement interdit.** La configuration d'entrée des services rejette
tout trafic ne provenant pas du répartiteur. Ce n'est pas une règle de pare-feu que l'on
peut oublier d'appliquer ; c'est une propriété de la configuration du service.

Le déploiement par étiquette immuable (SHA du commit) mérite d'être souligné. L'étiquette
est égale à l'empreinte du commit source, ce qui rend la chaîne « image contrôlée → image
déployée » traçable et vérifiable. L'empreinte cryptographique (digest) est utilisée comme
référence dans les configurations Terraform pour les reconstructions et la reprise après
incident, garantissant que la même image exacte est redéployée.

### L4 — Réseau

| Élément | Conception |
|---|---|
| **Composants** | Réseau privé en mode personnalisé, sous-réseaux, accès privé aux services managés, passerelle de sortie, règles de filtrage |
| **Règle de base** | Refus par défaut en entrée, autorisations explicites minimales |
| **Accès aux données** | Par service d'accès privé exclusivement ; la base de données ne possède aucune adresse publique |
| **Sortie** | Passerelle unique, destinations connues et documentées |
| **Exigences couvertes** | EX4, EX20 |

Le principe de conception de cette couche s'énonce simplement : **le réseau transporte, il
n'autorise pas.** Être situé à l'intérieur du réseau privé ne confère aucun droit ; chaque
appel repasse par la vérification d'identité du plan L2. C'est la différence exacte entre
cette architecture et le modèle périmétrique décrit au chapitre 1, où la présence dans le
réseau interne valait autorisation.

**Point de vigilance.** La sortie contrôlée n'est pas une négation de la sortie. Les
applications hébergées ont des besoins légitimes — messagerie, interfaces externes. Zero
Trust ne signifie pas « aucune sortie » mais « sorties connues, nommées et journalisées ».
Une exception existe : le service d'encodage ne dispose d'aucune sortie, sa fonction n'en
requérant aucune.

### L5 — Données

Cette couche héberge deux systèmes de nature très différente, qu'il importe de ne pas
confondre.

**La base de données applicative** stocke les données métier de l'application hébergée. Elle
est en adresse privée, sauvegardée avec possibilité de restauration à un instant donné, et
accessible uniquement par les identités applicatives.

**L'entrepôt de supervision** est le cœur du dispositif de détection. Sa conception suit une
chaîne de traitement en quatre étapes :

```
   journaux bruts        ← alimenté par la collecte (F4), partitionné par jour,
        │                   filtré à la source, avec expiration automatique
        │  règles de détection versionnées, exécutées à intervalle régulier
        ▼
   détections            ← alertes normalisées
        │  tâche d'enrichissement (F5) : encodage puis recherche vectorielle
        ▼
   enrichissement        ← rattachement à une technique d'attaque, avec score
        │
        ▼
   scoring et présentation → tableau de bord de l'analyste
```

| Contrôle | Conception | Exigence |
|---|---|---|
| Intégrité des preuves | Droits d'écriture sur les journaux bruts et les détections réservés à la collecte et aux règles ; aucune identité applicative ou d'analyse n'y a accès | EX11 |
| Maîtrise du coût | Partitionnement par jour, expiration automatique, **filtrage à la source lors de la collecte** | BNF3 |
| Seuil de rattachement | Déclaré explicitement en tête de requête, donc auditable et modifiable sans redéploiement | BNF6 |
| Traitement des cas non rattachés | Sous le seuil, l'absence de rattachement est assumée et le taux correspondant est un indicateur affiché | Honnêteté de la mesure |

Le dernier point est une décision de conception rarement prise. Il aurait été possible
d'abaisser le seuil jusqu'à ce que toute alerte reçoive un rattachement — produisant un
tableau de bord entièrement rempli et entièrement faux. Le choix inverse a été fait :
**afficher le taux d'alertes non rattachées comme un indicateur de qualité.** Un système qui
avoue ne pas savoir est plus utile qu'un système qui devine.

### L6 — Enrichissement sémantique

| Élément | Conception |
|---|---|
| **Modèle** | Modèle de représentation de phrases spécialisé en cybersécurité, révision figée, format de poids refusant l'exécution de code, empreintes consignées |
| **Optimisation** | Quantisation int8 testée et rejetée (0/5 correspondances de premier rang) ; modèle livré en fp32 ONNX |
| **Service d'encodage** | Poids embarqués dans l'image, aucun téléchargement à l'exécution, **aucune sortie réseau**, appel authentifié obligatoire, entrée interne uniquement |
| **Tâche d'enrichissement** | Déclenchée à intervalle fixe, traite les détections non enrichies par lots |
| **Chaîne d'approvisionnement** | L'image traverse les mêmes contrôles que toute autre : les poids d'un modèle sont un artefact tiers non fiable |
| **Exigences couvertes** | EX14, EX15 |

Trois décisions de sécurité structurent cette couche.

**Les poids du modèle sont traités comme un artefact non fiable.** Ils proviennent d'un tiers
et sont chargés par un processus disposant de droits. Le format retenu exclut l'exécution de
code à la désérialisation, les empreintes sont vérifiées, et l'image passe par les mêmes
contrôles de vulnérabilité que le code applicatif.

**Le service n'a aucune sortie réseau.** Sa fonction — transformer un texte en vecteur — n'en
requiert aucune. Cette absence de sortie n'est pas une restriction ajoutée mais une propriété
de la conception, et elle supprime la possibilité d'utiliser ce composant comme point de
rebond (scénario SO17).

**Les poids sont embarqués dans l'image plutôt que téléchargés à l'exécution.** Un
téléchargement au démarrage introduirait une dépendance externe dans le chemin critique et un
point d'injection dans la chaîne d'approvisionnement.

### L7 — Observabilité

| Élément | Conception | Exigence |
|---|---|---|
| **Sources** | Journaux d'audit du fournisseur, journaux des charges de travail, verdicts du filtrage applicatif, journaux réseau | EX13 |
| **Collecte** | Vers l'entrepôt de supervision, **avec filtres d'exclusion appliqués à la source** | EX12, BNF3 |
| **Supervision** | Sondes de disponibilité sur les points de santé des services | BNF1 |
| **Politiques d'alerte** | Taux d'erreurs, latence du service d'encodage, échec de la tâche d'enrichissement, pic de blocages au périmètre, échec de connexion aux données | EX12, EX19 |
| **Procédures** | Une procédure d'incident par famille de technique d'attaque, accessible directement depuis le tableau de bord | BNF4 |
| **Indicateurs** | Délai de détection, part des détections issues du rattachement sémantique, taux d'alertes non rattachées, latence, version du modèle | BNF6 |

Le lien entre le tableau de bord et les procédures d'incident est ce qui rend le dispositif
utilisable par une personne seule. Une alerte affichée sans conduite à tenir transfère
intégralement la charge d'interprétation à l'analyste — c'est-à-dire précisément ce que le
besoin BNF4 cherche à éviter.

---

## 4.5 Le plan d'identité : la segmentation réelle

Cette section est la traduction concrète du principe P2. Elle décrit ce qui, dans cette
architecture, remplace les pare-feux internes.

### 4.5.1 Matrice des identités et des droits

| Identité | Utilisée par | Droits accordés | Interdiction structurante |
|---|---|---|---|
| Identité applicative (une par application hébergée) | Service d'application | Accès à la base de données ; accès aux secrets de cette application uniquement | **Aucun accès à l'entrepôt de supervision** — *une application hébergée ne lit pas le système qui la surveille* |
| Identité de l'API de supervision | API | **Lecture seule** sur l'entrepôt de supervision ; accès à la base ; secrets de la plateforme | Aucune écriture sur les preuves. Exception unique et volontaire : la table des verdicts d'analyste |
| Identité du tableau de bord | Interface d'analyste | Aucun accès direct aux données : passe exclusivement par l'API | — |
| Identité de la tâche d'enrichissement | Tâche planifiée | Lecture des détections ; écriture **uniquement** sur la table d'enrichissement ; droit d'appeler le service d'encodage | **Écriture interdite sur les journaux bruts et les détections** |
| Identité de la chaîne d'intégration | Chaîne de livraison, via fédération | Écriture dans le registre d'images ; déploiement ; usurpation contrôlée des identités d'exécution ; écriture limitée à la table des vulnérabilités | Aucune clé exportée ; portée limitée au projet de son environnement |

**Cette matrice *est* la micro-segmentation.** Elle ne décrit pas des règles réseau ; elle
décrit qui peut atteindre quoi. C'est la mise en œuvre littérale du principe selon lequel la
position dans le réseau ne confère aucun droit.

### 4.5.2 La ligne la plus importante

La quatrième ligne mérite un développement. L'identité de la tâche d'enrichissement peut
*lire* les détections et *écrire* dans la table d'enrichissement — et rien d'autre.

Ce n'est pas une précaution générale de moindre privilège. C'est la traduction en
autorisations du principe P3 et de l'exigence EX11 : le composant qui analyse les preuves ne
peut pas les modifier. Si cette identité disposait d'un droit d'écriture sur les détections,
un attaquant l'ayant compromise pourrait effacer la trace de son propre passage — scénario
SO16 du chapitre 3.

Le test T11 du chapitre 6 consiste précisément à tenter cette écriture et à vérifier le
refus.

### 4.5.3 Fédération de la chaîne d'intégration

Le point bloquant B2 de l'audit concernait un secret unique gouvernant sept mécanismes. Le
scénario SO9 concerne une clé d'identité de longue durée détenue par la chaîne
d'intégration. La réponse à ces deux problèmes est de même nature : **supprimer la classe de
risque plutôt que la gérer.**

La chaîne d'intégration s'authentifie par fédération d'identité : elle présente une assertion
signée par la forge logicielle, vérifiée par le fournisseur cloud, et obtient en retour un
jeton de courte durée. Une condition d'attribut restreint cette fédération à un dépôt et une
branche précis.

**Aucune clé n'existe.** Il n'y a donc rien à faire fuiter, rien à faire tourner, rien à
révoquer. La différence avec une clé bien gérée est qualitative : une clé bien gérée reste
une clé.

Cette conception est complétée par une politique du fournisseur interdisant la création de
clés d'identité de service. Le contrôle ne dépend donc pas de la discipline de l'opérateur.

### 4.5.4 Secrets et chiffrement

Une leçon directe de l'audit du chapitre 1 est appliquée sans exception : **un secret par
usage, jamais de secret dérivé d'un autre.** Le point bloquant B2 démontrait le coût de la
règle inverse — la fuite d'une valeur unique compromettait simultanément l'authentification,
l'anonymat et l'accès à l'actif principal.

Une seconde règle encadre la relation entre l'infrastructure en code et les secrets :
**l'infrastructure crée les conteneurs de secrets, jamais leurs valeurs.** Les valeurs sont
injectées hors du code d'infrastructure. La raison est directe : le fichier d'état de
l'infrastructure ne doit jamais devenir un coffre de secrets.

---

## 4.6 Couverture des exigences

Cette section vérifie que les vingt exigences du chapitre 3 sont effectivement traitées par
la conception, et signale celles qui ne le sont que partiellement.

| Exigence | Couche(s) | Statut de couverture |
|---|---|---|
| EX1 — Filtrage de toute requête entrante | L1 | **Complète** |
| EX2 — Limitation et détection des tentatives anormales | L1, L5 | **Complète** |
| EX3 — Disponibilité sous charge, traçabilité du balayage | L1, L7 | **Complète** |
| EX4 — Données injoignables depuis Internet | L4, L5 | **Complète** |
| EX5 — Cloisonnement des identités applicatives | L2 | **Partielle** — voir écart É3 (section 4.9) |
| EX6 — Accès lié à une identité vérifiée | L2, L3 | **Complète** |
| EX7 — Aucune clé de longue durée | L2 | **Complète** |
| EX8 — Aucun artefact vulnérable en production | F3 | **Complète** |
| EX9 — Registre de confiance unique | L2, F3 | **Complète** |
| EX10 — Aucun secret versionné | L2, F3 | **Complète** |
| EX11 — Intégrité de la chaîne de preuve | L2, L5 | **Complète** |
| EX12 — Interruption de collecte détectable | L7 | **Complète** |
| EX13 — Attribution des actions privilégiées | L7 | **Complète** |
| EX14 — Aucune sortie du composant d'inférence | L4, L6 | **Partielle** — voir écart É3 |
| EX15 — Résistance de la chaîne d'enrichissement à la charge | L6 | **Complète** |
| EX16 — Aucune ressource hors du code | F7 | **Complète** |
| EX17 — État d'infrastructure privé et chiffré | F7 | **Complète** |
| EX18 — Revue avant modification de droits | F7 | **Complète** |
| EX19 — Détection d'une consommation anormale | L7 | **Complète** |
| EX20 — Sorties limitées et journalisées | L4 | **Partielle** — voir écart É1 |

**Dix-sept exigences sur vingt sont complètement couvertes par la conception ; trois ne le
sont que partiellement.** Ces trois écarts sont documentés en section 4.9, avec leur date,
leur cause et leur conséquence sur le niveau de risque résiduel.

Le tableau de correspondance avec les sept principes du référentiel Zero Trust est le
suivant.

| Principe (chapitre 2) | Matérialisation |
|---|---|
| P1 — Toute ressource est protégée | Base de données, entrepôt de supervision, registre d'images et secrets sont tous des ressources à accès contrôlé |
| P2 — Toute communication est sécurisée | Chiffrement en transit indépendant de la position réseau ; appels entre services authentifiés |
| P3 — Accès par session | Jetons de courte durée ; aucune clé permanente |
| P4 — Politique dynamique fondée sur l'identité | Une identité par charge de travail, droits attribués au cas par cas |
| P5 — Mesure continue de l'état | Collecte depuis toutes les couches, supervision, alertes |
| P6 — Vérification avant chaque accès | Vérification d'identité à chaque saut, y compris entre services internes |
| P7 — Collecte pour amélioration | Entrepôt de supervision, matrice de couverture affichant aussi les lacunes, boucle F6 |

---

## 4.7 Registre des décisions d'architecture

Le registre des décisions est ce qui prouve qu'une architecture est délibérée. Chaque
décision structurante y figure avec son statut : **validée** (conservée telle quelle),
**retouchée** (ajustée par rapport à la conception initiale), **ajoutée**, ou **écartée**.

| # | Décision | Statut | Justification |
|---|---|---|---|
| **D01** | Exécution de conteneurs sans serveur comme unique plateforme | Validée | Aucun système d'exploitation à durcir, chiffrement interne natif, identité par service, réduction à zéro hors trafic. Un orchestrateur apporterait une souplesse dont ce périmètre n'a pas besoin, au prix d'un cluster à exploiter |
| **D02** | Point d'entrée unique avec filtrage applicatif | Validée | Un point d'entrée unique est un point de contrôle unique. Le filtrage managé couvre les risques applicatifs courants sans composant à maintenir |
| **D03** | Base de données managée, adresse privée, restauration à un instant donné | Validée | Correspond au besoin de l'application hébergée. La haute disponibilité était initialement écartée pour raison de coût ; elle a été activée en cours de projet — voir D13 |
| **D04** | Entrepôt de données généraliste comme système de supervision | Validée | Le système de supervision est *construit*, non acheté : c'est l'apport du projet. L'entrepôt fournit le stockage, le langage de détection, et — point décisif — la recherche vectorielle nécessaire à L6 sans base spécialisée |
| **D05** | Modèle de représentation non génératif pour l'enrichissement | Validée | Sortie déterministe donc auditable ; aucune surface d'injection par le contenu des journaux ; exécution sur processeur généraliste |
| **D06** | Recherche vectorielle déportée dans l'entrepôt | Validée | Supprime un composant entier. Cohérent avec le principe P1 |
| **D07** | Registre d'images unique, retrait du second registre | Retouchée | Deux registres constituent deux surfaces de chaîne d'approvisionnement et une ambiguïté sur la source de vérité. Les images de base restent accessibles par un dépôt miroir en lecture |
| **D08** | Fédération d'identité pour la chaîne d'intégration | Ajoutée | Supprime la classe de risque « clé de longue durée ». Aligné avec la politique interdisant la création de clés |
| **D09** | Détection de secrets en tête de chaîne | Ajoutée | Coût quasi nul, gain élevé. L'audit du chapitre 1 démontre précisément le coût d'un secret mal géré |
| **D10** | Autorisation applicative par rôles conservée | Validée | L'autorisation applicative reste dans l'application ; l'autorisation d'infrastructure protège l'infrastructure. Les deux plans ne se substituent pas l'un à l'autre |
| **D11** | Sortie réseau contrôlée avec liste d'autorisation | Validée | Zero Trust ne signifie pas absence de sortie, mais sorties connues. Exception : le composant d'encodage n'a aucune sortie |
| **D12** | Infrastructure en code comme standard unique de provisionnement | Validée, renforcée | Réponse directe au point bloquant B5. Trois gains : reproductibilité, contrôle avant création, détection de dérive |
| **D13** | Passage de la base de données en haute disponibilité régionale | **Révision de D03**, datée du 08/08/2026 | Décision assumée, coût doublé. Contredit la justification initiale de D03 : la révision est enregistrée comme telle plutôt que présentée comme une continuité |

**La décision D13 illustre la fonction du registre.** Elle contredit D03. Il aurait été plus
confortable de réécrire D03 pour effacer la contradiction ; le choix inverse a été fait. Un
registre de décisions dans lequel aucune décision n'est jamais révisée n'est pas un registre,
c'est une reconstruction *a posteriori*.

Un second registre, tenu au fil de la réalisation, enregistre les décisions prises face aux
contraintes rencontrées — quinze entrées à la date du 11 août 2026, portant notamment sur la
généralisation multi-application, la cadence réelle de l'enrichissement, la restriction
géographique et la limitation de débit à deux niveaux. Les deux registres sont
complémentaires : le premier documente le *pourquoi* de l'architecture cible, le second le
*pourquoi* de chaque évolution.

---

## 4.8 Ce qui a été délibérément écarté

Sept éléments ont été évalués puis écartés en application du principe P1. Les documenter a
autant de valeur que documenter ce qui est retenu : cela démontre que leur absence est une
décision et non une lacune.

| Élément écarté | Raison | Condition de réévaluation |
|---|---|---|
| **Périmètre de protection contre l'exfiltration** | Mécanisme puissant mais lourd à exploiter (exceptions, diagnostic complexe). Disproportionné pour un périmètre à projet unique | Passage en production multi-équipes avec données réglementées |
| **Orchestrateur de conteneurs et maillage de services** | La plateforme retenue fournit déjà le chiffrement interne et l'identité par service. Un maillage ajouterait un plan de contrôle entier sans couvrir de menace résiduelle identifiée | Besoin de charges longues, à état, ou de politiques fines entre services |
| **Cache distribué** | Nécessaire uniquement pour des limitations de débit distribuées et un cache multi-instances — exigence de mise à l'échelle explicitement hors objectif (BNF7) | Montée en charge réelle |
| **Déploiement multi-région** | Coût doublé, complexité triplée, valeur de démonstration nulle. Les sauvegardes couvrent le risque de perte de données | Exigence contractuelle de disponibilité |
| **Vérification de signature des images au déploiement** | Contrôle excellent, mais son apport marginal après le contrôle de vulnérabilité, le registre unique et la fédération d'identité est faible à ce stade | **Première extension recommandée après le projet** |
| **Passerelle d'authentification devant le tableau de bord** | L'autorisation applicative par rôles couvre le besoin du périmètre. Une passerelle ajouterait une fédération d'entreprise redondante ici | Ouverture du tableau de bord à des identités d'entreprise |
| **Modèle de langue génératif pour l'analyse d'incidents** | Écarté **par conception** : sortie non déterministe et surface d'injection par le contenu des journaux, inacceptables dans une chaîne de preuve | **Aucune** — le choix non génératif est un contrôle de sécurité, pas une contrainte subie |

La dernière ligne est la plus importante. Les six premiers écarts sont des arbitrages de
coût ou de complexité, révisables. Le septième est un choix de sécurité : il ne sera pas
révisé si le contexte change, parce que la raison de l'écart ne dépend pas du contexte.

---

## 4.9 Écarts entre la conception et l'implémentation

Cette section recense les différences constatées entre l'architecture décrite ci-dessus et
le système réellement déployé. Elle est présentée ici, dans le chapitre de conception, plutôt
que reléguée en annexe.

**Justification de ce choix.** Il serait plus flatteur de présenter une implémentation
parfaitement conforme à sa conception. Ce ne serait pas exact. Tout projet d'infrastructure
produit des écarts : contraintes non anticipées, arbitrages de coût, limites d'une plateforme.
La question n'est pas de savoir s'il y en a, mais s'ils sont connus, datés, justifiés et
mesurés dans leurs conséquences.

| # | Écart | Date | Cause | Exigence affectée | Statut |
|---|---|---|---|---|---|
| **É1** | La journalisation des règles de refus du pare-feu et de la passerelle de sortie n'était pas activée | 11/08/2026 → **corrigé le 19/08/2026, vérifié** | Coût d'ingestion, puis activation décidée | **EX20** — les sorties sont limitées et désormais journalisées | **Corrigé le 19/08/2026, vérifié** (`terraform plan` sans différence) |
| **É2** | Un sous-réseau prévu par la conception n'est utilisé par aucune ressource | 11/08/2026 | Prévu pour une topologie à segment public qui n'a pas été nécessaire | Aucune exigence de sécurité ; écart au référentiel d'infrastructure | **Retrait décidé le 25/08/2026** (D-10), à appliquer par `terraform apply` |
| **É3** | Le service d'encodage partageait son identité avec la tâche de détection planifiée | 11/08/2026 → **corrigé le 19/08/2026, vérifié** | Simplification lors de la mise en œuvre, puis correction | **EX5, EX14** — identité dédiée `sa-ml-embed` créée, seul rôle `logging.logWriter` | **Corrigé le 19/08/2026, vérifié** (`terraform state show`) |
| **É4** | Le mécanisme de connexion au réseau privé retenu diffère de celui prévu | En cours de réalisation | Confort d'exploitation d'un composant managé | Aucune ; conséquence sur le coût fixe, documentée | **Assumé** |
| **É5** | La cadence de la tâche d'enrichissement est plus lente que prévu | Mise en œuvre | Arbitrage coût/latence | Aucune exigence ; conséquence sur le délai de détection, mesurée au chapitre 6 | **Assumé** |
| **É6** | Le cache d'encodage est prévu et instrumenté mais n'est pas utilisé | Mise en œuvre | Non terminé | Aucune ; conséquence sur le coût, mesurée | **À terminer** |
| **É7** | Les politiques d'organisation (interdiction de clé, accès public) sont définies dans le code mais inapplicables sans organisation GCP | 25/08/2026 | Projet personnel, pas d'organisation GCP | — | **Écart assumé**, à reprendre lors du rattachement à une organisation |
| **É8** | Le déploiement est réalisé par étiquette immuable (SHA du commit), l'empreinte étant résolue uniquement lors des reconstructions Terraform | 25/08/2026 | Choix d'architecture : traçabilité au commit | — | **Conforme à l'intention** ; documentation précisée |

**L'écart É3 était le plus significatif.** Il constituait une entorse au principe P2 dans la
couche même qui illustre ce principe. Il a été corrigé le 19/08/2026 par la création d'une
identité dédiée `sa-ml-embed` avec le seul rôle `logging.logWriter`, et vérifié par
`terraform state show`. Sa présentation factuelle, avant correction, démontre que le
dispositif de revue fonctionne.

### Un incident méthodologique instructif

Un événement survenu le 8 août 2026 mérite d'être rapporté, car il enseigne quelque chose sur
la conduite d'une infrastructure décrite en code.

Lors de l'activation du chiffrement par clés gérées, une opération d'application a échoué en
raison d'une contrainte du fournisseur non détectable au moment de la planification —
validation portant sur plusieurs champs simultanément. L'échec a été partiel : l'état local
de l'infrastructure a enregistré une valeur qui n'avait jamais été appliquée à
l'infrastructure réelle.

L'écart a été détecté par comparaison explicite entre l'état déclaré et l'état réel, puis
corrigé par une opération de rafraîchissement avant de poursuivre.

**La leçon retenue est directement transférable** : après toute opération d'application
ayant échoué partiellement, l'état doit être revérifié contre la réalité avant de replanifier.
Il ne faut pas supposer qu'un échec laisse l'état intact. Cette leçon a été intégrée aux
procédures d'exploitation du projet.

---

## Conclusion du chapitre

Ce chapitre a présenté l'architecture réalisant les vingt exigences du chapitre 3.

Le modèle retenu comporte sept niveaux L1–L7 (cinq couches et deux plans transversaux :
identité et observabilité). Six flux nommés structurent la vue dynamique. Dix-sept des
vingt exigences sont complètement couvertes ; trois ne le sont que partiellement. Huit
écarts entre conception et implémentation ont été datés et rattachés aux exigences
affectées, dont un corrigé le 19/08/2026. Treize décisions structurantes ont été
enregistrées et sept composants évalués puis écartés.

Le chapitre suivant décrit la réalisation : infrastructure en code, chaîne de livraison
avec ses portes de contrôle, chaîne de détection et fermeture de la boucle entre
livraison et détection.
