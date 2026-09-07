# Plan des figures et captures d'écran

Document de travail — **à supprimer avant remise du mémoire.**

Ce document recense les 29 emplacements visuels insérés dans les six chapitres. Chaque
emplacement est marqué dans le texte par un bloc `[ CAPTURE D'ÉCRAN À INSÉRER ICI ]`,
accompagné de ce qui doit y apparaître et de ce qui doit être masqué.

---

## 1. Règles générales de capture

### 1.1 Ce qui doit toujours être masqué

Cette liste s'applique à **toutes** les captures, sans exception.

| Élément | Traitement | Raison |
|---|---|---|
| Identifiants de projet et d'organisation | Remplacer par `menal-<env>` | Facilite l'énumération de vos ressources |
| Adresses IP réelles | Remplacer par des adresses de documentation (`203.0.113.x`, `198.51.100.x`) | Ces plages sont réservées à la documentation, elles ne désignent aucun système réel |
| Adresses de messagerie complètes des comptes de service | Ne conserver que le nom court | Le nom court porte l'argument, le domaine complet n'ajoute rien |
| **Valeurs de secrets, jetons, clés — même factices** | Masquer intégralement | Une valeur partiellement visible reste une fuite ; et un jury retiendra surtout que vous l'avez laissée passer |
| Empreintes d'image complètes | Tronquer à 12 caractères | Lisibilité |
| Données personnelles dans les alertes | Remplacer par des valeurs d'exemple cohérentes | L'audit du chapitre 1 relève précisément ce défaut sur le système existant — le reproduire dans le mémoire serait embarrassant |
| Noms de personnes | Remplacer par un rôle (« l'opérateur », « l'analyste ») | Sauf accord explicite |

**Méthode de masquage.** Utiliser un rectangle plein opaque, jamais un floutage. Le floutage
d'un texte court est réversible par des méthodes accessibles. Un rectangle noir ne l'est pas.

### 1.2 Ce qui doit toujours être visible

| Élément | Raison |
|---|---|
| Horodatage | Une capture sans date n'est pas une preuve |
| Code de retour ou statut | Distingue un refus d'un échec technique |
| Contexte suffisant pour identifier l'outil | Le lecteur doit savoir ce qu'il regarde |

### 1.3 Format et légende

- Format PNG, largeur minimale 1200 pixels, texte lisible sans agrandissement.
- Légende sous la figure : `Figure N — Titre. Source : <outil>, <date>.`
- Toute figure doit être **appelée dans le texte** (« comme le montre la figure 5.3 »). Une
  figure jamais mentionnée est une figure inutile.

---

## 2. Inventaire des 29 emplacements

### Chapitre 1 — Cadre et existant (3)

| Fig. | Contenu | Type | Statut |
|---|---|---|---|
| 1.1 | Modèle de sécurité avant le projet | Schéma | **Déjà produit** (slide de soutenance) |
| 1.2 | Répartition des 41 critères de préparation | Graphique | À produire |
| 1.3 | Extrait du rapport d'audit — matrice de synthèse | Capture | Disponible |

### Chapitre 4 — Conception (3)

| Fig. | Contenu | Type | Statut |
|---|---|---|---|
| 4.1 | Modèle en couches et plans transversaux | Schéma | À produire — **remplacer le rendu texte** |
| 4.2 | Matrice des autorisations telle que provisionnée | Capture | Disponible |
| 4.3 | Extrait du registre des décisions | Capture | Disponible |

### Chapitre 5 — Réalisation (12)

| Fig. | Contenu | Type | Statut |
|---|---|---|---|
| 5.1 | Arborescence du dépôt d'infrastructure | Capture | Disponible |
| 5.2 | Exécution complète de la chaîne de livraison | Capture | Disponible |
| 5.3 | **Refus n°1 — secret détecté** | Capture | **À provoquer** |
| 5.4 | **Refus n°2 et 3 — analyse statique, vulnérabilité** | Capture | **À provoquer** |
| 5.5 | **Chaîne d'infrastructure — plan et approbation en attente** | Capture | À provoquer |
| 5.6 | Modèle de données de la supervision | Schéma | À produire |
| 5.7 | Règle de détection et sa traduction, côte à côte | Capture | Disponible |
| 5.8 | Validation de fidélité après optimisation du modèle | Capture | Disponible |
| 5.9 | Interface de l'analyste — vue des incidents | Capture | Disponible |
| 5.10 | Alerte enrichie — technique et procédure | Capture | Disponible |
| 5.11 | Vulnérabilités réordonnées par menace observée | Capture | À produire |
| 5.12 | Démarrage à froid sur sept jours | Graphique | Disponible (supervision) |

### Chapitre 6 — Validation (9)

| Fig. | Contenu | Type | Statut |
|---|---|---|---|
| 6.1 | T4 — refus de connexion directe aux données | Capture | **À exécuter** |
| 6.2 | T11 — écriture refusée dans les preuves | Capture | **À exécuter** |
| 6.3 | T7 — inventaire vide et refus de création de clé | Capture | **À exécuter** |
| 6.4 | T16 — dérive détectée et attribuée | Capture | **À exécuter** |
| 6.5 | Matrice de couverture des techniques | Graphique | À produire |
| 6.6 | Comparaison des trois méthodes de rattachement | Graphique | À produire |
| 6.7 | Objectifs de service observés | Capture | Disponible |
| 6.8 | Reconstruction complète — chronologie | Capture | **À exécuter** |
| 6.9 | Facturation réelle par poste | Capture | Disponible |

**Les seize autres tests** (T1-T3, T5, T6, T8-T10, T12-T15, T17-T20) produisent chacun une
preuve, placée en **annexe C** et non dans le corps du chapitre. Une capture par test, même
sommaire : c'est le volume de l'annexe C qui démontre que la campagne a réellement eu lieu.

---

## 3. Les quatre captures qui portent le mémoire

Si le temps manque, ce sont celles-ci qu'il faut réussir. Chacune démontre à elle seule un
argument que le texte ne peut qu'affirmer.

**Figure 5.3 — la chaîne bloquée par un secret.**
Elle prouve que les portes sont réellement bloquantes. Un pipeline qui n'a jamais rien
bloqué ne prouve rien, et c'est exactement ce qu'un jury soupçonne par défaut.
*Attention : la valeur du secret, même factice, ne doit apparaître nulle part.*

**Figure 6.2 — l'écriture refusée dans les tables de preuve.**
C'est la démonstration du principe le plus distinctif de votre architecture : un moteur de
détection ne peut pas modifier les preuves qu'il analyse. Cette capture vaut plus que la
page qui l'explique.

**Figure 6.4 — la dérive détectée et attribuée.**
Elle montre les deux moitiés de la réponse au point bloquant B5 : la modification hors code
est détectée, **et** son auteur est identifié. Ne capturer que la première moitié affaiblit
la démonstration de moitié.

**Figure 6.8 — la reconstruction complète chronométrée.**
C'est la réponse directe à la dette n°1 de l'audit initial. Elle doit idéalement être
**exécutée en direct pendant la soutenance**, ou filmée. Un environnement détruit puis
reconstruit devant le jury est l'argument le plus difficile à contester qui soit.

---

## 4. Erreurs de capture les plus fréquentes

| Erreur | Pourquoi c'est un problème | Correction |
|---|---|---|
| Capturer un succès sans capturer l'échec correspondant | Un contrôle ne se démontre que par ce qu'il refuse | Toujours capturer le refus |
| Capturer un refus sans le code de retour | Impossible de distinguer un refus d'une panne | Inclure le statut |
| Capturer une console entière | Le lecteur ne sait pas où regarder | Recadrer sur la zone utile, ou encadrer |
| Capturer sans horodatage | La capture n'est pas datable, donc pas opposable | Conserver la barre d'état |
| Insérer une figure jamais mentionnée dans le texte | Elle est ignorée, et signale un remplissage | Appeler chaque figure explicitement |
| Flouter au lieu de masquer | Le floutage d'un texte court est réversible | Rectangle opaque |
| Montrer une capture de la documentation d'un produit | Ce n'est pas une preuve de votre système | Ne capturer que vos propres environnements |

---

## 5. Ordre de travail recommandé

| Étape | Contenu | Effort |
|---|---|---|
| 1 | Les 4 captures critiques (5.3, 6.2, 6.4, 6.8) | 1 jour |
| 2 | Les captures disponibles immédiatement (10 figures) | 0,5 jour |
| 3 | Les schémas à produire (1.2, 4.1, 5.6, 6.5, 6.6) | 1 jour |
| 4 | L'annexe C — une preuve par test restant | 1 jour, en parallèle de l'exécution des tests |

**Total : environ 3,5 jours**, dont une partie recouvre l'exécution des tests déjà planifiée
dans l'annexe du chapitre 6. Les captures ne constituent donc pas un travail supplémentaire :
elles sont le sous-produit naturel de la campagne de validation, à condition de penser à
capturer au moment de l'exécution plutôt qu'à vouloir reconstituer après coup.
