# Chapitre 1 — Cadre général et étude de l'existant

---

## Introduction du chapitre

Ce chapitre établit, sur des faits vérifiables, **pourquoi** ce projet devait être mené. Il
présente l'entreprise MENAL-SARL, l'application ELSON qui sert de cas réel, les résultats
de l'audit technique et sécurité, puis en tire une critique de l'existant. Ces constats
conduisent à la problématique, aux objectifs mesurables et à la démarche retenue.

*L'application existante fonctionne, mais elle repose sur un modèle périmétrique et sur un
environnement non reproductible ; le projet consiste à construire le socle qui corrige ces
deux défauts.*

---

## 1.1 Organisme d'accueil : MENAL-SARL

### 1.1.1 Présentation générale

MENAL-SARL est une entreprise de droit mauritanien, également implantée en France, fondée
en 2025. Elle est spécialisée dans les services informatiques, les technologies numériques
et la fourniture de solutions IT.

| Élément | Information |
|---|---|
| Raison sociale | MENAL-SARL |
| Année de création | 2025 |
| Siège social | Avenue Cheikh Bouddah Ould El Bousseiry 741, Nouakchott, Mauritanie |
| Implantation secondaire | France |
| Secteur | Services informatiques, cloud et cybersécurité |
| Encadrant entreprise | M. Houssein Ezzedine |

L'entreprise s'est constituée pour répondre à une demande croissante des organisations
mauritaniennes en matière de digitalisation, de sécurité des systèmes d'information et de
gestion d'infrastructures. Son positionnement consiste à proposer des solutions adaptées
au contexte local tout en respectant les standards internationaux.

### 1.1.2 Le service d'accueil et son organisation

Le projet s'est déroulé au sein du **service technique et cloud** de
MENAL-SARL, composé de cinq personnes : un responsable technique, deux ingénieurs cloud,
un développeur full-stack et l'élève-ingénieur accueilli en stage. Le service est chargé
de la conception, du déploiement et de la maintenance des infrastructures cloud pour les
clients de l'entreprise, ainsi que du développement des applications hébergées sur ces
infrastructures.

L'organisation du service repose sur des rituels hebdomadaires : un point d'équipe le lundi
matin pour la planification des activités de la semaine, et un revue de code le jeudi. Les
outils collaboratifs incluent GitHub pour le versionnage, Slack pour la communication
quotidienne et Google Workspace pour la documentation.

### 1.1.3 Mission confiée et rôle de l'élève-ingénieur

La mission confiée à l'élève-ingénieur était de **concevoir et implémenter un socle
d'hébergement cloud sécurisé selon les principes Zero Trust**, destiné à remplacer
l'environnement périmétrique existant. Cette mission s'inscrivait dans le premier axe
stratégique de l'entreprise — la construction d'un actif réutilisable capable d'accueillir
plusieurs applications clientes.

L'élève-ingénieur a occupé une place opérationnelle au sein de l'équipe, sous la direction
de M. Houssein Ezzedine (encadrant entreprise) et de M. Mohamed Amine Gara (encadrant
académique). Ses responsabilités couvraient l'intégralité du cycle : audit de l'existant,
analyse des menaces, conception de l'architecture, implémentation en Terraform, mise en
place des chaînes de livraison et de détection, et validation par des tests adverses.

Les interlocuteurs réguliers étaient le responsable technique du service (revues d'archi-
tecture), l'encadrant entreprise (points hebdomadaires de suivi), et l'encadrant académique
(revues d'avancement bimensuelles).

### 1.1.4 Domaines d'activité

L'activité de MENAL-SARL s'organise autour de deux axes complémentaires.

**a) Services informatiques**

- Conception et déploiement d'architectures cloud (Google Cloud Platform, AWS)
- Mise en place de solutions sécurisées selon les approches DevSecOps et Zero Trust
- Développement d'applications web et d'API sécurisées
- Conception et industrialisation de pipelines de données
- Intégration de solutions de supervision et de monitoring
- Audit, sécurisation et optimisation des systèmes existants

**b) Fourniture de matériels et de solutions IT**

- Fourniture d'équipements (serveurs, postes de travail, matériel réseau)
- Installation et configuration des systèmes
- Déploiement d'infrastructures IT
- Maintenance et assistance technique

### 1.1.5 Positionnement et vision

MENAL-SARL se positionne comme un **prestataire global**, capable d'assurer un
accompagnement de bout en bout, de la conception à l'exploitation, en associant services
techniques et équipements. Sa vision affichée est de devenir un acteur de référence en
Mauritanie dans le domaine des technologies de l'information.

### 1.1.6 Situation du projet dans la stratégie de l'entreprise

Le projet ne relève pas d'un besoin ponctuel. Il correspond au premier axe de service de
l'entreprise — la conception d'architectures cloud sécurisées — et vise à doter MENAL-SARL
d'un **actif réutilisable** : un socle d'hébergement standardisé, sur lequel plusieurs
applications clientes pourront être accueillies successivement.

Cette dimension est importante pour la suite du mémoire. Le projet n'est pas la
sécurisation d'une application, mais la construction d'une **capacité industrielle** que
l'entreprise pourra proposer à ses clients. L'application décrite en section 1.2 en est le
premier cas d'usage, et non la finalité.

---

## 1.2 Contexte technique : l'application ELSON

### 1.2.1 Nature et finalité

ELSON est une plateforme de crowdsourcing gamifiée destinée à construire des jeux de
données parallèles texte et audio pour les langues nationales de Mauritanie, en commençant
par l'arabe hassaniya. Les contributeurs traduisent des phrases sources (anglais, français,
arabe) vers le hassaniya, enregistrent leur voix, puis évaluent les contributions des
autres participants. Les données de meilleure qualité alimentent ensuite des modèles de
reconnaissance vocale, de traduction automatique et de synthèse vocale.

L'application présente trois caractéristiques qui élèvent fortement son niveau d'exigence
en matière de sécurité :

1. **Elle traite des données d'identité officielle** : le numéro national d'identité (NNI)
   mauritanien et le numéro WhatsApp sont collectés à l'inscription.
2. **Elle traite des données biométriques** : les enregistrements vocaux constituent des
   données à caractère personnel de nature biométrique.
3. **Elle est associée à une compétition dotée de prix en numéraire**, ce qui crée une
   incitation économique directe à la fraude et à la prise de contrôle de comptes.

### 1.2.2 Volumétrie et périmètre technique

L'application a été analysée dans le cadre d'un audit dont les résultats sont présentés en
section 1.3. Sa volumétrie est la suivante :

| Indicateur | Valeur mesurée |
|---|---|
| Lignes de code TypeScript | ~34 600 (≈14 200 backend, ≈20 400 frontend) |
| Points d'entrée HTTP (endpoints) | 225, répartis en 11 routeurs |
| Tables PostgreSQL définies | 54 (+ 17 vues, 15 fonctions et déclencheurs) |
| Fichiers SQL | 74, dont 72 migrations |
| Endpoints protégés par le contrôle administrateur | ~165 |

Il ne s'agit donc pas d'un prototype, mais d'une application en exploitation réelle, de
taille significative.

### 1.2.3 Architecture d'hébergement avant le projet

L'application est déployée sur un serveur unique loué chez un hébergeur européen, sous la
forme d'un ensemble de conteneurs orchestrés par un seul fichier `docker-compose.yml` :

- un frontend Next.js,
- une API Express en mode *cluster* (quatre processus),
- une base PostgreSQL 17,
- un pooler de connexions PgBouncer,
- un proxy inverse Caddy assurant la terminaison TLS,
- une passerelle WhatsApp tierce (WAHA),
- un service de sauvegarde local.

Ce modèle correspond à l'architecture illustrée en figure 1.1 : un pare-feu unique en
entrée, et à l'intérieur un réseau où la confiance est implicite. Tout composant présent
dans le réseau interne est traité comme légitime.

> **Figure 1.1** — Modèle de sécurité avant le projet : périmètre unique et confiance
> implicite à l'intérieur. *(insérer ici le schéma « Avant ce projet »)*

Ce modèle porte un défaut connu et structurel : **un attaquant qui franchit l'unique
barrière d'entrée accède à l'ensemble des ressources internes.** L'audit en donne une
illustration concrète, exposée plus loin : le pooler de base de données accepte les
connexions sans authentification, et se trouve sur le même réseau qu'un conteneur tiers
connecté à Internet.

---

## 1.3 Étude de l'existant : audit technique et sécurité

### 1.3.1 Méthode d'audit

Un audit technique et sécurité de l'application a été réalisé le **29 juillet 2026**, en
amont de toute conception. La méthode retenue est l'**analyse statique exhaustive du
dépôt** : lecture intégrale du code, des fichiers de configuration, des scripts de
déploiement et des 74 fichiers SQL, sans aucune exécution, modification ni déploiement de
l'application.

Deux règles ont encadré ce travail :

- **Règle de preuve** : seul ce qui est réellement présent dans le dépôt est documenté,
  avec citation du chemin de fichier et du numéro de ligne. Aucune fonctionnalité ni
  configuration n'a été supposée.
- **Règle de confidentialité** : aucun secret n'est reproduit ; les valeurs sensibles sont
  désignées uniquement par leur nom de variable.

Chaque constat a été classé selon une convention de statut à quatre valeurs :

| Statut | Signification |
|---|---|
| Vérifié | Constaté directement dans un fichier du dépôt (chemin cité) |
| À confirmer | Dépend de la configuration d'exécution, non observable dans le dépôt |
| Absent | Rien dans le dépôt ne couvre ce point |
| Recommandé | Proposition d'amélioration, non présente aujourd'hui |

Cette convention est reprise dans tout le mémoire. Elle permet de distinguer en permanence
ce qui est **constaté** de ce qui est **supposé**, ce qui est la condition d'un audit
utilisable.

### 1.3.2 Points forts constatés

L'audit ne conclut pas à un travail de mauvaise qualité, et il est important de le dire
avant d'exposer les faiblesses. Plusieurs mécanismes se situent au-dessus de ce que l'on
observe habituellement sur un projet de cette taille :

| Domaine | Élément constaté |
|---|---|
| Injections | Aucune injection SQL ni injection de commande système identifiée : la totalité des requêtes est paramétrée, et les appels système utilisent des tableaux d'arguments sans passer par un interpréteur de commandes |
| CSRF | Défense en profondeur à quatre niveaux (cookie `SameSite=strict`, contrôle d'origine, CORS mono-origine, jeton d'accès conservé en mémoire) |
| Sessions | Jeton de rafraîchissement haché en base, rotation, détection de réutilisation, session unique par compte avec révocation propagée |
| Intégrité de la compétition | Score de fraude à l'inscription (14 signaux), détection de collusion, exclusion bidirectionnelle contributeur/évaluateur, déduplication audio, pièges de contrôle |
| Immuabilité de l'identité | Déclencheur en base interdisant toute modification du NNI, du nom et du numéro après inscription |
| Résilience utilisateur | File d'attente locale garantissant qu'aucune contribution n'est perdue en cas de coupure réseau |

Le code porte par ailleurs la trace de plusieurs cycles de correction de sécurité
antérieurs. La logique applicative est mûre.

### 1.3.3 Constats bloquants

Le problème ne se situe donc pas dans la logique métier, mais dans la **configuration** et
dans l'**industrialisation**. L'audit identifie six points qualifiés de bloquants, c'est-à-dire
devant être levés avant tout nouveau déploiement.

**Quatre constats bloquants de sécurité :**

| # | Constat | Conséquence |
|---|---|---|
| B1 | Un compte administrateur est créé par le fichier de schéma versionné, avec un mot de passe écrit en clair et un identifiant fixe | Toute personne ayant lu le dépôt connaît un couple identifiant/mot de passe administrateur valide sur un environnement non modifié |
| B2 | Un secret unique gouverne sept mécanismes cryptographiques distincts (jetons d'accès et de rafraîchissement, clés de session, URL audio signées, codes à usage unique, jeton d'export du corpus, codes d'anonymat) | La fuite d'un seul secret compromet simultanément l'authentification, l'anonymat des évaluateurs et l'accès à l'intégralité du corpus |
| B3 | Le pooler de base de données accepte les connexions sans authentification, sur un réseau partagé avec un conteneur tiers connecté à Internet — alors qu'il n'est en réalité jamais utilisé par l'application | Chemin d'accès direct à la base, sans contrepartie fonctionnelle |
| B4 | Le jeton permettant de télécharger l'intégralité du corpus validé n'est lié ni à un utilisateur, ni à une adresse IP, ni à un usage unique | Quiconque obtient l'URL télécharge l'actif principal du projet : textes, traductions et fichiers audio |

**Deux constats bloquants d'industrialisation :**

| # | Constat | Conséquence |
|---|---|---|
| B5 | Le schéma de base n'est pas reconstructible depuis le dépôt : le fichier d'initialisation ne crée que 8 tables sur 54, 72 migrations doivent être appliquées manuellement, 10 numéros de version sont en doublon, et **trois objets de base utilisés par le code n'ont aucune définition versionnée** | Un environnement reconstruit à partir du dépôt est fonctionnellement incomplet. C'est le frein technique principal à toute migration |
| B6 | L'état applicatif est local au processus : fichiers écrits sur le disque du serveur, caches et compteurs de limitation de débit en mémoire, invalidation de cache par communication entre processus d'une même machine | Toute mise à l'échelle horizontale rend les protections incohérentes ; les plafonds de limitation sont multipliés par quatre et remis à zéro à chaque déploiement |

Il faut souligner un point qui n'est pas anecdotique : **le constat B5 signifie que le code
en production contient des objets qui n'existent nulle part sous forme versionnée.** Ils
ont été créés manuellement, hors de tout contrôle. C'est la définition même d'un
environnement non reproductible.

### 1.3.4 Autres carences relevées

Au-delà des six points bloquants, l'audit relève des absences complètes dans quatre
domaines :

| Domaine | Éléments absents |
|---|---|
| Qualité logicielle | Aucun test automatisé (unitaire, intégration ou bout en bout), aucune chaîne d'intégration continue, aucun contrôle de vulnérabilité des dépendances ni des images |
| Gestion des secrets | Aucun gestionnaire de secrets ; l'ensemble repose sur un fichier d'environnement présent sur le serveur ; aucune procédure de rotation |
| Observabilité | Aucune journalisation structurée, aucune agrégation centralisée, aucun identifiant de corrélation, aucune métrique, aucune trace, aucune surveillance externe de disponibilité |
| Conformité | Aucune politique de confidentialité, aucune base légale documentée pour le traitement de la voix et du NNI, aucune durée de conservation, aucun droit à l'effacement, aucun encadrement contractuel des sous-traitants |

S'y ajoute un constat de minimisation des données : les alertes de sécurité par courriel et
le journal d'audit contiennent en clair le NNI, le numéro WhatsApp, l'adresse électronique
et l'adresse IP des utilisateurs, sans aucune durée de conservation.

### 1.3.5 Synthèse chiffrée

L'audit se conclut par une grille de 41 critères de préparation au déploiement, répartis en
quatre catégories.

| Catégorie | Critères | Prêt | Partiel | Non prêt |
|---|---:|---:|---:|---:|
| Fonctionnel | 7 | 6 | 1 | 0 |
| Technique | 10 | 0 | 1 | 9 |
| Sécurité | 17 | 6 | 4 | 7 |
| Conformité | 7 | 0 | 1 | 6 |
| **Total** | **41** | **12** | **7** | **22** |

> **Figure 1.2** — Répartition des 41 critères de préparation.
> *(insérer ici un graphique en barres empilées à partir du tableau ci-dessus)*

La lecture de ce tableau est sans ambiguïté et constitue le point de départ du projet :

- Le **fonctionnel** est prêt à 86 %.
- Le **technique** et la **conformité** sont proches de zéro.

Autrement dit : **l'application fait ce qu'elle doit faire, mais elle n'est ni
reproductible, ni observable, ni conforme, ni déployable de façon maîtrisée.**

---

## 1.4 Critique de l'existant et expression du besoin

### 1.4.1 Cinq carences structurantes

En reformulant les constats précédents à un niveau d'abstraction plus élevé, cinq carences
structurantes se dégagent. Elles ne sont pas propres à cette application ; elles
caractérisent un système construit sans socle.

| # | Carence | Formulation |
|---|---|---|
| C1 | **Modèle de confiance périmétrique** | La sécurité repose sur une barrière d'entrée unique. À l'intérieur, la confiance est implicite : un composant présent sur le réseau est traité comme légitime, sans vérification d'identité |
| C2 | **Environnement non reproductible** | L'infrastructure et le schéma de données ne sont pas décrits sous forme de code. Reconstruire l'environnement suppose une connaissance non écrite |
| C3 | **Chaîne de livraison non contrôlée** | Aucun contrôle automatique n'est exercé entre l'écriture du code et sa mise en production : ni recherche de secrets, ni analyse statique, ni contrôle de vulnérabilités |
| C4 | **Absence d'observabilité et de détection** | Les événements de sécurité existent (journal d'audit applicatif) mais ne sont ni centralisés, ni corrélés, ni analysés. Une intrusion réussie ne serait pas détectée |
| C5 | **Absence de cadre de conformité** | Des données d'identité officielle et des données biométriques sont traitées sans base légale documentée, sans durée de conservation et sans droit d'effacement |

### 1.4.2 Une distinction essentielle : l'application et le socle

Une conclusion importante découle de l'audit : **corriger l'application ne suffit pas.**

Les carences C1 à C5 ne sont pas des défauts de code. Ce sont des propriétés absentes de
l'**environnement d'exécution**. Un correctif appliqué au code applicatif ne créera ni
identité par charge de travail, ni journalisation centralisée, ni chaîne de livraison
contrôlée, ni reproductibilité.

Cette distinction fonde le périmètre du projet :

- Le **code applicatif** relève de l'équipe produit et reste hors du périmètre de ce
  mémoire.
- Le **socle qui héberge, isole, contrôle, journalise et supervise** cette application
  constitue l'objet du projet.

Cette séparation présente en outre l'avantage recherché par l'entreprise : un socle conçu
indépendamment de l'application peut accueillir d'autres applications clientes, ce qui est
précisément l'objectif stratégique exposé en section 1.1.4.

### 1.4.3 Positionnement par rapport aux modèles d'architecture existants

Pour situer la solution visée, trois modèles sont comparés sur des critères issus, pour les
sept premiers, des principes de l'architecture Zero Trust (NIST SP 800-207), et pour les
suivants, des contraintes d'ingénierie réelles du projet.

**Modèles comparés :**

- **Modèle A — Architecture périmétrique.** Barrière d'entrée unique, confiance implicite à
  l'intérieur. C'est le modèle de l'existant décrit en section 1.2.3.
- **Modèle B — Hébergement cloud managé sans démarche de sécurité explicite.** Les services
  managés apportent nativement du chiffrement, de l'isolation et une identité de service,
  mais aucune conception de sécurité n'est menée : les valeurs par défaut sont conservées.
- **Modèle C — Socle Zero Trust MENAL.** La cible du projet.

**Légende :** ● couvert par conception · ◐ partiellement couvert ou dépendant de la
configuration · ○ non couvert.

| # | Critère | Origine du critère | A | B | C |
|---|---|---|:-:|:-:|:-:|
| 1 | Vérification explicite de l'identité à chaque requête | NIST 800-207 | ○ | ◐ | ● |
| 2 | Aucune confiance accordée à la position réseau | NIST 800-207 | ○ | ◐ | ● |
| 3 | Moindre privilège, une identité par charge de travail | NIST 800-207 | ○ | ◐ | ● |
| 4 | Micro-segmentation, limitation des mouvements latéraux | NIST 800-207 | ○ | ◐ | ● |
| 5 | Hypothèse de compromission : tout est journalisé | NIST 800-207 | ○ | ◐ | ● |
| 6 | Collecte, corrélation et conservation des événements | NIST 800-207 | ○ | ◐ | ● |
| 7 | Surveillance continue et amélioration | NIST 800-207 | ○ | ○ | ● |
| 8 | Infrastructure entièrement décrite en code | Carence C2 | ○ | ○ | ● |
| 9 | Contrôles de sécurité bloquants dans la livraison | Carence C3 | ○ | ◐ | ● |
| 10 | Règles de détection écrites, versionnées et mesurées | Carence C4 | ○ | ○ | ● |
| 11 | Priorisation des vulnérabilités par la menace observée | Apport du projet | ○ | ○ | ● |
| 12 | **Coût mensuel d'exploitation** | Contrainte projet | **●** | ◐ | ◐ |
| 13 | **Simplicité initiale, délai de mise en service** | Contrainte projet | **●** | ◐ | **○** |
| 14 | **Mise à l'échelle horizontale** | Contrainte projet | ○ | **●** | ◐ |
| 15 | **Maturité, support éditeur, compétences disponibles** | Contrainte projet | ◐ | **●** | **○** |

> **Figure 1.3** — Positionnement des trois modèles.
> *Version destinée à la soutenance : conserver les lignes 1, 3, 4, 8, 9, 10, 11, 13 et 15.*

**Lecture du tableau.** Les onze premières lignes montrent l'apport du modèle retenu, et
justifient le projet. Les quatre dernières montrent ce qu'il coûte, et doivent être lues
avec la même attention.

Le modèle C **perd sur trois critères**, ce qui doit être énoncé clairement :

- **Simplicité initiale (ligne 13).** Un serveur unique avec un fichier de composition de
  conteneurs se met en service en quelques heures. Le socle visé demande des semaines de
  conception, d'écriture d'infrastructure en code et de validation. Le gain de sécurité se
  paie en délai.
- **Mise à l'échelle (ligne 14).** Elle est explicitement hors objectif (section 1.7,
  hypothèse 2). Le modèle B ferait mieux sur ce point.
- **Maturité et compétences (ligne 15).** Une supervision de sécurité construite sur mesure
  suppose que quelqu'un sache l'exploiter et la faire évoluer. Une solution commerciale
  apporte un support éditeur et une communauté que ce projet n'a pas.

Le coût (ligne 12) mérite une nuance : le modèle A est le moins cher en facturation directe,
mais ce coût n'intègre ni la sauvegarde externalisée, ni la détection, ni la reprise après
incident, qui sont absentes. La comparaison ne porte donc pas sur des périmètres
équivalents.

> **Remarque méthodologique.** Une comparaison dont l'auteur sort vainqueur sur tous les
> critères n'est pas une comparaison mais une présentation orientée. Les trois critères
> perdus ci-dessus sont ce qui rend les onze autres crédibles. Ils sont repris tels quels au
> chapitre 6, section « limites ».

---

## 1.5 Problématique

### 1.5.1 Question centrale

Les constats précédents permettent de formuler la question centrale du mémoire :

> **Comment concevoir, déployer et — surtout — *prouver* un socle d'hébergement cloud
> conforme aux principes Zero Trust et à une chaîne de livraison DevSecOps, dans les
> conditions réelles d'une entreprise émergente : une seule personne pour l'exploitation,
> un budget de quelques dizaines d'euros par mois, et aucune solution de supervision de
> sécurité commerciale — et quel prix faut-il payer, en faux positifs, en latence de
> détection et en complexité, pour atteindre ce résultat ?**

Cette formulation appelle deux remarques.

D'abord, le verbe **prouver** est central. Un système peut être déclaré conforme à Zero
Trust sans que cette affirmation soit vérifiable. Le mémoire soutient l'inverse : chaque
contrôle doit être associé à un test qui démontre son efficacité.

Ensuite, la question comporte explicitement un **coût**. Une architecture de sécurité qui
ne mesure pas ce qu'elle coûte — en argent, en latence, en fausses alertes, en charge
d'exploitation — ne peut pas être défendue devant un comité de pilotage.

### 1.5.2 Questions dérivées

La question centrale se décompose en six questions. Chacune est formulée de façon à
appeler une réponse **vérifiable** : à chaque question correspond un indicateur, un
objectif et un chapitre de traitement.

| # | Question | Ce qui y répond | Objectif | Chapitre |
|---|---|---|---|---|
| **Q1** | Un environnement complet peut-il être détruit puis reconstruit à l'identique à partir du seul dépôt, et en combien de temps ? | Infrastructure décrite en code, état distant, détection de dérive | O2 | 5, 6 |
| **Q2** | Que reste-t-il atteignable depuis Internet lorsque le point d'entrée unique est contourné ? | Suppression de la confiance réseau, accès privé aux données, exposition restreinte des services | O1 | 4, 5, 6 |
| **Q3** | Que peut faire un compte ou un service compromis, et jusqu'où peut-il aller ? | Une identité par charge de travail, moindre privilège, séparation des droits d'écriture | O1 | 4, 5, 6 |
| **Q4** | Quelles attaques le système détecte-t-il, lesquelles ne détecte-t-il **pas**, et en combien de temps ? | Collecte centralisée des journaux, règles de détection versionnées, mesure de la couverture et des fausses alertes | O4 | 5, 6 |
| **Q5** | Qu'est-ce qui empêche une régression de sécurité d'atteindre la production, et à quel coût en blocages injustifiés ? | Portes de contrôle bloquantes, identité fédérée de la chaîne d'intégration, registre unique de confiance | O3 | 5, 6 |
| **Q6** | Les vulnérabilités livrées peuvent-elles être priorisées selon les menaces réellement observées sur le système ? | Enrichissement sémantique des alertes et rapprochement avec les vulnérabilités détectées à la livraison | O5 | 5, 6 |

L'objectif **O6** (coût réel et exploitabilité) n'est associé à aucune question en
particulier : il est transversal et s'applique à chacune des six réponses.

Deux remarques sur cette formulation.

**Les questions portent sur des capacités, non sur des produits.** Une question du type
« comment protéger l'API contre les attaques web ? » appelle une réponse en nom de service,
qui ne se démontre pas. La question Q2, elle, appelle une réponse en résultat mesuré : la
liste des ressources encore atteignables après contournement du point d'entrée.

**La question Q6 constitue l'axe original du travail.** Elle relie deux domaines
habituellement traités séparément — la sécurité de la chaîne de développement d'une part,
la détection d'incidents d'autre part — et constitue l'apport principal de ce mémoire.
Elle correspond à la ligne 11 du tableau de positionnement (section 1.4.3), seul critère
sur lequel aucun des deux autres modèles ne se positionne.

---

## 1.6 Objectifs et critères de succès

Un objectif qui ne peut pas être mesuré ne peut pas être défendu. Chaque objectif est donc
associé à un indicateur, à une cible et à un moyen de vérification. Ce tableau sert de
contrat d'évaluation pour l'ensemble du mémoire ; le chapitre 6 y répond point par point.

| # | Objectif | Indicateur | Cible | Moyen de vérification |
|---|---|---|---|---|
| **O1** | Supprimer la confiance implicite du réseau | Nombre de tentatives de contournement bloquées lors de la campagne de tests adverses | 100 % des scénarios définis | Campagne de tests adverses, chapitre 6 |
| **O2** | Rendre l'infrastructure reproductible | Part du socle décrite en code d'infrastructure ; durée de reconstruction complète d'un environnement | 100 % du socle ; durée mesurée et documentée | Destruction puis reconstruction chronométrée |
| **O3** | Contrôler la chaîne de livraison | Nombre de portes bloquantes ; nombre de clés de compte de service exportées | 3 portes (secrets, analyse statique, vulnérabilités) ; 0 clé | Journaux d'exécution de la chaîne d'intégration |
| **O4** | Détecter les événements de sécurité | Nombre de règles de détection ; couverture des tactiques de la matrice de référence ; taux de fausses alertes sur 7 jours | Couverture mesurée et publiée, y compris ses lacunes | Requêtes de détection et mesures, chapitre 6 |
| **O5** | Enrichir les alertes de façon déterministe | Précision de l'association alerte → technique d'attaque, comparée à une méthode de référence simple | Gain mesuré, positif ou négatif, sur un jeu annoté | Évaluation comparative, chapitre 6 |
| **O6** | Rester exploitable et économiquement soutenable | Coût mensuel réel ; disponibilité et latence observées ; existence de procédures d'incident exécutées au moins une fois | Coût de l'ordre de quelques dizaines d'euros par mois ; objectifs de service instrumentés | Facturation, supervision, exécution réelle des procédures |

Deux précisions méthodologiques importantes :

- L'objectif **O4** demande explicitement de publier ce que le système **ne détecte pas**.
  Une couverture de détection présentée sans ses lacunes n'est pas une mesure.
- L'objectif **O5** admet par avance un résultat négatif. Si l'enrichissement sémantique
  n'apporte pas de gain mesurable par rapport à une méthode simple, ce résultat sera
  présenté comme tel. C'est la condition d'une évaluation rigoureuse.

---

## 1.7 Périmètre du projet

| Dans le périmètre | Hors périmètre |
|---|---|
| Socle d'hébergement cloud : filtrage en entrée, identité, exécution des charges, réseau, données, enrichissement, observabilité | Code interne de l'application hébergée |
| Chaîne de livraison DevSecOps de bout en bout | Correction fonctionnelle des anomalies applicatives relevées par l'audit |
| Supervision de sécurité construite sur un entrepôt de données, et enrichissement sémantique des alertes | Déploiement multi-région et reprise d'activité inter-région |
| Interface de supervision destinée à l'analyste | Mise à l'échelle massive (cache distribué, orchestrateur de conteneurs, maillage de services) |
| Recommandations de conformité | Mise en conformité juridique complète, qui relève du responsable de traitement |

Trois hypothèses sont assumées explicitement et énoncées ici pour éviter toute ambiguïté
lors de l'évaluation :

1. **Deux environnements réels (développement et recette) et une production cible**, dans
   une seule région, avec les mêmes modules d'infrastructure partout. Seules les variables de
   dimensionnement changent : la sécurité n'est jamais un paramètre d'environnement. La
   production est documentée en code mais non provisionnée ; les mesures sont réalisées sur la
   recette, dont la topologie est identique à la cible.
2. **La mise à l'échelle n'est pas un objectif du projet.** Les limites sont mesurées et
   documentées, non contournées.
3. **La simplicité est un critère d'architecture.** Tout composant doit justifier son
   existence ; tout composant non justifié est retiré, et ce retrait est documenté au même
   titre qu'un ajout.

---

## 1.8 Contraintes

| Nature | Contrainte | Conséquence sur la conception |
|---|---|---|
| Humaine | Une seule personne conçoit, réalise et exploite le socle | Écarte les composants exigeant une exploitation permanente ; impose des procédures écrites |
| Économique | Budget de l'ordre de quelques dizaines d'euros par mois | Écarte les solutions de supervision commerciales ; impose un filtrage à la source des journaux, poste de coût dominant |
| Technique | L'application hébergée écrit sur un disque local et conserve son état en mémoire | Conditionne le choix du mode d'exécution ; identifié comme prérequis dès l'audit |
| Technique | Le schéma de base n'est pas reconstructible depuis le dépôt | Prérequis absolu : le schéma de référence doit être consolidé avant toute migration |
| Réglementaire | Données d'identité officielle et données biométriques, utilisateurs situés en Mauritanie et dans la diaspora | Impose un choix explicite et documenté de la région d'hébergement, et un chiffrement par clés gérées |
| Temporelle | Durée du projet de fin d'études | Impose un phasage avec critères de sortie, exposé en section 1.9 |

---

## 1.9 Démarche méthodologique

### 1.9.1 Principe directeur

La démarche suit une règle simple, appliquée sans exception : **rien n'existe dans
l'infrastructure qui n'existe d'abord sous forme de code versionné.** Les commandes
interactives sont réservées aux opérations ponctuelles d'exploitation — rotation d'un
secret, réponse à un incident — et jamais au provisionnement.

Cette règle est la réponse directe à la carence C2. Elle produit trois effets :
reproductibilité complète, possibilité de contrôler la sécurité de l'infrastructure **avant**
sa création, et détection de toute dérive entre l'état décrit et l'état réel.

### 1.9.2 Phasage

Le projet est organisé en cinq phases, chacune fermée par un critère de sortie vérifiable.

| Phase | Contenu | Critère de sortie |
|---|---|---|
| **P0 — Audit et cadrage** | Analyse statique de l'existant, expression du besoin, objectifs mesurables | Rapport d'audit produit et constats bloquants identifiés |
| **P1 — Conception** | Architecture en couches, flux nommés, registre des décisions, modèle de menaces | Conception générale et détaillée validées ; chaque décision justifiée par écrit |
| **P2 — Socle et infrastructure** | Description complète de l'infrastructure en code, environnements, réseau, identités, données | Un environnement complet reconstruit intégralement à partir du dépôt |
| **P3 — Chaîne de livraison et détection** | Portes de contrôle automatiques, identité fédérée de la chaîne d'intégration, collecte des journaux, règles de détection, enrichissement, interface d'analyse | Chaîne de bout en bout fonctionnelle ; alertes visibles par l'analyste |
| **P4 — Validation et mesure** | Tests adverses, mesures de détection, de performance, de résilience et de coût | Chaque objectif O1 à O6 confronté à une mesure, y compris en cas d'écart |

### 1.9.3 Traçabilité de la démarche

Deux registres sont tenus tout au long du projet et constituent des livrables à part
entière :

- un **registre des décisions d'architecture**, qui documente pour chaque décision
  structurante l'option retenue, les options écartées et la justification ;
- un **registre des écarts**, qui recense les différences constatées entre la conception
  cible et l'implémentation réelle.

Ce second registre mérite une justification. Il serait plus confortable de présenter une
implémentation parfaitement conforme à sa conception. Ce ne serait pas exact. Documenter
les écarts, les dater et les justifier est une pratique d'ingénierie ; les ignorer serait
une erreur méthodologique. Le chapitre 4 y consacre une section, et le chapitre 6 rend
compte des mesures qui ont contredit certaines hypothèses initiales.

---

## Conclusion du chapitre

Ce chapitre a établi le point de départ du projet sur des faits vérifiés.

L'application retenue est mature sur le plan fonctionnel — 6 critères sur 7 satisfaits —
mais l'audit du 29 juillet 2026 révèle que 22 des 41 critères de préparation au
déploiement ne sont pas remplis, dont six points bloquants. Ces constats se ramènent à
cinq carences structurantes : confiance implicite du réseau, environnement non
reproductible, chaîne de livraison non contrôlée, absence d'observabilité, absence de
conformité. Aucune ne relève du code applicatif ; toutes relèvent de l'environnement
d'exécution. La problématique et les six objectifs mesurables du projet en découlent
directement.

Le chapitre suivant examine l'état de l'art — Zero Trust, DevSecOps, supervision et
traitement automatique du langage — et justifie les choix technologiques retenus.

---

### Sources du chapitre

| Réf. | Document | Usage |
|---|---|---|
| S1 | Présentation de MENAL-SARL | Sections 1.1 et 1.1.4 |
| S2 | Audit technique et sécurité de l'application, 29 juillet 2026 | Sections 1.2 à 1.4 |
| S3 | Conception générale du socle (document de projet) | Sections 1.7 et 1.9 |
| S4 | Plan de travail du projet de fin d'études | Sections 1.5 et 1.8 |
