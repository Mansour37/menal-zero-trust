# RAPPORT_FIG_CH1_CH3 — application de la convention graphique aux figures de l'introduction et des chapitres 1 à 3

**Équipe** : figures ch1–ch3. **Date** : 29/08/2026.
**Périmètre d'écriture** : `chapters/final/intro_generale.tex`, `ch1_cadre_existant.tex`,
`ch2_etat_art.tex`, `ch3_besoins_menaces.tex`. Aucun autre fichier ouvert en écriture,
aucun fichier supprimé.
**Compilation de travail** : `xelatex -jobname=buildE main.tex`, deux passes.

## Inventaire réel du périmètre — 7 figures, pas 8

`grep` sur `\begin{tikzpicture}` dans les quatre fichiers :

| Fichier | Figures |
|---|---|
| `intro_generale.tex` | `fig:carte-memoire` |
| `ch1_cadre_existant.tex` | `fig:organisation-menal`, `fig:elson-fonctionnel`, `fig:archi-avant`, `graph:audit-41` |
| `ch2_etat_art.tex` | **aucune** — 0 `tikzpicture` |
| `ch3_besoins_menaces.tex` | `fig:cas-utilisation`, `fig:dfd-frontieres` |

**Correction au brief reçu** : `fig:contexte` n'est pas dans mon périmètre — elle est en
`ch4_conception.tex:108`, comme `fig:modele-couches` (`ch4:161`). Elles appartiennent à
l'équipe ch4–ch6. Le chapitre 2 ne contient **aucune** figure : c'est un chapitre entièrement
tabulaire. Mon périmètre est donc de **7 figures**.

**Référence de départ** : 153 pages PDF, 0 erreur (`grep -c '^!' buildE.log` = 0).

---

## Figure 1 — `fig:carte-memoire` (`intro_generale.tex`)

**Avant** : 4 styles locaux (`bloc`, `num`, `prod`, `fl`), palette `black!55 / black!70 /
black!60 / black!3`, pointe `Latex[1.6mm]`, hauteur de nœud 1,02 cm, pas vertical 1,62 cm.
Le style `num` était **déclaré et jamais employé** (constat nouveau, non listé par
`RAPPORT_FIGURES`).

**Signification décidée pour le trait** : il y en a un seul, et il dit *« le chapitre n produit
ce que consomme le chapitre n+1 »*. C'est une transmission de livrable dans le fil de lecture,
pas une décision de politique ni un événement asynchrone → **`fluxdonnee`**. Conforme à la
table de migration §3.9.

**Après** :
- `fl` → `fluxdonnee` (5 emplois) ;
- `bloc` → `nsysteme` de la convention (+ `text width=4.05cm`), ce qui remplace `fill=black!3`
  par le blanc de la convention et fixe la hauteur à 0,80 cm ;
- `prod` passe en `text=menalencre` ;
- style mort `num` **supprimé** ;
- pas vertical 1,62 → **1,32 cm** ; largeur du volet « Produit » 8,0 → 8,35 cm pour ramener
  chaque produit à deux lignes exactement ;
- **espace insécable posée** : `Chapitre 1` → `Chapitre~1`, et de même pour les six chapitres
  (c'est le défaut signalé « intro:123 »).

**Légende interne** : non requise — un seul aspect de trait (invariant §3.6.1).
**Séparation des plans** : sans objet (figure de structure documentaire).

**Gain mesuré** : hauteur du dessin 9,13 → **7,22 cm**, soit **−1,91 cm ≈ 0,08 page**.
Le total du document reste à 153 pages à ce stade : le gain est de la place blanche rendue à la
page 3, pas encore une page entière.

**Rendu regardé** : oui, page PDF 17 (page 3 du corps) extraite à 150 dpi et lue. Six blocs
alignés, aucun recouvrement, les cinq flèches touchent bien les bords `south`/`north`, chaque
volet « Produit » tient sur deux lignes sans veuve.
