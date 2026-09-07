# Chapitre 3 — Analyse des besoins et modèle de menaces

---

## Introduction du chapitre

Ce chapitre répond aux trois questions fondamentales de la sécurité — *qu'est-ce qui a de la valeur ? qui voudrait s'y attaquer ? par quel chemin ?* — puis en dérive les exigences de sécurité. Il applique la méthode EBIOS Risk Manager (analyse de haut niveau) et STRIDE (analyse opérationnelle sur les sept flux de l'architecture).

Les sections couvrent les acteurs et cas d'utilisation (3.1), les besoins fonctionnels (3.2) et non fonctionnels (3.3), l'analyse de risque (3.4), et la matrice de traçabilité (3.5). **Cette matrice est la pièce centrale du mémoire** : elle relie chaque menace identifiée à une exigence, à un contrôle et au test qui en démontrera l'efficacité.

Les identifiants de flux (F1–F7) et de couches (L1–L7) utilisés ici sont ceux définis en section 4.2. Le chapitre suivant présente l'architecture qui réalise ces exigences.

---

## 3.1 Acteurs et cas d'utilisation

### 3.1.1 Acteurs

L'analyse distingue les acteurs **légitimes**, dont les besoins définissent les
fonctionnalités, et les acteurs **hostiles**, dont les objectifs définissent les menaces.
Cette distinction n'est pas étanche : un compte légitime détourné devient un acteur hostile
disposant de droits légitimes, ce qui constitue précisément le scénario que le modèle Zero
Trust cherche à contenir.

**Acteurs légitimes**

| Acteur | Description | Interaction principale |
|---|---|---|
| **A1 — Utilisateur final** | Contributeur de l'application hébergée | Accède à l'application via le point d'entrée public (F1) |
| **A2 — Analyste sécurité** | Consulte les alertes, qualifie les incidents, applique les procédures | Accède au tableau de bord de supervision (F1), en lecture |
| **A3 — Administrateur de la plateforme** | Gère les environnements, les identités et les secrets | Accède aux consoles d'administration et aux dépôts |
| **A4 — Développeur** | Modifie le code applicatif ou l'infrastructure | Interagit indirectement, via la chaîne de livraison (F3, F7) |
| **A5 — Chaîne d'intégration continue** | Acteur non humain, construit et déploie | Identité fédérée, sans secret permanent (F3, F7) |
| **A6 — Tâches automatisées internes** | Enrichissement, détection planifiée | Acteurs non humains internes (F5) |

L'acteur A5 mérite une remarque. Une chaîne d'intégration continue est un acteur à part
entière : elle possède une identité, des droits, et la capacité de modifier la production.
Dans la plupart des incidents de chaîne d'approvisionnement documentés, c'est cet acteur qui
est détourné. Le traiter comme un simple outil, et non comme un acteur à privilèges, est une
erreur d'analyse fréquente.

**Acteurs hostiles**

| Acteur | Motivation | Moyens supposés |
|---|---|---|
| **H1 — Attaquant opportuniste** | Gain rapide, cible non choisie | Outils automatisés, exploitation de vulnérabilités connues |
| **H2 — Acteur intéressé par les données** | Valeur du corpus linguistique constitué | Ciblage délibéré, patience, recherche du chemin le plus discret |
| **H3 — Participant fraudeur** | Gain financier direct lié aux prix de la compétition | Comptes légitimes multiples, manipulation des règles applicatives |
| **H4 — Attaquant de la chaîne d'approvisionnement** | Exécution de code chez la victime | Compromission d'une dépendance ou d'une image de base |
| **H5 — Acteur interne ou prestataire** | Variable : négligence, curiosité, malveillance | Accès légitime initial, connaissance du système |

L'acteur H3 est spécifique à ce contexte et ne doit pas être sous-estimé : lorsqu'une
plateforme distribue des prix en numéraire, la fraude devient économiquement rationnelle, et
l'attaquant dispose d'un accès légitime au système.

### 3.1.2 Cas d'utilisation

Huit cas d'utilisation structurent le socle. Ils sont formulés du point de vue de l'acteur,
et non du composant technique.

| # | Cas d'utilisation | Acteur | Flux | Besoin couvert |
|---|---|---|---|---|
| **UC1** | Accéder à une application hébergée depuis Internet | A1 | F1 | Exposition contrôlée et filtrée |
| **UC2** | Consulter les alertes de sécurité et leur contexte | A2 | F1 | Supervision exploitable |
| **UC3** | Qualifier une alerte et enregistrer un verdict | A2 | F1 | Traçabilité de la décision humaine |
| **UC4** | Livrer une nouvelle version d'une application | A4, A5 | F3 | Livraison contrôlée |
| **UC5** | Modifier l'infrastructure | A3, A5 | F7 | Provisionnement reproductible et revu |
| **UC6** | Détecter automatiquement un comportement suspect | A6 | F4, F5 | Détection sans surveillance humaine permanente |
| **UC7** | Enrichir une alerte d'un contexte d'attaque | A6 | F5 | Réduction de la charge d'interprétation |
| **UC8** | Prioriser les correctifs selon les menaces observées | A4, A6 | F6 | Boucle livraison ↔ détection |

Les cas UC3 et UC8 méritent d'être signalés.

**UC3** introduit une exigence subtile : le verdict de l'analyste doit être enregistré, mais
il ne doit pas pouvoir altérer les preuves techniques sur lesquelles il porte. Cette
exigence produira une décision d'architecture précise au chapitre 4 — la séparation entre
les tables de preuve, en écriture interdite, et la table de verdict humain.

**UC8** est le cas d'utilisation correspondant à la question Q6 du chapitre 1 et au verrou
V4 du chapitre 2. Il constitue l'apport du mémoire.

---

## 3.2 Besoins fonctionnels

Les besoins sont présentés selon la segmentation retenue au chapitre 1 : ce que le socle
doit faire, pour qui, et pourquoi.

| # | Besoin | Segment | Origine | Cas d'utilisation |
|---|---|---|---|---|
| **BF1** | Exposer les applications hébergées derrière un point d'entrée unique, filtré et journalisé | Sécurité | Carence C1 | UC1 |
| **BF2** | Attribuer une identité distincte à chaque charge de travail, avec des droits minimaux | Sécurité | Carence C1 | UC1, UC6 |
| **BF3** | Rendre les données inaccessibles depuis Internet, en accès privé uniquement | Sécurité | Carence C1, audit B3 | UC1 |
| **BF4** | Décrire l'intégralité du socle sous forme de code versionné | Ops | Carence C2, audit B5 | UC5 |
| **BF5** | Contrôler automatiquement chaque livraison avant mise en production | Dev | Carence C3 | UC4, UC5 |
| **BF6** | Authentifier la chaîne d'intégration sans secret permanent | Dev | Carence C3, audit B2 | UC4, UC5 |
| **BF7** | Centraliser les journaux de toutes les couches dans un entrepôt unique | Détection | Carence C4 | UC6 |
| **BF8** | Exécuter des règles de détection versionnées sur ces journaux | Détection | Carence C4 | UC6 |
| **BF9** | Garantir qu'aucun composant d'analyse ne puisse modifier les preuves qu'il analyse | Sécurité | Exigence propre | UC3, UC6 |
| **BF10** | Associer automatiquement chaque alerte à une technique d'attaque connue | Données | Verrou V3 | UC7 |
| **BF11** | Présenter à l'analyste les incidents, leur contexte et la conduite à tenir | Métier | Carence C4 | UC2, UC3 |
| **BF12** | Réordonner les vulnérabilités détectées à la livraison selon les menaces observées | Données | Verrou V4 | UC8 |
| **BF13** | Permettre l'accueil d'une nouvelle application sans reconception du socle | Métier | Objectif d'entreprise | UC4, UC5 |

Le besoin **BF9** est une exigence d'intégrité de la chaîne de preuve. Sa formulation est
volontairement absolue. Elle se traduit par une règle simple, énoncée au chapitre 4 et
vérifiée au chapitre 6 : *un moteur de détection ne doit jamais pouvoir modifier les preuves
qu'il analyse.*

Le besoin **BF13** traduit l'objectif d'entreprise de la section 1.1.4. Il impose une
contrainte de conception forte : aucun composant du socle ne doit contenir de logique
spécifique à une application donnée.

---

## 3.3 Besoins non fonctionnels

| # | Besoin | Cible | Vérification |
|---|---|---|---|
| **BNF1** | Disponibilité des services exposés | Objectif de niveau de service instrumenté et mesuré en continu | Supervision, chapitre 6 |
| **BNF2** | Latence des requêtes applicatives | Objectif défini et mesuré ; tout dépassement documenté et expliqué | Supervision, chapitre 6 |
| **BNF3** | Coût mensuel d'exploitation | De l'ordre de quelques dizaines d'euros ; le poste dominant identifié et maîtrisé | Facturation réelle, chapitre 6 |
| **BNF4** | Exploitabilité par une seule personne | Procédures écrites et exécutées au moins une fois | Exécution réelle, chapitre 6 |
| **BNF5** | Reproductibilité | Reconstruction complète d'un environnement à partir du dépôt, chronométrée | Destruction/reconstruction, chapitre 6 |
| **BNF6** | Auditabilité | Chaque décision automatisée journalisée avec ses entrées et la version du composant | Inspection des journaux |
| **BNF7** | Scalabilité | **Volontairement limitée.** Les limites sont mesurées et documentées, non contournées | Déclaration explicite, chapitre 6 |

Le besoin **BNF3** mérite une précision d'ingénierie. Le poste de coût dominant d'une
supervision de sécurité n'est pas le calcul, mais l'**ingestion des journaux**. Cette
propriété a une conséquence de conception directe : le filtrage doit être appliqué à la
source, au moment de la collecte, et non après stockage. Ce choix est décrit au chapitre 4.

Le besoin **BNF7** est formulé comme une limite assumée et non comme une lacune. Cette
formulation engage : le chapitre 6 doit produire les limites mesurées, faute de quoi
l'affirmation reste invérifiable.

---

## 3.4 Analyse de risque

### 3.4.1 Atelier 1 — Valeurs métier et biens supports

Une **valeur métier** est ce dont la perte, l'altération ou la divulgation nuit à
l'organisation. Un **bien support** est un élément technique dont dépend une valeur métier.

**Valeurs métier**

| # | Valeur métier | Nature | Pourquoi elle a de la valeur |
|---|---|---|---|
| **VM1** | Le corpus de données linguistiques constitué | Confidentialité, intégrité, disponibilité | Actif principal du projet hébergé ; données rares, coûteuses à reconstituer |
| **VM2** | Les données d'identité et les données biométriques des contributeurs | Confidentialité | Identifiants nationaux, numéros de téléphone, enregistrements vocaux ; préjudice direct aux personnes |
| **VM3** | L'intégrité de la compétition dotée de prix | Intégrité | Une fraude non détectée entraîne une contestation et une perte financière |
| **VM4** | La disponibilité du service | Disponibilité | Une interruption pendant une phase de compétition compromet l'équité |
| **VM5** | **L'intégrité de la chaîne de preuve de la supervision** | Intégrité | Si les journaux et détections peuvent être altérés, tout le dispositif de sécurité perd sa valeur probante |
| **VM6** | La crédibilité technique de l'entreprise | Réputation | Le socle est destiné à être proposé à d'autres clients |

La valeur **VM5** est propre au socle et non à l'application. Elle est le plus souvent
absente des analyses de risque, qui protègent les données métier sans protéger les traces qui
permettraient de constater une attaque. Elle est ici traitée au même niveau que les autres.

**Biens supports**

| # | Bien support | Valeurs métier dépendantes |
|---|---|---|
| BS1 | Base de données relationnelle applicative | VM1, VM2, VM3, VM4 |
| BS2 | Entrepôt de données de supervision | VM5 |
| BS3 | Charges de travail exécutant les applications et l'API | VM1, VM4 |
| BS4 | Chaîne d'intégration continue et registre d'images | VM1, VM4, VM5 |
| BS5 | Gestionnaire de secrets et service de gestion de clés | VM1, VM2 |
| BS6 | Identités de service et politique d'autorisation | Toutes |
| BS7 | Dépôt de code source et état de l'infrastructure | Toutes |
| BS8 | Composant d'enrichissement sémantique et sa base de vecteurs | VM5 |
| BS9 | Point d'entrée public et filtrage applicatif | VM1, VM4 |

Le bien support **BS6** apparaît en regard de toutes les valeurs métier. Ce n'est pas un
artefact de présentation : dans une architecture Zero Trust, la politique d'identité
*remplace* le pare-feu interne comme mécanisme de segmentation. Elle devient donc le bien
support le plus critique, et sa compromission est le scénario le plus grave.

### 3.4.2 Atelier 2 — Sources de risque et objectifs visés

| # | Source de risque | Objectif visé | Pertinence retenue |
|---|---|---|---|
| **SR1** | Attaquant opportuniste automatisé | Détourner des ressources de calcul, installer un point d'entrée persistant | **Élevée** — tout service exposé est balayé en continu |
| **SR2** | Acteur cherchant à obtenir le corpus | Exfiltrer VM1 sans être détecté | **Élevée** — l'actif a une valeur propre et l'audit a montré un chemin réel |
| **SR3** | Participant fraudeur | Obtenir un gain financier en altérant VM3 | **Élevée** — motivation économique directe, accès légitime |
| **SR4** | Attaquant de la chaîne d'approvisionnement | Faire exécuter son code par la victime | **Moyenne** — non ciblée, mais l'audit relève des images non épinglées |
| **SR5** | Acteur interne ou prestataire | Élargir ses accès, ou effacer ses traces | **Moyenne** — équipe réduite, mais accès étendus |
| **SR6** | Acteur étatique ou groupe organisé | Ciblage stratégique | **Écartée** — hors du modèle de menace de ce projet ; l'écart est assumé et documenté |

L'exclusion de **SR6** est explicite et volontaire. Un modèle de menace qui prétend couvrir
toutes les sources de risque ne couvre en réalité aucune priorité. Le périmètre retenu
correspond aux moyens du projet.

### 3.4.3 Atelier 3 — Scénarios stratégiques

Un scénario stratégique relie une source de risque à une valeur métier, par un chemin de
haut niveau et sans détail technique.

| # | Scénario stratégique | Source | Valeur atteinte | Gravité |
|---|---|---|---|---|
| **SS1** | Un attaquant obtient un accès direct à la base de données et copie le corpus et les identités | SR2 | VM1, VM2 | **G4 — Critique** |
| **SS2** | Un attaquant obtient l'URL ou le jeton d'export du corpus et le télécharge intégralement | SR2 | VM1 | **G4 — Critique** |
| **SS3** | Une identité de la chaîne d'intégration est détournée et déploie du code non revu en production | SR4, SR5 | VM1, VM4, VM5 | **G4 — Critique** |
| **SS4** | Un attaquant altère ou efface les journaux et détections pour dissimuler son passage | SR2, SR5 | VM5 | **G3 — Grave** |
| **SS5** | Un participant contourne les contrôles applicatifs et fausse le classement de la compétition | SR3 | VM3 | **G3 — Grave** |
| **SS6** | Un service exposé est saturé ou détourné pour du calcul illégitime | SR1 | VM4 | **G2 — Significative** |
| **SS7** | Un secret est divulgué et permet la reconstitution d'accès légitimes | SR1, SR5 | VM1, VM2 | **G4 — Critique** |

**Échelle de gravité employée**

| Niveau | Libellé | Critère |
|---|---|---|
| G1 | Mineure | Gêne interne, sans conséquence externe |
| G2 | Significative | Interruption de service ou perte de données limitée et récupérable |
| G3 | Grave | Perte d'intégrité durable, contestation, perte de confiance |
| G4 | Critique | Divulgation de données personnelles ou perte de l'actif principal |

Trois scénarios stratégiques sur sept — SS1, SS2 et SS7 — correspondent directement à des
points bloquants relevés par l'audit du chapitre 1. Ce n'est pas une coïncidence : l'audit a
fourni la matière factuelle de cette analyse, ce qui distingue ce modèle de menace d'un
exercice théorique.

### 3.4.4 Atelier 4 — Scénarios opérationnels par application de STRIDE aux flux

Les scénarios stratégiques sont maintenant traduits en chemins techniques. La méthode STRIDE
est appliquée systématiquement à chacun des sept flux de l'architecture.

**Rappel des flux**

| Flux | Chemin | Nature |
|---|---|---|
| F1 | Utilisateur → point d'entrée public → filtrage → charge de travail | Requête applicative |
| F2 | Charge de travail → réseau privé → base de données | Accès aux données |
| F3 | Dépôt → chaîne d'intégration → registre d'images → déploiement | Livraison logicielle |
| F4 | Toutes les couches → collecte de journaux → entrepôt de supervision | Télémétrie |
| F5 | Planificateur → tâche d'enrichissement → modèle → recherche vectorielle → alertes enrichies | Détection et enrichissement |
| F6 | Vulnérabilités détectées à la livraison → encodage → rapprochement avec les techniques observées → priorisation | Boucle livraison ↔ détection |
| F7 | Dépôt → chaîne d'intégration → plan → contrôle → approbation → application | Provisionnement de l'infrastructure |

**Rappel des six catégories STRIDE** : usurpation d'identité (S), altération (T),
répudiation (R), divulgation d'information (I), déni de service (D), élévation de privilège
(E).

**Scénarios opérationnels**

| # | Flux | STRIDE | Scénario opérationnel | Technique ATT&CK | G | V | Scénario stratégique |
|---|:-:|:-:|---|---|:-:|:-:|:-:|
| **SO1** | F1 | I, E | Exploitation d'une vulnérabilité applicative exposée sur Internet | T1190 | G3 | V3 | SS1 |
| **SO2** | F1 | S | Réutilisation d'identifiants valides obtenus ailleurs pour accéder à un compte | T1078 | G3 | V3 | SS5 |
| **SO3** | F1 | S | Recherche exhaustive de mot de passe sur des comptes existants | T1110 | G2 | V3 | SS5 |
| **SO4** | F1 | D | Saturation du service exposé par un volume de requêtes anormal | T1498, T1499 | G2 | V3 | SS6 |
| **SO5** | F1 | I | Balayage automatisé de la surface exposée à la recherche de services accessibles | T1595 | G1 | V4 | SS6 |
| **SO6** | F2 | I | Accès direct à la base de données depuis Internet, en contournant la charge de travail | T1530 | **G4** | V2 | SS1 |
| **SO7** | F2 | E | Utilisation d'une identité de service applicative pour lire des données hors de son périmètre | T1078.004 | G3 | V2 | SS1 |
| **SO8** | F2 | I | Obtention d'un jeton d'accès aux données non lié à une identité et transmissible | T1550 | **G4** | V2 | SS2 |
| **SO9** | F3 | S | Détournement de l'identité de la chaîne d'intégration au moyen d'une clé exportée | T1552.001 | **G4** | V2 | SS3 |
| **SO10** | F3 | T | Introduction de code malveillant par une dépendance ou une image de base compromise | T1195.002 | **G4** | V2 | SS3 |
| **SO11** | F3 | E | Déploiement d'un artefact non contrôlé par contournement des portes de la chaîne | T1195 | G3 | V2 | SS3 |
| **SO12** | F3 | I | Divulgation d'un secret versionné dans le dépôt ou son historique | T1552.001 | **G4** | V3 | SS7 |
| **SO13** | F4 | T | Altération ou suppression de journaux pour dissimuler une action | T1070 | G3 | V2 | SS4 |
| **SO14** | F4 | D | Désactivation ou dégradation de la collecte de journaux | T1562 | G3 | V2 | SS4 |
| **SO15** | F4 | R | Absence de trace permettant d'attribuer une action à un acteur | — | G3 | V2 | SS4 |
| **SO16** | F5 | T | Écriture par un composant d'enrichissement dans les tables de preuve qu'il analyse | T1070 | G3 | V2 | SS4 |
| **SO17** | F5 | E | Utilisation du composant d'inférence comme point de rebond vers d'autres ressources | T1078.004 | G3 | V1 | SS3 |
| **SO18** | F5 | D | Saturation du composant d'inférence par un volume d'alertes anormal | T1499 | G2 | V2 | SS6 |
| **SO19** | F6 | T | Falsification du rattachement d'une vulnérabilité pour la faire déclasser | — | G2 | V1 | SS3 |
| **SO20** | F7 | E | Modification de l'infrastructure sans revue, par accès direct aux interfaces du fournisseur | T1098 | **G4** | V2 | SS3 |
| **SO21** | F7 | I, T | Accès en lecture ou en écriture à l'état de l'infrastructure, qui contient des données sensibles | T1530 | **G4** | V2 | SS3, SS7 |
| **SO22** | F7 | E | Création d'une identité ou d'un droit supplémentaire par un acteur ayant obtenu un premier accès | T1098.001 | **G4** | V2 | SS3 |
| **SO23** | Tous | E | Détournement de ressources de calcul pour un usage illégitime | T1496 | G2 | V2 | SS6 |
| **SO24** | Tous | I | Exfiltration de données par un canal sortant légitime et non surveillé | T1567 | G3 | V2 | SS1, SS2 |

**Échelle de vraisemblance employée**

| Niveau | Libellé | Critère |
|---|---|---|
| V1 | Minime | Suppose des moyens ou un accès préalable importants |
| V2 | Significative | Réalisable par un attaquant motivé disposant d'un accès initial limité |
| V3 | Forte | Régulièrement observé sur des systèmes comparables |
| V4 | Maximale | Systématique, observé en continu sur tout service exposé |

> **Note de version.** Les identifiants de techniques renvoient à la version 19 de la
> matrice de référence. Deux techniques employées ici ont changé de tactique lors de cette
> version : la suppression d'indicateurs (T1070) relève désormais des techniques de
> discrétion, et la dégradation des défenses (T1562) d'une tactique distincte nouvellement
> créée. Cette précision conditionne la comparabilité de la mesure de couverture présentée
> au chapitre 6.

Trois scénarios — SO15, SO19 et l'aspect de répudiation en général — ne correspondent à
aucune technique répertoriée. C'est normal et doit être dit : la matrice décrit des
comportements d'attaquants observés, non des défauts de conception. Un défaut de traçabilité
n'est pas une technique d'attaque ; c'est une condition qui rend les techniques d'attaque
indétectables.

### 3.4.5 Atelier 5 — Appréciation et traitement du risque

Le croisement gravité × vraisemblance produit la cartographie suivante. Les scénarios sont
placés selon leur niveau de risque **avant traitement**.

| | **V1 Minime** | **V2 Significative** | **V3 Forte** | **V4 Maximale** |
|---|---|---|---|---|
| **G4 Critique** | — | SO6, SO8, SO9, SO10, SO20, SO21, SO22 | SO12 | — |
| **G3 Grave** | SO17 | SO7, SO13, SO14, SO15, SO16, SO24 | SO1, SO2 | — |
| **G2 Significative** | SO19 | SO18, SO23 | SO3, SO4 | — |
| **G1 Mineure** | — | — | — | SO5 |

**Lecture.** La zone de risque la plus élevée regroupe huit scénarios, dont **sept concernent
la chaîne de livraison et le provisionnement de l'infrastructure (F3 et F7), ou l'accès
direct aux données (F2)**.

Ce résultat est le principal enseignement de l'analyse, et il oriente toute la conception :

- Le risque dominant ne provient pas de l'application exposée sur Internet — pourtant le
  seul point que le modèle périmétrique protégeait.
- Il provient des **chemins d'administration et de livraison**, qui disposent par nature de
  droits élevés et qui, dans l'existant décrit au chapitre 1, n'étaient soumis à aucun
  contrôle.
- Le scénario SO12, seul scénario critique de vraisemblance forte, correspond exactement au
  point bloquant B2 de l'audit.

**Décisions de traitement**

| Décision | Scénarios | Justification |
|---|---|---|
| **Réduire** | SO1 à SO14, SO16, SO18, SO20 à SO24 | Traités par des contrôles d'architecture, détaillés en section 3.5 |
| **Réduire partiellement** | SO2, SO3, SO5 | Le socle limite l'exposition et détecte ; le traitement complet relève du code applicatif, hors périmètre |
| **Accepter** | SO17, SO19 | Vraisemblance minime et gravité contenue ; acceptation explicite, révisable |
| **Transférer** | — | Aucun transfert (pas d'assurance ni de sous-traitance de sécurité dans le périmètre) |

L'acceptation explicite de SO17 et SO19 est une décision, non un oubli. Elle est datée, et
sa condition de réévaluation est indiquée au chapitre 4.

---

## 3.5 Matrice de traçabilité : menace → exigence → contrôle → test

Cette matrice est le produit central du chapitre. Elle établit, pour chaque scénario
opérationnel, la chaîne complète qui va du risque analysé jusqu'à sa démonstration.

Chaque ligne se lit ainsi : *ce scénario de menace impose cette exigence de sécurité, qui
est réalisée par ce contrôle, dont l'efficacité est démontrée par ce test.*

| Menace | Exigence de sécurité | Contrôle (couche) | Test de validation |
|---|---|---|---|
| SO1 | **EX1** — Toute requête entrante est filtrée avant d'atteindre une charge de travail | Filtrage applicatif au point d'entrée unique (L1) | **T1** — Envoi de charges d'attaque applicatives connues ; vérification du blocage |
| SO2, SO3 | **EX2** — Les tentatives d'authentification anormales sont limitées et détectées | Limitation de débit au point d'entrée (L1) ; règle de détection sur les échecs répétés (L5) | **T2** — Génération d'échecs répétés ; vérification du blocage et de l'apparition d'une alerte |
| SO4, SO5 | **EX3** — Le service reste disponible sous charge anormale et le balayage est tracé | Limitation de débit et restriction géographique (L1) ; journalisation (L7) | **T3** — Test de charge ; vérification de la limitation et de la trace |
| SO6 | **EX4** — Les données ne sont joignables par aucun chemin depuis Internet | Base de données sans adresse publique, accès par service privé uniquement (L4, L5) | **T4** — Tentative de connexion directe depuis l'extérieur ; échec attendu |
| SO7 | **EX5** — Une identité applicative ne peut accéder qu'aux données de son périmètre | Une identité de service par charge de travail, aucun droit sur l'entrepôt de supervision (L2) | **T5** — Tentative de lecture de l'entrepôt de supervision avec une identité applicative ; refus attendu |
| SO8 | **EX6** — Tout accès aux données est lié à une identité vérifiée, sans jeton transmissible | Authentification requise sur chaque appel entre services (L2, L3) | **T6** — Appel direct au service sans jeton d'identité ; refus attendu |
| SO9 | **EX7** — Aucune clé d'identité de longue durée n'existe | Identité fédérée pour la chaîne d'intégration, jetons de courte durée, création de clés interdite par politique (L2) | **T7** — Inventaire des clés existantes ; tentative de création d'une clé ; refus attendu |
| SO10 | **EX8** — Aucun artefact vulnérable n'atteint la production | Contrôle de vulnérabilité bloquant sur les images et dépendances (F3) | **T8** — Soumission d'un artefact contenant une vulnérabilité connue ; blocage attendu |
| SO11 | **EX9** — Le déploiement ne peut tirer que du registre de confiance unique | Registre unique autorisé, droits de déploiement limités (L2, F3) | **T9** — Tentative de déploiement depuis une source externe ; refus attendu |
| SO12 | **EX10** — Aucun secret ne peut être versionné | Détection de secrets bloquante en tête de chaîne (F3) ; secrets stockés dans un gestionnaire dédié, un secret par usage (L2) | **T10** — Soumission volontaire d'un secret factice ; blocage attendu ; vérification qu'aucun secret n'est dérivé d'un autre |
| SO13, SO16 | **EX11** — Aucun composant d'analyse ne peut modifier les preuves qu'il analyse | Droits d'écriture sur les tables de preuve réservés à la collecte ; le composant d'enrichissement n'écrit que dans sa propre table (L2, L5) | **T11** — Tentative d'écriture dans les tables de preuve avec l'identité du composant d'enrichissement ; refus attendu |
| SO14 | **EX12** — Toute interruption de la collecte de journaux est détectable | Supervision de la continuité du flux de collecte (L7) | **T12** — Interruption volontaire de la collecte ; vérification de l'alerte |
| SO15 | **EX13** — Toute action privilégiée est attribuable à un acteur identifié | Journaux d'audit du fournisseur activés et collectés (L7) | **T13** — Exécution d'une action privilégiée ; vérification de l'attribution dans les journaux |
| SO17 | **EX14** — Le composant d'inférence ne dispose d'aucune sortie réseau | Sortie réseau nulle sur ce composant (L4, L6) | **T14** — Tentative d'appel sortant depuis le composant ; échec attendu |
| SO18 | **EX15** — Une charge anormale d'alertes ne compromet pas la chaîne d'enrichissement | Traitement par lots à cadence fixe, limites d'instances (L6) | **T15** — Injection d'un volume anormal ; observation du comportement et du coût |
| SO20 | **EX16** — Aucune ressource n'existe sans description dans le code versionné | Provisionnement exclusif par infrastructure en code ; détection de dérive (F7) | **T16** — Création manuelle d'une ressource ; vérification de sa détection comme dérive |
| SO21 | **EX17** — L'état de l'infrastructure est privé, versionné et chiffré | Stockage d'état distant, accès restreint (F7) | **T17** — Tentative d'accès à l'état avec une identité non autorisée ; refus attendu |
| SO22 | **EX18** — Toute modification de droits est revue avant application | Approbation manuelle obligatoire avant application des changements d'infrastructure (F7) | **T18** — Soumission d'un changement élargissant des droits ; vérification du blocage en attente d'approbation |
| SO23 | **EX19** — Une consommation de ressources anormale est détectée | Supervision de la consommation, alerte de budget (L7) | **T19** — Simulation d'une consommation anormale ; vérification de l'alerte |
| SO24 | **EX20** — Les sorties réseau sont limitées à des destinations connues et journalisées | Sortie contrôlée et liste d'autorisation (L4) | **T20** — Tentative de connexion sortante vers une destination non autorisée ; échec attendu |

**Vingt exigences, vingt tests.** Ces vingt tests constituent le programme de validation du
chapitre 6. Aucun n'est optionnel : une exigence dont le test n'est pas exécuté reste une
déclaration.

Trois remarques sur cette matrice.

**Elle se lit dans les deux sens.** De gauche à droite, elle justifie chaque contrôle par une
menace — ce qui empêche d'ajouter un composant parce qu'il est à la mode. De droite à gauche,
elle permet de vérifier qu'aucune menace identifiée n'est restée sans réponse.

**Elle fixe le contenu du chapitre 6 avant que celui-ci ne soit écrit.** C'est une garantie
méthodologique : le programme de test est dérivé de l'analyse de risque, et non choisi après
coup parmi les tests qui réussissent.

**Elle rend les échecs visibles.** Si un test échoue au chapitre 6, la matrice indique
exactement quelle exigence n'est pas satisfaite et quelle menace redevient ouverte. Cette
propriété est recherchée : elle transforme un échec en information exploitable plutôt qu'en
lacune non identifiée.

---

## 3.6 Rattachement aux référentiels

Les vingt exigences sont enfin rattachées aux référentiels présentés au chapitre 2. Ce
rattachement permet d'exprimer la conformité en termes reconnus, et surtout d'identifier les
écarts assumés.

| Référentiel | Exigences concernées | Écarts assumés |
|---|---|---|
| Principes Zero Trust (NIST SP 800-207) | EX4 à EX7, EX11, EX13, EX14, EX20 | Aucun principe non traité ; le degré de mise en œuvre varie et est mesuré au chapitre 6 |
| Référentiel applicatif (OWASP Top 10:2025) | EX1 (contrôle d'accès, mauvaise configuration), EX8 à EX10 (chaîne d'approvisionnement) | Le traitement complet des risques applicatifs relève du code hébergé, hors périmètre |
| Référentiel d'infrastructure (CIS) | EX4, EX5, EX7, EX13, EX16, EX17, EX20 | Deux écarts identifiés dès la conception : la journalisation des flux réseau et la segmentation d'un sous-réseau inutilisé. Justifiés par le coût, documentés au chapitre 4, mesurés au chapitre 6 |
| Matrice des techniques d'attaque | Couverture de détection issue des scénarios SO1 à SO24 | La couverture est partielle par construction ; son plafond et ses lacunes sont publiés au chapitre 6 |

La dernière ligne engage le mémoire sur un point délicat. Publier une couverture de
detection partielle expose à la critique. La taire expose à davantage : un jury, un
auditeur ou un client finit toujours par demander ce que le système ne voit pas. La position
retenue est de répondre à cette question avant qu'elle ne soit posée.

---

## Conclusion du chapitre

Ce chapitre a transformé les carences du chapitre 1 et l'état de l'art en un ensemble
d'exigences vérifiables. L'analyse a identifié six valeurs métier, retenu cinq sources
de risque, produit sept scénarios stratégiques et vingt-quatre scénarios opérationnels
obtenus par application de STRIDE aux sept flux de l'architecture. **Les scénarios les
plus graves concernent non l'application exposée sur Internet, mais les chemins
d'administration, de livraison et d'accès aux données.**

Vingt exigences de sécurité en ont été dérivées, chacune associée à un contrôle
d'architecture et à un test de validation, constituant le programme de validation du
chapitre 6.

Le chapitre suivant présente l'architecture qui réalise ces vingt contrôles : modèle en
couches, flux, registre des décisions et composants évalués puis écartés.
