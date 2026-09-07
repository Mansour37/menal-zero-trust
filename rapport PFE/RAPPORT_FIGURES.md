# RAPPORT_FIGURES — audit et spécification de mise à niveau des figures

**Équipe** : architecture visuelle. **Date** : 29/08/2026.
**Périmètre** : les 30 figures TikZ du corps du mémoire (`latex/chapters/final/`).
**Statut d'écriture** : LECTURE SEULE sur le LaTeX. Aucun `.tex` du mémoire n'a été modifié,
aucun fichier supprimé. Seules écritures : ce rapport et les fichiers de test isolés du
répertoire de travail temporaire.

---

## En bref

**Corpus** : 30 figures, toutes en TikZ natif, aucune image matricielle. Elles occupent
**13,75 pages** sur les 121 pages de corps.

**Le défaut central est mesuré.** 46 styles de flèches nommés, 8 longueurs de pointe,
7 teintes, 7 épaisseurs — et surtout **les pointillés ont six significations différentes selon
la figure, les tirets en ont cinq**. 16 figures emploient au moins deux styles ; **10 n'ont
aucune légende de trait**, 3 l'écrivent en prose. Et le mémoire, dont la thèse est « ce que le
socle interdit », **n'a aucun signe graphique du refus** : `fig:seq-refus`, qui porte le mot
dans son titre, ne possède pas de style de refus.

**Cinq erreurs à corriger, toutes vérifiées** (détail §5.4) : une contradiction factuelle entre
`fig:composants-logiciel` et le tableau du même chapitre (correction F7 non propagée) ; une
légende qui décrit un trait inexistant (`fig:modele-couches`) ; quatre débordements de marge
silencieux dont un de 7,7 mm ; deux recouvrements de texte visibles au rendu
(`fig:topologie-cible`, `fig:cas-utilisation`) ; un type de flottant `graphique` déclaré sur
27 lignes et jamais employé.

**Verdicts** : 2 conformes · 16 à retoucher · 5 à refaire · 4 à fusionner · 3 à retirer.

**Volume** : le travail proposé rend **≈ 2,4 pages** nettes, dont **1,3 page mesurée par
compilation** et non estimée. Les figures ne fourniront pas les 37 pages du budget — il faut le
dire à l'équipe volume, le gisement est dans la prose.

**Livrables prêts à appliquer** : une convention de 70 lignes de code TikZ (§3.7) **compilée à
0 erreur** et vérifiée en niveaux de gris, une table de migration style par style pour les
30 figures (§3.9), et un tableau de critères de recette pour 6 vues (§4.3) **compilé à 0 erreur
et 0 `Overfull`**, mesuré à 57,2 % d'une page.

---

## 0. Méthode et instrumentation

### 0.1 Corpus réel

Recherche sur `\begin{tikzpicture}` et `\label{fig:` dans `chapters/final/`, `appendices/`
et `frontmatter/`.

| Zone | `tikzpicture` | Commentaire |
|---|---|---|
| `chapters/final/` | 30 | **le corpus audité** — 30 environnements flottants, 1 `tikzpicture` chacun |
| `frontmatter/cover.tex`, `frontmatter/formulaire_depot.tex` | 2 | filets de page de garde en `remember picture, overlay` — hors périmètre |
| `appendices/` (A à H) | **0** | aucune figure en annexe |
| `chapters/drafts/` | 0 | brouillons non compilés (`fig:archi-globale`, `fig:planning`) — non inclus dans `main.tex` |

**Aucune image matricielle dans le corps** : `grep` sur `\includegraphics`, `\resizebox`,
`\scalebox`, `\adjustbox` dans `chapters/final/` ne renvoie rien. Tout est TikZ natif et
vectoriel — c'est une force du mémoire, et cela rend chaque correction proposée ici applicable
mécaniquement.

**La liste du brief était incomplète** : elle annonçait « une quinzaine » de figures et en
citait 15. Il y en a **30**. Les 15 non citées sont : `fig:archi-avant`, `graph:audit-41`,
`fig:cas-utilisation`, `fig:contexte`, `fig:modele-couches`, `fig:deploiement`,
`fig:chronologie-incident`, `fig:plan-identite`, `fig:sequence-livraison`, `fig:boucle-f6`,
`fig:pipeline-detection`, `fig:composants-logiciel`, `fig:gantt`, `graph:coldstart`,
`fig:scenario-19-08`.

### 0.2 Harnais de compilation isolée

Répertoire de travail :
`…/scratchpad/audit_figures/`.

1. `extract.py` découpe chaque environnement flottant contenant un `tikzpicture`, en extrait le
   `tikzpicture` seul dans `figs/<slug>.tex`, et produit `inventory.json`
   (label, fichier, lignes, légende, nombre de lignes source).
2. `shims.tex` recopie à l'identique les trois macros définies **dans les fichiers de chapitre**
   et non dans `config/commands.tex` : `\gcprod` (`ch5:12`), `\pastilleOK` et `\pastilleWarn`
   (`ch4:1817-1826`, définies *à l'intérieur* de l'environnement `figure` de
   `fig:delegation-identite`).
3. `genmeasure.py` produit `measure.tex`, qui charge le **préambule réel** du mémoire
   (`config/packages`, `formatting`, `commands`, `metadata` via `TEXINPUTS`) et place chaque
   figure dans une `\savebox` dont il écrit largeur, hauteur et profondeur dans `measure.dim`.

Résultat de la compilation XeLaTeX du document de mesure :

```
erreurs (^!) = 0        Overfull \hbox = 0 (dans le document de mesure)
Output written on measure.pdf (30 pages)
Bloc de texte mesuré : 455,24 pt x 702,78 pt  =  16,00 cm x 24,70 cm
```

Tous les chiffres de taille de ce rapport viennent de cette mesure, pas d'une estimation.

### 0.3 Tableau des tailles mesurées

`%haut` = (hauteur de la figure + 34 pt de légende et de ressorts) / hauteur du bloc de texte.
C'est la fraction de page consommée par le flottant complet.

| Ordre | Label | L (cm) | H (cm) | % largeur | % page | Alerte |
|---|---|---:|---:|---:|---:|---|
| 1 | `fig:carte-memoire` | 12,92 | 9,13 | 80,7 % | 41,8 % | |
| 2 | `fig:organisation-menal` | 16,19 | 7,44 | **101,2 %** | 35,0 % | **déborde de 5,4 pt** |
| 3 | `fig:elson-fonctionnel` | 14,85 | 6,87 | 92,8 % | 32,7 % | |
| 4 | `fig:archi-avant` | 15,93 | 5,62 | 99,6 % | 27,6 % | |
| 5 | `graph:audit-41` | 14,31 | 6,23 | 89,4 % | 30,1 % | |
| 6 | `fig:cas-utilisation` | 15,36 | 9,67 | 96,0 % | 44,0 % | |
| 7 | `fig:dfd-frontieres` | 16,77 | 13,06 | **104,8 %** | 57,7 % | **déborde de 22,0 pt** |
| 8 | `fig:contexte` | 15,79 | 12,46 | 98,7 % | 55,3 % | |
| 9 | `fig:modele-couches` | 12,24 | 8,99 | 76,5 % | 41,3 % | |
| 10 | `fig:deploiement` | 15,84 | 10,14 | 99,0 % | 45,9 % | |
| 11 | `fig:topologie-reseau` | 15,72 | 14,35 | 98,2 % | **62,9 %** | pousse la suite |
| 12 | `fig:topologie-cible` | 16,03 | 11,22 | **100,2 %** | 50,2 % | déborde de 0,9 pt |
| 13 | `fig:cycle-donnee` | 15,14 | 12,63 | 94,6 % | 56,0 % | |
| 14 | `fig:modele-donnees` | 15,53 | **20,94** | 97,1 % | **89,6 %** | occupe une page pleine |
| 15 | `fig:seq-refus` | 16,06 | 16,10 | **100,4 %** | **70,0 %** | déborde de 1,7 pt |
| 16 | `fig:chronologie-incident` | 15,67 | 7,24 | 97,9 % | 34,2 % | |
| 17 | `fig:plan-identite` | 12,59 | 9,06 | 78,7 % | 41,5 % | |
| 18 | `fig:delegation-identite` | 15,86 | **17,90** | 99,1 % | **77,3 %** | occupe une page pleine |
| 19 | `fig:seq-mfa` | 15,47 | **17,99** | 96,7 % | **77,7 %** | occupe une page pleine |
| 20 | `fig:graphe-taches-livraison` | 14,96 | 10,65 | 93,5 % | 47,9 % | |
| 21 | `fig:sequence-livraison` | 15,60 | 5,35 | 97,5 % | 26,5 % | |
| 22 | `fig:boucle-f6` | 15,87 | 5,18 | 99,2 % | 25,8 % | |
| 23 | `fig:chaine-infrastructure` | 15,30 | 9,24 | 95,6 % | 42,2 % | |
| 24 | `fig:pipeline-detection` | 15,98 | 6,89 | 99,9 % | 32,7 % | |
| 25 | `fig:composants-logiciel` | 15,91 | 9,98 | 99,5 % | 45,2 % | |
| 26 | `fig:chaine-donnees-vue` | 15,65 | 9,24 | 97,8 % | 42,2 % | |
| 27 | `fig:accueil-locataire` | 14,36 | 11,63 | 89,8 % | 51,9 % | |
| 28 | `fig:gantt` | 15,82 | 7,94 | 98,9 % | 37,0 % | |
| 29 | `graph:coldstart` | 6,98 | 5,14 | 43,7 % | 25,7 % | figure minuscule, page presque vide |
| 30 | `fig:scenario-19-08` | 15,73 | 5,40 | 98,3 % | 26,7 % | |

**Total : 13,75 pages de flottants figures** sur les 121 pages de corps (11,4 %). C'est le
gisement de volume que ce rapport instruit.

**Quatre figures dépassent la justification** (`fig:organisation-menal`, `fig:dfd-frontieres`,
`fig:topologie-cible`, `fig:seq-refus`). Le mémoire ne le voit pas parce que les
`tikzpicture` sont centrés dans un `figure` sans `\hbox` de contrôle : le débordement sort dans
la marge sans produire d'`Overfull \hbox`. `fig:dfd-frontieres` sort de **7,7 mm** dans la marge
extérieure — sur un tirage recto-verso relié, c'est visible et c'est un défaut de fabrication.

---

## 1. Le défaut central, mesuré : la sémantique des flèches

Recensement automatique (`census2.py`) des styles nommés déclarés dans l'en-tête de chaque
`tikzpicture`, de leur définition exacte, et du nombre d'emplois de chacun.

### 1.1 Quarante-six styles de flèches pour quatre significations

Le mémoire déclare **46 styles de flèches nommés** répartis sur 24 figures
(6 figures n'ont aucun style de flèche nommé : `graph:audit-41`, `fig:cas-utilisation`,
`fig:chronologie-incident` — une seule flèche anonyme —, `fig:gantt`, `graph:coldstart`,
`fig:scenario-19-08`). Ces 46 styles emploient :

- **8 longueurs de pointe différentes** : 1,4 (×2) / 1,5 (×15) / 1,6 (×13) / 1,7 (×2) /
  1,8 (×15) / 2,1 (×1) / 2,6 (×1) mm dans les styles nommés, plus 2,2 mm dans une flèche
  anonyme de `fig:chronologie-incident` ;
- **7 teintes de trait** : `black!55` (×9), `black!60`, `black!65` (×7), `black!70` (×11),
  `black!75`, `black!80`, plus `blue!55!black` (×2) dans la seule `fig:archi-avant` — c'est
  **la seule couleur non grise de tout le corpus de flèches** ;
- **7 épaisseurs** : défaut (×17), `thick` (×16), `line width=` 0,5 (×6) / 0,7 (×4) / 1,1 /
  1,5 / 1,7 pt.

Aucune de ces variations ne porte de sens. Ce sont des choix locaux, figure par figure.
Deux figures voisines du même chapitre — `fig:seq-refus` et `fig:seq-mfa`, toutes deux des
diagrammes de séquence de `ch4` — partagent les noms de style `msg` et `rep` avec des
définitions identiques, mais `fig:seq-mfa` ajoute `ref` en tirets pour un refus, quand
`fig:seq-refus`, qui *porte le refus dans son titre*, n'a aucun style de refus.

### 1.2 La table de collision — le même trait, six sens

C'est le défaut bloquant, et il est démontrable :

| Aspect du trait | Signification dans la figure | Figure |
|---|---|---|
| **pointillés** (`dotted` / `densely dotted`) | flux **asynchrone** (`asyn`) | `fig:contexte` |
| | **journal** F4 (`jour`) | `fig:deploiement` |
| | **meilleur effort**, non bloquant (`best`) | `fig:composants-logiciel` |
| | lien **interne / indirect** (`ai`) | `fig:organisation-menal`, `fig:elson-fonctionnel`, `fig:dfd-frontieres`, `fig:topologie-reseau` |
| | **rétroaction** (`ar`) | `fig:chaine-infrastructure` |
| | **lien logique** hors flux (`al`) | `fig:accueil-locataire` |
| **tirets** (`dashed` / `densely dashed`) | geste **manuel** (`man`) | `fig:deploiement` |
| | **interdiction / refus** (`ko`) | `fig:plan-identite` |
| | **arrêt de la chaîne** (`fstop`) | `fig:sequence-livraison` |
| | **réponse de refus** (`ref`) | `fig:seq-mfa` |
| | flux **asynchrone** (`ad`) | `fig:cycle-donnee` |
| **trait plein** | appel synchrone | 21 figures — le seul emploi stable |

Six sens pour les pointillés, cinq pour les tirets. Un lecteur qui apprend au chapitre 4 que
« pointillés = asynchrone » lit faux au chapitre 5, où les mêmes pointillés veulent dire
« meilleur effort ». **C'est exactement le défaut que le brief §2.1 demande de corriger, et il
est ici quantifié.**

### 1.3 Conformité au brief §2.1 — état actuel

| Exigence du brief | État mesuré |
|---|---|
| plein = appel synchrone | **respecté de fait** dans 21 figures sur 24 |
| tirets = flux asynchrone / journal / événement | **respecté dans 1 figure sur 5** (`fig:cycle-donnee`) ; ailleurs les tirets signifient manuel, refus, arrêt |
| pointillés = décision de politique / contrôle / autorisation | **respecté dans 0 figure sur 9** — aucune figure n'emploie les pointillés pour une décision de politique |
| plein épais barré = refus | **inexistant** — aucune figure du mémoire ne dessine un refus par un trait barré ; le refus est rendu par des tirets (`ko`, `ref`), par un `\node` texte, ou n'est pas rendu |

Le point le plus grave est le dernier : le mémoire s'intitule *zero trust* et sa thèse est
« ce que le socle interdit ». **Aucune de ses 30 figures ne dispose d'un signe graphique du
refus.** Les trois figures qui montrent un refus (`fig:seq-refus`, `fig:seq-mfa`,
`fig:plan-identite`) l'écrivent en toutes lettres dans un nœud. C'est le déficit d'expressivité
le plus coûteux du corpus.

### 1.4 Légendes internes — 10 défauts bloquants, 3 légendes rédigées en prose

Le brief : *« Aucune figure ne mélange deux styles sans légende. »*
**16 figures emploient au moins deux styles de flèches.** Inspection du rendu, figure par figure :

| État | Figures | Nb |
|---|---|---:|
| légende **formelle** (clé graphique : un trait dessiné + son sens) | `fig:seq-refus`, `fig:seq-mfa`, `fig:dfd-frontieres` | 3 |
| légende **rédigée en prose** dans la figure (« Trait plein : … Pointillés : … ») — la bonne information, la mauvaise forme | `fig:plan-identite`, `fig:composants-logiciel`, `fig:contexte` | 3 |
| **aucune légende de trait** — défaut bloquant | `fig:elson-fonctionnel`, `fig:archi-avant`, `fig:deploiement`, `fig:topologie-reseau`, `fig:topologie-cible`, `fig:cycle-donnee`, `fig:delegation-identite`, `fig:sequence-livraison`, `fig:chaine-infrastructure`, `fig:accueil-locataire` | **10** |

Deux figures (`fig:modele-couches`, `fig:deploiement`) déportent l'explication **dans la légende
de bas de figure**, ce qui est une demi-mesure : le lecteur fait l'aller-retour entre le dessin
et un texte de six lignes. Le cas de `fig:deploiement` est caricatural — sa légende décrit
« quatre styles de lien » en trois lignes et demie de prose. Ce texte doit devenir une bande de
légende dans la figure, et disparaître de la légende.

Trois figures sans flèche portent malgré tout une légende de trait, et bien : `fig:cas-utilisation`
(association humaine / automatisée), `fig:graphe-taches-livraison` et `fig:accueil-locataire`
(pour leurs cadres, pas pour leurs flèches — d'où le classement en défaut ci-dessus pour la
seconde).

### 1.4 bis Douze pavés de prose « Ce que la figure démontre » — mesurés

Douze figures portent, **à l'intérieur du `tikzpicture`**, un pavé de quatre à six lignes de
prose intitulé « Ce que la figure démontre ». **Dix d'entre elles ont aussi une légende de
flottant qui dit exactement la même chose** (« La figure démontre que… »). C'est une duplication
stricte, et c'est de la prose dans une figure — deux défauts en un.

J'ai mesuré le gain de leur suppression en compilant les douze figures amputées de ce pavé
(`strip_boxes.py`, `measure_strip.tex`, 0 erreur) :

| Figure | H avant | H après | Gain |
|---|---:|---:|---:|
| `fig:delegation-identite` | 17,90 cm | 14,92 cm | **−2,98 cm** |
| `fig:topologie-reseau` | 14,35 | 12,53 | −1,82 |
| `fig:seq-mfa` | 17,99 | 16,28 | −1,71 |
| `fig:topologie-cible` | 11,22 | 10,42 | −0,80 |
| `fig:chaine-infrastructure` | 9,24 | 8,53 | −0,71 |
| `fig:modele-donnees` | 20,94 | 20,41 | −0,54 |
| `fig:seq-refus` | 16,10 | 15,71 | −0,38 |
| `fig:cycle-donnee` | 12,63 | 12,33 | −0,30 |
| `fig:dfd-frontieres`, `fig:graphe-taches-livraison`, `fig:chaine-donnees-vue`, `fig:accueil-locataire` | — | — | 0 (pavé posé à côté, pas dessous) |
| **Total** | | | **−9,27 cm = −0,38 page** |

Pour `fig:dfd-frontieres`, le pavé ne coûte pas de hauteur mais **8,5 cm de largeur** : c'est lui
qui fait déborder la figure de 22 pt dans la marge.

### 1.5 Séparation des plans — 2 figures sur 30

Le brief §2.2 exige que le plan de données, le plan de contrôle et le plan d'observation soient
visuellement séparés.

| Moyen employé | Figures |
|---|---|
| cadre `fit` + calque `backgrounds` | `fig:archi-avant` (1 cadre), `fig:composants-logiciel` (2 cadres) |
| bande de fond dessinée à la main (`\fill` avant les nœuds, sans `backgrounds`) | `fig:dfd-frontieres`, `fig:topologie-reseau`, `fig:topologie-cible`, `fig:delegation-identite`, `fig:accueil-locataire`, `fig:modele-donnees` |
| **aucune séparation** | les 22 autres |

La bibliothèque `backgrounds` est chargée dans `config/packages.tex:29` et n'est employée que
par 2 figures sur 30. Les 6 figures qui dessinent leurs bandes à la main le font avec des
coordonnées littérales, ce qui casse dès qu'un nœud bouge — c'est de la dette graphique.

---

## 2. Audit figure par figure

Chaque bloc suit les neuf points demandés. « Taille » = mesure XeLaTeX réelle (§0.3).
Les croisements sont comptés sur le rendu, pas sur le code.

---

### 2.1 `fig:carte-memoire`

1. **Identité** — `chapters/final/intro_generale.tex:112-145`, environnement `figure`,
   34 lignes source. Légende : « Carte du mémoire : chaque chapitre consomme le livrable du
   précédent. » Chapitre : introduction générale. **12,92 × 9,13 cm — 41,8 % d'une page.**
2. **Ce qu'elle démontre** — que la démonstration est une chaîne : aucun chapitre ne suppose un
   résultat qui ne soit produit en amont. Énonçable en une phrase : conforme.
3. **Sémantique des flèches** — un seul style, `fl` = `-{Latex[length=1.6mm]}, black!60, thick`,
   5 emplois, tous « le chapitre *n* produit ce que consomme *n+1* ». Sens stable.
   **À changer** : renommer en `\fluxdonnee` de la convention (§3), pointe 1,7 mm, `black!75`.
4. **Légende interne** — un seul style : non requise. Conforme.
5. **Séparation des plans** — sans objet (figure de structure documentaire, pas d'architecture).
6. **Croisements** — 0.
7. **Lisibilité** — corps `\footnotesize` pour les titres de chapitre, `\scriptsize` pour les
   « Produit : … ». Les textes « Produit » sont des **phrases** (« un audit daté sur 41 critères,
   cinq carences C1–C5, six objectifs mesurables O1–O6 ») : ce sont en fait des énumérations
   nominales, acceptable. Aucun libellé sous `\footnotesize` porteur du sens principal.
   Niveaux de gris : deux teintes, lisible.
8. **Gain de place** — la figure est **un tableau à deux colonnes dessiné en TikZ**. Un
   `tabular` de six lignes tiendrait en ~5,5 cm au lieu de 9,13 : **gain 0,15 page**. Si elle
   reste en TikZ, `minimum height` 1,02 → 0,80 cm et l'écart vertical 1,50 → 1,25 cm ramènent la
   hauteur à ~7,3 cm : **gain 0,07 page**.
9. **Verdict — à retoucher.** Conserver : c'est la seule figure qui donne au jury le plan de
   preuve en dix secondes. Appliquer la convention et compresser.

---

### 2.2 `fig:organisation-menal`

1. **Identité** — `ch1_cadre_existant.tex:95-178`, 84 lignes. « Organigramme de MENAL-SARL et
   rattachement du projet, à la date de \dateref. » Chapitre 1.
   **16,19 × 7,44 cm — 101,2 % de la largeur : DÉBORDE de 5,4 pt dans la marge.**
2. **Ce qu'elle démontre** — que le projet est porté par un intervenant unique rattaché à deux
   des neuf unités, alors que sa chaîne de revue mobilise trois interlocuteurs. Une phrase :
   conforme.
3. **Sémantique des flèches** — un seul style fléché, `ai` = pointillés `black!55`, 1 emploi :
   du bloc « Projet » vers l'encadré « Chaîne de revue des livrables ». Les traits de
   l'organigramme sont des `\draw` sans pointe (rattachement hiérarchique) — c'est correct et
   c'est un **quatrième aspect non déclaré** : le trait sans pointe.
   **À changer** : le lien vers la chaîne de revue est une **relation de compte rendu**, pas un
   flux — passer en `\lienstructure` (trait fin sans pointe) ou en `\fluxcontrole` (pointillés)
   selon que l'on veut ou non le compter comme une décision. Recommandation : `\lienstructure`.
   Le trait hiérarchique devient `\lienstructure` explicitement, au lieu d'un `\draw` nu.
4. **Légende interne** — un seul style fléché, mais **deux aspects de trait** (plein sans pointe,
   pointillés avec pointe) : une ligne de légende suffit et devient obligatoire dès que le trait
   hiérarchique est nommé. Proposition : `— rattachement hiérarchique · ⋯▸ compte rendu`.
5. **Séparation des plans** — sans objet.
6. **Croisements** — 0 dans l'arbre. La flèche vers l'encadré passe sous le niveau 3 sans le
   couper.
7. **Lisibilité** — police `\scriptsize` sur **tous** les libellés de l'organigramme, y compris
   les noms d'unité, qui sont le contenu porteur : **non conforme au plancher `\footnotesize`**.
   Le nœud « Business Development » est plus étroit que son texte : le libellé mord sur le nœud
   voisin. L'encadré « Chaîne de revue » contient **trois lignes et demie de phrase** avec des
   flèches Unicode `→` dans le texte : c'est de la prose dans une figure.
8. **Gain de place** — c'est l'encadré de la chaîne de revue qui fait déborder la figure :
   4,05 cm de large pour un contenu qui appartient au texte courant. **Le retirer ramène la
   largeur sous 12 cm et supprime le débordement**, sans perte : l'information est déjà dans le
   paragraphe d'appel. Hauteur inchangée. Gain : la correction d'un défaut de fabrication.
9. **Verdict — à retoucher** (correction obligatoire du débordement).

---

### 2.3 `fig:elson-fonctionnel`

1. **Identité** — `ch1_cadre_existant.tex:248-308`, 61 lignes. « Boucle fonctionnelle de
   l'application pilote et actifs produits. » Chapitre 1. **14,85 × 6,87 cm — 32,7 % d'une page.**
2. **Ce qu'elle démontre** — que trois temps de nature différente produisent trois actifs de
   nature différente en transitant par un point d'entrée unique. Une phrase : conforme.
3. **Sémantique des flèches** — deux styles :
   `a` (plein, `black!65`, 7 emplois) = production d'un actif ;
   `ai` (**pointillés**, `black!55`, 3 emplois) = lien indirect vers le profil de contributeur.
   **À changer** : les pointillés ne désignent ici **ni une décision de politique ni un
   contrôle** — c'est une contribution différée à un agrégat. Convention : `\fluxevenement`
   (tirets). Le style `a` devient `\fluxdonnee`.
4. **Légende interne** — **ABSENTE, défaut bloquant** : deux styles, aucune clé.
   Légende proposée, une ligne sous la figure, dans le `tikzpicture` :
   `▸ production d'un actif   ⇢ alimentation différée du profil`
5. **Séparation des plans** — le cadre en tirets « application web progressive installable »
   sépare l'application du reste, mais rien ne distingue les **actifs** (données) des
   **traitements**. Proposition : bande de fond `plandonnee` derrière la colonne de droite
   (les trois actifs), cadre `fit` nommé `appli` autour des trois temps.
6. **Croisements** — **4 croisements** dans le faisceau entre la colonne des traitements et
   celle des actifs : « Évaluer → Corpus » croise « Traduire → Profil » et « Enregistrer →
   Profil » ; « Traduire → Corpus » croise la descente « Traduire → Enregistrer ».
   **Réacheminement** : ordonner la colonne de droite dans l'ordre de production
   (Corpus, Classement, Profil) au lieu de (Corpus, Profil, Classement) supprime deux
   croisements ; passer les deux liens différés vers le Profil en arc `to[out=0,in=180]`
   décalés verticalement en supprime deux autres. **Objectif atteignable : 0.**
7. **Lisibilité** — tout en `\scriptsize` (5 occurrences) : **non conforme**. L'étiquette
   « note de validation » est **tournée à 90°** le long d'une accolade : illisible en
   feuilletage, à passer horizontale.
8. **Gain de place** — figure déjà compacte. Le réordonnancement de la colonne d'actifs ne
   change pas la hauteur. Gain : nul, c'est une correction de qualité.
9. **Verdict — à retoucher.**

---

### 2.4 `fig:archi-avant`

1. **Identité** — `ch1_cadre_existant.tex:457-500`, 44 lignes. « Modèle de sécurité avant le
   projet : périmètre unique en entrée, confiance implicite à l'intérieur. » Chapitre 1.
   **15,93 × 5,62 cm — 27,6 % d'une page.**
2. **Ce qu'elle démontre** — qu'un serveur unique à réseau interne partagé fait de tout
   composant interne un composant de confiance. Une phrase : conforme, et c'est le contrepoint
   dont le mémoire a besoin.
3. **Sémantique des flèches** — deux styles nommés plus un anonyme :
   `flux` (plein `thick`, `blue!55!black`, 6 emplois) = appel synchrone ;
   `retour` (plein `thick`, bi-directionnel, `blue!55!black`, 1 emploi) = copie de sauvegarde ;
   une flèche anonyme `-{Latex[length=1.8mm]}` en `red!70!black` = pointeur d'annotation B3.
   **C'est la seule figure du mémoire en couleur** (bleu et rouge).
   **À changer** : `flux` → `\fluxdonnee` ; `retour` → `\fluxdonnee` avec double pointe déclarée
   dans la convention ; la flèche rouge d'annotation → `\pointeurnote` (trait fin, sans pointe,
   `\coulrefus`), pour ne pas la confondre avec un flux.
4. **Légende interne** — **ABSENTE, défaut bloquant** : trois aspects, dont un porteur d'un sens
   fort (rouge = faiblesse identifiée B3). Légende proposée :
   `▸ appel synchrone   ◂▸ copie   ── annotation de faiblesse (B3)`
5. **Séparation des plans** — un cadre `fit` sur calque `backgrounds` matérialise le
   « Serveur unique — réseau interne partagé ». C'est **la meilleure séparation du corpus** et
   le modèle à généraliser. Manque : rien ne distingue le plan de données du plan
   d'observation (la sauvegarde). Ajouter une bande `planobservation` derrière la sauvegarde.
6. **Croisements** — 0.
7. **Lisibilité** — **défaut réel** : les étiquettes de protocole `HTTP`, `API`, `SQL` sont
   posées au milieu d'arcs trop courts et **mordent sur les nœuds** qu'elles relient
   (`HTTP` recouvre le bord de « Frontend Next.js », `SQL` recouvre « PgBouncer » et
   « PostgreSQL 17 »). Correctif : `midway, fill=white, inner sep=1pt`, ou allonger les arcs de
   0,3 cm. Couleur : le bleu passe en gris moyen à l'impression noir et blanc et devient
   indistinguable du noir — **le rouge de B3 doit doubler sa couleur par une forme** (cadre
   double ou pastille) pour rester lisible en niveaux de gris.
8. **Gain de place** — aucun ; figure bien dimensionnée.
9. **Verdict — à retoucher.** À conserver telle quelle dans son principe : c'est la seule figure
   « avant » et elle porte la justification de tout le mémoire.

---

### 2.5 `graph:audit-41` *(sans label `fig:` — voir la remarque de nomenclature)*

1. **Identité** — `ch1_cadre_existant.tex:545-580`, 36 lignes, **environnement `figure`** mais
   label `graph:audit-41`. « Répartition des 41 critères de préparation au déploiement, par
   catégorie et par statut (audit du 29/07/2026). » Chapitre 1.
   **14,31 × 6,23 cm — 30,1 % d'une page.**
2. **Ce qu'elle démontre** — que le fonctionnel est prêt et que le technique, la sécurité et la
   conformité ne le sont pas. Une phrase : conforme.
3. **Sémantique des flèches** — aucune flèche. Sans objet.
4. **Légende interne** — présente et correcte (Prêt / Partiel / Non prêt avec effectifs).
   Conforme.
5. **Séparation des plans** — sans objet.
6. **Croisements** — 0.
7. **Lisibilité** — trois remplissages `black!8 / black!30 / black!65` : contrastes suffisants
   en niveaux de gris, doublés par l'ordre d'empilement annoncé. Tous les libellés en
   `\scriptsize` (8 occurrences) : **sous le plancher**, à passer `\footnotesize`.
   La note de bas de graphique est une phrase complète — acceptable pour une note de lecture.
8. **Gain de place** — la légende occupe une colonne de 1,6 cm à droite ; la placer sur une
   ligne sous l'axe des abscisses ramène la largeur à ~11 cm sans changer la hauteur.
   Gain de page : nul.
9. **Verdict — conforme, à retoucher sur la typographie.**
   **Défaut de nomenclature à signaler** : `config/packages.tex:44-70` déclare un type de
   flottant `graphique` (compteur, `\ext@graphique`, `\listofgraphiques`) —
   **`\begin{graphique}` n'est employé nulle part et `\listofgraphiques` n'est appelé nulle
   part**. Les deux graphiques du mémoire (`graph:audit-41` et `graph:coldstart`) sont des
   `figure` portant un préfixe de label `graph:`, donc listés dans la liste des **figures**.
   Ou bien on emploie le type de flottant déclaré, ou bien on retire les 27 lignes de
   `packages.tex` et on renomme les deux labels en `fig:`. **Je ne tranche pas : hors périmètre
   graphique, à arbitrer par l'équipe qualité.**

---

### 2.6 `fig:cas-utilisation`

1. **Identité** — `ch3_besoins_menaces.tex:84-155`, 72 lignes. « Diagramme de cas d'utilisation
   du socle ». Chapitre 3. **15,36 × 9,67 cm — 44,0 % d'une page.**
2. **Ce qu'elle démontre** — **rien qui soit énonçable en une phrase de démonstration.** Sa
   légende est un titre de contenu (« Diagramme de cas d'utilisation du socle »), pas une
   proposition. C'est un défaut majeur au sens du brief. La proposition récupérable est :
   *trois acteurs humains et trois acteurs système partagent huit cas d'utilisation, et les
   trois cas de la chaîne automatisée n'ont aucun acteur humain*. Si l'équipe rédaction
   n'assume pas cette phrase, la figure est candidate au retrait.
3. **Sémantique des flèches** — **aucune flèche** : associations UML en traits nus, plein
   (humain) et tirets (automatisé). C'est un usage **licite mais non couvert** par la convention
   du brief §2.1, qui ne parle que de flèches. La convention doit prévoir le trait sans pointe.
4. **Légende interne** — **présente et correcte** : « — association humaine  - - - association
   automatisée ». C'est le bon modèle formel à généraliser (une ligne, sous la figure, dans le
   `tikzpicture`).
5. **Séparation des plans** — le cadre « Socle Zero Trust » sépare le système de ses acteurs.
   **Un second cadre non nommé** entoure UC4, UC6, UC7 et UC8 sans qu'aucune étiquette ni la
   légende ne dise ce qu'il regroupe : **élément graphique non déclaré, défaut.** Il faut le
   nommer (« chaîne automatisée ») ou le supprimer.
6. **Croisements** — **3**. Le pire est le trait tireté de A6 (« Tâches planifiées ») qui
   descend sous la boîte du socle, court sur toute sa largeur et remonte : il croise les
   associations de A3 et de UC5. **Réacheminement** : placer A6 à droite de UC8, dont il est le
   seul correspondant, supprime les trois croisements en même temps.
7. **Lisibilité** — **défaut bloquant** : la boîte de l'acteur système **A5 recouvre le libellé
   de l'acteur A4** (« A4 / Dépôt de code et chaîne de livraison » est partiellement caché). Sur
   le rendu, le texte de A4 est illisible. Correctif : descendre A5 et A6 de 0,6 cm, ou passer
   le libellé de A4 au-dessus du pictogramme.
   Polices : `\scriptsize` dans les ellipses, `\footnotesize` pour les acteurs — le contenu
   porteur (les noms de cas) est **sous le plancher**.
8. **Gain de place** — 9,67 cm pour huit cas. En resserrant les ellipses
   (`minimum height` 1,05 → 0,90 cm) et l'écart vertical, ~8,2 cm : **gain 0,06 page**.
   Aucun doublon avec une autre figure.
9. **Verdict — à retoucher, sous condition.** Si la légende ne devient pas une proposition
   démontrable, **à retirer** : le chapitre 3 doit passer de 11 à 8 pages et un diagramme de cas
   d'utilisation qui ne démontre rien est le premier candidat (**gain 0,44 page**).

---

### 2.7 `fig:dfd-frontieres`

1. **Identité** — `ch3_besoins_menaces.tex:252-371`, **120 lignes source**. « Diagramme de flux
   de données du socle et ses cinq frontières de confiance. » Chapitre 3.
   **16,77 × 13,06 cm — 57,7 % d'une page. DÉBORDE de 22,0 pt (7,7 mm) dans la marge : c'est le
   pire débordement du mémoire et il est visible à l'impression.**
2. **Ce qu'elle démontre** — que TB1 à TB4 sont franchies par le réseau et que TB5, orthogonale,
   n'est franchie que par l'identité, donc qu'aucun dispositif réseau ne peut s'y interposer.
   Une phrase : conforme, et c'est l'une des meilleures propositions du mémoire.
3. **Sémantique des flèches** — trois styles :
   `a` (plein, `black!65`, 12 emplois) = flux de données ;
   `ab` (plein bi-directionnel, 4 emplois) = échange requête/réponse ;
   `ai` (**pointillés**, `black!55`, 3 emplois) = « flux différé ou hors requête ».
   **À changer** : `ai` désigne un flux différé, pas une décision de politique — c'est
   exactement `\fluxevenement` (tirets) de la convention. `a` → `\fluxdonnee`,
   `ab` → `\fluxdonnee` bi-directionnel. Il manque un style : les franchissements de TB5 (F2b,
   F3) sont des franchissements **par l'identité seule**, c'est-à-dire des décisions
   d'autorisation — ils doivent passer en `\fluxcontrole` (pointillés), ce qui rend la thèse de
   la figure visible sans lire une étiquette.
4. **Légende interne** — **présente** (« Notation » : processus, magasin, entité externe,
   frontière, flux différé). C'est la meilleure du corpus. **À compléter** de la ligne
   `\fluxcontrole` une fois TB5 traitée.
5. **Séparation des plans** — les frontières TB1–TB4 sont des bandes horizontales en tirets,
   TB5 une verticale : c'est une séparation, mais **par frontière de confiance, pas par plan**.
   Les trois plans se lisent pourtant dans la figure : plan de données à gauche (application,
   base), plan de contrôle au centre (API, périmètre), plan d'observation à droite (collecte,
   entrepôt, requêtes). **Proposition** : ajouter trois bandes de fond verticales très claires
   (`plandonnee`, `plancontrole`, `planobservation`, cf. §3), sur le calque `backgrounds`, sous
   les frontières existantes. Le lecteur lirait alors les deux découpages en même temps — c'est
   précisément ce que la figure veut dire.
6. **Croisements** — **5 au moins**. (a) F4 « Collecte journalisée » croise la verticale TB5 ;
   (b) l'arc « étiquette SHA » du registre d'images vers l'API croise la descente F4 ;
   (c) F6 (pointillés, du référentiel de techniques vers l'entrepôt) contourne par la droite et
   croise F5b ; (d) l'arc de la tâche planifiée vers la base de données croise TB4 et le flux F2 ;
   (e) F7 croise la verticale TB5. **Les franchissements de frontière ne sont pas des
   croisements à supprimer** — ce sont le sujet. Les croisements (b), (c) et (d) le sont :
   passer (b) et (d) en arc, et faire descendre (c) le long du bord droit hors du cadre.
7. **Lisibilité** — `\scriptsize` partout (6 occurrences), aucun `\footnotesize` :
   **non conforme**, et sur une figure de 28 nœuds c'est le cas le plus coûteux.
   Les étiquettes de flux (`F1`, `F2b — identité seule (É11)`, `étiquette SHA`) sont posées
   **sur** les traits sans fond blanc : plusieurs sont coupées par le trait.
8. **Gain de place** — l'encadré « Ce que la figure démontre » (6 lignes de prose) est **le
   doublon exact de la légende du flottant**. Sa suppression mesurée ne gagne que 0,01 cm ici
   (il est placé à côté du bloc « Notation », pas dessous) mais **libère 8,5 cm de largeur** :
   c'est lui qui fait déborder la figure. **Le retirer supprime le débordement de 22 pt.**
   Gain de page : 0 ; gain de fabrication : décisif.
9. **Verdict — à retoucher (correction obligatoire).** À conserver : c'est la figure charnière du
   chapitre 3.

---

### 2.8 `fig:contexte`

1. **Identité** — `ch4_conception.tex:62-108`, 47 lignes. « Vue de contexte : le socle, ses
   acteurs et les systèmes extérieurs dont il dépend ». Chapitre 4.
   **15,79 × 12,46 cm — 55,3 % d'une page.**
2. **Ce qu'elle démontre** — que le socle dépend de six systèmes extérieurs dont trois lui
   entrent des données qu'il ne maîtrise pas. Une phrase : conforme. **La légende, elle, ne
   l'énonce pas** : « Vue de contexte : le socle, ses acteurs et les systèmes extérieurs » est un
   titre de contenu. À réécrire en proposition.
3. **Sémantique des flèches** — deux styles :
   `sync` (plein `thick`, 6 emplois) = échange synchrone pendant l'exploitation ;
   `asyn` (**pointillés** `thick`, 3 emplois) = import différé, hors du chemin de la requête.
   **À changer** : `asyn` est un flux différé, donc `\fluxevenement` (tirets), pas des
   pointillés. `sync` → `\fluxdonnee`. La flèche « résolution de noms » vers le bureau
   d'enregistrement est une **dépendance externe non maîtrisée** (écart É10) : la distinguer par
   `\fluxexterne` (trait plein, pointe creuse) est le seul moyen de rendre É10 visible ici.
4. **Légende interne** — **présente mais en prose** : les six lignes sous la figure disent
   « Trait plein : échange synchrone pendant l'exploitation. Pointillés : import différé, hors du
   chemin de la requête — une indisponibilité y dégrade… ». Défaut de forme. À remplacer par une
   ligne de clé graphique, le reste passant en légende de flottant ou en paragraphe d'appel.
5. **Séparation des plans** — **aucune**. Or la figure s'y prête parfaitement : colonne de
   gauche = acteurs, centre = le socle, colonne de droite = dépendances externes. Trois bandes
   de fond nommées (`fit` sur `backgrounds`) rendraient la lecture immédiate.
6. **Croisements** — 0. C'est l'une des trois figures parfaitement propres de ce point de vue.
7. **Lisibilité** — corps `\footnotesize` pour les nœuds : conforme. Mais **le pavé de six
   lignes de prose est en corps de texte à l'intérieur du `tikzpicture`** : il représente à lui
   seul environ 2,6 cm des 12,46, soit **21 % de la figure**.
8. **Gain de place** — sortir les six lignes de prose de la figure : la hauteur passe d'environ
   12,46 à 9,9 cm, **gain 0,10 page**, et la figure descend de 55,3 % à 44 % d'une page, ce qui
   lui permet de partager sa page avec du texte.
   **Paire redondante** : `fig:contexte` et `fig:modele-couches` sont deux vues du même socle
   (voir 2.9). Fusion non recommandée — le contexte est extérieur, le modèle en couches est
   intérieur : les deux points de vue sont distincts au sens de la recette.
9. **Verdict — à retoucher.**

---

### 2.9 `fig:modele-couches`

1. **Identité** — `ch4_conception.tex:120-161`, 42 lignes. « Modèle en couches : cinq couches
   empilées (L1, L3, L4, L5, L6) et deux plans transversaux (L2, L7). » Chapitre 4.
   **12,24 × 8,99 cm — 41,3 % d'une page.**
2. **Ce qu'elle démontre** — que l'identité (L2) et l'observabilité (L7) ne sont pas des couches
   mais des plans qui traversent toutes les autres. Une phrase : conforme. **La correction
   factuelle F1 du brief est déjà appliquée** : la résolution de noms ne figure plus en L1 et la
   légende renvoie à la vue de contexte.
3. **Sémantique des flèches** — un seul style nommé, `fleche` (plein `thick`, 7 emplois), mais il
   sert **deux sens différents** : les sept petites flèches internes entre couches (traversée
   d'un saut) et les sept flèches en pointillés dessinées à la main sur le rail gauche
   (collecte F4 — déclarées hors du style nommé). Le mémoire compte donc ici **deux aspects,
   un seul style**.
   **À changer** : traversée de saut → `\fluxdonnee` ; collecte F4 → `\fluxevenement` (tirets) ;
   et — c'est le point important — **la vérification d'identité à chaque saut doit devenir
   visible** : c'est une décision d'autorisation, donc `\fluxcontrole` (pointillés) depuis L2
   vers chaque frontière de couche. Aujourd'hui elle n'est écrite que dans le libellé tourné
   à 90°.
4. **Légende interne** — **absente** ; l'explication est dans la légende du flottant
   (« Pointillés : collecte F4 ; tirets : vérification d'identité à chaque saut »). Or **la
   figure ne contient aucun trait en tirets** : la légende décrit les *bordures* en tirets des
   cadres L2 et L7. **La légende du flottant est fausse sur ce point** — à corriger.
5. **Séparation des plans** — c'est le sujet même de la figure, et elle le fait bien : les deux
   plans transversaux sont des cadres à bordure tiretée, distincts de la pile. **Conforme.**
   C'est la figure de référence à citer dans la convention.
6. **Croisements** — 0.
7. **Lisibilité** — **défaut** : le libellé de L2 est **tourné à 90°** et comporte, dans la même
   colonne verticale, les noms de produits en `\scriptsize` gris clair
   (`Cloud IAM · Secret Manager · Cloud KMS · Workload Identity Federation`). Tourné, en gris
   clair, sous le plancher : illisible à l'impression. Correctif : élargir la colonne L2,
   écrire le titre horizontalement sur deux lignes, et faire passer les noms de produits en
   `\footnotesize` `black!55`.
   Dix occurrences de `\scriptsize` pour deux de `\footnotesize` : la figure est majoritairement
   sous le plancher.
8. **Gain de place** — 76,5 % de la largeur seulement : il reste 3,8 cm de marge inutilisée. En
   élargissant à 15 cm on gagne de la place verticale sur L2 sans augmenter la hauteur.
   **Paire à examiner : `fig:modele-couches` (41,3 %) et `fig:deploiement` (45,9 %)** montrent
   le même socle avec les **mêmes produits** (Cloud Load Balancing, Cloud Armor, Cloud Run, VPC,
   Cloud SQL, BigQuery, Cloud Logging), l'un en couches, l'autre en composants et liens. Ensemble
   87,2 % d'une page. **Fusion possible** : une seule vue en couches où chaque couche porte ses
   composants et où les flux F1–F5 sont tracés entre couches — hauteur estimée 12 cm, soit 55 %
   d'une page. **Gain ≈ 0,32 page.** Coût : on perd la lisibilité des liens réseau
   public/privé, qui est le seul apport propre de `fig:deploiement`. **Recommandation : fusion,
   à condition de conserver les quatre styles de lien dans la vue fusionnée.**
9. **Verdict — à retoucher** (ou **à fusionner** avec `fig:deploiement`, décision de l'équipe
   chapitre 4).

---

### 2.10 `fig:deploiement`

1. **Identité** — `ch4_conception.tex:180-260`, 81 lignes. « Vue de déploiement : composants,
   liens réseau et flux F1 à F5. » Chapitre 4. **15,84 × 10,14 cm — 45,9 % d'une page.**
2. **Ce qu'elle démontre** — que le chemin public et le chemin privé sont deux chemins réseau
   distincts, et que la chaîne de livraison entre sans clé. Une phrase : conforme.
3. **Sémantique des flèches** — **quatre styles, le maximum du mémoire** :
   `pub` (plein fin 0,5 pt, 8 emplois) = chemin public ;
   `priv` (plein épais 1,5 pt, 5 emplois) = chemin réseau privé ;
   `jour` (**pointillés** `thick`, 6 emplois) = journal F4 ;
   `man` (**tirets** `thick`, 2 emplois) = geste manuel.
   **À changer, style par style** :
   - `pub` → `\fluxdonnee` (plein 0,6 pt) ;
   - `priv` → `\fluxdonnee` + attribut `prive` (plein 1,1 pt) — l'épaisseur reste le seul
     porteur de la distinction public/privé, ce qui est acceptable **à condition qu'elle soit
     dans la légende** ;
   - `jour` → `\fluxevenement` (tirets) — c'est le cas d'école de la convention : un journal
     est un flux asynchrone ;
   - `man` → **`\fluxcontrole` (pointillés)** : un geste manuel est une décision hors
     automatisme. Les deux styles échangent donc leur aspect. C'est la correction la plus
     visible du mémoire.
4. **Légende interne** — **absente**, alors que la figure emploie quatre styles : **défaut
   bloquant, le plus grave du corpus**. La légende du flottant contient à sa place trois lignes
   et demie de prose (« Quatre styles de lien — trait fin : chemin public… »). Légende proposée,
   sur une ligne, dans la figure :
   `── chemin public   ━━ chemin privé   ⇢ journal (F4)   ⋯▸ geste manuel`
5. **Séparation des plans** — **aucune bande, aucun cadre**. La figure a pourtant une structure
   de plan évidente : L1 (contrôle d'entrée), la rangée des services (données), L4 (réseau),
   L7 (observation). Trois bandes de fond suffiraient.
6. **Croisements** — **4**. (a) le lien tireté « étiquette SHA (F3) » du registre d'images
   traverse toute la largeur et **passe sur le nœud « Tableau de bord »**, dont il coupe le nom
   de produit `Cloud Run` ; (b) il croise ensuite la descente L1 → Tableau de bord ; (c) la
   verticale tiretée « identité seule (É11) » croise le cadre « Réseau privé (L4) » ; (d) le
   rail F4 de gauche croise le flux F2 de l'application hébergée.
   **Réacheminement** : (a) et (b) disparaissent en faisant descendre la flèche F3 par la
   **droite** du cadre, au-dessus du registre d'images ; (c) se règle en la faisant longer le
   bord droit du cadre L4 plutôt qu'en le coupant ; (d) en décalant le rail F4 de 0,4 cm vers
   la gauche.
7. **Lisibilité** — 14 occurrences de `\scriptsize` contre 2 de `\footnotesize` : **la
   quasi-totalité des libellés est sous le plancher**. Les étiquettes `JWT ; 2e passage`,
   `identité seule (É11)`, `par le connecteur` sont posées sur les traits sans fond blanc.
8. **Gain de place** — voir 2.9 : fusion avec `fig:modele-couches`, **gain ≈ 0,32 page**.
   Seule, la figure gagnerait 1,2 cm en resserrant les rangées (`minimum height` des nœuds
   0,95 → 0,80 cm) : **gain 0,05 page**.
9. **Verdict — à refaire.** C'est la figure qui concentre le défaut central du mémoire : quatre
   styles, aucune légende, deux d'entre eux à contresens de la convention, quatre croisements
   dont un qui coupe un libellé. Elle est aussi la vue d'architecture la plus citée du
   chapitre 4 : le rapport qualité/coût de sa reprise est le meilleur du corpus.

---

### 2.11 `fig:topologie-reseau`

1. **Identité** — `ch4_conception.tex:279-389`, 111 lignes. « Topologie réseau **avant la
   refonte** — état du dépôt jusqu'au 11/08/2026. » Chapitre 4.
   **15,72 × 14,35 cm — 62,9 % d'une page : au-delà du seuil où LaTeX réserve une page de
   flottant et laisse la page voisine partiellement vide.**
2. **Ce qu'elle démontre** — que la sortie des charges de travail n'était pas gouvernée par le
   réseau mais par un paramètre de la plateforme d'exécution. Une phrase : conforme, excellente.
3. **Sémantique des flèches** — trois styles :
   `a` (plein, 4 emplois) = flux ; `ae` (plein 1,1 pt, pointe 2,1 mm, 2 emplois) = **sortie
   effective** ; `ai` (pointillés, 1 emploi) = lien indirect.
   **À changer** : `ae` n'est pas un style, c'est un **accent** — la sortie réelle. Le rendre
   explicite avec `\fluxdonnee` + `accent`, déclaré en légende. `ai` → `\fluxevenement`.
   **Il manque le style du refus** : la figure porte déjà un `×` manuscrit entre la passerelle
   de sortie et le connecteur pour dire « chemin non attesté par le code ». C'est le germe de
   `\fluxrefuse` — à formaliser (§3).
4. **Légende interne** — **absente** pour les traits. Défaut bloquant.
5. **Séparation des plans** — un cadre en tirets matérialise le réseau virtuel : c'est une
   séparation topologique, pas une séparation de plans. Le panneau « Règles de filtrage en
   entrée / Règles de sortie » à droite appartient au plan de contrôle : le mettre sur fond
   `plancontrole` le dirait sans mot.
6. **Croisements** — **1 seul** (la verticale « par l'accès privé » longe le panneau de règles
   et croise la ligne d'appui du cadre). Figure remarquablement propre pour sa densité.
7. **Lisibilité** — `\scriptsize` partout (5 occurrences), aucun `\footnotesize`. Le panneau de
   règles est **une table de dix lignes dessinée en nœuds TikZ** : les préfixes numériques
   (`800`, `900`, `1000`, `65534`) sont en `\ttfamily\scriptsize`. C'est du contenu tabulaire
   qui n'a rien à faire dans une figure.
8. **Gain de place** — deux leviers mesurés :
   - retirer le pavé « Ce que la figure démontre » (doublon de la légende) : **−1,82 cm**,
     mesuré, la figure passe de 62,9 % à 54,7 % d'une page — elle peut alors partager sa page ;
   - sortir le panneau de règles vers un `tabular` du texte courant : **−4,2 cm de largeur** et
     ~−1,5 cm de hauteur supplémentaires.
   Les deux ensemble ramènent la figure à ~11 cm : **gain ≈ 0,20 page**, plus le déblocage de
   la page voisine.
   **Paire `fig:topologie-reseau` / `fig:topologie-cible`** : voir 2.12. **Fusion non
   recommandée, avec chiffres à l'appui.**
9. **Verdict — à retoucher.**

---

### 2.12 `fig:topologie-cible`

1. **Identité** — `ch4_conception.tex:546-647`, 102 lignes. « Topologie réseau **après la
   refonte appliquée du 11 au 25/08/2026** — le réseau en service à \dateref. » Chapitre 4.
   **16,03 × 11,22 cm — 50,2 % d'une page. Déborde de 0,9 pt.**
2. **Ce qu'elle démontre** — que les charges de travail émettent désormais depuis un sous-réseau,
   donc que le pare-feu leur est applicable. Une phrase : conforme.
3. **Sémantique des flèches** — deux styles : `a` (plein, 5 emplois), `ab` (plein
   bi-directionnel, 1 emploi). Sens stable. **À changer** : renommage vers `\fluxdonnee`
   uniquement. Comme en 2.11, le `⨯` d'isolation entre les deux locataires doit devenir
   `\fluxrefuse` — c'est **la** propriété que la figure veut établir.
4. **Légende interne** — **absente**. Défaut bloquant (deux styles + le `⨯` + les cadres en
   tirets « déjà adressé » / « ferme le /24 »).
5. **Séparation des plans** — le cadre du réseau virtuel sépare l'intérieur de l'extérieur ;
   rien ne sépare les deux locataires autrement que par deux nœuds côte à côte. La démonstration
   d'isolation gagnerait à deux bandes de fond distinctes, une par locataire.
6. **Croisements** — **2**. La longue horizontale `E5 — 443 (tableau de bord seul)` court en
   haut sur toute la largeur, **passe au-dessus du cadre du réseau virtuel** et croise la
   descente `E4`. À faire longer le bord extérieur du cadre.
7. **Lisibilité — DÉFAUT BLOQUANT, visible au rendu** : le titre en italique
   *« Réseau virtuel en mode personnalisé — mode de routage régional déclaré »* est **coupé par
   la bordure supérieure du cadre et recouvert par le nœud « Locataire plateforme »**. Le texte
   est illisible sur environ la moitié de sa longueur. De plus, le contenu du nœud « Locataire
   plateforme » (« API de supervision · tableau de bord · tâche d'enrichissement ») **déborde de
   son cadre** et mord sur le nœud voisin. Les étiquettes `E7–E8` et `I1–I2` sont posées sur la
   bordure du cadre.
   Correctif : remonter le titre du cadre de 0,5 cm (`label={[yshift=…]above:…}` plutôt qu'un
   nœud posé), élargir les deux nœuds de locataire de 0,4 cm, et déplacer `E7–E8` / `I1–I2` sous
   le `⨯`.
8. **Gain de place** — retrait du pavé de prose : **−0,80 cm mesuré**. Panneau « Règles » vers
   un `tabular` : ~−3,5 cm de largeur, ce qui supprime le débordement.
   **Fusion avec `fig:topologie-reseau` : je l'ai chiffrée et je la déconseille.** Après retrait
   des deux pavés de prose, les deux figures mesurent 12,53 cm et 10,42 cm ; empilées dans un
   seul flottant elles font 22,95 cm plus deux sous-légendes, soit **plus d'une page pleine**,
   contre 0,52 + 0,47 = 0,99 page aujourd'hui. **Gain net : nul.** Et les deux vues sont chacune
   trop larges (15,7 et 16,0 cm) pour tenir côte à côte. **Recommandation : les garder
   séparées, et faire porter la comparaison par un tableau « avant / après » de six lignes**,
   ce qui est à la fois plus court et plus citable qu'une figure fusionnée.
9. **Verdict — à refaire.** Le recouvrement de titre est un défaut de fabrication visible par le
   jury.

---

### 2.13 `fig:cycle-donnee`

1. **Identité** — `ch4_conception.tex:978-1056`, 79 lignes. « Cycle de vie de la donnée de
   sécurité : six étapes, et le budget de latence porté par les cadences. » Chapitre 4.
   **15,14 × 12,63 cm — 56,0 % d'une page.**
2. **Ce qu'elle démontre** — que le délai entre l'événement et son affichage est fait d'attentes
   d'ordonnanceur et non de temps de traitement. Une phrase : conforme, et c'est une des
   propositions les plus utiles du mémoire.
3. **Sémantique des flèches** — deux styles : `a` (plein 0,7 pt, 4 emplois) = passage d'étape ;
   `ad` (**tirets**, 1 emploi) = branche d'enrichissement. **C'est la seule figure du mémoire où
   les tirets signifient effectivement « flux asynchrone » au sens du brief §2.1.**
   **À changer** : `a` → `\fluxdonnee` ; `ad` → `\fluxevenement` (aspect inchangé, nom
   normalisé). Le `⨯` sur la diagonale « arc absent » devient `\fluxrefuse`.
4. **Légende interne** — deux styles + un `⨯` : **légende requise, absente**. Elle est
   remplacée par des étiquettes locales (« arc absent — pas de clé d'entité : jointure
   impossible »), ce qui fonctionne mais n'est pas transposable. Légende proposée :
   `▸ passage d'étape   ⇢ branche d'enrichissement   ⨯ arc absent`
5. **Séparation des plans** — la colonne de gauche est le plan de données, la branche de droite
   la branche informationnelle. Deux bandes de fond suffiraient à rendre la « impasse
   fonctionnelle assumée » visible sans lire.
6. **Croisements** — **0**.
7. **Lisibilité** — `\scriptsize` seul (4 occurrences). Les cadences (`5 min`, `10 s`,
   `15 min`, `quasi temps réel`) sont en gras sur le trait : bien vu, c'est le sujet.
   Le pavé « Ce que la figure démontre » (5 lignes) duplique la légende.
8. **Gain de place** — retrait du pavé : **−0,30 cm mesuré** (il est posé à côté, pas dessous).
   **Redondance à trancher, la plus coûteuse du mémoire** : trois figures décrivent la même
   chaîne de latence — `fig:cycle-donnee` (ch4, 56,0 %), `fig:chronologie-incident` (ch4,
   34,2 %) et `fig:pipeline-detection` (ch5, 32,7 %). Total **1,23 page**. Voir 2.16 et 2.24.
9. **Verdict — à retoucher** (et à conserver comme figure de référence de la chaîne de latence,
   les deux autres s'y rattachant).

---

### 2.14 `fig:modele-donnees`

1. **Identité** — `ch4_conception.tex:1072-1255`, **184 lignes source, 43 nœuds**. « Modèle de
   données des deux systèmes de stockage : ce que les clés permettent, et la jointure que leur
   absence interdit. » Chapitre 4.
   **15,53 × 20,94 cm — 89,6 % d'une page : elle occupe une page entière et laisse ~10 % de
   blanc. C'est la figure la plus coûteuse du mémoire.**
2. **Ce qu'elle démontre** — que l'impossibilité de corréler le rattachement sémantique au score
   d'incident est une propriété **du schéma** et non un choix d'algorithme. Une phrase :
   conforme, et c'est une démonstration forte, du type que le jury attend.
3. **Sémantique des flèches** — un seul style fléché, `a` (plein 0,7 pt, 1 emploi). Le reste est
   une notation patte-d'oie (traits sans pointe) : `un` / `plusieurs` / `rattachement sans clé`
   (tirets) / `jointure impossible` (tirets barrés d'un `⨯`).
   **À changer** : peu de chose. Cette figure est **la plus proche de la convention cible** :
   elle distingue déjà quatre aspects et les déclare. Il faut simplement adopter les noms de la
   convention et faire du `⨯` sur tirets le `\fluxrefuse` du mémoire.
4. **Légende interne** — **présente, formelle, complète** (« Notation patte-d'oie »). C'est le
   modèle de référence du corpus, avec celle de `fig:dfd-frontieres`.
5. **Séparation des plans** — deux cadres nommés « Cadre A — base relationnelle » et
   « Cadre B — entrepôt de supervision », avec entre eux une bande de texte qui énonce la
   séparation. **Conforme et exemplaire** — c'est exactement le dispositif que le brief §2.2
   demande, appliqué à des systèmes de stockage plutôt qu'à des plans.
6. **Croisements** — **0** entre arcs. Les `⨯` de la figure sont des symboles de notation, pas
   des croisements.
7. **Lisibilité** — `\scriptsize` sur les noms de colonnes (`\ttfamily`) : c'est le cas où la
   dérogation est la plus défendable (un nom de colonne est une annotation secondaire), mais les
   **noms de table** sont porteurs et doivent passer `\footnotesize`.
8. **Gain de place — c'est ici que se joue le plus gros gain unitaire du corpus.**
   - retrait du pavé « Ce que la figure démontre » : **−0,54 cm mesuré** ;
   - **la moitié supérieure du Cadre B ne sert pas la démonstration** : les six tables
     `raw_logs`, `access_logs`, `security_events`, `api_metrics`, `cve_findings`,
     `pending_embeddings` n'ont aucun arc et ne portent qu'un « partition par jour ». Elles
     appartiennent à l'annexe D. Les retirer économise deux rangées, soit ~3,2 cm ;
   - le Cadre A entier (`roles`, `users`, `audit_logs`, `api_keys`) démontre autre chose
     (l'authentification) que le titre de la figure. Le conserver est légitime, mais la
     démonstration annoncée ne porte que sur le Cadre B.
   **Total réaliste : 20,94 → ~16,5 cm, soit de 89,6 % à 71 % d'une page — gain 0,19 page**, et
   surtout la figure cesse d'être seule sur sa page.
   **Attention, testé et négatif** : j'ai essayé la compression globale `y=1cm → y=0.86cm`. La
   hauteur tombe bien à 17,76 cm, mais **des nœuds se recouvrent** (voir §5.3). Le gain doit
   venir du contenu, pas de l'échelle.
9. **Verdict — à retoucher** (allègement du Cadre B). À conserver : c'est la meilleure figure du
   mémoire sur le fond.

---

### 2.15 `fig:seq-refus`

1. **Identité** — `ch4_conception.tex:1275-1450`, **176 lignes, 36 nœuds**. « Requête
   malveillante refusée au périmètre : ordre d'évaluation des règles et trajet de la preuve
   jusqu'à l'analyste. » Chapitre 4.
   **16,06 × 16,10 cm — 70,0 % d'une page. Déborde de 1,7 pt.**
2. **Ce qu'elle démontre** — que l'ordre des règles est une propriété de sécurité : la première
   correspondance est terminale. Une phrase : conforme.
3. **Sémantique des flèches** — deux styles :
   `msg` (plein 0,5 pt, pointe pleine 1,6 mm, 7 emplois) = appel synchrone ;
   `rep` (plein 0,5 pt, **pointe creuse** `[open]`, 2 emplois) = réponse.
   **Défaut de fond** : la distinction entre les deux ne tient **qu'à la forme de la pointe**,
   à 1,6 mm, en `black!70`. À l'impression, sur une figure de 36 nœuds, elle est invisible.
   **À changer** : conserver `msg` → `\fluxdonnee` ; `rep` → `\fluxreponse` (plein, pointe
   creuse **et** trait plus clair `black!45`, deux porteurs au lieu d'un).
   **Manque le plus grave du corpus** : cette figure s'appelle « refus » et **n'a aucun style de
   refus**. Le `403` est un simple nœud de texte sur une flèche `rep`. La réponse de refus doit
   être `\fluxrefuse` (plein épais barré d'un `⨯`), sans quoi le titre de la figure n'est pas
   soutenu par son dessin.
4. **Légende interne** — **présente et formelle** (« Notation → appel synchrone → réponse →
   message asynchrone ⋯ note *italique* : cadence configurée »). Bonne forme, mais elle déclare
   **trois** aspects distingués uniquement par la pointe : c'est le défaut du point 3 reporté
   dans la légende. À reprendre avec la convention.
5. **Séparation des plans** — les sept participants sont alignés sans regroupement. Or ils se
   répartissent nettement : plan de données (Client, Périmètre), plan d'observation
   (Journalisation, Entrepôt), plan de contrôle (Requêtes planifiées, API). **Trois bandes de
   fond verticales, une par plan, derrière les lignes de vie** : c'est le geste le plus rentable
   sur cette figure, et il ne coûte pas un millimètre de hauteur.
6. **Croisements** — **2**. La réponse `403` du Périmètre vers le Client passe sous la ligne de
   vie de « Journalisation » ; l'encart « une règle de régulation de débit… » chevauche la zone
   d'activation des « Requêtes planifiées de détection ». À régler par un décalage vertical de
   0,4 cm de l'encart et en faisant passer la réponse `403` au-dessus de l'activation.
7. **Lisibilité** — `\scriptsize` seul (5 occurrences). Le bloc « règles suivantes **non
   évaluées** : 1200 LFI, 1300 RCE, 1400 RFI, 1450 débit d'authentification, 1500 régulation
   globale, autorisation par défaut » est en `black!45` `\scriptsize` : **gris clair sous le
   plancher**, or c'est précisément la preuve de la figure (les règles non atteintes). À
   remonter en `black!70` `\footnotesize`.
   Deux pavés de prose en bas (« Encart de mesure » 4 lignes, « Ce que la figure démontre »
   4 lignes).
8. **Gain de place** — retrait du pavé dupliqué : **−0,38 cm mesuré**. L'« Encart de mesure »,
   lui, **n'est pas un doublon** : il porte les mesures datées du 19/08 et du 10/08 et doit être
   conservé, mais il appartient au texte, pas à la figure — l'en sortir gagne encore ~1,1 cm.
   Total ~1,5 cm : la figure passe de 70,0 % à 63,2 % d'une page. **Gain 0,07 page** et la
   suppression du débordement.
9. **Verdict — à refaire.** Motif principal : une figure du refus sans signe du refus.

---

### 2.16 `fig:chronologie-incident`

1. **Identité** — `ch4_conception.tex:1452-1493`, 42 lignes. « De l'attaque à l'incident : cinq
   repères et budget de latence par segment ». Chapitre 4.
   **15,67 × 7,24 cm — 34,2 % d'une page.**
2. **Ce qu'elle démontre** — rien qui ne soit déjà démontré par `fig:cycle-donnee` seize pages
   plus haut dans le même chapitre. Sa légende est un titre de contenu.
   **La proposition récupérable** — *le délai est dominé par une attente de cycle, pas par un
   traitement* — **est la proposition de `fig:cycle-donnee`, mot pour mot.**
3. **Sémantique des flèches** — aucun style nommé, une flèche anonyme `-{Latex[length=2.2mm]}`
   pour l'axe du temps. La longueur 2,2 mm n'existe nulle part ailleurs.
4. **Légende interne** — non requise (un seul aspect). Une note de trois lignes en bas explique
   l'échelle non linéaire : nécessaire et bien faite.
5. **Séparation des plans** — sans objet.
6. **Croisements** — 0.
7. **Lisibilité** — `\footnotesize` dans les jalons : **conforme, c'est l'une des rares.**
8. **Gain de place** — **34,2 % d'une page pour une redite.**
9. **Verdict — À FUSIONNER avec `fig:cycle-donnee`.** Les cinq repères de cette figure sont les
   étapes 1, 2, 3, 4 et 6 de `fig:cycle-donnee`, avec les mêmes durées. La fusion consiste à
   ajouter à `fig:cycle-donnee` la colonne d'horodatage relatif (`t₀`, `t₀ + qq. s`,
   `t₀ + 0 à 5 min`, `t₀ + ≈ 15 min`) qu'elle ne porte pas encore, et la note d'échelle non
   linéaire. **Gain mesuré : 0,34 page**, et le chapitre 4 doit perdre 9 pages.

---

### 2.17 `fig:plan-identite`

1. **Identité** — `ch4_conception.tex:1741-1792`, 52 lignes. « Plan d'identité : droits accordés
   et interdictions structurantes (cinq identités) ». Chapitre 4.
   **12,59 × 9,06 cm — 41,5 % d'une page.**
2. **Ce qu'elle démontre** — que trois écritures sont interdites par construction et non par
   convention. Une phrase : conforme. Le titre, lui, est un titre de contenu.
3. **Sémantique des flèches** — deux styles :
   `ok` (plein `thick`, 5 emplois) = droit accordé ;
   `ko` (**tirets** `thick` `black!55`, 3 emplois) = **interdiction structurante**, barrée d'un
   `⊗`.
   **C'est le seul endroit du mémoire où un refus est dessiné comme tel**, et c'est le bon
   idiome. **À changer** : `ok` → `\fluxdonnee` ; `ko` → `\fluxrefuse`, avec l'aspect imposé par
   la convention (**plein épais barré**, cf. brief §2.1) plutôt que tirets fins — un refus doit
   peser visuellement plus qu'un droit, pas moins.
4. **Légende interne** — **présente mais en prose** : « Trait plein : droit accordé. Trait
   tireté barré : **interdiction structurante** — ni l'application hébergée ni la tâche
   d'enrichissement ne peuvent écrire sur les preuves (scénario SO16, test T11). Trait tireté
   simple : séparation appliquée par le code applicatif… » — quatre lignes de phrase. À
   transformer en clé graphique de deux lignes ; le contenu argumentatif remonte au texte.
5. **Séparation des plans** — deux colonnes implicites (Identités / Ressources) avec deux
   titres en gras, sans bande. Deux bandes de fond suffisent, et la figure y gagne beaucoup :
   la colonne de gauche est le plan de contrôle, celle de droite le plan de données.
6. **Croisements** — **4**, et ce sont les pires du corpus rapportés à la taille : les trois
   diagonales `ko` traversent la bande centrale et croisent les horizontales `ok`, dont
   « lecture / écriture ». L'étiquette « non cloisonné (É9) » est posée **sur** un croisement.
   **Réacheminement** : réordonner la colonne des ressources pour que chaque interdiction soit
   horizontale ou quasi (Base de données face à l'application hébergée, Journaux face à la
   tâche d'enrichissement) et faire passer les deux interdictions restantes en arcs par
   l'extérieur de la colonne de droite. **0 croisement atteignable.**
7. **Lisibilité** — mélange `\footnotesize` (4) / `\scriptsize` (5) sans règle. Les libellés
   d'arc (`appel API`, `lecture seule`, `écriture`) sont `\scriptsize` sur le trait, sans fond.
8. **Gain de place** — 78,7 % de la largeur : il reste 3,4 cm de marge. Sortir la légende en
   prose de la figure gagne ~1,3 cm de hauteur : **gain 0,05 page**.
   **Ne pas fusionner avec `fig:delegation-identite`** : l'une montre les droits directs,
   l'autre la composition des délégations, et le mémoire dit explicitement que le risque n'est
   pas dans la première mais dans la seconde. La paire est une opposition, pas une redite.
9. **Verdict — à retoucher.**

---

### 2.18 `fig:delegation-identite`

1. **Identité** — `ch4_conception.tex:1814-1998`, **185 lignes, 33 nœuds**. « Chaînes de
   délégation d'identité : ce qu'un droit de déploiement à l'échelle du projet rend
   atteignable. » Chapitre 4.
   **15,86 × 17,90 cm — 77,3 % d'une page.**
   **Défaut de structure** : les macros `\pastilleOK` et `\pastilleWarn` sont définies par
   `\providecommand` **à l'intérieur de l'environnement `figure`** (lignes 1817-1826). Elles
   doivent rejoindre `config/commands.tex`, à côté des `\pictoPleinAudit` — d'autant qu'elles
   sont du même type et que les pictogrammes existants y sont déjà, en `\DeclareRobustCommand`
   pour la raison connue (ils cassaient dans les légendes). **Ces deux-là ne sont pas robustes
   et sont utilisées dans des nœuds : si elles remontent dans une légende un jour, elles
   casseront.** À déclarer en `\DeclareRobustCommand` au passage.
2. **Ce qu'elle démontre** — que le risque d'identité naît de la **composition** des délégations
   et non d'un droit isolé. Une phrase : conforme, et c'est l'analyse la plus fine du mémoire.
3. **Sémantique des flèches** — trois styles :
   `a` (plein `black!65`, 10 emplois) = étape de la chaîne ;
   `af` (plein `black!55`, 10 emplois) = **atteinte d'une ressource** ;
   `synth` (plein 1,7 pt, pointe 2,6 mm, `black!80`, 1 emploi) = le chemin composé, la
   conclusion de la figure.
   **Défaut** : `a` et `af` ne diffèrent que par **dix points de gris** (`black!65` contre
   `black!55`) — indistinguables. **À changer** : `a` → `\fluxdonnee` ;
   `af` → `\fluxcontrole` (pointillés) — atteindre une ressource par un droit délégué **est**
   une décision d'autorisation ; `synth` → `\fluxsynthese` (plein épais `black!85`), le seul
   accent autorisé, et il doit rester unique.
4. **Légende interne** — **absente** pour trois styles : défaut bloquant sur la figure la plus
   dense du chapitre.
5. **Séparation des plans** — bandes dessinées à la main. La bande basse « Trois chaînes
   secondaires de délégation » est correcte. Il manque la séparation entre le **plan de
   contrôle** (les identités, colonnes 1 à 3) et le **plan de données** (les cinq ressources
   atteintes, colonne de droite) : c'est pourtant la traversée de cette frontière qui est le
   risque.
6. **Croisements** — **3**, tous dans le faisceau entre la colonne 4a/4b/4c et la colonne des
   ressources. **Réacheminement** : ordonner les cinq ressources dans l'ordre de leurs
   antécédents (Clé de signature et Clé de chiffrement pour 4a, Mot de passe pour 4b, Registre
   et Médias pour 4c) élimine les trois.
7. **Lisibilité** — **deux étiquettes tournées à 90°** (« assertion signée », « jeton de courte
   durée ») en `\scriptsize` : illisibles au feuilletage. Neuf occurrences de `\scriptsize`,
   aucune de `\footnotesize`. Pavé de prose de 6 lignes en bas.
8. **Gain de place** — retrait du pavé : **−2,98 cm mesuré, le meilleur gain unitaire du
   corpus**. La figure passe de 77,3 % à 64,2 % d'une page. En sortant en outre la bande
   « Trois chaînes secondaires » vers un tableau de trois lignes du texte courant :
   **−1,9 cm de plus**, soit ~55 % d'une page. **Gain total ≈ 0,22 page.**
9. **Verdict — à refaire.** La figure est juste et importante ; sa mise en forme ne l'est pas.

---

### 2.19 `fig:seq-mfa`

1. **Identité** — `ch4_conception.tex:2039-2250`, **212 lignes, 46 nœuds — la plus longue source
   du mémoire**. « Authentification à deux facteurs : cinq états de la session et le jeton
   intermédiaire qui ne porte aucun rôle. » Chapitre 4.
   **15,47 × 17,99 cm — 77,7 % d'une page.**
2. **Ce qu'elle démontre** — qu'entre le mot de passe et le code à usage unique la session existe
   « authentifiée mais non autorisée ». Une phrase : conforme, excellente.
3. **Sémantique des flèches** — trois styles :
   `msg` (plein 0,5 pt, 7 emplois) = appel synchrone ;
   `rep` (plein, pointe creuse, 3 emplois) = réponse ;
   `ref` (**tirets**, pointe creuse, 6 emplois) = **refus**, barré d'une croix.
   **Incohérence directe avec `fig:seq-refus`** (voisine de 590 lignes dans le même fichier) :
   les deux partagent les noms `msg` et `rep` avec des définitions identiques, mais celle-ci a
   un style de refus et l'autre — qui s'appelle « refus » — n'en a pas.
   **À changer** : `msg` → `\fluxdonnee` ; `rep` → `\fluxreponse` ; `ref` → `\fluxrefuse`, et le
   **même** `\fluxrefuse` doit apparaître dans `fig:seq-refus` et `fig:plan-identite`. Le refus
   passe en **plein épais barré**, conformément au brief.
4. **Légende interne** — **présente et formelle** (« → appel synchrone ⇢ réponse - -×- - refus,
   marqué d'une croix ○ état de la session »). C'est la meilleure du corpus pour les flèches.
   À conserver telle quelle dans sa forme, en remplaçant les aspects.
5. **Séparation des plans** — le bandeau `refus` en bas de figure sépare le nominal de
   l'exceptionnel : dispositif excellent, à généraliser. Manque la séparation navigateur /
   serveur, qui est pourtant la frontière de sécurité de la figure.
6. **Croisements** — **2**, entre le message (2) « relais » et l'activation du tableau de bord,
   et là où le pavé « limitation de débit à deux niveaux » (6 lignes) **recouvre la ligne de vie
   du tableau de bord**. Le second est un défaut de superposition, pas un croisement d'arcs, et
   il masque la ligne de vie sur 2,5 cm.
7. **Lisibilité** — 8 occurrences de `\scriptsize`, aucune de `\footnotesize`. Le panneau
   « états de la session du navigateur » à droite est **une table de cinq lignes dessinée en
   nœuds** : contenu tabulaire dans une figure.
8. **Gain de place** — retrait du pavé « Ce que la figure démontre » : **−1,71 cm mesuré**.
   Sortie du pavé « limitation de débit » (qui est du texte de section, pas une annotation) :
   ~−1,4 cm et la ligne de vie redevient visible. Sortie du panneau des cinq états vers un
   tableau : ~−2 cm de plus.
   Total ~13 cm au lieu de 18 : de 77,7 % à 57 % d'une page. **Gain ≈ 0,21 page.**
9. **Verdict — à refaire.**

---

### 2.20 `fig:graphe-taches-livraison`

1. **Identité** — `ch5_realisation.tex:150-225`, 76 lignes. « Graphe des tâches de la chaîne de
   livraison applicative. » Chapitre 5. **14,96 × 10,65 cm — 47,9 % d'une page.**
2. **Ce qu'elle démontre** — que la construction n'est jamais atteinte si une porte échoue, et
   que la vérification de bout en bout est postérieure au déploiement, donc n'est pas une porte.
   Une phrase : conforme.
3. **Sémantique des flèches** — un seul style, `a` (plein 0,7 pt, 5 emplois) = dépendance
   bloquante. Sens stable. **À changer** : `a` → `\fluxdonnee`. La transition vers l'étape non
   bloquante (« vérification de bout en bout », cadre en tirets) devrait être `\fluxevenement` —
   aujourd'hui c'est la même flèche pleine que les dépendances bloquantes, ce qui contredit
   exactement le point que la figure veut faire.
4. **Légende interne** — **présente et formelle** (« Notation : flèche pleine = dépendance
   bloquante ; cadre épais, fond grisé et mention écrite = étape bloquante ; cadre en tirets,
   hors bandeau = étape non bloquante »). Bonne. À compléter du style non bloquant une fois le
   point 3 appliqué.
5. **Séparation des plans** — deux bandes de fond grisées, « chemin de l'API » et « chemin du
   tableau de bord ». **Conforme, exemplaire** — c'est le seul emploi propre de bandes du
   chapitre 5.
6. **Croisements** — 0.
7. **Lisibilité** — `\scriptsize` seul (4 occurrences). Aucun libellé illisible ; la figure est
   aérée.
8. **Gain de place** — 10,65 cm pour six nœuds : **c'est la figure la moins dense du mémoire**.
   Les bandes contiennent 4 à 5 cm de blanc à droite. **Fusion recommandée** — voir 2.21.
9. **Verdict — à fusionner** avec `fig:sequence-livraison`.

---

### 2.21 `fig:sequence-livraison`

1. **Identité** — `ch5_realisation.tex:235-268`, 34 lignes. « Chaîne de livraison applicative :
   huit étapes et trois portes bloquantes ». Chapitre 5.
   **15,60 × 5,35 cm — 26,5 % d'une page.**
2. **Ce qu'elle démontre** — la même chose que `fig:graphe-taches-livraison`, dix pages plus
   haut dans le même chapitre : que trois étapes sont bloquantes. Elle ajoute les huit étapes
   nommées et les outils. Elle n'ajoute **aucune proposition nouvelle**.
3. **Sémantique des flèches** — deux styles :
   `fl` (plein `thick`, 1 emploi) = enchaînement ;
   `fstop` (**tirets** `thick`, 3 emplois) = arrêt de la chaîne.
   **À changer** : `fstop` désigne un refus, pas un flux asynchrone → `\fluxrefuse`. `fl` →
   `\fluxdonnee`. Remarque : sept des huit transitions sont dessinées **sans style nommé** (les
   nœuds se touchent), ce qui rend l'enchaînement implicite.
4. **Légende interne** — **absente** ; une note en italique de trois lignes en bas explique les
   cadres, pas les traits. Défaut.
5. **Séparation des plans** — aucune. Sans grand enjeu ici.
6. **Croisements** — 0.
7. **Lisibilité** — `\scriptsize` seul (3 occurrences), huit nœuds de 1,68 cm de large sur
   15,6 cm : les libellés sont coupés sur trois lignes (« Publication / au registre »,
   « Analyse de / vulnérabilité »). Les noms de produits (`Gitleaks`, `Semgrep`, `Docker`,
   `Trivy`, `Artifact Registry`, `Cloud Run`, `BigQuery`) sont en `\scriptsize` gris clair
   sous les libellés : au bord de l'illisible.
   **La figure contient un `\cref` vers une section** (rendu `??` en compilation isolée, résolu
   dans le document complet) : c'est fragile et cela rend la figure non portable. Même remarque
   pour `fig:pipeline-detection`. Ces renvois appartiennent à la légende ou au texte.
8. **Gain de place** — **Fusion `fig:graphe-taches-livraison` + `fig:sequence-livraison` :
   47,9 % + 26,5 % = 74,4 % d'une page pour une seule proposition.**
   Figure fusionnée proposée : la chaîne linéaire des huit étapes (celle-ci), avec les trois
   portes en cadre épais et fond grisé, les deux bandes « chemin de l'API » / « chemin du
   tableau de bord » de l'autre, et la « vérification de bout en bout » posée après le
   déploiement en cadre tireté. Hauteur estimée 7,2 cm, soit **33 % d'une page.
   Gain ≈ 0,41 page**, et la démonstration est plus forte, parce que l'ordre et le blocage se
   lisent enfin dans le même dessin.
9. **Verdict — à fusionner** (figure porteuse : celle-ci, enrichie des bandes de l'autre).

---

### 2.22 `fig:boucle-f6`

1. **Identité** — `ch5_realisation.tex:417-444`, 28 lignes. « Boucle F6 : rapprochement des
   vulnérabilités livrées et des techniques observées ». Chapitre 5.
   **15,87 × 5,18 cm — 25,8 % d'une page.**
2. **Ce qu'elle démontre** — **rien.** Cinq nœuds, cinq flèches, un enchaînement linéaire
   trivial (analyse → encodage → table → rapprochement → ordre de correction). La note de trois
   lignes sous la figure dit l'essentiel — « F6 ne couvre aucune exigence de sécurité : il
   produit un ordre de traitement, pas une réduction de risque » — et **cette phrase n'est pas
   soutenue par le dessin** : rien dans la figure ne montre l'absence de couverture. La légende
   est un titre de contenu.
3. **Sémantique des flèches** — un seul style, `fl` (plein `thick`, 5 emplois).
4. **Légende interne** — non requise.
5. **Séparation des plans** — aucune, sans enjeu.
6. **Croisements** — 0.
7. **Lisibilité** — correcte, `\footnotesize` dans les nœuds.
8. **Gain de place** — **0,26 page.**
9. **Verdict — À RETIRER.** C'est la seule figure du corpus dont je ne peux écrire ce qu'elle
   démontre, et c'est le critère de retrait que le brief pose. Les cinq nœuds tiennent dans une
   phrase du texte courant : *« F6 rapproche la table des vulnérabilités livrées et les
   détections R1–R7 par technique ATT&CK, et en tire un ordre de correction ; il ne couvre aucune
   exigence de sécurité, et son utilité reste non validée tant que l'ordre produit n'est pas
   comparé à l'ordre par gravité seule. »* Le chapitre 5 doit perdre 9 pages ; c'est la coupe la
   moins coûteuse du mémoire.

---

### 2.23 `fig:chaine-infrastructure`

1. **Identité** — `ch5_realisation.tex:487-556`, 70 lignes. « Chaîne de provisionnement de
   l'infrastructure. » Chapitre 5. **15,30 × 9,24 cm — 42,2 % d'une page.**
2. **Ce qu'elle démontre** — que la frontière entre automatique et manuel est un **choix de
   privilège** et non un degré d'achèvement. Une phrase : conforme, et c'est exactement le
   registre que le brief demande (Q2 : contrainte + contrôle compensatoire).
3. **Sémantique des flèches** — deux styles :
   `a` (plein `black!70`, 6 emplois) = étape suivante ;
   `ar` (**pointillés** `black!55`, 1 emploi) = rétroaction (détection de dérive → dépôt).
   **À changer** : `ar` est une boucle de retour asynchrone → `\fluxevenement` (tirets).
   `a` → `\fluxdonnee`. La porte de revue (losange 5) mérite `\fluxcontrole` sur ses sorties :
   c'est une décision.
4. **Légende interne** — **absente**. Deux styles + un séparateur épais + un losange : légende
   requise.
5. **Séparation des plans** — **le trait vertical épais « automatique | manuel » est le meilleur
   séparateur du chapitre 5** : une seule ligne, un sens immédiat. À conserver et à généraliser
   comme idiome (`\frontiereplan` dans la convention).
6. **Croisements** — **1** : la rétroaction en pointillés part du haut à droite, longe le bord
   supérieur et **traverse le séparateur automatique/manuel**. Ce croisement est **volontaire et
   signifiant** (la dérive détectée côté manuel réalimente le dépôt côté automatique) : à
   conserver, mais à marquer d'un saut de trait pour qu'il se lise comme un franchissement.
7. **Lisibilité** — deux étiquettes **tournées à 90°** (« automatique », « manuel — identifiants
   de l'administrateur ») : elles portent le sens principal de la figure et sont illisibles au
   feuilletage. À passer horizontales au-dessus du séparateur.
   Six occurrences de `\scriptsize`, aucune de `\footnotesize`.
8. **Gain de place** — retrait du pavé « Ce que la figure démontre » : **−0,71 cm mesuré**. Le
   pavé « Sur toute la partie gauche » n'est pas un doublon (il porte la propriété d'absence de
   permission d'émission de jeton) : à conserver, mais dans le texte. Total ~7,0 cm.
   **Gain ≈ 0,10 page.**
9. **Verdict — à retoucher.**

---

### 2.24 `fig:pipeline-detection`

1. **Identité** — `ch5_realisation.tex:755-795`, 41 lignes. « Chaîne de détection et
   d'enrichissement : deux cycles indépendants ». Chapitre 5.
   **15,98 × 6,89 cm — 32,7 % d'une page.**
   **Remarque de nomenclature** : le label est `fig:pipeline-detection` alors que « pipeline »
   figure au registre des termes interdits du brief. Le label n'est pas imprimé, mais la
   cohérence de la source vaut d'être signalée : `fig:chaine-detection`.
2. **Ce qu'elle démontre** — que les deux cycles sont indépendants et que le score se calcule
   sur les seules détections. **C'est la proposition de `fig:cycle-donnee` (ch4), reprise avec
   les mêmes étapes, le même `⨯` de jointure non réalisée et les mêmes cadences de 15 min.**
3. **Sémantique des flèches** — un seul style, `fl` (plein `thick`, 8 emplois). Le `⨯` de
   jointure non réalisée est dessiné à la main.
4. **Légende interne** — non requise pour un style ; le `⨯` doit toutefois être déclaré
   (`\fluxrefuse` ou notation « arc absent »).
5. **Séparation des plans** — deux rangées = deux cycles, sans bande. Deux bandes les
   sépareraient franchement.
6. **Croisements** — 0.
7. **Lisibilité** — `\footnotesize` dans les nœuds : conforme. Noms de produits en `\scriptsize`
   gris : acceptable (annotation secondaire).
   Contient un `\cref` de section, même remarque qu'en 2.21.
8. **Gain de place** — **0,33 page si retirée.**
9. **Verdict — À RETIRER, ou à réduire à sa seule différence.** Ce que cette figure ajoute à
   `fig:cycle-donnee` tient en deux faits : les noms de produits de chaque étape, et le fait que
   la recherche vectorielle produit trois candidats. Les deux appartiennent au tableau des
   composants du chapitre 5. **Recommandation** : retirer la figure, remplacer par un renvoi
   `\cref{fig:cycle-donnee}` et deux lignes ajoutées au tableau des composants. Si l'équipe
   chapitre 5 refuse le retrait, la solution de repli est de ne garder que la **rangée basse**
   (le cycle d'enrichissement), la rangée haute étant intégralement dans `fig:cycle-donnee` :
   gain 0,15 page.

---

### 2.25 `fig:composants-logiciel`

1. **Identité** — `ch5_realisation.tex:901-958`, 58 lignes. « Architecture interne des deux
   logiciels écrits : composants, frontières de déploiement et points d'application du contrôle
   d'accès ». Chapitre 5. **15,91 × 9,98 cm — 45,2 % d'une page.**
2. **Ce qu'elle démontre** — que le rôle est vérifié sur les treize points d'entrée de données
   de l'API et jamais dans le tableau de bord, qui ne détient aucune autorisation propre. Une
   phrase : conforme. Le titre est un titre de contenu, à réécrire.
3. **Sémantique des flèches** — deux styles :
   `sync` (plein `thick`, 12 emplois) = appel synchrone ;
   `best` (**pointillés** `thick`, 1 emploi) = écriture au mieux, hors chemin de réponse.
   **À changer** : `best` est un flux asynchrone non bloquant → `\fluxevenement` (tirets).
   `sync` → `\fluxdonnee`. **Manque** : le point d'application du contrôle d'accès, qui est le
   sujet, n'est marqué que par un fond grisé ; l'entrée dans le composant « Authentification »
   devrait être `\fluxcontrole`.
4. **Légende interne** — **présente mais en prose**, quatre lignes : « Trait plein : appel
   synchrone. Pointillés : écriture au mieux, hors chemin de réponse — son échec est absorbé et
   ne fait jamais échouer la requête de l'analyste. Tirets : frontière de déploiement, un
   conteneur par cadre. Fond grisé : composant portant un contrôle de sécurité… ». À
   transformer en clé graphique de deux lignes.
5. **Séparation des plans** — **deux cadres `fit` sur calque `backgrounds`** : avec
   `fig:archi-avant`, c'est l'un des deux seuls emplois corrects de la bibliothèque
   `backgrounds` du mémoire. **Conforme.** Manque la troisième zone (les trois dépôts de droite :
   coffre, entrepôt, base) qui est le plan de données.
6. **Croisements** — **1** : les liens « identifiants » et « jeton porteur » se croisent dans le
   couloir entre les deux cadres. À régler en inversant les deux points d'ancrage.
7. **Lisibilité** — `\footnotesize` dans les nœuds : conforme. L'étiquette « audit » sur le
   trait pointillé de droite est **tournée à 90°** en `\scriptsize`. Les compteurs de points
   d'entrée (`9 points d'entrée`, `4 points d'entrée`) sont en `\gcprod`, c'est-à-dire
   `\scriptsize` `black!55` : ils portent la démonstration (9 + 4 = 13) et sont donc **sous le
   plancher alors qu'ils sont porteurs**.
8. **Gain de place** — figure bien dimensionnée. Sortie de la légende en prose : −1,5 cm,
   **gain 0,06 page**.
9. **Verdict — à retoucher.**
   **ERREUR FACTUELLE À CORRIGER — la correction F7 du brief n'a pas été propagée dans cette
   figure.** Le tableau de caractérisation du chapitre 5 (`ch5_realisation.tex:1200`) porte bien
   la valeur corrigée — « douze vues, dont dix rendues au serveur et deux clientes, et sept
   routes serveur » — mais le nœud de la figure (`ch5_realisation.tex:915`) dit toujours
   **« 11 pages rendues au serveur »**. Le mémoire se contredit à 285 lignes d'intervalle.
   Le libellé du nœud doit devenir « 10 vues rendues au serveur, 2 clientes ».

---

### 2.26 `fig:chaine-donnees-vue`

1. **Identité** — `ch5_realisation.tex:969-1019`, 51 lignes. « Chaîne de données d'une vue du
   tableau de bord. » Chapitre 5. **15,65 × 9,24 cm — 42,2 % d'une page.**
2. **Ce qu'elle démontre** — que le jeton reste côté serveur et que l'autorité d'autorisation
   est l'API, jamais l'interface. Une phrase : conforme.
3. **Sémantique des flèches** — un seul style, `a` (plein 0,7 pt, 4 emplois) = saut. Sens
   stable. **À changer** : renommage `\fluxdonnee`. Le saut 3 → 4 est une **seconde traversée du
   bord**, c'est-à-dire un point de contrôle : le passer en `\fluxcontrole` rendrait la
   propriété visible.
4. **Légende interne** — non requise (un style). La verticale en tirets « le jeton ne franchit
   jamais cette frontière » porte le sens et est bien faite.
5. **Séparation des plans** — la verticale en tirets sépare navigateur et serveur : conforme
   pour cette figure.
6. **Croisements** — 0.
7. **Lisibilité** — `\scriptsize` seul (4 occurrences). L'étiquette de la frontière est
   **tournée à 90°** mais en gras : c'est le seul cas où la rotation est acceptable (elle longe
   une verticale et se lit naturellement).
8. **Gain de place** — la disposition **en escalier** (cinq nœuds décalés en diagonale) laisse
   deux triangles de blanc représentant environ 40 % de la surface. Une disposition **linéaire
   horizontale** avec la frontière verticale conservée après le nœud 1 donne la même
   démonstration en ~4,5 cm au lieu de 9,24. **Gain ≈ 0,21 page.**
   Le pavé « Ce que la figure démontre » ne coûte pas de hauteur ici (posé en haut à droite,
   dans un des triangles de blanc) mais duplique la légende du flottant : à retirer quand même.
9. **Verdict — à retoucher** (passage en disposition linéaire).

---

### 2.27 `fig:accueil-locataire`

1. **Identité** — `ch5_realisation.tex:1278-1364`, 87 lignes. « Accueil d'un locataire : six
   étapes, et les cinq gestes qui restent hors du code. » Chapitre 5.
   **14,36 × 11,63 cm — 51,9 % d'une page.**
2. **Ce qu'elle démontre** — que l'accueil est reproductible sur le plan de l'identité et du
   déploiement, et qu'il conserve cinq gestes non descriptibles en code. Une phrase : conforme,
   et c'est **la mesure exacte de la maturité multi-locataire** — l'une des figures les plus
   honnêtes du mémoire.
3. **Sémantique des flèches** — deux styles :
   `a` (plein `black!70`, 8 emplois) = étape suivante ;
   `al` (**pointillés** `black!55`, pointe 1,4 mm — **la plus petite du mémoire**, 5 emplois)
   = rattachement d'un geste hors code à l'étape correspondante.
   **À changer** : `al` n'est ni un flux ni une décision, c'est une **relation d'annotation** →
   `\lienstructure` (trait fin sans pointe) plutôt qu'une flèche. `a` → `\fluxdonnee`.
4. **Légende interne** — **présente mais partielle** : la « Notation » explique les cadres en
   tirets et la mention « hors code », **pas les traits en pointillés**. Défaut.
5. **Séparation des plans** — deux colonnes « dans le code » / « hors du code » séparées par une
   **verticale épaisse**, comme dans `fig:chaine-infrastructure`. Cohérent entre les deux figures
   du même chapitre : **bon point, à consacrer en idiome** (`\frontiereplan`).
6. **Croisements** — 0.
7. **Lisibilité** — `\scriptsize` seul (5 occurrences). La sous-bande « 4. application par ordre »
   est en italique gris clair sur le cadre : au bord de l'illisible.
8. **Gain de place** — le pavé « Ce que la figure démontre » ne coûte pas de hauteur (posé à
   côté de la Notation), mais duplique la légende. La sous-bande de l'étape 4 (nœuds `4a`,
   `porte`, `4b`) occupe 2,7 cm pour trois nœuds dont deux sont muets (« 4a », « 4b ») :
   les nommer et les mettre en ligne gagne ~1,3 cm. **Gain ≈ 0,06 page.**
9. **Verdict — à retoucher.**

---

### 2.28 `fig:gantt`

1. **Identité** — `ch5_realisation.tex:1615-1704`, 90 lignes. « Planning consolidé du stage, du
   \datedebutstage au \datefinstage. » Chapitre 5. **15,82 × 7,94 cm — 37,0 % d'une page.**
2. **Ce qu'elle démontre** — que les huit phases PH0–PH7 se recouvrent largement et que les
   jalons M1–M7 se concentrent sur les six dernières semaines. Une phrase : conforme, et la
   légende dit honnêtement que les barres sont une reconstruction macroscopique.
3. **Sémantique des flèches** — aucune. Sans objet.
4. **Légende interne** — présente (barre / losange = jalon). Conforme.
5. **Séparation des plans** — sans objet.
6. **Croisements** — les **sept verticales en tirets** des jalons traversent **toutes les
   barres** de haut en bas. Ce sont des repères, pas des arcs, mais visuellement ce sont sept
   traits qui coupent huit barres, soit une trame parasite. **Réacheminement** : ne tracer chaque
   verticale que du haut du tableau jusqu'à la barre concernée, pas au-delà.
7. **Lisibilité** — **deux débordements de libellé mesurables** : l'étiquette « 03/03 – 27/03 »
   de PH0 sort de sa barre et chevauche le filet de colonne mars/avril ; « 18/08 – 07/09 » de
   PH7 déborde de même. Correctif : placer l'étiquette **à droite de la barre** quand la barre
   est plus courte que son texte.
   **Palette** : la figure emploie `black!6`, `black!12`, `black!18`, `black!24`, `black!30`,
   `black!35`, `black!65`, `black!70`, `black!5` — **neuf teintes de gris**, contre les cinq que
   le brief §5 autorise pour tout le mémoire. Le dégradé ne code rien (il suit simplement
   l'ordre des phases). **À ramener à trois teintes**, correspondant aux trois familles de
   phases (cadrage / construction / validation), ce qui donnerait au dégradé un sens.
   Onze occurrences de `\scriptsize` : les noms de phases sont sous le plancher.
8. **Gain de place** — figure correctement dimensionnée. Aucun gain notable.
9. **Verdict — à retoucher** (palette et débordements d'étiquette).

---

### 2.29 `graph:coldstart`

1. **Identité** — `ch6_validation.tex:495-519`, 25 lignes, **environnement `figure`**, label
   `graph:coldstart`. « Démarrage à froid du service d'encodage : moyenne et pic mesurés début
   août 2026, comparés au budget de la sonde de disponibilité. » Chapitre 6.
   **6,98 × 5,14 cm — 43,7 % de la largeur, 25,7 % d'une page.**
2. **Ce qu'elle démontre** — que le pic mesuré (94 s) reste sous le budget porté à 150 s. Une
   phrase : conforme.
3. **Sémantique des flèches** — aucune. La ligne de budget est en `dashed, very thick` : c'est
   un **seuil**, pas un flux. À déclarer `\seuil` dans la convention pour ne pas le confondre
   avec `\fluxevenement`.
4. **Légende interne** — l'étiquette « budget de la sonde porté à 150 s (07/08/2026) » est
   posée sur la ligne de seuil : c'est une légende suffisante pour deux barres. Conforme.
5. **Séparation des plans** — sans objet.
6. **Croisements** — 0.
7. **Lisibilité** — `\scriptsize` sur les libellés d'axe et de barre. Deux remplissages
   `black!12` / `black!45` bien séparés en gris.
8. **Gain de place — c'est le cas inverse des autres : la figure est trop petite.** 6,98 cm de
   large sur un bloc de 16 cm, deux barres seulement, et un flottant qui occupe malgré tout un
   quart de page. **Deux valeurs et un seuil ne justifient pas une figure** : le brief §4 le dit
   pour les captures, la règle vaut ici. Un tableau de trois lignes (moyenne 27 s, pic p99 94 s,
   budget 150 s, avec les dates de relevé) est **citable, comparable, et tient en trois lignes**.
   **Gain 0,20 page** et la mesure devient réutilisable dans le registre T.
9. **Verdict — à retirer, remplacée par un tableau de trois lignes.** La donnée est conservée
   intégralement ; c'est un changement de support, pas une coupe.

---

### 2.30 `fig:scenario-19-08`

1. **Identité** — `ch6_validation.tex:653-685`, 33 lignes. « Scénario de bout en bout du
   19/08/2026 : de l'attaque à l'alerte qualifiée ». Chapitre 6.
   **15,73 × 5,40 cm — 26,7 % d'une page.**
2. **Ce qu'elle démontre** — que la chaîne complète a fonctionné le 19/08/2026 avec ≈ 15 min
   entre l'attaque et l'alerte, **et que l'étiquetage produit (TA0040 / T1498) est discutable**.
   Cette seconde partie, portée par la note de bas de figure, est la plus intéressante : c'est
   une non-conformité publiée, conformément au brief. Une phrase : conforme.
3. **Sémantique des flèches** — aucun style nommé ; une flèche d'axe du temps.
4. **Légende interne** — non requise.
5. **Séparation des plans** — sans objet.
6. **Croisements** — 0.
7. **Lisibilité** — `\footnotesize` dans les jalons : **conforme**. Les horodatages masqués
   (`16:41:xx`, `16:41:5x`) sont cohérents avec `fig:seq-refus`, qui donne `16 h 41 UTC` et
   `16 h 56 min 08 s UTC` : pas de contradiction.
8. **Gain de place** — **doublon de forme avec `fig:chronologie-incident`** : même gabarit
   (boîtes au-dessus d'un axe horizontal, repères datés en dessous, note d'échelle non linéaire
   en bas). L'une est le modèle (ch4), l'autre l'instance mesurée (ch6). **Ce n'est pas une
   redondance de contenu** — le modèle et sa mesure sont deux choses — et je ne recommande pas
   la fusion, qui casserait la séparation conception/validation.
   Recommandation : **harmoniser les deux gabarits au trait près** (mêmes hauteurs de boîte,
   même style d'axe, même corps), de sorte que le lecteur du chapitre 6 reconnaisse le schéma du
   chapitre 4 et lise la mesure comme le remplissage du modèle. C'est un gain de démonstration à
   coût nul.
9. **Verdict — conforme, à harmoniser.**

---

## 3. Livrable transverse A — la convention unique du mémoire

**Code compilé et vérifié.** Le fichier `convention.tex` du répertoire de travail a été chargé
derrière le préambule réel du mémoire et exercé par une planche d'essai employant les sept
aspects de trait, les sept formes de nœud, les trois bandes de plan et les deux macros de
légende. Résultat :

```
xelatex testconv.tex (2 passes)
erreurs (^!) = 0        undefined = 0        Output written on testconv.pdf (2 pages)
```

Contrôle supplémentaire : rendu **en niveaux de gris** (`pdftoppm -gray`) pour vérifier la
lisibilité à l'impression, et emploi des macros de légende **dans une légende de flottant**,
donc recopiées dans le fichier `.lof` — 0 erreur, 0 référence indéfinie.

### 3.1 Ce que l'essai a fait changer

Deux décisions viennent de l'essai, pas de l'intention :

- **Un huitième style, `fluxexterne` (trait plein, pointe creuse, encre pleine), a été écarté
  après essai** : en niveaux de gris il est indistinguable de `fluxdonnee`, la pointe creuse ne
  se lisant plus à 1,7 mm. **L'extériorité d'un système est portée par la forme du nœud
  (`nexterne`, bordure en tirets), pas par le trait.** Il reste donc **sept** aspects de trait.
- Les trois gris de bande ont été écartés de 0,970 / 0,900 / 0,830 (au lieu de 0,965 / 0,915 /
  0,865) parce que les deux premiers se confondaient sur le rendu en gris.

### 3.2 Palette — cinq teintes, une signification chacune

| Nom | Valeur | Signification | En gris |
|---|---|---|---|
| `menalencre` | `gray 0.15` | trait ou libellé **porteur** | noir |
| `menaltrait` | `gray 0.45` | trait ou libellé **secondaire** | gris moyen |
| `menalplanA` | `gray 0.970` | bande — **plan de données** | très clair |
| `menalplanB` | `gray 0.900` | bande — **plan de contrôle** | clair |
| `menalplanC` | `gray 0.830` | bande — **plan d'observation** | moyen clair |
| `menalrefus` | `rgb .55 .10 .10` | **refus, blocage, faiblesse** — accent unique | gris foncé |

`menalrefus` est la **seule** couleur du mémoire. Elle ne porte jamais seule un sens : un refus
est toujours **aussi** un trait de 1,4 pt **et** une croix. `fig:archi-avant` est aujourd'hui
la seule figure colorée ; son bleu disparaît, son rouge devient `menalrefus`, ce qui la met en
cohérence avec le reste sans rien lui retirer.

### 3.3 Les sept aspects de trait

| Style | Aspect | Signification | Conformité brief §2.1 |
|---|---|---|---|
| `fluxdonnee` | plein, pointe pleine 1,7 mm, 0,6 pt | appel synchrone, requête | ✔ ligne 1 |
| `fluxreponse` | plein, **pointe creuse**, gris moyen | réponse à un appel synchrone | ✔ variante de la ligne 1 |
| `fluxevenement` | **tirets serrés**, pointe pleine | flux asynchrone, journal, événement | ✔ ligne 2 |
| `fluxcontrole` | **pointillés serrés**, pointe pleine | décision de politique, autorisation | ✔ ligne 3 |
| `fluxrefuse` | **plein 1,4 pt, barré d'une croix** | refus, blocage | ✔ ligne 4 |
| `lienstructure` | plein 0,5 pt, **sans pointe**, gris moyen | rattachement, annotation — jamais un flux | complément nécessaire |
| `fluxsynthese` | plein 1,6 pt, pointe 2,4 mm | la conclusion de la figure — **une seule par figure** | complément nécessaire |

Deux aspects hors flux complètent la convention : `seuil` (tirets larges, sans pointe) pour un
budget mesuré dans un graphique, et `frontiereplan` (plein 1,6 pt) pour la séparation de deux
régimes — l'idiome déjà employé par `fig:chaine-infrastructure` et `fig:accueil-locataire`.

### 3.4 Formes de nœud — une forme, une nature

| Style | Forme | Nature |
|---|---|---|
| `nsysteme` | rectangle arrondi, filet 0,6 pt, fond blanc | composant du socle |
| `nexterne` | idem, **bordure en tirets** | système extérieur au socle |
| `nstock` | rectangle, **double filet** | magasin de données |
| `nacteur` | rectangle très arrondi, fond `menalplanA` | acteur humain ou système |
| `nporte` | **losange**, filet 1,1 pt | porte bloquante |
| `ncontrole` | rectangle arrondi, **filet 1,2 pt** | composant portant un contrôle de sécurité |
| `nabsent` | tirets, gris moyen | élément absent, écarté, non descriptible en code |

### 3.5 Typographie

- `font=\footnotesize` déclaré **une fois** dans les options du `tikzpicture` ; tous les nœuds
  en héritent. Aucun `\scriptsize` sur un libellé porteur.
- `\scriptsize` réservé aux annotations secondaires — noms de produits, compteurs de lignes de
  code — par la macro `\gcprod`, qu'il faut **déplacer de `ch5_realisation.tex:12` vers
  `config/commands.tex`** puisqu'elle sera employée par plusieurs chapitres.
- Libellés en **groupes nominaux**. Aucune phrase, aucun verbe conjugué dans un nœud.
- **Aucune étiquette tournée à 90°** sauf le long d'une verticale qu'elle nomme. Sept figures
  en emploient aujourd'hui : `fig:elson-fonctionnel`, `fig:modele-couches`,
  `fig:delegation-identite` (×2), `fig:chaine-infrastructure` (×2), `fig:composants-logiciel`,
  `fig:chaine-donnees-vue` (le seul cas acceptable), `graph:audit-41` et `graph:coldstart`
  (titres d'axe, acceptables).
- Toute étiquette posée sur un trait porte `etiq` (fond blanc, `\footnotesize`) ou `etiqsec`
  (fond blanc, `\scriptsize`). **Fond blanc obligatoire** : c'est le correctif des étiquettes
  coupées de `fig:archi-avant`, `fig:dfd-frontieres` et `fig:deploiement`.

### 3.6 Règles d'emploi — les cinq invariants

1. **Dès deux aspects de trait dans une figure, une légende interne `legendecadre`.** Pas dans
   la légende du flottant : dans la figure.
2. **Un refus se dessine.** Toute figure qui énonce une interdiction porte au moins un
   `fluxrefuse` avec sa `croixrefus`.
3. **Les plans se voient.** Toute vue d'architecture pose ses bandes `bandedonnee`,
   `bandecontrole`, `bandeobservation` sur le calque `backgrounds` avec `fit`.
4. **Aucun croisement sans nécessité.** Un franchissement de frontière est une nécessité ; un
   croisement dû à l'ordre des nœuds n'en est pas une. Si le croisement est inévitable, l'un
   des deux traits passe en arc (`to[out=…,in=…]`).
5. **Aucune prose dans une figure.** Ce qui se rédige va dans la légende du flottant ou dans le
   paragraphe d'appel. Ce qui se tabule va dans un `tabular`.

### 3.7 Le code, testé, à insérer dans `latex/config/commands.tex`

À placer après le bloc des pictogrammes de couverture (`commands.tex:181`) et avant l'encadré
« Résultat mesuré ». **Aucune bibliothèque TikZ nouvelle, aucun paquet nouveau** : tout repose
sur `arrows.meta`, `shapes.geometric`, `fit`, `backgrounds`, déjà chargés par
`config/packages.tex:29`, et sur `path picture`, qui est du TikZ de base.

```latex
% =============================================================
% CONVENTION GRAPHIQUE UNIQUE DU MÉMOIRE
% Bibliothèques requises : arrows.meta, positioning, shapes.geometric,
% calc, fit, backgrounds — toutes déjà chargées par config/packages.tex.
% =============================================================

% --- 1. PALETTE : cinq teintes, une signification chacune -----------------
\definecolor{menalencre}{gray}{0.15}   % traits et libellés porteurs
\definecolor{menaltrait}{gray}{0.45}   % traits secondaires, annotations
\definecolor{menalplanA}{gray}{0.970}  % bande — plan de données
\definecolor{menalplanB}{gray}{0.900}  % bande — plan de contrôle
\definecolor{menalplanC}{gray}{0.830}  % bande — plan d'observation
\definecolor{menalrefus}{rgb}{0.55,0.10,0.10} % refus / faiblesse (accent unique)

% --- 2. STYLES DE TRAIT ---------------------------------------------------
\tikzset{
  fluxdonnee/.style   = {-{Latex[length=1.7mm]}, line width=0.6pt,
                         draw=menalencre},
  fluxreponse/.style  = {-{Latex[length=1.7mm,open]}, line width=0.6pt,
                         draw=menaltrait},
  fluxevenement/.style= {-{Latex[length=1.7mm]}, line width=0.6pt,
                         draw=menalencre, densely dashed},
  fluxcontrole/.style = {-{Latex[length=1.7mm]}, line width=0.6pt,
                         draw=menalencre, densely dotted},
  fluxrefuse/.style   = {-{Latex[length=1.9mm]}, line width=1.4pt,
                         draw=menalrefus, line cap=round},
  lienstructure/.style= {line width=0.5pt, draw=menaltrait},
  % Pas de style « dépendance externe » : essayé, puis écarté — un trait plein
  % à pointe creuse est indistinguable de fluxdonnee en niveaux de gris.
  % L'extériorité est portée par la forme du nœud (nexterne).
  fluxsynthese/.style = {-{Latex[length=2.4mm,width=1.8mm]}, line width=1.6pt,
                         draw=menalencre, line join=round},
  seuil/.style        = {line width=1.0pt, draw=menalencre, dashed},
  frontiereplan/.style= {line width=1.6pt, draw=menalencre},
  % Croix de refus : \draw[fluxrefuse] (a) -- node[croixrefus]{} (b);
  % Le fond blanc masque le trait sous la croix.
  croixrefus/.style   = {pos=0.5, inner sep=0pt, minimum size=2.4mm,
                         draw=none, fill=white,
                         path picture={%
                           \draw[line width=1.1pt, menalrefus, line cap=round]
                             (path picture bounding box.south west)
                               -- (path picture bounding box.north east)
                             (path picture bounding box.north west)
                               -- (path picture bounding box.south east);}},
  etiq/.style         = {midway, fill=white, inner sep=1.2pt,
                         font=\footnotesize, text=menalencre},
  etiqsec/.style      = {midway, fill=white, inner sep=1.2pt,
                         font=\scriptsize, text=menaltrait},
}

% --- 3. FORMES DE NŒUD ----------------------------------------------------
\tikzset{
  nsysteme/.style  = {draw=menalencre, line width=0.6pt, rounded corners=2pt,
                      fill=white, align=center, font=\footnotesize,
                      inner sep=3.5pt, minimum height=0.80cm},
  nexterne/.style  = {nsysteme, densely dashed},
  nstock/.style    = {nsysteme, double, double distance=0.8pt,
                      rounded corners=0pt},
  nacteur/.style   = {nsysteme, rounded corners=6pt, fill=menalplanA},
  nporte/.style    = {draw=menalencre, line width=1.1pt, diamond,
                      aspect=2.2, fill=menalplanB, align=center,
                      font=\footnotesize, inner sep=2pt},
  ncontrole/.style = {nsysteme, line width=1.2pt},
  nabsent/.style   = {nsysteme, densely dashed, draw=menaltrait,
                      text=menaltrait},
  bandedonnee/.style      = {fill=menalplanA, rounded corners=3pt,
                             inner sep=5pt, draw=none},
  bandecontrole/.style    = {fill=menalplanB, rounded corners=3pt,
                             inner sep=5pt, draw=none},
  bandeobservation/.style = {fill=menalplanC, rounded corners=3pt,
                             inner sep=5pt, draw=none},
  titrebande/.style= {font=\footnotesize\itshape, text=menalencre,
                      inner sep=2pt},
}

% --- 4. LÉGENDE INTERNE : obligatoire dès deux aspects de trait -----------
% Déclarées ROBUSTES, pour la même raison que les pictogrammes de couverture :
% une commande TikZ fragile casse dès qu'elle remonte dans une légende ou
% dans la liste des figures. Essai fait : légende + .lof, 0 erreur.
\DeclareRobustCommand{\legendetrait}[2]{%
  \tikz[baseline=-0.55ex]{\draw[#1] (0,0) -- (0.7,0);}~{\footnotesize #2}%
}
\DeclareRobustCommand{\legendecroix}[1]{%
  \tikz[baseline=-0.55ex]{\draw[fluxrefuse] (0,0) -- node[croixrefus]{} (0.7,0);}%
  ~{\footnotesize #1}%
}
\tikzset{
  legendecadre/.style = {draw=menaltrait, line width=0.4pt, rounded corners=2pt,
                         fill=white, inner sep=4pt, align=left,
                         font=\footnotesize},
}
```

### 3.8 Deux gabarits compilés, à recopier

**Gabarit A — légende interne** (obligatoire dès deux aspects) :

```latex
\node[legendecadre, anchor=north west, text width=12cm] at (x,y) {%
  \legendetrait{fluxdonnee}{appel synchrone}\quad
  \legendetrait{fluxevenement}{journal, événement}\quad
  \legendetrait{fluxcontrole}{décision de politique}\\[3pt]
  \legendecroix{refus}\quad
  \legendetrait{lienstructure}{rattachement}};
```

**Gabarit B — séparation des plans** par bandes de fond nommées :

```latex
\begin{scope}[on background layer]
  \node[bandedonnee,      fit=(a)(b)(c)] {};
  \node[bandeobservation, fit=(d)(e)]    {};
  \node[bandecontrole,    fit=(f)]       {};
\end{scope}
\node[titrebande, anchor=south west] at (-1.6, 0.55) {plan de données};
\node[titrebande, anchor=south west] at (-1.6,-1.15) {plan d'observation};
\node[titrebande, anchor=south west] at (-1.6,-2.85) {plan de contrôle};
```

**Gabarit C — refus dessiné** :

```latex
\draw[fluxrefuse] (source) -- node[croixrefus]{} (cible);
```

### 3.9 Table de migration — style actuel vers style de la convention

À appliquer mécaniquement, figure par figure. La colonne « aspect » indique quand le **dessin**
change, et pas seulement le nom.

| Figure | Style actuel | Devient | Aspect change ? |
|---|---|---|---|
| `fig:carte-memoire` | `fl` | `fluxdonnee` | non |
| `fig:organisation-menal` | `ai` | `lienstructure` | **oui** (perd sa pointe) |
| `fig:elson-fonctionnel` | `a` / `ai` | `fluxdonnee` / `fluxevenement` | **oui** (pointillés → tirets) |
| `fig:archi-avant` | `flux` / `retour` / flèche rouge | `fluxdonnee` / `fluxdonnee` bidir. / `lienstructure` | **oui** (perd le bleu) |
| `fig:dfd-frontieres` | `a` / `ab` / `ai` | `fluxdonnee` / bidir. / `fluxevenement` ; TB5 en `fluxcontrole` | **oui** |
| `fig:contexte` | `sync` / `asyn` | `fluxdonnee` / `fluxevenement` | **oui** (pointillés → tirets) |
| `fig:modele-couches` | `fleche` + rail F4 | `fluxdonnee` / `fluxevenement` ; L2 en `fluxcontrole` | **oui** |
| `fig:deploiement` | `pub` / `priv` / `jour` / `man` | `fluxdonnee` / `fluxdonnee` épais / `fluxevenement` / `fluxcontrole` | **oui — les deux derniers échangent** |
| `fig:topologie-reseau` | `a` / `ae` / `ai` ; `×` manuel | `fluxdonnee` / accent / `fluxevenement` ; `fluxrefuse` | **oui** |
| `fig:topologie-cible` | `a` / `ab` ; `⨯` manuel | `fluxdonnee` / bidir. ; `fluxrefuse` | **oui** |
| `fig:cycle-donnee` | `a` / `ad` ; `×` manuel | `fluxdonnee` / `fluxevenement` ; `fluxrefuse` | non pour les traits |
| `fig:modele-donnees` | patte-d'oie + `⨯` | patte-d'oie conservée + `fluxrefuse` | non |
| `fig:seq-refus` | `msg` / `rep` | `fluxdonnee` / `fluxreponse` ; **ajouter `fluxrefuse`** | **oui** |
| `fig:chronologie-incident` | flèche anonyme 2,2 mm | `fluxdonnee` | oui (longueur) |
| `fig:plan-identite` | `ok` / `ko` | `fluxdonnee` / `fluxrefuse` | **oui** (tirets → plein épais barré) |
| `fig:delegation-identite` | `a` / `af` / `synth` | `fluxdonnee` / `fluxcontrole` / `fluxsynthese` | **oui** |
| `fig:seq-mfa` | `msg` / `rep` / `ref` | `fluxdonnee` / `fluxreponse` / `fluxrefuse` | **oui** |
| `fig:graphe-taches-livraison` | `a` | `fluxdonnee` ; sortie non bloquante en `fluxevenement` | **oui** |
| `fig:sequence-livraison` | `fl` / `fstop` | `fluxdonnee` / `fluxrefuse` | **oui** |
| `fig:boucle-f6` | `fl` | *(figure retirée)* | — |
| `fig:chaine-infrastructure` | `a` / `ar` | `fluxdonnee` / `fluxevenement` | **oui** |
| `fig:pipeline-detection` | `fl` | *(figure retirée ou réduite)* | — |
| `fig:composants-logiciel` | `sync` / `best` | `fluxdonnee` / `fluxevenement` | **oui** |
| `fig:chaine-donnees-vue` | `a` | `fluxdonnee` ; 2ᵉ traversée en `fluxcontrole` | **oui** |
| `fig:accueil-locataire` | `a` / `al` | `fluxdonnee` / `lienstructure` | **oui** (perd sa pointe) |
| `graph:coldstart` | ligne `dashed very thick` | `seuil` | non |

---

## 4. Livrable transverse B — critères de validation de l'état final

Demande explicite de l'auteur : *les vues d'architecture doivent porter ce qu'un architecte
utilise pour prononcer la recette.* Trois contraintes se croisent — il faut le point de vue, les
critères mesurables et datés avec leur protocole, et la réserve ; il faut que ce soit court ; et
le mémoire doit maigrir de 37 pages.

### 4.1 Le choix de forme, mesuré

J'ai compilé et mesuré les deux formes possibles.

| Forme | Coût mesuré | Verdict |
|---|---|---|
| **encadré par vue** (`\recette{}{}{}{}`, quatre lignes, filets `booktabs`) | ~9 % d'une page par vue | lisible, mais chaque vue paie son encadré |
| **tableau consolidé**, une ligne par vue, quatre colonnes | **9,5 % d'une page par vue** (15,29 × 14,13 cm pour 6 vues, 0 erreur, 0 `Overfull`) | même coût, mais **un seul objet** à placer, à légender et à citer |

Les deux coûtent la même chose : c'est le contenu qui pèse, pas la forme. **Je recommande le
tableau consolidé**, pour trois raisons : il se place une fois, à la fin de la section
d'architecture du chapitre 4 ; il se lit en comparaison d'une vue à l'autre, ce qu'un encadré
isolé ne permet pas ; et il rend visible d'un coup d'œil que **toutes** les vues portent une
réserve, ce qui est l'argument de méthode.

### 4.2 Six vues, pas dix-huit

Le mémoire compte dix-huit figures qui pourraient prétendre au statut de vue d'architecture.
En doter dix-huit coûterait **1,7 page** au budget. Le critère de sélection est celui de la
recette : **une vue mérite un tableau si un tiers doit pouvoir en prononcer l'acceptation.**

Retenues (6) : contexte, couches, déploiement, topologie cible, plan d'identité, frontières de
confiance. **Coût mesuré : 0,57 page.**

Écartées, avec le motif :

| Vue | Motif de non-inscription |
|---|---|
| `fig:topologie-reseau` | vue de l'état antérieur ; on ne prononce pas la recette d'un état qu'on a supprimé — son critère est la comparaison avec la cible |
| `fig:cycle-donnee`, `fig:chronologie-incident` | vues de latence, pas d'architecture ; leurs critères sont des mesures, déjà portées par le chapitre 6 |
| `fig:modele-donnees` | vue de schéma ; sa recette est une propriété du schéma, énoncée dans la figure elle-même |
| `fig:seq-refus`, `fig:seq-mfa` | vues de comportement ; elles illustrent T1, T2 et T11 sans les remplacer |
| `fig:delegation-identite` | vue d'analyse de risque ; elle **n'est pas recettable** — elle décrit ce qui serait atteignable, pas ce qui est vérifié. Sa réserve est son objet entier |
| chaînes du chapitre 5 | vues de procédé ; leur recette est le résultat de la chaîne (T8, T9, T10, T16, T18), déjà publié |
| `fig:archi-avant`, `fig:elson-fonctionnel`, `fig:organisation-menal`, `fig:cas-utilisation` | vues de contexte ou d'état antérieur, hors recette |

### 4.3 Le tableau, compilé et mesuré

Placement proposé : **fin de §4.x, après la dernière vue d'architecture**, en `table` avec
légende **au-dessus** (norme du brief §3), `\caption[court]{long}`.

Contrôle de compilation : `xelatex testrecette2.tex` — **0 erreur, 0 `Overfull \hbox`**,
`15,29 × 14,13 cm`, soit **57,2 % d'une page pour six vues**.

```latex
\begin{table}[htbp]
\caption[Critères de recette des vues d'architecture]{Critères de recette des vues
d'architecture : le point de vue servi, les critères datés avec leur protocole, et la
réserve de chaque vue.}
\label{tab:recette-vues}
\centering
\setlength{\tabcolsep}{4pt}\footnotesize
\begin{tabular}{@{}P{2.15cm}P{3.05cm}P{5.20cm}P{4.05cm}@{}}
\toprule
\textbf{Vue} & \textbf{Point de vue --- décision servie}
& \textbf{Critères de recette, datés, et protocole}
& \textbf{Réserve --- ce que la vue ne démontre pas} \\
\midrule
Contexte &
Architecte --- arbitre les dépendances non maîtrisées &
Les trois imports différés ne sont sur aucun chemin de requête (conception, \dateref) ;
la zone de noms reste hors code --- écart É10 &
Ni volumétrie, ni disponibilité des tiers \\
\addlinespace
Couches &
Architecte --- vérifie qu'aucune couche n'est traversée sans identité &
L2 vérifiée à chaque saut : \textbf{T5} conforme 23/08/2026 ; \textbf{T6} partiel au \dateref &
Ne montre pas les chemins réseau ; voir la vue de déploiement \\
\addlinespace
Déploiement &
Exploitant --- décide si le chemin privé est le seul chemin de données &
Sorties refusées : \textbf{T20} conforme 24/08/2026 ; données inaccessibles depuis
Internet : \textbf{T4} partiel &
Ni volumes, ni latences, ni perte du connecteur (\textbf{T15}, validation continue) \\
\addlinespace
Topologie cible &
Architecte réseau --- prononce la recette de la refonte &
Émission depuis un sous-réseau, pare-feu applicable : \textbf{T20} conforme 24/08/2026 ;
isolation : \textbf{T5} conforme 23/08/2026 &
Ne couvre pas le trafic entrant ; \textbf{T1} reste non conforme \\
\addlinespace
Plan d'identité &
Responsable sécurité --- décide si une identité peut altérer une preuve &
Inventaire de clés vide : \textbf{T7} conforme 19/08/2026 ; intégrité de la preuve :
\textbf{T11} conforme, test automatisé &
Décrit les droits déclarés, non leur composition (voir la vue de délégation) \\
\addlinespace
Frontières de confiance &
Analyste de la menace --- décide où poser un contrôle &
TB1--TB4 franchies par le réseau, TB5 par l'identité seule : \textbf{T5} et \textbf{T11}
conformes ; \textbf{T14} non conforme au \dateref &
Ne hiérarchise pas les scénarios ; la gravité est portée par l'annexe C \\
\bottomrule
\end{tabular}
\end{table}
```

### 4.4 Gabarit de repli — l'encadré par vue

Si l'équipe chapitre 4 préfère accoler la recette à chaque figure plutôt que la regrouper, le
gabarit suivant compile sans erreur (`testrecette.tex`, 0 erreur, 0 `Overfull`) et tient en
quatre lignes. À déclarer dans `config/commands.tex` :

```latex
% \recette{vue}{point de vue et préoccupation}{critères datés + protocole}{réserve}
\newcommand{\recette}[4]{%
  \begin{center}\footnotesize
  \begin{tabular}{@{}>{\bfseries}p{2.35cm}P{12.9cm}@{}}
  \toprule
  \multicolumn{2}{@{}l@{}}{\normalsize\bfseries Recette de la vue --- #1}\\
  \midrule
  Point de vue & #2 \\
  Critères     & #3 \\
  Réserve      & #4 \\
  \bottomrule
  \end{tabular}
  \end{center}}
```

### 4.5 Les trois règles qui font tenir ces tableaux

1. **Aucun critère sans protocole ni date.** Chaque cellule « Critères » nomme au moins un
   protocole `T1`–`T20` et porte une date de relevé ou `\dateref`. Les valeurs employées
   ci-dessus sont celles publiées par le mémoire lui-même (tableau de statut,
   `ch6_validation.tex:104-158`) : **T5, T7, T11, T20 conformes ; T4, T6, T15 partiels ; T1 et
   T14 non conformes.** Aucun chiffre n'a été produit pour ce rapport.
2. **Les non-conformités entrent dans le tableau, elles n'en sortent pas.** `T1` figure dans la
   réserve de la topologie cible et `T14` dans celle des frontières : c'est ce qui rend le
   tableau crédible.
3. **La réserve dit ce que la vue ne montre pas, jamais ce qui manque au système.** « Ni
   volumes, ni latences » est une réserve. « Les latences ne sont pas mesurées » serait un aveu,
   et tomberait sous le registre interdit du brief §1.

---

## 5. Synthèse, plan d'action et ce que j'ai trouvé de faux

### 5.1 Les trente verdicts

| Verdict | Nb | Figures |
|---|---:|---|
| **conforme** (retouche typographique seulement) | 2 | `graph:audit-41`, `fig:scenario-19-08` |
| **à retoucher** | 16 | `fig:carte-memoire`, `fig:organisation-menal`, `fig:elson-fonctionnel`, `fig:archi-avant`, `fig:cas-utilisation`*, `fig:dfd-frontieres`, `fig:contexte`, `fig:topologie-reseau`, `fig:cycle-donnee`, `fig:modele-donnees`, `fig:plan-identite`, `fig:chaine-infrastructure`, `fig:composants-logiciel`, `fig:chaine-donnees-vue`, `fig:accueil-locataire`, `fig:gantt` |
| **à refaire** | 5 | `fig:deploiement`, `fig:topologie-cible`, `fig:seq-refus`, `fig:delegation-identite`, `fig:seq-mfa` |
| **à fusionner** | 4 | `fig:modele-couches` + `fig:deploiement` ; `fig:chronologie-incident` → `fig:cycle-donnee` ; `fig:graphe-taches-livraison` + `fig:sequence-livraison` |
| **à retirer** | 3 | `fig:boucle-f6`, `fig:pipeline-detection`, `graph:coldstart` (→ tableau) |

\* `fig:cas-utilisation` est **conditionnelle** : à retirer si sa légende ne devient pas une
proposition démontrable (gain supplémentaire 0,44 page).

### 5.2 Le grand livre des pages

Tout ce qui porte la mention « mesuré » vient d'une compilation XeLaTeX de ce rapport, pas d'une
estimation.

| Action | Gain (page) | Origine du chiffre |
|---|---:|---|
| Retrait des 12 pavés « Ce que la figure démontre » (doublons de légende) | **0,38** | **mesuré** (`measure_strip.tex`) |
| Fusion `fig:graphe-taches-livraison` + `fig:sequence-livraison` | 0,41 | estimé sur hauteurs mesurées |
| Fusion `fig:chronologie-incident` → `fig:cycle-donnee` | **0,34** | **mesuré** (le flottant entier disparaît) |
| Retrait de `fig:pipeline-detection` | **0,33** | **mesuré** |
| Fusion `fig:modele-couches` + `fig:deploiement` | 0,32 | estimé sur hauteurs mesurées |
| Retrait de `fig:boucle-f6` | **0,26** | **mesuré** |
| Panneaux tabulaires sortis des figures (topologies ×2, `fig:seq-mfa`) | 0,30 | estimé |
| `fig:chaine-donnees-vue` en disposition linéaire | 0,21 | estimé |
| `graph:coldstart` → tableau de trois lignes | 0,20 | estimé |
| Allègement du Cadre B de `fig:modele-donnees` | 0,19 | estimé |
| **Sous-total figures** | **2,94** | |
| *(conditionnel)* retrait de `fig:cas-utilisation` | *0,44* | mesuré |
| **Coût** — tableau des critères de recette, 6 vues | **−0,57** | **mesuré** (`testrecette2.tex`) |
| **Net** | **≈ 2,4 page** *(2,8 avec le conditionnel)* | |

**Il faut le dire nettement à l'équipe volume : les figures ne fourniront pas les 37 pages.**
Elles pèsent 13,75 pages sur 121, et le travail ci-dessus en rend environ 2,4. Le gisement est
dans la prose et dans la redondance inter-chapitres, comme le brief le dit lui-même en plaçant
les figures au **quatrième** rang de ses leviers. Ce que les figures apportent d'irremplaçable,
c'est autre chose : quatre débordements de marge corrigés, deux recouvrements de texte
supprimés, une erreur factuelle rattrapée, et une convention qui rend le mémoire lisible.

**Effet indirect, non chiffré ici mais réel** : cinq figures dépassent 62 % d'une page
(`fig:topologie-reseau`, `fig:seq-refus`, `fig:delegation-identite`, `fig:seq-mfa`,
`fig:modele-donnees`) et forcent LaTeX à leur réserver une page de flottant, laissant du blanc
autour. Les corrections ci-dessus en ramènent quatre sous 65 % et deux sous 58 %, ce qui leur
permet de partager leur page avec du texte. L'équipe qualité mesurera le gain réel à la
recompilation.

### 5.3 Ce que j'ai testé et qui ne marche pas — à ne pas re-découvrir

**La compression par `y=` échoue.** Le réflexe naturel pour réduire une figure trop haute est de
passer `y=1cm` à `y=0.86cm` dans les options du `tikzpicture`. Je l'ai fait sur les huit
figures les plus hautes et mesuré :

| Figure | H à `y=1cm` | H à `y=0.86cm` |
|---|---:|---:|
| `fig:modele-donnees` | 20,94 cm | 17,76 cm |
| `fig:seq-mfa` | 17,99 | 14,14 |
| `fig:delegation-identite` | 17,90 | 13,06 |
| `fig:seq-refus` | 16,10 | 13,92 |
| `fig:topologie-reseau` | 14,35 | 10,93 |

Les gains sont spectaculaires et **le résultat est inutilisable** : les hauteurs de nœud sont
en centimètres absolus et ne suivent pas l'échelle, si bien que les nœuds se recouvrent. Sur
`fig:delegation-identite`, l'encadré « Réduction » recouvre le nœud « 3. Identité de
déploiement » et coupe « écriture sur la seule table des vulnérabilités » ; sur
`fig:topologie-reseau`, le panneau « Règles de filtrage en entrée » recouvre « Règles de
sortie » et biffe la ligne `65534 refus général`. **La hauteur doit venir du contenu retiré, pas
de l'échelle appliquée.** (Rendus conservés : `yy-1.png` à `yy-8.png`.)

**Un huitième style de flèche a été essayé puis écarté** (`fluxexterne`, plein à pointe creuse
en encre pleine) : indistinguable de `fluxdonnee` au rendu en niveaux de gris. Voir §3.1.

**Le piège des antislashs est réel et je suis tombé dedans.** En construisant un fichier de test
par une chaîne Python non brute, `\begin` est devenu un caractère de contrôle (`^^H` + `egin`)
et le fichier a produit 20 erreurs sans qu'on voie rien à la lecture. **Tout le LaTeX de ce
rapport a ensuite été écrit avec l'outil `Write`, jamais par substitution.**

### 5.4 Tout ce que j'ai trouvé de faux

C'est, selon le brief, le livrable le plus utile. Cinq points, tous vérifiés.

1. **`fig:composants-logiciel` contredit le tableau du même chapitre.** Le nœud de
   `ch5_realisation.tex:915` dit **« 11 pages rendues au serveur »** ; le tableau de
   caractérisation de `ch5_realisation.tex:1200` dit **« douze vues, dont dix rendues au serveur
   et deux clientes, et sept routes serveur »**. La correction factuelle **F7** du brief a été
   appliquée au tableau et **pas à la figure**. Deux valeurs incompatibles à 285 lignes
   d'intervalle, dans le même chapitre. Correctif : le nœud devient « 10 vues rendues au
   serveur, 2 clientes ».

2. **La légende de `fig:modele-couches` décrit un trait qui n'existe pas.** Elle annonce
   « Pointillés : collecte F4 ; **tirets : vérification d'identité à chaque saut** ». La figure
   ne contient **aucun trait en tirets** : les tirets qu'elle porte sont les *bordures* des
   cadres L2 et L7. Un lecteur qui cherche la vérification d'identité ne la trouvera pas.

3. **Quatre figures débordent de la justification** sans qu'aucun `Overfull \hbox` ne le
   signale, parce qu'un `tikzpicture` centré dans un `figure` sort dans la marge en silence :
   `fig:dfd-frontieres` (**22,0 pt = 7,7 mm**), `fig:organisation-menal` (5,4 pt),
   `fig:seq-refus` (1,7 pt), `fig:topologie-cible` (0,9 pt). Le premier est visible à
   l'impression.

4. **`fig:topologie-cible` a un recouvrement de texte visible au rendu.** Le titre du cadre
   *« Réseau virtuel en mode personnalisé — mode de routage régional déclaré »* est coupé par la
   bordure du cadre et recouvert par le nœud « Locataire plateforme » ; le contenu de ce nœud
   déborde à son tour sur le nœud voisin. Même famille de défaut, plus grave encore, dans
   `fig:cas-utilisation` : **la boîte de l'acteur A5 recouvre le libellé de l'acteur A4**, qui
   devient illisible.

5. **Le type de flottant `graphique` est déclaré et jamais employé.**
   `config/packages.tex:44-70` déclare un compteur `graphique`, l'extension `.lgr`,
   `\fnum@graphique`, `\l@graphique` et une réécriture manuelle de `\listofgraphiques` — soit
   27 lignes. `\begin{graphique}` n'apparaît **nulle part** dans le mémoire, et
   `\listofgraphiques` n'est **pas appelé** par `main.tex`. Les deux graphiques existants
   (`graph:audit-41`, `graph:coldstart`) sont des `figure` portant un préfixe de label `graph:`,
   donc numérotés et listés parmi les **figures**. Ou bien on emploie le type déclaré, ou bien
   on retire les 27 lignes et on renomme les deux labels en `fig:`. La situation actuelle est la
   seule qui ne se défende pas. *(Arbitrage hors périmètre graphique — signalé, non tranché.)*

**Trois défauts de structure, moins graves mais à corriger au passage :**

- `\pastilleOK` et `\pastilleWarn` sont définies par `\providecommand` **à l'intérieur de
  l'environnement `figure`** de `fig:delegation-identite` (`ch4_conception.tex:1817-1826`), et
  `\gcprod` en tête de `ch5_realisation.tex:12`. Les trois doivent rejoindre
  `config/commands.tex`, et les deux pastilles doivent y être déclarées
  `\DeclareRobustCommand` comme les `\pictoPleinAudit` voisins — pour la raison exacte qui a
  motivé ce choix pour les pictogrammes : elles casseraient dans une légende.
- **Sept figures emploient des étiquettes tournées à 90°** portant du sens principal ; deux
  d'entre elles (`fig:modele-couches` pour L2, `fig:chaine-infrastructure` pour
  « automatique / manuel ») rendent illisible ce que la figure a de plus important à dire.
- **Deux figures contiennent un `\cref` de section** (`fig:sequence-livraison`,
  `fig:pipeline-detection`). Un renvoi de section dans un dessin n'est pas portable et impose
  une passe de compilation supplémentaire ; il appartient à la légende.

### 5.5 Plan d'action, dans l'ordre de rentabilité

**Lot 1 — défauts de fabrication (une demi-journée, aucun arbitrage rédactionnel).**
Corriger les quatre débordements de marge (§5.4 point 3), les deux recouvrements de texte
(point 4), l'erreur factuelle F7 (point 1), la légende fausse de `fig:modele-couches`
(point 2). **Aucun de ces points ne demande l'accord de l'équipe rédaction.**

**Lot 2 — la convention (une journée).**
Insérer le bloc §3.7 dans `config/commands.tex`, déplacer `\gcprod` et les deux pastilles,
puis appliquer la table de migration §3.9 figure par figure. Ajouter les dix légendes internes
manquantes avec le gabarit A. Passer tous les libellés porteurs à `\footnotesize`.
**C'est ce lot qui répond à la commande du brief §2.1.**

**Lot 3 — le volume (une journée).**
Retirer les 12 pavés de prose dupliqués (−0,38 page, mesuré), les trois figures à retirer
(−0,79 page, mesuré), opérer les trois fusions (−1,07 page), sortir les panneaux tabulaires
(−0,30 page). Vérifier à la recompilation que les cinq figures pleine page sont redescendues.

**Lot 4 — la recette (une demi-journée).**
Insérer le tableau §4.3 (+0,57 page), et retirer en contrepartie les paragraphes du chapitre 4
qui énoncent déjà en prose ce que le tableau porte — l'équipe chapitre 4 les identifiera plus
vite que moi.

**Lot 5 — la séparation des plans (une journée, la plus visible pour le jury).**
Poser les bandes du gabarit B sur les six vues qui en ont le plus besoin :
`fig:dfd-frontieres`, `fig:contexte`, `fig:deploiement`, `fig:seq-refus`,
`fig:delegation-identite`, `fig:plan-identite`. Coût de place : nul — les bandes sont sur le
calque `backgrounds` et n'agrandissent pas la figure.

**Lot 6 — les croisements.**
**Trente-deux croisements** comptés sur l'ensemble du corpus. **Trois sont signifiants** — deux
franchissements de frontière dans `fig:dfd-frontieres` (F4 et F7 traversant TB5) et la
rétroaction de `fig:chaine-infrastructure` traversant la frontière automatique/manuel : ils sont
le sujet même de leur figure et se conservent, en marquant le saut de trait. Les **vingt-neuf
autres** se règlent par réordonnancement de la colonne cible ou passage en arc, figure par
figure, comme indiqué au point 6 de chaque bloc du §2. Les trois figures les plus chargées sont
`fig:dfd-frontieres` (5), `fig:elson-fonctionnel` (4), `fig:deploiement` (4) et
`fig:plan-identite` (4) — cette dernière étant la plus coûteuse rapportée à sa taille.

Répartition complète : `fig:dfd-frontieres` 5 · `fig:elson-fonctionnel` 4 ·
`fig:deploiement` 4 · `fig:plan-identite` 4 · `fig:cas-utilisation` 3 ·
`fig:delegation-identite` 3 · `fig:topologie-cible` 2 · `fig:seq-refus` 2 · `fig:seq-mfa` 2 ·
`fig:topologie-reseau` 1 · `fig:composants-logiciel` 1 · `fig:chaine-infrastructure` 1.
Les dix-huit autres figures sont à zéro croisement.

### 5.6 Vérification — périmètre non dépassé

**Mes seules écritures sont** `rapport PFE/RAPPORT_FIGURES.md` (ce fichier) et les artefacts de
`…/scratchpad/audit_figures/`, hors du dépôt. **Je n'ai modifié aucun `.tex` du mémoire et
supprimé aucun fichier.**

```
$ git status --porcelain "rapport PFE/RAPPORT_FIGURES.md"
?? "rapport PFE/RAPPORT_FIGURES.md"

$ git status --porcelain | grep "^ *D"
(aucune ligne : aucun fichier supprimé dans tout le dépôt)
```

**Avertissement à l'équipe qualité.** `git status --porcelain "rapport PFE/latex/"` renvoie
26 fichiers en `M`. **Ce ne sont pas mes modifications** : vingt d'entre elles étaient déjà
présentes à l'ouverture de ma tâche, et six sont apparues **pendant** ma tâche
(`annexe_b_extraits_realisation.tex`, `annexe_g_glossaire.tex`, `config/formatting.tex`,
`frontmatter/abstract.tex`, `frontmatter/acronyms.tex`, `frontmatter/resume.tex`) du fait des
équipes travaillant en parallèle sur le même dépôt. Je le signale parce que la comparaison
`git status` avant/après est le contrôle que l'équipe qualité applique : sur un dépôt partagé
par plusieurs équipes simultanées, ce contrôle ne discrimine pas, et il faut lui préférer la
comparaison des horodatages ou un journal par équipe.

Artefacts de travail conservés dans `…/scratchpad/audit_figures/` : `extract.py`,
`census.py`, `census2.py`, `verify.py`, `genmeasure.py`, `report_dims.py`, `strip_boxes.py`,
`test_yscale.py`, `shims.tex`, `convention.tex`, `testconv.tex`, `testrecette.tex`,
`testrecette2.tex`, les 30 rendus `pg-*.png`, les rendus de contre-essai `yy-*.png`, les
rendus en niveaux de gris `cvg-*.png` et les relevés `measure.dim`, `strip.dim`, `yscale.dim`,
`recette.dim`. **`convention.tex` est prêt à être recopié tel quel dans `config/commands.tex`.**

---

## 6. Addendum — deux constats hors périmètre graphique

Signalés parce que le brief demande *« tout ce que tu as trouvé de faux »*. Je ne les ai pas
corrigés : ils relèvent de l'équipe qualité.

**A. L'annexe G est orpheline.** `latex/appendices/annexe_g_glossaire.tex` contient
41 lignes, un `\chapter{Glossaire technique complémentaire}` et un `\label{ann:glossaire}` sur
un `longtable` renseigné. Elle n'est **appelée par aucun `\input`** — `main.tex` s'arrête à
`annexe_f` (lignes 75-80) — et `ann:glossaire` n'apparaît pas dans `build.aux`. Aucun renvoi ne
la cite depuis le corps ni depuis les pièces liminaires, alors que son propre en-tête annonce
qu'elle est « appelée depuis la liste des acronymes ». Par ailleurs le commentaire de
`main.tex:69-71` affirme toujours que « le glossaire technique complémentaire […] devient
l'annexe G », ce qui n'est plus vrai. Trois issues : la réintégrer (coût ~2 pages, que le
budget n'a pas), corriger le commentaire de `main.tex` et l'assumer comme matériau non publié,
ou la verser dans la liste des acronymes. **Ne pas supprimer le fichier.**

**B. L'annexe H a été démontée le 29/08/2026, proprement.** Le fichier
`annexe_h_captures.tex` est volontairement vide et porte en tête le journal de la
redistribution de son contenu vers l'annexe E. Ce n'est **pas** un défaut : c'est documenté,
daté et cohérent. Je le mentionne pour qu'une relecture ultérieure ne le prenne pas pour un
oubli — et pour confirmer, du point de vue graphique, que **plus aucun appel `\capture{}` ne
subsiste dans les annexes**, donc plus aucun cadre gris « Capture Kxx » en version de remise.
Les six cadres de capture autorisés par le brief §4 restent entièrement disponibles pour les
chapitres 5 et 6.

---

*Fin du rapport. Corpus : 30 figures. Compilations de contrôle : 6, toutes à 0 erreur.
Mesures : 30 hauteurs, 12 hauteurs après allègement, 8 hauteurs sous compression d'essai,
2 gabarits de tableau. Aucun `.tex` du mémoire modifié.*
