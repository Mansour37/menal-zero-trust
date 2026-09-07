# Captures à réaliser — sept cadres posés, sept images à déposer

**État au 30/08/2026.** Le mémoire porte **sept cadres de restitution de preuve**. Aucune image
n'est encore déposée : chaque cadre affiche, à la place, la **spécification de la prise** — la vue
attendue, ce qui vaut preuve dans cette vue, et ce qu'il faut masquer.

## Comment déposer une capture

Rien à modifier dans le LaTeX. Chaque cadre est écrit ainsi :

```latex
\IfFileExists{figures/K35.png}{ ...l'image, encadrée... }{ ...la spécification... }
```

**Il suffit de déposer le fichier `latex/figures/<ID>.png` et de recompiler** : l'encadré de
spécification s'efface, l'image prend sa place avec un filet fin, la légende ne change pas.

**Règles communes.** Largeur de la source ≥ 1 400 px pour rester lisible après réduction · recadrer
au contenu utile — pas de barre d'onglets, pas de bureau · texte interne lisible à ≥ 8 pt une fois
réduit · **masquer par rectangle opaque, jamais par flou** (un flou se retire) · aucune donnée
personnelle réelle à l'écran.

**Règle de date.** La date de relevé doit rester dans la fenêtre du stage, **au plus tard le
29/08/2026**. Le §6.1 annonce des preuves ponctuelles « datées jusqu'au 25/08/2026 » : si une
capture est relevée après cette date, **mettre à jour cette phrase en même temps**, sans quoi le
mémoire se contredit lui-même.

---

## Les sept cadres, par ordre de priorité

### 1. K23 — la porte d'analyse statique : le faux vert du 16/08 contre l'échec du 19/08
*Chapitre 5, §5.8.1 (difficultés rencontrées). Figure double.*
Les deux exécutions de la chaîne de livraison côte à côte : celle du **16/08/2026**, verte, qui
n'évaluait aucune règle, et celle du **19/08/2026**, en échec, qui en a évalué 612 sur 439 fichiers
et rendu 74 constats avec un code de sortie 1.
**Pourquoi en premier :** c'est la démonstration DevSecOps la plus forte du dossier — la même porte,
déclarée bloquante dans les deux cas, et le seul moyen de distinguer les deux est d'ouvrir le
journal. Le jury retient cette paire.
**Source :** historique des exécutions de la forge. Se recapture avec ses dates d'origine intactes.
**Masquer :** nom du dépôt s'il révèle un client, identifiants d'exécution.

### 2. K14 — les treize refus au périmètre du 19/08/2026
*Chapitre 6, §6.5, après le scénario de bout en bout.*
Le collecteur de journaux filtré sur les journaux du répartiteur, fenêtre du **19/08/2026 autour de
16:41 UTC** : les **treize** requêtes refusées en **403**, horodatées, avec le nom de la règle de
filtrage qui a prononcé chaque refus.
**Pourquoi :** c'est le premier maillon du fil conducteur du mémoire, et le seul dont la preuve
tienne dans une seule vue. L'alerte R2 de 16:56:08 n'agrège que ce décompte.
**Source :** Cloud Logging, tant que la rétention le permet — pas de rejeu nécessaire.
**Masquer :** numéro de projet cloud, adresses source réelles des requêtes.
**Attention :** ne pas y chercher la couverture du filtrage. Le motif brut de traversée de chemin,
qui a reçu une redirection 302 le 23/08, n'appartient pas à ce scénario — le cadre le dit lui-même.

### 3. K05 — le tableau de bord servi à un compte analyste
*Chapitre 5, §5.6.3.*
Page **Détections** du tableau de bord, session ouverte sous un compte portant le **rôle analyste**
— pas administrateur, c'est l'objet même de la preuve. Au moins une ligne de la règle **R2**
rattachée à la technique **T1498** et portant le locataire dans sa colonne de service, l'horodatage
visible, et le sélecteur de locataire affichant lui-même la portée partielle de son filtre.
**Date :** 23/08/2026 si la vue est repeuplée depuis la table d'archive de récupération — la table
vive ayant été vidée par une suppression d'administration les 24 et 25/08/2026 ; sinon, date du
rejeu. *La date portée par la capture fait foi.*
**Masquer :** identifiant de projet, courriel du compte connecté, adresses réelles.

### 4. K34 — la vue d'ensemble, et ce qui n'y est pas
*Chapitre 6, §6.7.*
Page **Vue d'ensemble**, cadrée sur le bandeau supérieur et la bande des cinq indicateurs, un
locataire sélectionné, au moins une détection de gravité élevée dans la répartition.
**Ce que le cadre établit :** l'absence, au milieu de compteurs vifs, de toute file d'incidents, de
tout accusé de prise en charge et de tout canal de notification. C'est cette absence qui est la
preuve — la chaîne de sécurité se termine par un écran.
**Masquer :** identifiant de projet, courriel du compte connecté.

### 5. K35 — l'écran de contribution de l'application pilote
*Chapitre 1, §1.2.1, après la boucle fonctionnelle.* **Cadre posé le 30/08/2026.**
Le premier temps de la boucle tel qu'il se présente au contributeur : phrase source affichée,
langue sélectionnée, commande d'enregistrement de la voix — le tout dans le même cadre.
**Pourquoi :** le mémoire parle d'ELSON pendant 103 pages sans jamais la montrer. Le jury le
demandera.
**Impératif :** **aucune contribution réelle d'un tiers** — ni voix, ni texte soumis, ni identité de
contributeur. Prendre la vue sur un compte de recette.
**Masquer :** nom et identifiant du compte connecté, adresse du service.

### 6. K36 — les charges de travail du socle sur la plateforme d'exécution
*Chapitre 5, §5.1.* **Cadre posé le 30/08/2026.**
Liste des services de la plateforme d'exécution de conteneurs, **projet de recette**, colonnes
service / région / dernier déploiement visibles.
**Ce que le cadre établit, en une vue :** une identité par charge de travail, et aucune charge hors
de la région européenne déclarée. Le décompte visible doit coïncider avec l'inventaire
technologique du chapitre 2.
**Masquer :** numéro et identifiant du projet cloud, adresses de service publiées.

### 7. K33 — la fiche d'incident et le candidat sémantique rendu à l'analyste
*Chapitre 6, §6.3.3.*
La fiche d'incident telle qu'un analyste la reçoit, avec le rattachement sémantique proposé et son
score de similarité.
**Réserve à respecter :** l'enrichissement est une branche informationnelle, hors du score
d'incident. La capture ne doit pas laisser croire l'inverse.
**Masquer :** identifiant de projet, courriel du compte connecté.

---

## Ce qui reste volontairement sans cadre

Douze protocoles de la campagne sont déclarés non exécutés ou partiellement conformes. Leur poser
une capture contredirait le mémoire, qui l'écrit lui-même. Leurs identifiants (K01, K03, K10, K11,
K12, K13, K19, K24 à K32) portent en annexe E un **attendu formulé avant exécution** : rien à
produire tant que le protocole n'est pas rejoué. C'est la même discipline que la hiérarchie de
preuves du §6.1 — une capture restitue une preuve nommée, elle n'en tient jamais lieu.

## Après le dépôt des images

1. Recompiler deux fois (`xelatex -jobname=build main.tex`, `biber build`, puis deux passes).
2. Vérifier que le total de pages n'a pas bougé de plus d'une ou deux unités — un cadre de 6 cm
   remplacé par une image plus haute peut déplacer un saut de page.
3. Vérifier qu'aucune légende ne promet un contenu que l'image ne montre pas : c'est le seul défaut
   qu'un jury attentif sanctionne réellement.
4. Si une capture a été relevée après le 25/08/2026, mettre à jour la phrase du §6.1 qui borne la
   date des preuves ponctuelles.
