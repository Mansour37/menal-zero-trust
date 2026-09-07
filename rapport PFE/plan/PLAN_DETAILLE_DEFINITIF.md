# Plan détaillé définitif du mémoire

Version conforme à la note pédagogique — **40 pages hors annexes**

---

## Titre du mémoire

> **Conception d'une architecture cloud sécurisée Zero Trust avec approche DevSecOps**
>
> *Construction et validation d'un socle d'hébergement pour une entreprise émergente,
> de l'audit de l'existant à la mesure*

**Traitement du sous-titre.** Le sous-titre ne correspond à aucun niveau de la hiérarchie
imposée. Il est donc composé en **italique, centré, sous le titre principal**, dans un style
dédié non numéroté — il n'apparaît ni dans la table des matières, ni dans la numérotation.
La même règle s'applique aux sous-titres des six chapitres.

---

## Convention de numérotation appliquée

| Niveau | Forme | Exemple | Dans la table des matières |
|---|---|---|---|
| Chapitre | `Chapitre N` + titre | Chapitre 3 | Oui |
| Sous-titre de chapitre | Italique centré, non numéroté | *De la valeur métier à…* | **Non** |
| Section | `N.M` | 3.2 | Oui |
| Sous-section | `N.M.P` | 3.2.1 | Oui |
| Paragraphe titré | `N.M.P.Q` | 3.2.1.1 | Non — à éviter, un seul niveau de trop nuit à la lisibilité |

**Recommandation de bonne pratique :** ne pas descendre en dessous du niveau 3. Sur un
document de 40 pages, un quatrième niveau de titre signale presque toujours qu'une section
aurait dû devenir une sous-section, ou que le contenu appartient à une annexe.

---

## Légende du plan

| Marque | Signification |
|---|---|
| **`+`** | **Contenu nouveau, à écrire** — répond à une exigence de la note pédagogique |
| `→ Ann. X` | Le détail est reporté en annexe ; le corps conserve la synthèse |
| *(p.)* | Volume cible en pages |

---

# I. PIÈCES LIMINAIRES *(9 p.)*

| Ordre | Pièce | Pages |
|:-:|---|:-:|
| 1 | Page de garde *(modèle de l'établissement, titre en 24 pt centré)* | 1 |
| 2 | Dédicaces | 1 |
| 3 | Remerciements | 1 |
| 4 | Résumé *(français)* — 200 mots, **avec au moins deux résultats chiffrés** | 0,5 |
| 5 | *Abstract* *(anglais)* | 0,5 |
| 6 | Table des matières *(niveaux 1 à 3)* | 2 |
| 7 | Liste des figures — `Fig. 1` à `Fig. 27` | 1 |
| 8 | Liste des tableaux — `Tab. 1` à `Tab. N` | 1 |
| 9 | Liste des graphiques — `Graph. 1` à `Graph. 6` | 0,5 |
| 10 | Liste des acronymes | 0,5 |

---

# II. INTRODUCTION GÉNÉRALE *(2 p.)*

Sans numérotation de section. Cinq mouvements, dans cet ordre :

| # | Contenu | Remarque |
|:-:|---|---|
| 1 | Présentation du sujet par des renseignements précis | Le lecteur n'est pas spécialiste du domaine |
| 2 | Position du problème à résoudre | **Sans évoquer aucun résultat** — exigence explicite |
| 3 | Grands traits de la démarche vers l'objectif | Cinq phases, en un paragraphe |
| 4 | Objectifs fixés | Annoncés, non détaillés |
| 5 | **Annonce du contenu de chaque chapitre** | **Obligatoire, en fin d'introduction** — un paragraphe court par chapitre |

---

# III. CORPS DU MÉMOIRE *(36 p.)*

---

## Chapitre 1 — Contexte général et étude de l'existant *(5 p.)*
*De l'audit d'une plateforme en exploitation à la formulation d'un besoin de socle*

> *Introduction du chapitre*

| § | Titre | Contenu | Marque |
|---|---|---|:-:|
| **1.1** | **Cadre du projet** | | |
| 1.1.1 | L'entreprise d'accueil | Activité, positionnement, ambition cloud et cybersécurité | |
| 1.1.2 | Le service d'accueil et son organisation | Le service dans lequel le projet s'est déroulé, son effectif, ses missions | **`+`** |
| 1.1.3 | Mission confiée et rôle de l'élève-ingénieur | La mission telle que définie au début du stage ; la place occupée dans la structure ; les interlocuteurs | **`+`** |
| **1.2** | **Étude de l'existant** | | |
| 1.2.1 | L'application pilote et son hébergement initial | Nature, volumétrie, architecture périmétrique constatée — `Fig. 1` | |
| 1.2.2 | Méthode de l'audit technique | Analyse statique, convention de statut à quatre valeurs | |
| 1.2.3 | Résultats de l'audit | Points forts, six constats bloquants, synthèse des 41 critères — `Graph. 1` | → Ann. A |
| **1.3** | **Critique de l'existant** | | |
| 1.3.1 | Cinq carences structurantes | C1 à C5 | |
| 1.3.2 | Distinction entre l'application et le socle | Fonde le périmètre du projet | |
| 1.3.3 | Positionnement par rapport aux modèles existants | Tableau de synthèse à trois colonnes | → Ann. A |
| **1.4** | **Problématique et objectifs** | | |
| 1.4.1 | Problématique et questions dérivées | Question centrale, six questions Q1 à Q6 | |
| 1.4.2 | Objectifs et critères de succès | Six objectifs O1 à O6, avec indicateur et cible | |
| **1.5** | **Périmètre, contraintes et démarche** | | |
| 1.5.1 | Périmètre et hypothèses assumées | Dans / hors périmètre, trois hypothèses | |
| 1.5.2 | Contraintes du projet | Humaines, économiques, techniques, réglementaires | |
| 1.5.3 | Démarche méthodologique | Cycle en V par incréments, cinq phases, registres de suivi | |

> *Conclusion du chapitre — résume les résultats et introduit le chapitre 2*

---

## Chapitre 2 — État de l'art et choix technologiques *(5 p.)*
*Zero Trust, DevSecOps, ingénierie de la détection et enrichissement sémantique*

> *Introduction du chapitre*

| § | Titre | Contenu | Marque |
|---|---|---|:-:|
| **2.1** | **L'architecture Zero Trust** | | |
| 2.1.1 | Du modèle périmétrique au Zero Trust | Origine, définition, référentiel de 2020 | |
| 2.1.2 | Les sept principes directeurs | Tableau principe → traduction pour le projet | |
| 2.1.3 | Limites reconnues du modèle | Coût, point de défaillance unique, dérive commerciale | |
| **2.2** | **L'approche DevSecOps** | | |
| 2.2.1 | Principe et portes de contrôle automatisées | Quatre familles d'outils ; la notion de porte bloquante | |
| 2.2.2 | Provenance et intégrité des artefacts | Inventaire de composants, signature, niveaux d'exigence | |
| 2.2.3 | Référentiels applicatif et d'infrastructure | Classement des risques applicatifs, référentiel de configuration | → Ann. A |
| **2.3** | **Supervision et ingénierie de la détection** | | |
| 2.3.1 | Système de supervision acheté ou construit | Le modèle économique et sa conséquence de conception | |
| 2.3.2 | La détection comme code | Format neutre de règles, absence de convertisseur adapté | |
| 2.3.3 | La matrice des techniques d'attaque | Rôle, et précaution de version | |
| 2.3.4 | Étude comparative et solution retenue | Cinq solutions comparées, critère décisif, prix du choix | → Ann. A |
| **2.4** | **Enrichissement sémantique des alertes** | | |
| 2.4.1 | Approches disponibles | Quatre familles ; pourquoi le non-génératif est un contrôle de sécurité | |
| 2.4.2 | Modèles de langue spécialisés | Représentation de phrases, modèles du domaine | |
| 2.4.3 | Travail le plus proche et différences | Trois différences : entrée, régime, finalité | |
| **2.5** | **Méthodes d'analyse de risque** | Trois méthodes comparées, combinaison retenue | |
| **2.6** | **Synthèse : verrous et positionnement** | Quatre verrous V1 à V4, quatre contributions annoncées | |

> *Conclusion du chapitre*

---

## Chapitre 3 — Analyse des besoins et modélisation des menaces *(6 p.)*
*De la valeur métier à l'exigence de sécurité vérifiable*

> *Introduction du chapitre*

| § | Titre | Contenu | Marque |
|---|---|---|:-:|
| **3.1** | **Acteurs et cas d'utilisation** | | |
| 3.1.1 | Acteurs légitimes et acteurs hostiles | Six acteurs légitimes dont deux non humains ; cinq acteurs hostiles | |
| 3.1.2 | Cas d'utilisation du socle | Huit cas UC1 à UC8 — `Fig. 4` | |
| **3.2** | **Spécification des besoins** | | |
| 3.2.1 | Besoins fonctionnels | Treize besoins rattachés aux carences | |
| 3.2.2 | Besoins non fonctionnels | Sept besoins avec cible et mode de vérification | |
| **3.3** | **Analyse de risque** | | |
| 3.3.1 | Valeurs métier et biens supports | Six valeurs, dont l'intégrité de la chaîne de preuve | |
| 3.3.2 | Sources de risque et scénarios stratégiques | Cinq sources retenues, une écartée ; sept scénarios | |
| 3.3.3 | Scénarios opérationnels | Méthode appliquée aux sept flux ; **synthèse seule dans le corps** | → Ann. C |
| 3.3.4 | Appréciation et traitement du risque | Cartographie, enseignement principal, décisions de traitement | → Ann. C |
| **3.4** | **Exigences de sécurité et traçabilité** | | |
| 3.4.1 | Les vingt exigences de sécurité | EX1 à EX20, énoncées | |
| 3.4.2 | Matrice menace → exigence → contrôle → test | **Pièce centrale — reste intégralement dans le corps** | |
| **3.5** | **Rattachement aux référentiels** | Correspondance et écarts assumés | |

> *Conclusion du chapitre*

---

## Chapitre 4 — Conception de l'architecture Zero Trust *(6 p.)*
*Modèle en couches, plans transversaux et registre des décisions*

> *Introduction du chapitre*

| § | Titre | Contenu | Marque |
|---|---|---|:-:|
| **4.1** | **Principes directeurs de conception** | Quatre principes P1 à P4 | |
| **4.2** | **Architecture générale** | | |
| 4.2.1 | Modèle en couches | Cinq couches et deux plans — `Fig. 5` | |
| 4.2.2 | Justification des deux plans transversaux | Pourquoi l'identité n'est pas une couche | |
| 4.2.3 | Vue de déploiement | Composants réels et liens — `Fig. 7` | |
| **4.3** | **Vue dynamique : les sept flux** | F1 à F7, exigences associées — `Fig. 6` | |
| **4.4** | **Conception par couche** | Gabarit unique, six couches — **synthèse dans le corps** | → Ann. D |
| **4.5** | **Le plan d'identité** | | |
| 4.5.1 | Matrice des identités et des droits | La micro-segmentation réelle — `Fig. 8` | |
| 4.5.2 | Fédération de la chaîne d'intégration | Suppression de la classe de risque, non sa gestion | |
| 4.5.3 | Secrets et chiffrement | Un secret par usage ; l'état n'est pas un coffre | |
| **4.6** | **Couverture des exigences de sécurité** | 17 complètes, 3 partielles | |
| **4.7** | **Décisions d'architecture** | | |
| 4.7.1 | Registre des décisions | Treize décisions, dont une révision — `Fig. 9` | → Ann. D |
| 4.7.2 | Composants évalués puis écartés | Sept refus, conditions de réévaluation | → Ann. D |
| **4.8** | **Écarts entre conception et implémentation** | Six écarts datés, rattachés aux exigences | |

> *Conclusion du chapitre*

---

## Chapitre 5 — Réalisation et industrialisation *(8 p.)*
*Infrastructure as code, chaînes de livraison et chaîne de détection*

> *Introduction du chapitre*

| § | Titre | Contenu | Marque |
|---|---|---|:-:|
| **5.1** | **Environnement de travail** | | |
| 5.1.1 | Environnements et organisation du dépôt | Trois projets ; un module par couche — `Fig. 10` | |
| 5.1.2 | Frontière entre le code et l'exploitation | La couture entre les deux chaînes | |
| **5.2** | **Infrastructure as code** | | |
| 5.2.1 | Mise en œuvre et sécurité de l'état | Politiques d'organisation ; l'état comme donnée sensible | → Ann. B |
| 5.2.2 | Détection de dérive et limites constatées | Deux limites rapportées | |
| **5.3** | **Chaîne de livraison applicative** | | |
| 5.3.1 | Étapes et portes bloquantes | Huit étapes ; l'ordre des portes — `Fig. 11`, `Fig. 12` | |
| 5.3.2 | Authentification sans secret permanent | Fédération, isolation structurelle | |
| 5.3.3 | Refus démontrables | Trois cas — `Fig. 13`, `Fig. 14` | |
| **5.4** | **Chaîne de provisionnement de l'infrastructure** | Cinq étapes, approbation obligatoire — `Fig. 15` | |
| **5.5** | **Chaîne de détection** | | |
| 5.5.1 | Collecte filtrée et modèle de données | Quatre tables, un écrivain par table — `Fig. 16`, `Fig. 17` | |
| 5.5.2 | Traduction des règles de détection | Méthode, ce qu'elle coûte, ce qu'elle apporte — `Fig. 18` | → Ann. B |
| **5.6** | **Couche d'enrichissement sémantique** | | |
| 5.6.1 | Préparation et exécution du modèle | Figement, vérification, optimisation — `Fig. 19` | |
| 5.6.2 | État d'avancement réel de la couche | Ce qui est réalisé, ce qui ne l'est pas | |
| **5.7** | **Interface de supervision** | Rôles, séparation stricte, procédures — `Fig. 20`, `Fig. 21` | |
| **5.8** | **Boucle entre livraison et détection** | Principe, réalisation, ce qui reste à démontrer — `Fig. 22` | |
| **5.9** | **Généralisation à plusieurs applications** | Ce qu'elle démontre, ce qu'elle coûte | |
| **5.10** | **Conduite du projet** | | |
| 5.10.1 | Déroulement et tâches quotidiennes | Rythme de travail, activités récurrentes, points avec l'encadrant | **`+`** |
| 5.10.2 | Difficultés rencontrées | Trois incidents d'ingénierie — `Graph. 2` | **`+`** partiel |
| 5.10.3 | Changements apportés aux objectifs initiaux | Écarts de périmètre assumés en cours de projet | **`+`** |
| 5.10.4 | **Planning de travail** | **`Fig. 3` — diagramme de Gantt, sur une page complète, prévu contre réalisé** | **`+`** |

> *Conclusion du chapitre*

> **Point de conformité.** La section 5.10.4 doit occuper **une page complète** et se situer
> **à la fin de la description du travail** : c'est une exigence explicite de la note
> pédagogique. Le planning y est un bilan, non une prévision — il fait donc apparaître les
> décalages entre le prévisionnel et le réalisé.

---

## Chapitre 6 — Validation, expérimentation et résultats *(6 p.)*
*Campagne de tests adverses, évaluation de la détection et mesures*

> *Introduction du chapitre*

| § | Titre | Contenu | Marque |
|---|---|---|:-:|
| **6.1** | **Stratégie de validation** | Quatre axes, convention de résultat, conditions de mesure | → Ann. E |
| **6.2** | **Résultats de la campagne de tests** | | |
| 6.2.1 | Synthèse des vingt tests | Tableau de résultats — `Fig. 23` à `Fig. 26` | → Ann. E |
| 6.2.2 | Analyse des non-conformités | Exigences redevenues ouvertes, causes | |
| **6.3** | **Évaluation de la détection** | | |
| 6.3.1 | Couverture obtenue | Méthode de calcul, dénominateur déclaré — `Graph. 3` | |
| 6.3.2 | Ce que le système ne détecte pas | Lacunes et leurs causes | |
| 6.3.3 | Qualité et délai de détection | Fausses alertes, délai et sa contrainte structurelle | |
| **6.4** | **Évaluation de l'enrichissement sémantique** | | |
| 6.4.1 | Comparaison aux méthodes de référence | Trois méthodes — `Graph. 4` | → Ann. F |
| 6.4.2 | Boucle entre livraison et détection | Effet mesuré sur l'ordre de priorité | |
| **6.5** | **Performance, résilience et coût** | | |
| 6.5.1 | Objectifs de service | Disponibilité, latence — `Graph. 5` | |
| 6.5.2 | Reproductibilité et résilience | Reconstruction chronométrée — `Fig. 27` | |
| 6.5.3 | Coût réel | Ventilation par poste — `Graph. 6` | |
| **6.6** | **Conformité aux référentiels** | Principes Zero Trust, référentiel de configuration | |
| **6.7** | **Limites et menaces à la validité** | Périmètre, méthode, biais d'auto-évaluation | |
| **6.8** | **Réponse aux objectifs du projet** | Confrontation chiffrée aux six objectifs | |

> *Conclusion du chapitre*

---

# IV. CONCLUSION GÉNÉRALE *(2 p.)*

Sans numérotation. Cinq points, dans l'ordre exigé par la note pédagogique :

| # | Contenu | Remarque |
|:-:|---|---|
| 1 | **Récapitulation de la démarche** annoncée par l'introduction générale | Reformulée, non recopiée |
| 2 | **Présentation des résultats** — réponses aux problèmes posés au début | **Avec les valeurs mesurées** |
| 3 | **Problèmes rencontrés** lors de la réalisation | Renvoi synthétique au § 5.10.2 |
| 4 | **Les apports, techniques et autres** | **`+`** Ce que le projet a apporté à l'entreprise ; ce que le stage a apporté à l'élève-ingénieur ; les compétences acquises et les domaines de progression |
| 5 | **Perspectives** d'approfondissement ou d'élargissement | Les sept composants écartés deviennent la feuille de route |

> **Le point 4 est nouveau et obligatoire.** La note pédagogique demande explicitement
> d'évaluer l'intérêt du stage dans une optique à la fois professionnelle et personnelle, et
> de dire si les objectifs ont été atteints **pour l'entreprise comme pour l'élève-ingénieur**.
> Le mémoire actuel n'en dit rien.

---

# V. BIBLIOGRAPHIE / NETOGRAPHIE *(3 p.)*

Section unique portant ce titre. Vingt-cinq à trente références au format complet :
auteurs, titre, revue ou congrès, éditeur, date, numéro ou lieu, pages ; et pour les sources
en ligne, l'URL **accompagnée du sujet, des auteurs et de la date de parution**.

---

# VI. ANNEXES *(30 à 40 p.)*

| Annexe | Titre | Contenu | Appelée depuis |
|---|---|---|---|
| **A** | Études comparatives détaillées | Tableau des 41 critères d'audit ; positionnement à quinze critères ; comparaison des cinq solutions de supervision ; comparaison des modes d'exécution ; correspondance entre les deux versions du référentiel applicatif | § 1.2.3, 1.3.3, 2.2.3, 2.3.4 |
| **B** | Extraits techniques de la réalisation | Arborescence du dépôt ; un module représentatif par couche ; gabarit de traduction des règles ; exemples de règles et de leurs traductions | § 5.2.1, 5.5.2 |
| **C** | Modèle de menaces détaillé | Les vingt-quatre scénarios opérationnels ; échelles de gravité et de vraisemblance ; cartographie du risque | § 3.3.3, 3.3.4 |
| **D** | Conception détaillée | Conception couche par couche ; registre complet des décisions ; composants écartés et conditions de réévaluation ; registre complet des écarts | § 4.4, 4.7 |
| **E** | Protocoles et preuves de validation | Protocoles des vingt tests ; gabarit de fiche de test ; les seize preuves non reproduites dans le corps | § 6.1, 6.2.1 |
| **F** | Jeu d'évaluation de l'enrichissement | Les alertes annotées, la méthode d'annotation, les résultats détaillés par méthode | § 6.4.1 |

> **Deux règles.** Aucune annexe orpheline : chacune est appelée depuis le corps, et la
> colonne de droite le vérifie. Et chaque annexe porte un titre explicite, pas seulement une
> lettre.

---

# VII. Récapitulatif du volume

| Partie | Pages |
|---|---:|
| Pièces liminaires | 9 |
| Introduction générale | 2 |
| Chapitre 1 | 5 |
| Chapitre 2 | 5 |
| Chapitre 3 | 6 |
| Chapitre 4 | 6 |
| Chapitre 5 | 8 |
| Chapitre 6 | 6 |
| Conclusion générale | 2 |
| Bibliographie/Netographie | 3 |
| **Corps hors annexes** | **≈ 40** |
| Annexes A à F | 30 à 40 |
| **Total** | **≈ 80 à 90** |

---

# VIII. Les onze contenus à écrire

Récapitulatif de tout ce qui est marqué **`+`** dans le plan.

| # | § | Contenu | Volume | Source |
|:-:|---|---|---|---|
| 1 | 1.1.2 | Le service d'accueil et son organisation | 0,5 p. | À collecter auprès de l'encadrant entreprise |
| 2 | 1.1.3 | Mission confiée et rôle de l'élève-ingénieur | 0,5 p. | Rédaction personnelle |
| 3 | 5.10.1 | Déroulement et tâches quotidiennes | 0,5 p. | Rédaction personnelle |
| 4 | 5.10.2 | Difficultés rencontrées | 0,5 p. | Existe partiellement — à compléter |
| 5 | 5.10.3 | Changements apportés aux objectifs initiaux | 0,25 p. | Registre des écarts |
| 6 | 5.10.4 | Planning de travail, page complète | 1 p. | Diagramme à produire |
| 7 | Concl. | Apports pour l'entreprise | 0,25 p. | Rédaction personnelle |
| 8 | Concl. | Apports pour l'élève-ingénieur, compétences acquises | 0,5 p. | Rédaction personnelle |
| 9 | Liminaires | Résumé et *abstract* | 1 p. | À rédiger en dernier |
| 10 | Liminaires | Remerciements et dédicaces | 2 p. | Rédaction personnelle |
| 11 | Concl. | Perspectives structurées | 0,5 p. | Composants écartés du § 4.7.2 |

**Total à écrire : environ 7,5 pages**, dont la moitié relève de la rédaction personnelle et
ne dépend d'aucune mesure. **Ces pages peuvent être écrites dès maintenant**, en parallèle de
la campagne de validation.

---

# IX. Ce qui a changé par rapport à la version actuelle

| Changement | Motif |
|---|---|
| Passage de 78 à 40 pages de corps | Note pédagogique : 40 pages environ hors annexes |
| Création de six annexes A à F | Réception du contenu déplacé |
| Ajout de onze contenus personnels et de conduite de projet | Exigences explicites non couvertes |
| Déplacement du planning en fin de chapitre 5, sur une page complète | Exigence explicite de position et de format |
| Renumérotation des illustrations par type | Exigence explicite : `Fig.`, `Tab.`, `Graph.` |
| Sous-titres sortis de la hiérarchie numérotée | Ils ne correspondent à aucun niveau imposé |
| Section unique « Bibliographie/Netographie » | Intitulé imposé |
| Suppression des blocs techniques du corps | Les lignes de code sont proscrites dans le corps |
