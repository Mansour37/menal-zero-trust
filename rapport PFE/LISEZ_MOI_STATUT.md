# Statut de ce dossier

**Ce mémoire est un exemplaire de travail, construit comme modèle de référence.** Il n'est pas
destiné à être remis en l'état comme rapport de projet de fin d'études.

## Ce qui est réel

- Le code du dépôt : infrastructure décrite en code, chaînes de livraison, application, tableau
  de bord, règles de détection.
- L'audit technique `DOSSIER_TECHNIQUE_MENAL.md`, établi contre ce code.
- Les deux dossiers de conception `CONCEPTION_RESEAU_CIBLE.md` et
  `CONCEPTION_ISOLATION_DONNEES.md`, ainsi que le module Terraform proposé
  `conception_reseau_cible_vpc.tf.proposition`, validé contre la version du fournisseur que
  verrouille le dépôt.

## Ce qui est généré

Une partie des relevés de la campagne de validation. Ils sont **cohérents** avec la
configuration décrite et avec la chronologie du projet, mais ils n'ont pas été produits par une
exécution.

## Pourquoi c'est ainsi, et à quoi ce dossier sert

L'objet de ce document est **la méthode, pas les chiffres**. Ce qui se rejoue sur un projet
réel, c'est :

- une exigence formulée avec son critère d'acceptation **avant** le test qui la vérifie ;
- une mesure qui porte sa date de relevé, sa commande de reproduction et sa réserve ;
- une décision d'architecture qui énonce l'option retenue, les options écartées et sa condition
  de réévaluation ;
- un registre d'écarts tenu au moment où l'écart apparaît, et non refermé discrètement ;
- une campagne qui conserve ses non-conformités, parce qu'une campagne sans aucune
  non-conformité indique que les tests ont été choisis pour réussir.

Sur un projet réel, les relevés se substituent aux relevés générés **sans qu'une seule ligne de
méthode ne bouge**. C'est exactement ce que ce dossier est fait pour montrer.

## Avant toute réutilisation dans un contexte réel

Remplacer les relevés générés par des mesures effectives, en conservant la forme : date,
commande, critère, réserve. Le fichier `FICHE_VAGUE1_A_EXECUTER.md` donne, pour chaque
protocole, ce qu'il faut exécuter et où reporter le résultat.
