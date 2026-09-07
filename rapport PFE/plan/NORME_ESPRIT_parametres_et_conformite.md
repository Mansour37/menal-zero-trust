# Norme ESPRIT — Paramètres de mise en page et plan de conformité

Document de référence — **à conserver pendant la rédaction, à supprimer avant remise.**

---

> ### Correction d'une recommandation antérieure
>
> Mes recommandations précédentes s'appuyaient sur un modèle de rapport diffusé de manière
> informelle, qui indique des chapitres de 20 à 25 pages. **La note pédagogique officielle
> fournie ici dit autre chose : 40 pages environ, hors annexes, pour le rapport entier.**
>
> La note officielle prime. La recommandation « laisser les chapitres croître jusqu'à 20-25
> pages » était erronée et doit être abandonnée. La section G ci-dessous en tire les
> conséquences, qui sont lourdes.

---

## A. Paramètres de mise en page

### A.1 Valeurs imposées

| Paramètre | Valeur | Où le régler dans un traitement de texte |
|---|---|---|
| Police du corps | **Times New Roman 12 pt** | Style « Normal » |
| Marges | **2,5 cm** sur les quatre côtés | Mise en page → Marges → Personnalisées |
| Interligne | **1,15** | Paragraphe → Interligne |
| Justification | **À droite et à gauche** (justifié) | Paragraphe → Alignement |
| Alinéa de première ligne | **0,50 cm** | Paragraphe → Retrait spécial → Première ligne |
| Titre du document | **24 pt, centré** | Page de garde |
| Pagination | **En bas à droite**, sous la forme `page/total` | Pied de page |
| Impression | **Recto verso** | Mise en page → Disposition |

### A.2 Réglages complémentaires recommandés

Ces réglages ne sont pas imposés mais découlent des exigences de pagination équilibrée.

| Paramètre | Valeur | Raison |
|---|---|---|
| Espacement avant/après paragraphe | 0 pt avant, 6 pt après | L'alinéa de 0,50 cm marque déjà le début de paragraphe ; un espacement double alourdit |
| Contrôle des veuves et orphelines | **Activé** | Exigence explicite : éviter les pages à trois lignes |
| Paragraphes solidaires | Activé sur les styles de titre | Évite qu'un titre reste seul en bas de page |
| Césure | Activée | Améliore le rendu du texte justifié en français |
| Langue de vérification | Français (France) | Cohérence de la correction orthographique |

> **Sur la césure.** Le texte justifié en français produit des espaces inter-mots irréguliers,
> surtout dans les colonnes étroites et avec des termes techniques longs. La césure automatique
> corrige ce défaut. C'est un détail, mais il est visible sur quarante pages.

---

## B. Styles de titres

### B.1 Hiérarchie et numérotation

La numérotation imposée est de la forme `1`, `1.1`, `1.1.1`.

| Niveau | Style | Taille | Graisse | Numérotation |
|---|---|---|---|---|
| Chapitre | Titre 1 | 18 pt | Gras | `Chapitre 1` |
| Section | Titre 2 | 16 pt | Gras | `1.1` |
| Sous-section | Titre 3 | 14 pt | Gras | `1.1.1` |
| Sous-sous-section | Titre 4 | 12 pt | Gras | `1.1.1.1` |

**Taille décroissante en fonction de la profondeur** : c'est une exigence explicite.

### B.2 Espacements des titres

Trois valeurs précises sont imposées :

| Élément | Valeur |
|---|---|
| Retrait du titre par rapport au bord de la page | **0,20 cm** |
| Retrait des lignes suivantes d'un titre sur deux lignes | **0,30 cm** |
| Espacement entre le numéro et le texte du titre | **0,20 cm** |

Ces valeurs se règlent une seule fois, dans la définition des styles, jamais manuellement
titre par titre.

### B.3 Conséquence sur le mémoire actuel

Les sous-titres en italique ajoutés aux six chapitres (*« De l'audit d'une plateforme… »*)
ne correspondent à aucun niveau de la hiérarchie imposée.

**Deux options :**

- **Les supprimer** — solution la plus sûre au regard de la norme.
- **Les conserver** en les traitant comme du texte courant en italique, centré, sous le titre
  de chapitre, et **non comme un style de titre**. Ils n'apparaîtront alors pas dans la table
  des matières.

La seconde option est acceptable et préserve l'apport des sous-titres. Elle suppose de créer
un style dédié, non inclus dans la numérotation.

---

## C. Numérotation des illustrations

### C.1 La règle est différente de celle appliquée jusqu'ici

L'exigence est explicite : **les figures doivent être numérotées de manière cohérente en
fonction de leur type** — `Tab. 1`, `Graph. 1`, `Fig. 1`.

Le mémoire actuel numérote par chapitre (`Figure 5.3`). **C'est à reprendre.** La numérotation
devient continue sur tout le document, et séparée par type.

Chaque illustration doit en outre comporter :

- **une légende**, placée sous l'illustration ;
- **une référence dans le texte** — toute illustration jamais appelée doit être supprimée ou
  déplacée en annexe.

### C.2 Répartition par type

| Type | Étiquette | Contenu concerné dans le mémoire | Nombre estimé |
|---|---|---|---|
| Figure | `Fig. N` | Schémas d'architecture, diagrammes UML, captures d'écran | 27 |
| Tableau | `Tab. N` | Tous les tableaux | Plus de 50 avant réduction |
| Graphique | `Graph. N` | Histogrammes, courbes, répartitions | 7 |

### C.3 Table de conversion des figures actuelles

| Numérotation actuelle | Nouvelle étiquette | Titre |
|---|---|---|
| 1.1 | Fig. 1 | Modèle de sécurité avant le projet |
| 1.2 | Fig. 2 | Extrait du rapport d'audit |
| 1.3 | **Graph. 1** | Répartition des 41 critères de préparation |
| 1.4 | *(tableau)* → Tab. n | Positionnement des trois modèles |
| 1.5 | Fig. 3 | Planification du projet — Gantt |
| 3.1 | Fig. 4 | Cas d'utilisation du socle |
| 4.1 | Fig. 5 | Modèle en couches et plans transversaux |
| 4.2 | Fig. 6 | Séquence — flux nominal |
| 4.3 | Fig. 7 | Diagramme de déploiement |
| 4.4 | Fig. 8 | Matrice des autorisations provisionnée |
| 4.5 | Fig. 9 | Extrait du registre des décisions |
| 5.1 | Fig. 10 | Arborescence du dépôt d'infrastructure |
| 5.2 | Fig. 11 | Exécution de la chaîne de livraison |
| 5.3 | Fig. 12 | Séquence — chaîne de livraison |
| 5.4 | Fig. 13 | Refus n°1 — secret détecté |
| 5.5 | Fig. 14 | Refus n°2 et 3 |
| 5.6 | Fig. 15 | Chaîne d'infrastructure — approbation |
| 5.7 | Fig. 16 | Séquence — détection et enrichissement |
| 5.8 | Fig. 17 | Modèle de données de la supervision |
| 5.9 | Fig. 18 | Règle de détection et sa traduction |
| 5.10 | Fig. 19 | Validation de fidélité du modèle |
| 5.11 | Fig. 20 | Interface de l'analyste |
| 5.12 | Fig. 21 | Alerte enrichie |
| 5.13 | Fig. 22 | Vulnérabilités réordonnées |
| 5.14 | **Graph. 2** | Démarrage à froid sur sept jours |
| 6.1 | Fig. 23 | T4 — refus de connexion directe |
| 6.2 | Fig. 24 | T11 — écriture refusée |
| 6.3 | Fig. 25 | T7 — inventaire vide des clés |
| 6.4 | Fig. 26 | T16 — dérive détectée |
| 6.5 | **Graph. 3** | Couverture des techniques d'attaque |
| 6.6 | **Graph. 4** | Comparaison des trois méthodes |
| 6.7 | **Graph. 5** | Objectifs de service observés |
| 6.8 | Fig. 27 | Reconstruction complète — chronologie |
| 6.9 | **Graph. 6** | Facturation réelle par poste |

**Conséquence pratique** : la liste des figures devient **trois listes** — liste des figures,
liste des tableaux, liste des graphiques. C'est cohérent avec la séparation par type.

---

## D. Règles de rédaction

| Élément | Règle imposée | État du mémoire |
|---|---|---|
| Exemples | **En italique** | À vérifier au relecture finale |
| Définitions | **Encadrées** ou non | Choisir une convention et s'y tenir |
| Conclusions et éléments essentiels | **En gras** | ✅ Déjà appliqué de manière systématique |
| Citations courtes | **Entre guillemets français « »** | À vérifier — utiliser « » et non " " |
| **Lignes de code dans le corps** | **Proscrites** — reporter en annexe | ⚠️ **Non conforme, voir ci-dessous** |
| Détails techniques | En annexe | ⚠️ À redistribuer |
| Fin de chapitre | Ne pas terminer sur une page de quelques lignes | À vérifier à la mise en page finale |

### D.1 Le point non conforme : les blocs techniques dans le corps

L'interdiction des lignes de code est explicite. Trois éléments du mémoire actuel tombent
sous cette règle :

| Élément | Chapitre | Traitement |
|---|---|---|
| L'arborescence du dépôt d'infrastructure en texte brut | 5, §5.1.2 | **Transformer en figure** (`Fig. 10`) ou déplacer en annexe B |
| Le rendu texte du modèle en couches | 4, §4.2.3 | **Remplacer par le schéma** `Fig. 5` — le rendu texte disparaît |
| Le rendu texte de la chaîne de traitement des données | 5, §5.5.2 | **Remplacer par le schéma** `Fig. 17` |
| Le gabarit de fiche de test | 6, §6.1.3 | **Déplacer en annexe E** |

Ces quatre transformations sont à faire de toute façon : elles font partie des figures déjà
prévues au plan des captures.

---

## E. Bibliographie et netographie

### E.1 Format imposé

**Une seule section, intitulée « Bibliographie/Netographie ».**

Les références doivent être **complètes afin d'être utilisables par un lecteur**. Les éléments
exigés sont :

| Type de source | Éléments obligatoires |
|---|---|
| Article de revue | Auteurs, titre, **nom de la revue**, éditeur, date de parution, **numéro de la revue**, **pages** |
| Communication en congrès | Auteurs, titre, **nom du congrès**, éditeur, date, **lieu du congrès**, pages |
| Ouvrage | Auteurs, titre, éditeur, date |
| **Source internet** | **URL**, **et en plus : le sujet, les auteurs, et si possible la date de parution** |

> La mention « si possible la date de parution » pour les sources en ligne signifie que l'URL
> seule est insuffisante. Une référence en ligne réduite à un lien est considérée comme
> incomplète.

### E.2 Application aux références actuelles

Les seize références du chapitre 2 doivent être reprises. Trois exemples de mise au format :

**Référence de congrès — conforme :**
> Abdeen, B., Al-Shaer, E., Singhal, A., Khan, L., Hamlen, K. *SMET: Semantic Mapping of CVE
> to ATT&CK and its Application to Cybersecurity.* IFIP Annual Conference on Data and
> Applications Security and Privacy (DBSec), Springer LNCS, Sophia Antipolis, 2023,
> p. 243-260.

**Référence de norme — à compléter :**
> Rose, S., Borchert, O., Mitchell, S., Connelly, S. *Zero Trust Architecture.* NIST Special
> Publication 800-207, National Institute of Standards and Technology, Gaithersburg, août
> 2020. `[ AJOUTER : URL et date de consultation ]`

**Référence en ligne — format complet exigé :**
> SigmaHQ. *Sigma — Format générique de règles de détection pour systèmes de supervision.*
> Documentation du projet. `[ AJOUTER : URL complète ]`, publiée le `[ date ]`, consultée le
> `[ date ]`.

**Cinq références du chapitre 2 sont actuellement incomplètes** au regard de cette exigence :
les numéros [1], [4], [7], [8] et [15].

---

## F. Contenu obligatoire absent du mémoire actuel

La note pédagogique impose des contenus que le mémoire ne comporte pas. **Ce sont des
manques de conformité, pas des choix.**

| # | Contenu exigé | État | Où l'insérer |
|---|---|---|---|
| **F1** | **Présentation du service** dans lequel le projet a été effectué, après la présentation générale de l'entreprise | ❌ Absent | Ch. 1, nouvelle section 1.1.4 |
| **F2** | **La mission** confiée à l'élève-ingénieur, explicitement formulée | ⚠️ Implicite | Ch. 1, §1.1.5 |
| **F3** | **La place et le rôle** de l'élève-ingénieur au sein de la structure | ❌ Absent | Ch. 1, §1.1.5 |
| **F4** | **Les tâches quotidiennes** effectuées durant le stage | ❌ Absent | Ch. 5, section finale |
| **F5** | **Le planning de travail**, sur une **page complète**, placé **à la fin de la description du travail** | ⚠️ Mal placé | **Déplacer de Ch. 1 §1.9 vers la fin du Ch. 5** |
| **F6** | **Les difficultés rencontrées** et les changements apportés aux objectifs initiaux | ⚠️ Partiel | Ch. 5, §5.9 existe — le compléter |
| **F7** | **Évaluation de l'intérêt du stage** : apports professionnels et personnels, réciproques | ❌ Absent | Conclusion générale |
| **F8** | **Les objectifs ont-ils été atteints**, pour l'entreprise **et** pour l'élève-ingénieur | ⚠️ Partiel | Conclusion générale |

### F.1 Le déplacement du planning

L'exigence est précise : le planning doit figurer **à la fin de la description du travail, sur
une page complète**. Le diagramme de Gantt actuellement placé en section 1.9.3 doit être
déplacé à la fin du chapitre 5.

Ce déplacement a un avantage : le planning y devient un bilan de ce qui a été fait, et non une
prévision en début de rapport. Il peut alors faire apparaître les décalages réels entre le
prévisionnel et le réalisé — ce qui répond en même temps à l'exigence F6.

### F.2 La dimension personnelle

C'est l'écart le plus important en nature, et le plus facile à combler.

Le mémoire actuel est un document d'ingénierie impersonnel. La note pédagogique demande
autre chose : *quelle était la mission, quel a été le rôle, quel type d'expérience a été
acquise, qu'a apporté l'élève à l'entreprise et l'entreprise à l'élève.*

**Deux à trois pages suffisent**, réparties entre le chapitre 1 (mission et rôle) et la
conclusion générale (apports réciproques et bilan). Ne pas les écrire serait perdre des points
sur un critère explicite.

---

## G. Le conflit de volume et son traitement

### G.1 L'écart

| | Valeur |
|---|---|
| Volume actuel du corps | 35 330 mots, soit **environ 78 pages** au format imposé |
| Volume exigé | **40 pages environ, hors annexes** |
| **Réduction nécessaire** | **Environ 55 %** |

Cet écart n'est pas un détail de mise en page. Il impose une redistribution du contenu.

### G.2 Le principe de redistribution

**Rien n'est supprimé. Tout ce qui sort du corps entre en annexe.** La note pédagogique
indique que les 40 pages s'entendent hors annexes, et que les détails techniques doivent y
être reportés — la redistribution est donc conforme à l'esprit du texte, et non un
contournement.

**Le critère de tri :** reste dans le corps ce qui porte le **raisonnement** ; passe en annexe
ce qui porte la **preuve** ou le **détail d'exécution**.

### G.3 Redistribution par chapitre

| Chapitre | Actuel | **Cible** | Reste dans le corps | Passe en annexe |
|---|---:|---:|---|---|
| Intro générale | — | **2 p.** | — | — |
| Ch. 1 | 12 p. | **5 p.** | Entreprise et service, mission et rôle, synthèse de l'audit, cinq carences, problématique, six objectifs | Détail des six constats bloquants, tableau des 41 critères, tableau de positionnement à 15 lignes → **Annexe A** |
| Ch. 2 | 11 p. | **5 p.** | Sept principes, familles de contrôles, choix justifié du système de supervision, travail le plus proche et différences, quatre verrous | Tableaux comparatifs détaillés, comparaison des modes d'exécution → **Annexe A** |
| Ch. 3 | 12 p. | **6 p.** | Acteurs, huit cas d'utilisation, valeurs métier, sept scénarios stratégiques, **matrice de traçabilité condensée** | Les 24 scénarios opérationnels détaillés, les échelles, la cartographie du risque → **Annexe C** |
| Ch. 4 | 14 p. | **6 p.** | Quatre principes, modèle en couches, sept flux, plan d'identité, couverture des exigences, **treize décisions en tableau synthétique**, six écarts | Conception détaillée par couche, justification longue de chaque décision, sept composants écartés → **Annexe D** |
| Ch. 5 | 14 p. | **8 p.** | Organisation, deux chaînes de livraison, chaîne de détection, enrichissement, boucle F6, trois incidents, **planning de travail en pleine page** | Arborescence du dépôt, structure de l'état, gabarits de traduction → **Annexe B** |
| Ch. 6 | 13 p. | **6 p.** | Stratégie, **résultats** des vingt tests, couverture et lacunes, comparaison des trois méthodes, coût, limites, réponse aux objectifs | **Protocoles** des vingt tests, fiches détaillées, jeu annoté → **Annexes E et F** |
| Conclusion générale | — | **2 p.** | — | — |
| **Total corps** | **78 p.** | **40 p.** | | |

### G.4 La règle de coupe

Pour chaque chapitre, l'opération est la même :

1. **Conserver l'affirmation et le résultat** ; déplacer la démonstration détaillée.
2. **Conserver un tableau de synthèse** dans le corps, avec renvoi explicite vers le tableau
   complet en annexe.
3. **Réduire le commentaire méthodologique** — c'est le premier gisement, et il était déjà
   signalé comme trop dense.

**Exemple appliqué au chapitre 3.** Le tableau des 24 scénarios opérationnels occupe près de
deux pages. Dans le corps, il devient : *« L'application systématique de la méthode aux sept
flux produit vingt-quatre scénarios opérationnels, dont huit atteignent le niveau de risque
le plus élevé. Sept de ces huit concernent les chemins de livraison, de provisionnement et
d'accès aux données. Le détail figure en annexe C. »* Quatre lignes au lieu de deux pages,
et l'enseignement est intégralement conservé.

### G.5 Ce qu'il ne faut pas couper

| À conserver absolument | Raison |
|---|---|
| La matrice de traçabilité, même condensée | C'est ce qui relie les chapitres 3 à 6 |
| Les six objectifs mesurables et leur réponse | Exigence explicite : les objectifs ont-ils été atteints |
| Les trois incidents d'ingénierie | Exigence explicite : difficultés rencontrées |
| Les six écarts de réalisation | Exigence explicite : changements apportés aux objectifs initiaux |
| La déclaration des lacunes de détection | C'est ce qui rend les résultats crédibles |
| Le planning de travail | Exigence explicite, page complète |

---

## H. Structure finale conforme

| Partie | Contenu | Pages |
|---|---|---|
| Page de garde | Modèle fourni par l'établissement | 1 |
| Dédicaces | | 1 |
| Remerciements | | 1 |
| Résumé / *Abstract* | | 1 |
| Table des matières | | 2 |
| Liste des figures | `Fig. 1` à `Fig. 27` | 1 |
| Liste des tableaux | `Tab. 1` à `Tab. N` | 1 |
| Liste des graphiques | `Graph. 1` à `Graph. 6` | 0,5 |
| Liste des acronymes | | 1 |
| **Introduction générale** | Sujet, problème, démarche, **annonce du contenu de chaque chapitre**, **sans évocation de résultats** | 2 |
| **Chapitres 1 à 6** | Chacun : introduction, développement, **conclusion résumant les résultats et introduisant le suivant** | 36 |
| **Conclusion générale** | Récapitulation, résultats, problèmes rencontrés, apports, perspectives | 2 |
| Bibliographie/Netographie | Section unique | 3 |
| Annexes A à F | | 30 à 40 |

**Corps hors annexes : 40 pages.** Conforme.

---

## I. Checklist de conformité avant remise

### Mise en page
- [ ] Times New Roman 12 pt sur tout le corps
- [ ] Marges 2,5 cm
- [ ] Interligne 1,15
- [ ] Texte justifié
- [ ] Alinéa de première ligne 0,50 cm
- [ ] Pagination en bas à droite, forme `page/total`
- [ ] Titre du document 24 pt centré sur la page de garde
- [ ] Aucune page ne comportant que quelques lignes
- [ ] Aucune illustration orpheline sur une page

### Titres
- [ ] Numérotation `1`, `1.1`, `1.1.1`
- [ ] Taille décroissante avec la profondeur
- [ ] Retraits 0,20 cm / 0,30 cm / 0,20 cm réglés dans les styles
- [ ] Sous-titres de chapitre traités hors hiérarchie ou supprimés

### Illustrations
- [ ] Numérotation par type : `Fig.`, `Tab.`, `Graph.`
- [ ] Numérotation continue sur tout le document
- [ ] Légende sous chaque illustration
- [ ] **Chaque illustration appelée dans le texte**
- [ ] Trois listes distinctes en pièces liminaires

### Contenu
- [ ] Présentation du service d'accueil
- [ ] Mission et rôle de l'élève-ingénieur explicités
- [ ] Tâches quotidiennes décrites
- [ ] Planning de travail en pleine page, à la fin de la description du travail
- [ ] Difficultés rencontrées et changements d'objectifs
- [ ] Apports professionnels et personnels, réciproques
- [ ] Introduction générale sans évocation de résultats
- [ ] Conclusion générale reprenant les cinq points exigés
- [ ] Chaque chapitre : introduction, développement, conclusion de transition

### Forme rédactionnelle
- [ ] **Aucune ligne de code dans le corps**
- [ ] Détails techniques reportés en annexe
- [ ] Citations courtes entre guillemets « »
- [ ] Exemples en italique
- [ ] Éléments essentiels en gras
- [ ] Section unique « Bibliographie/Netographie »
- [ ] Références complètes, avec URL, sujet, auteurs et date pour les sources en ligne
- [ ] Aucune marque de document de travail
- [ ] **Volume du corps : 40 pages environ**

---

## J. Ordre des opérations recommandé

| # | Opération | Effort | Pourquoi dans cet ordre |
|:-:|---|---|---|
| 1 | Produire les mesures du chapitre 6 | 10-13 j | Tout le reste en dépend |
| 2 | Écrire les contenus manquants F1 à F8 | 1 j | Exigences explicites, faciles à combler |
| 3 | **Redistribuer corps / annexes selon la section G** | 2 j | À faire avant la mise en forme, sinon le travail est fait deux fois |
| 4 | Produire les 27 figures et 6 graphiques | 4,5 j | |
| 5 | Renuméroter par type selon la table C.3 | 0,5 j | Après stabilisation du plan |
| 6 | Rédiger introduction et conclusion générales | 1 j | En dernier, une fois les résultats connus |
| 7 | Compléter la bibliographie au format E.1 | 0,5 j | |
| 8 | Appliquer les styles et la mise en page | 1 j | **En dernier** — appliquer les styles avant que le contenu ne soit stable oblige à tout reprendre |
| 9 | Dérouler la checklist I | 0,5 j | |

**Total : environ 21 à 24 jours.**

> **Une erreur à éviter.** La tentation est de commencer par la mise en forme, qui est
> gratifiante et visible. C'est l'ordre inverse du bon : toute modification de contenu
> postérieure à la mise en forme oblige à reprendre la pagination, les renvois et les listes.
> La mise en forme est la dernière opération, jamais la première.
