# RAPPORT_FINAL_LIMINAIRES.md — liminaires, ch. 1, ch. 2, annexes A–F

**Équipe** : vague finale, périmètre `frontmatter/*`, `chapters/final/ch1_cadre_existant.tex`,
`chapters/final/ch2_etat_art.tex`, `appendices/*`.
**Date** : 30/08/2026. **Chaîne** : `xelatex -jobname=buildZ` → `biber buildZ` → deux passes.
**Aucun fichier supprimé. Aucun fichier hors périmètre ouvert en écriture.**

---

## 0. Mesure de départ (buildZ, 30/08/2026, avant toute modification)

`Output written on buildZ.pdf (154 pages)`, `grep -c '^!' buildZ.log` = **0**.

Correspondance folio ↔ page PDF : la page de garde est la page PDF 1, le folio romain `i`
la page PDF 2 ; **folio arabe *n* = page PDF *n*+13** au départ, *n*+11 à l'arrivée.

| Partie | Bornes départ | **Départ** | Cible | Écart |
|---|---|---:|---:|---:|
| Liminaires (garde + i à xii) | PDF 1–13 | **13** | 10 | +3 |
| Ch. 1 — Contexte et existant | p. 4–14 | **11** | 8 | +3 |
| Ch. 2 — État de l'art | p. 15–29 | **15** | 11 | +4 |
| Annexes A à F | p. 117–140 | **24** | 21 | +3 |
| **Périmètre** | | **63** | **50** | **+13** |

Décomposition des 13 pages de liminaires, mesurée page par page :
garde (1), Dédicace i, Remerciements ii, Résumé iii, Abstract iv, Acronymes v,
**Conventions vi (1 page)**, **Table des matières vii–ix (3 pages)**, Table des figures x,
**Liste des tableaux xi–xii (2 pages)**.

---

## 1. Résultat mesuré — avant / après, lu sur `buildZ.toc` et `buildZ.pdf`

**Contrôles de sortie** : `grep -c '^!' buildZ.log` = **0**, `grep -ac undefined buildZ.log` = **0**,
`Output written on buildZ.pdf (144 pages)`. Chaîne complète exécutée (xelatex, biber, deux passes).

| Partie | Départ | **Arrivée** | Cible | Écart | Bornes finales |
|---|---:|---:|---:|---:|---|
| Liminaires (garde + i à x) | 13 | **11** | 10 | +1 | PDF 1–11 |
| Ch. 1 — Contexte et existant | 11 | **10** | 8 | +2 | p. 4–13 |
| Ch. 2 — État de l'art | 15 | **13** | 11 | +2 | p. 14–26 |
| Annexes A à F | 24 | **24** | 21 | +3 | p. 109–132 |
| **Périmètre** | **63** | **58** | **50** | **+8** | |
| Document entier | 154 | **144** | ≤ 120 | | |

Le document entier passe de 154 à 144 pages pendant la session, mais une partie de cet écart
appartient aux autres équipes, qui écrivaient les chapitres 3 à 6 en parallèle ; seule la ligne
« Périmètre » mesure ce travail-ci.

Détail des annexes à l'arrivée (relevé final) : A 109–113 (5), B 114–117 (4), C 118–121 (4),
D 122–124 (3), E 125–130 (6), F 131–132 (2). Les folios se décalent à chaque livraison des
autres équipes ; le nombre de pages par annexe, lui, est stable.

Liminaires à l'arrivée : garde (1), Dédicace i, Remerciements ii, **Résumé + Abstract iii**
(une seule page), Acronymes iv, Conventions v, **Table des matières vi–vii** (deux pages),
Table des figures viii, Liste des tableaux ix–x.

Source : ch1 743 → 715 lignes, ch2 966 → 917, annexe A 385 → 387 (elle **reçoit** un bloc du
ch. 2), annexe C 230 → 208, annexe D 242 → 237, annexe F 98 → 102.

---

## 2. Deux faits établis par la mesure, qui changent la lecture des rapports précédents

### 2.1 Les conventions de notation ne font pas quatre pages : elles en font une

Le brief de mission — et le message de coordination qui l'a répété — annonce que les
« Conventions de notation » occupent **quatre pages (vi à x)**. **C'est faux au 30/08/2026.** Le
relevé page par page de `buildZ.pdf` donne : conventions = **une seule page**, déjà densifiée par
l'équipe précédente (`RAPPORT_EXEC_ANNEXES.md` §2.3 : suppression de la colonne « Introduit au »,
regroupement par bandeaux de chapitre). Les quatre pages attribuées aux conventions étaient en
réalité **1 page de conventions + 3 pages de table des matières**.

Conséquence : le gisement des liminaires n'était pas là où le brief le situait. Il était dans la
**table des matières** (3 pages) et dans la **liste des tableaux** (2 pages).

### 2.2 Tous les `longtable` sont déjà composés à 8 pt — la coupe de rang 1 du rapport ch. 1–ch. 2 vaut zéro

`config/formatting.tex` l. 114 pose `\AtBeginEnvironment{longtable}{\scriptsize}`. Ce code
s'exécute **à l'intérieur** de l'environnement et **écrase** toute taille déclarée autour de lui.
Vérifié par mesure directe (fichier de sonde, `\f@size` relevé à trois profondeurs) :

```
hors groupe                      TAILLE COURANTE = 12pt
dans \begingroup\footnotesize    TAILLE COURANTE = 10pt
dans le longtable qui suit       TAILLE COURANTE =  8pt
```

Donc :

- `tab:briques-structurantes` **était déjà en `\scriptsize`**. La coupe de rang 1 de
  `RAPPORT_EXEC_CH1_CH2.md` §6.3 — « passer le tableau des trente-trois briques de `\footnotesize`
  à `\scriptsize`, gain −0,8 p. » — **ne rapporte rien** : elle décrit un changement déjà effectif.
  Le `\footnotesize` écrit devant ce tableau (et devant six autres) est du **code mort**, trompeur
  pour la maintenance ;
- inversement, deux tableaux de l'annexe C (`tab:cartographie-risque`, `tab:decisions-traitement`)
  ne déclaraient **aucune** taille et étaient donc composés **à 12 pt**, dans une annexe dont tous
  les autres tableaux sont à 8 pt. C'était le vrai gisement typographique, et il n'avait été vu par
  personne.

---

## 3. Les coupes, par nature

Convention : **T** = densification typographique ou tabulaire · **R** = redondance ramenée à un
renvoi · **F** = reformulation à contenu constant · **S** = déplacement · **C** = coupe réelle.

### 3.1 Liminaires (13 → 11)

| Type | Geste | Gain |
|---|---|---:|
| S | **Résumé et Abstract réunis sur une seule page** (folio iii). C'est ce que demande la norme ESPRIT §H, qui budgète « Résumé / *Abstract* : 1 page » ; le mémoire en consommait deux. `abstract.tex` n'ouvre plus de `\chapter*` (qui force un saut de page) mais un titre de même corps et de même graisse ; les deux textes passent en `\footnotesize` (10 pt) et sont resserrés d'environ 15 %. **Toutes les valeurs datées sont conservées.** | **−1 p.** |
| T | **Table des matières ramenée de 3 à 2 pages** (norme ESPRIT §H : 2 pages). `report.cls` insère `\vskip 1.0em` avant chaque entrée de niveau chapitre (`\l@chapter`, l. 615) ; le mémoire en compte vingt-trois, soit à lui seul une page de blanc. Ramené à `0.1em` par un `\patchcmd` d'etoolbox. | **−1 p.** |
| T | Quatre `\section` supprimées dans les annexes E et F (devenues des amorces en gras) : quatre lignes de moins dans la table des matières, ce qui a rendu le point précédent possible. Aucun contenu perdu, aucun `\label` détruit — vérifié : seules des références de niveau chapitre pointent vers E et F. | (contribue) |
| T | Colonnes de `conventions.tex` et de `acronyms.tex` portées à la largeur utile. | 0 |

### 3.2 Ch. 1 (11 → 10)

| Type | Geste | Gain |
|---|---|---:|
| T | `tab:actifs-adversaires` (3 lignes) **converti en prose**. Les trois actifs, les trois adversaires et les quatre codes d'acteur (A7, A8, A9, A11) sont conservés mot pour mot. Le mémoire compte un tableau de moins, donc une ligne de moins dans la liste des tableaux. | ≈ 0,3 p. |
| T | Largeurs de colonnes des trois tableaux portées de 13,4–14,8 cm à 15,3–15,4 cm ; enveloppes mortes retirées (`\footnotesize` sans effet, `\begin{center}` autour d'un `longtable`). | ≈ 0,3 p. |
| T | Blancs autour des flottants réduits (`\textfloatsep` 20 → 10 pt, `\intextsep` et `\floatsep` 12 → 8 pt) sur le seul segment ch. 1 – ch. 2, rétablis en fin de ch. 2. Sept flottants dans le ch. 1. | ≈ 0,25 p. |
| T | Hauteur des trois figures TikZ comprimée verticalement (`y=0.86cm`, `0.88cm`, `0.9cm`) : **aucune police touchée**, aucune coordonnée réécrite, aucun libellé sous `\scriptsize`. | ≈ 0,15 p. |
| R | Renvoi faux corrigé (voir §5.1). | — |
| F | Onze blocs reformulés à contenu constant (§1.1.1 à §1.5.3 et conclusion). Le paragraphe isolé d'une ligne « Deux registres accompagnent le projet » est fondu dans le paragraphe précédent — défaut de mise en page signalé par le brief §3. | ≈ 0,8 p. |

**Rien de protégé n'a été touché** : C1–C5, O1–O6, Q1–Q6, B1–B6, PH0–PH7, les six contraintes, les
dates (29/07/2026, 28/08/2026), les compteurs de l'audit (41 critères, 12/7/22, 6 sur 7), le
tableau des objectifs et le graphique de l'audit sont intacts.

### 3.3 Ch. 2 (15 → 13)

| Type | Geste | Gain |
|---|---|---:|
| T | **Largeurs de colonnes.** `tab:briques-structurantes` : 14,75 → 15,50 cm de colonnes, `tabcolsep` 3 → 2 pt, `arraystretch` 1,00 → 0,92, `LTpre/LTpost` 4 → 2 pt. Les quatre autres tableaux portés de 14,0–14,6 cm à 15,2–15,4 cm. **Les 33 briques, les 33 critères décisifs et les 33 prix payés sont intégralement conservés.** | ≈ 0,7 p. |
| T | Les quatre tableaux en `tabular` passent de 10 pt à 8 pt, taille à laquelle **tous** les `longtable` du mémoire sont déjà composés (§2.2) : la typographie des tableaux devient homogène au lieu d'être mixte. | ≈ 0,4 p. |
| T | Légendes « (suite) » supprimées sur les tableaux à cheval sur plusieurs pages : la ligne d'en-tête est déjà répétée par `\endhead`, la légende complète reste sur la première page, et `\caption[]` ne produit aucune entrée dans la liste des tableaux. | ≈ 0,15 p. |
| S | **Le bloc « Alternatives évaluées puis écartées, une phrase par couche » descend en annexe A** (§A.2.2, `ann:alternatives-couches`). C'est du matériel de reproduction pur — il permet de refaire le choix, il ne porte aucun argument —, et il atterrit sur une page d'annexe qui portait du blanc : **le ch. 2 gagne 0,35 p. et l'annexe A n'en perd aucune.** | ≈ 0,35 p. |
| C | **Deux encadrés `keybox` supprimés**, tous deux des clôtures qui redisaient le paragraphe précédent : celui du critère de sélection et celui des deux natures de refus. **Leur argument est conservé, fondu en une phrase dans le paragraphe qu'ils suivaient** — la distinction arbitrage de coût / principe, en particulier, reste écrite. | ≈ 0,3 p. |
| R | §2.7 : le rappel des cinq référentiels « déjà justifiés là où ils servent » récitait §2.1 et §2.2 avec leurs douze références bibliographiques. Ramené à une phrase et deux renvois ; **la justification propre de la méthode d'analyse de risque (STRIDE, EBIOS RM, ISO 27005) est conservée en entier**, parce qu'elle structure le ch. 3. | ≈ 0,3 p. |
| F | Dix-huit blocs reformulés à contenu constant. | ≈ 0,7 p. |

**Rien de protégé n'a été touché** : V1–V4 avec leur origine et leur traitement, les 33 briques, les
7 composants écartés avec leur condition de réévaluation, PR1, D00, D07, D08, D15, É10, les dates
(15–22/08, 24/08, 28/08/2026, version 19 du 28/04/2026), les deux études comparatives formalisées,
le tableau du critère de sélection avec ses **deux rejets et son cas frontière**.

### 3.4 Annexes (24 → 24, avec ≈ 2,2 pages retirées et ≈ 0,4 page ajoutée)

| Type | Annexe | Geste | Gain |
|---|---|---|---:|
| R | A | **`tab:audit-41-complet` supprimé.** Il ne contenait pas « la grille des 41 critères » que son titre annonçait, mais la seule répartition par catégorie — **déjà publiée en entier par `graph:audit-41` du ch. 1**. C'est exactement le cas visé par la consigne « coupe ce qui répète le corps ». La lecture propre à l'annexe (86 % / 0 % / à mi-chemin) est conservée dans le chapeau. | ≈ 0,3 p. |
| S | A | Réception du bloc d'alternatives du ch. 2 (§3.3). | −0,3 p. |
| T | A, B, C, D, F | Largeurs de colonnes portées à la largeur utile sur dix tableaux (12,9–14,5 cm → 15,0–15,9 cm). | ≈ 0,7 p. |
| T | C | `tab:cartographie-risque` **converti en énumération dense**. Les vingt-quatre scénarios et leurs seize cases de croisement gravité × vraisemblance sont publiés case par case : **aucune donnée perdue**, et le renvoi du ch. 3 (« le croisement gravité × vraisemblance, détaillé en annexe C ») reste vrai. | ≈ 0,35 p. |
| T | C | `tab:echelles` et `tab:decisions-traitement` composés à 8 pt au lieu de 12 pt (ils ne déclaraient aucune taille). | ≈ 0,3 p. |
| T | C | Le rattachement valeurs métier → biens supports passe de la prose (12 pt) à une ligne du tableau de codification (8 pt). | ≈ 0,1 p. |
| R/F | A, C, D | Sept blocs resserrés : note de la ligne 4 de A.1, chapeau de A.3, chapeau de C, rattachement des frontières, note de version, chapeaux de D.1 et D.3. | ≈ 0,4 p. |
| **+** | C | **Ajout** : le rattachement de SO15 et le paragraphe qui l'explique (§5.2). | −0,4 p. |

**Rien de protégé n'a été touché** : les vingt protocoles T1–T20 avec leur critère d'acceptation
formulé avant exécution, leur date, leur preuve et leur réserve ; les non-conformités **T1** et
**T14** avec leurs horodatages ; les statuts d'exigences EX1–EX20 ; les neuf extraits de
reproduction de l'annexe B ; la fiche de version des trente-trois briques ; les vingt-quatre
scénarios opérationnels avec leurs techniques ATT&CK et leur cotation ; les conditions de
publication de l'annexe F.

---

## 4. Le levier de largeur, chiffré

L'audit demandé par la coordination a été fait par script sur les vingt-quatre tableaux du
périmètre : somme des colonnes `P{...}` + 2 × `tabcolsep` × colonnes + filets, comparée à
`\textwidth` = 16,00 cm. État de départ :

| Tableau | Largeur occupée | Perdue |
|---|---:|---:|
| `tab:objectifs` (ch. 1) | 14,31 cm | 1,69 cm |
| `tab:enrichissement-approches` (ch. 2) | 14,89 cm | 1,11 cm |
| `tab:critere-application` (ch. 2) | 14,99 cm | 1,01 cm |
| `conventions.tex` | 14,29 cm | 1,71 cm |
| `acronyms.tex` | 14,96 cm | 1,04 cm |
| `tab:codification` (C) | 13,96 cm | 2,04 cm |
| `tab:scenarios-strategiques` (C) | 13,91 cm | 2,09 cm |
| `tab:couverture-exigences` (D) | 14,20 cm | 1,80 cm |
| `tab:composants-ecartes-annexe` (D) | 14,40 cm | 1,60 cm |
| `tab:resultats-methodes` (F) | 13,79 cm | 2,21 cm |
| `tab:ann-securite-etat` (B) | 14,70 cm | 1,30 cm |
| … (13 autres) | | 0,3 à 5,4 cm |

Les vingt-quatre tableaux ont été réajustés. **Gain mesuré à la compilation : 2 pages sur le
document entier** (146 → 144 avant les corrections factuelles), dont 1 page sur le ch. 2 et 1 sur
l'annexe C. Deux avertissements de débordement ont été introduits puis corrigés
(`tab:supervision-cinq` : 18,9 pt de trop ; `tab:plateforme-10-criteres` : 24,5 pt) ; il en reste
neuf dans le document, **tous antérieurs à cette session** (mots longs dans des colonnes étroites,
identifiant de règle Semgrep en annexe B, un paragraphe du ch. 5).

---

## 5. Ce que j'ai trouvé de faux

### 5.1 Un renvoi qui promettait une grille inexistante — **corrigé**

`ch1` §1.3.1 écrivait : « la grille de 41 critères **et ses résultats détaillés** figurent en
annexe A.1 ». L'annexe A.1 ne portait pas les 41 critères, mais un tableau de quatre lignes donnant
leur répartition par catégorie — c'est-à-dire **exactement le contenu de `graph:audit-41`**, qui
est dans le corps. Un lecteur qui suivait le renvoi pour voir les critères ne trouvait rien.
Corrigé des deux côtés : le ch. 1 renvoie à la figure, l'annexe ne duplique plus la figure.

### 5.2 SO15 manquait à la table de décision de risque — **vérifié et corrigé**

Le compte de la coordination est exact. Recompté ligne à ligne dans
`annexe_c_modele_menaces.tex` :

- *Réduire* : SO1, SO4, SO6 à SO14, SO16, SO18, SO20 à SO24 = **18** ;
- *Réduire partiellement* : SO2, SO3, SO5 = **3** ;
- *Réduire puis accepter le résiduel* : SO17, SO19 = **2** ;
- total **23 sur 24**. **SO15 ne figurait nulle part.**

Rattachement retenu, tranché sur les sources et non sur l'indication : **SO15 relève de
« Réduire »**, parce que le scénario est bien pris en charge par un contrôle d'architecture.
Chaîne de preuve : `annexe_e` — « **T13** — Attribution des actions privilégiées (**EX13, SO15**) » ;
`annexe_d`, `tab:couverture-exigences` — « **EX13 | L7** | Prévue ; T13 partiellement conforme ».
L'exigence existe, la couche qui la porte est nommée, le protocole qui la vérifie a un résultat
daté. La liste devient « SO1, SO4, **SO6 à SO16**, SO18, SO20 à SO24 » = 19, et le total tombe à
**24 sur 24**.

Le résiduel est publié avec le rattachement, pour ne pas transformer une réduction partielle en
réduction acquise : T13 est *partiellement conforme*, les journaux d'audit étant produits sans être
acheminés vers une destination dédiée ni exploités par une règle — « l'attribution est possible
sans être incontestable ».

### 5.3 Trois renvois creux au « plan de validation continue » — **corrigés**

Le plan de validation continue porte **exactement six protocoles** : T12, T14, T15, T17, T19, T20
(source : `annexe_e`, chapeau — « l'écart est nul pour T17 et T20, partiel pour T12, T15 et T19,
défavorable pour T14 »). Trois renvois y adressaient le lecteur pour des travaux qui n'en font pas
partie :

1. `annexe_c`, SO19 : « la condition de réévaluation demeure la comparaison prévue sur le flux F6
   (§ plan de validation) » — signalé par la coordination ;
2. `ch2` §2.6.4, solde financier de D15 : « le vérifier suppose de comparer les postes de
   facturation […] et **relève du plan de validation continue** » — **même défaut, non signalé,
   trouvé en recherchant le premier** ;
3. `ch2`, conclusion : V3 et V4 « relevant du plan de validation continue », alors que ni
   l'évaluation M0/M1/M2 ni le prototype de boucle n'y figurent.

Les trois portent désormais la formulation retenue par l'équipe du ch. 4 : le protocole est
**publié pour qu'un tiers puisse l'exécuter**, sans prétendre qu'il est inscrit au plan. Le cas
n° 1 nomme en outre les six protocoles du plan, pour que le lecteur puisse vérifier.

### 5.4 Le résumé et l'abstract n'étaient pas équivalents — **corrigé**

L'abstract listait **quatre** limites principales, le résumé **trois** : « the database instance
still shared across tenants » n'avait pas d'équivalent français. Le fait est vrai (D16 est conçue
et non appliquée ; l'annexe A le dit : « l'isolation du plan de la donnée est une conception datée
et chiffrée, non un état appliqué »), c'est donc le **résumé** qui était incomplet. Les deux textes
ont été réécrits ensemble et portent désormais les mêmes quatre limites, les mêmes dates et les
mêmes mesures.

### 5.5 Du code mort typographique dans sept tableaux

Les `\footnotesize` et `\small` posés autour des `longtable` n'ont aucun effet (§2.2). Ils ont été
retirés là où ils gênaient la lecture du source (ch. 1) et signalés par un commentaire là où le
tableau est le plus lu (`tab:briques-structurantes`). Les autres subsistent : les retirer tous
touchait des fichiers dont je n'avais pas d'autre raison de modifier la mise en forme.

---

## 6. Un incident d'environnement à connaître

**Le 30/08/2026 à 01 h 44, cinq de mes correctifs ont été annulés** sans intervention de ma part.
Constaté par relecture : `frontmatter/abstract.tex` était revenu **mot pour mot à sa version
d'origine** (avec son `\chapter*` et sa quatrième limite non répercutée), et
`frontmatter/conventions.tex` avait perdu le bloc de compacité de la table des matières — la table
des matières était repassée de 2 à 3 pages, sans qu'aucune erreur n'apparaisse dans le journal de
compilation. Le dossier est sous OneDrive ; la coordination a observé le même phénomène à la même
minute.

**Parade appliquée** : tous mes scripts de patch vivent **hors du dossier OneDrive**
(`…\AppData\Local\Temp\claude\…\scratchpad\`), et l'un d'eux (`reapply_frontmatter.py`) est
**idempotent** : il vérifie la présence de chaque correctif et le repose s'il a disparu. Il a été
relancé avant chacune des six dernières compilations. **Vérification finale faite : les deux
correctifs sont en place dans le PDF livré** (Résumé et Abstract au même folio iii, table des
matières sur deux pages).

**À faire avant la remise** : relancer une compilation complète et vérifier ces deux points, plus
`git status`, si le dossier a été synchronisé entre-temps.

---

## 7. Planchers atteints, et ce que coûterait la page suivante

### 7.1 Liminaires — plancher **11 pages** pour 10 demandées

Ce qui reste : garde 1, dédicace 1, remerciements 1, résumé+abstract 1, acronymes 1, conventions 1,
table des matières 2, table des figures 1, liste des tableaux 2.

| Rang | Coupe | Gain | Coût |
|---:|---|---:|---|
| 1 | **Dédicace et remerciements sur une même page.** | 1 p. | Faible sur le fond, **visible pour le jury** : la norme ESPRIT §H les budgète comme deux entrées distinctes d'une page chacune. C'est une décision qui appartient à l'auteur, pas à une équipe de condensation — je ne l'ai pas prise. |
| 2 | **Liste des tableaux ramenée à une page.** | 1 p. | **Impossible sans réduire le nombre de tableaux** : le mémoire en compte 57, soit 59 lignes composées ; une page en tient 34 à la taille courante et environ 50 en `\footnotesize`. Mesuré, pas estimé. Le seul levier réel est de convertir des tableaux en prose dans les chapitres 3 à 6 — hors de mon périmètre. J'en ai converti un (ch. 1). |
| 3 | Table des matières à une page. | 1 p. | Impossible : 82 entrées de niveau chapitre et section, déjà en `\small` et déjà privées de leur interligne de chapitre. |

### 7.2 Ch. 1 — plancher **10 pages** pour 8 demandées

Le chapitre porte encore **≈ 3,2 pages de flottants pour 10 pages** : quatre figures TikZ (dont
l'organigramme, exigé par la norme au titre de la présentation du service d'accueil) et trois
tableaux. Les dix pages sont pleines : la dernière porte 39 lignes composées.

| Rang | Coupe | Gain | Coût |
|---:|---|---:|---|
| 1 | `tab:sensibilite-elson` (7 lignes) déplacé en annexe C, le corps gardant les deux catégories irréversibles et le renvoi | 0,5 p. | Faible **si** l'annexe C peut l'absorber — or elle ne le peut pas aujourd'hui (§7.4). Le geste transfère la page, il ne la supprime pas. |
| 2 | `fig:elson-fonctionnel` supprimée, la boucle à trois temps restant en prose | 0,45 p. | **Réel** : c'est la seule vue de l'application pilote, et elle porte l'argument des trois actifs de natures différentes. |
| 3 | `graph:audit-41` supprimée | 0,4 p. | **Rédhibitoire** : seule vue de l'audit, et depuis la suppression du doublon d'annexe A, **seul endroit du mémoire** où la répartition des 41 critères est publiée. |
| 4 | `tab:objectifs` (O1–O6) réduit | 0,5 p. | **Rédhibitoire** : c'est le contrat d'évaluation auquel le ch. 6 répond point par point, et le brief le protège. |

### 7.3 Ch. 2 — plancher **13 pages** pour 11 demandées

Le chapitre ne contient **aucune figure** et porte **≈ 3,4 pages de tableaux pour 13 pages**, dont
**2,9 pages pour le seul inventaire des trente-trois briques**, que le brief protège nommément. Les
treize pages sont pleines. Après élargissement des colonnes, `arraystretch` à 0,92 et suppression
des légendes de continuation, **le tableau des briques est à son minimum typographique** : la seule
réduction restante est la réécriture des 99 cellules, dont l'équipe précédente a déjà resserré les
33 cellules « prix payé ».

| Rang | Coupe | Gain | Coût |
|---:|---|---:|---|
| 1 | Réécrire les 99 cellules du tableau des briques pour gagner 15 % de texte | 0,45 p. | Faible en principe, **très coûteux en temps** et à haut risque de perte de précision : les cellules « prix payé » portent des faits datés et chiffrés (couverture de tests 3,00 % au 28/08/2026, seuils 10 et 1000 requêtes / 60 s, rotation à 90 jours…). |
| 2 | `tab:critere-application` ramené de 5 à 3 lignes | 0,25 p. | **Réel** : les deux rejets sont plus instructifs que les deux admissions ; en garder un seul de chaque affaiblit la démonstration du critère. À éviter — avis déjà donné par l'équipe précédente, que je confirme. |
| 3 | `tab:supervision-cinq` ou `tab:plateforme-10-criteres` supprimés | 0,5 p. chacun | **Rédhibitoire** : ce sont les deux études comparatives attendues par le format ESPRIT. |
| 4 | Inventaire ramené à vingt briques | 1,3 p. | **Rédhibitoire** : casse la chaîne « décision → prix payé » que le brief protège. |

### 7.4 Annexes — plancher **24 pages** pour 21 demandées, et c'est la réponse que le brief autorise

**Le brief est explicite : « Ne coupe donc jamais du matériel de reproduction pour tenir ce budget.
Si tu ne peux pas atteindre 21 sans détruire du matériel de reproduction, arrête-toi et
écris-le. » C'est ce que je fais ici.**

J'ai retiré des annexes **environ 2,2 pages de matière** (un tableau qui répétait le corps, un
tableau converti en énumération, dix tableaux réajustés en largeur, deux tableaux ramenés de 12 à
8 pt, sept blocs resserrés) et j'y ai ajouté **0,4 page** de correction factuelle (SO15). **Le
nombre de pages n'a pas bougé.** La raison est structurelle et mesurée :

| Annexe | Pages | Lignes composées sur la dernière page | Blanc |
|---|---:|---:|---|
| A | 5 | 43 (pleine) | — |
| B | 4 | 15 | ≈ 0,6 p. |
| C | 4 | 3 | ≈ 0,9 p. |
| D | 3 | 40 (pleine) | — |
| E | 6 | 41 (pleine) | — |
| F | 2 | 29 | ≈ 0,3 p. |

**Les six annexes perdent ensemble ≈ 1,8 page en pages de fin partiellement remplies**, parce que
chacune ouvre un chapitre. Toute condensation à l'intérieur d'une annexe agrandit son blanc de fin
au lieu de supprimer une page : c'est ce qui s'est produit ici, et c'est vérifiable annexe par
annexe dans le tableau ci-dessus. J'ai poussé l'annexe C jusqu'à **3 lignes** sur sa quatrième page
sans réussir à la faire tomber — le flottant `tab:decisions-traitement` verrouille la coupure.

| Rang | Coupe | Gain | Coût |
|---:|---|---:|---|
| 1 | **Fusionner l'annexe F dans l'annexe E** (F est le protocole d'évaluation de O5, donc un protocole de validation) et l'annexe C dans l'annexe D. | 1,5 à 2 p. | **Nul sur le fond, mais hors de mon périmètre** : il faut retirer deux `\input` de `main.tex` et corriger les renvois du ch. 6, qui appellent l'annexe F par sa lettre. C'est **la seule coupe qui rende les trois pages manquantes sans rien détruire**, et c'est celle que je recommande. |
| 2 | Retirer `tab:decisions-traitement` (annexe C), les décisions passant en prose. | 0,4 p. | Réel : c'est le livrable de l'atelier 5 d'EBIOS RM, et le ch. 3 y renvoie désormais explicitement pour les quatre scénarios absents de sa matrice. |
| 3 | Retirer un extrait de l'annexe B. | 1,0 p. | **Contre la norme**, qui dirige explicitement l'arborescence du dépôt vers l'annexe B. Matériel de reproduction pur. |
| 4 | Réduire `tab:fiche-versions` (annexe A) aux briques non épinglées. | 1,0 p. | La fiche cesse d'être une fiche : sa valeur est d'être exhaustive sur trente-trois briques. |
| 5 | Supprimer l'annexe F. | 2,0 p. | Casse une chaîne de preuve : c'est le seul endroit où le mémoire publie ses **conditions de validité avant tout relevé**. |

**Recommandation.** Le rang 1 est le seul acceptable, il rend 1,5 à 2 pages, il ne coûte rien à la
démonstration — et il demande une décision sur `main.tex`, hors de mon périmètre. Les rangs 2 à 5
retirent au mémoire une capacité de preuve. **Si la fusion d'annexes est refusée, la réponse
honnête est 24 pages d'annexes**, et le dépassement doit être arbitré ailleurs : la norme ESPRIT
elle-même (`plan/NORME_ESPRIT_parametres_et_conformite.md`, l. 362) demande **30 à 40 pages**
d'annexes, soit le contraire exact du budget de 21.

---

## 8. Vérification de périmètre et d'intégrité

```
$ git status --porcelain -- "rapport PFE/latex"
 M appendices/annexe_a_etudes_comparatives.tex   <- moi
 M appendices/annexe_b_extraits_realisation.tex  <- moi (largeur de colonnes)
 M appendices/annexe_c_modele_menaces.tex        <- moi
 M appendices/annexe_d_conception_detaillee.tex  <- moi
 M appendices/annexe_e_protocoles_tests.tex      <- moi
 M appendices/annexe_f_evaluation_semantique.tex <- moi
 M frontmatter/abstract.tex                      <- moi
 M frontmatter/acronyms.tex                      <- moi (largeur de colonnes)
 M frontmatter/resume.tex                        <- moi
?? frontmatter/conventions.tex                   <- moi (fichier non suivi, créé en vague 3)
 M chapters/final/ch1_cadre_existant.tex         <- moi
 M chapters/final/ch2_etat_art.tex               <- moi
 M chapters/final/ch3..ch6, intro, conclusion    <- autres équipes
 M config/*, main.tex, bibliography/*            <- autres équipes, non ouverts par moi
```

**Aucun fichier supprimé** (`git status` ne rapporte aucune ligne `D`). Les annexes G et H restent
hors document et intactes. `main.tex`, `config/formatting.tex` et `config/packages.tex` n'ont pas
été ouverts en écriture : le réglage de la table des matières et celui des blancs de flottants sont
posés dans mes propres fichiers, avec le commentaire qui indique où les déplacer.
