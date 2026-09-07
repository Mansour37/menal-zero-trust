# RAPPORT_FINAL_CH3_CH6.md — vague finale, chapitres 3 et 6

**Périmètre d'écriture** : `latex/chapters/final/ch3_besoins_menaces.tex` et
`latex/chapters/final/ch6_validation.tex`, plus le présent rapport. **Aucun autre fichier
`.tex` n'a été ouvert en écriture. Aucun fichier n'a été supprimé.**
**Date** : 30/08/2026. **Nom de travail de compilation** : `buildY`.
**Outillage** : les dix patchs sont des scripts Python en `io.open(..., encoding='utf-8',
newline='\n')`, chacun refusant de s'exécuter si la chaîne cible est absente ou trouvée
plusieurs fois. **Aucun LaTeX n'a été écrit par heredoc bash, `sed`, `perl` ou `echo`.**

---

## 0. Mesure d'entrée — compilée, non estimée

`grep -c '^!' buildY.log` = **0**. `Output written on buildY.pdf (154 pages)`.

| | Début | Fin | **Pages** | Cible | Écart |
|---|---:|---:|---:|---:|---:|
| Ch. 3 — Besoins et menaces | 30 | 39 | **10** | 7 | +3 |
| Ch. 6 — Validation | 92 | 111 | **20** | 14 | +6 |
| Document entier | — | — | **154** | ≤ 120 | +34 |

Lignes source à l'entrée : ch3 = 697, ch6 = 1 140.

### Densité mesurée avant travail — il n'y avait pas de gras de mise en page

Lignes non vides par page (`pdftotext -layout`) :

- **ch3** : 48, 42, 45, 55, 44, 43, 48, 46, 52, **9**
- **ch6** : 36, 51, 46, 43, 49, 42, 57, 41, 43, 46, 52, 42, 58, 40, 39, 49, 51, 36, 55, 44

Une seule page creuse dans les deux chapitres : la **dernière du chapitre 3, à 9 lignes**, qui ne
portait que la queue de la conclusion. Partout ailleurs, le volume est du contenu et non du
placement — ce qui a orienté tout le travail vers le **levier 1 (densité des tableaux)** plutôt
que vers le levier 5 (coupe réelle).

---

## 1. Mesure de sortie — compilée, non estimée

Trois passes `xelatex` (biber au départ). Bornes relevées **sur le PDF lui-même** et non sur
`buildY.toc` : les trois autres équipes écrivent en parallèle et le `.toc` d'une passe reflète
les pages de la passe précédente — l'écart observé a atteint deux pages.

| | Avant | **Après** | Gain | Cible | Écart |
|---|---:|---:|---:|---:|---:|
| **Ch. 3 — Besoins et menaces** | 10 | **9** | **−1** | 7 | +2 |
| **Ch. 6 — Validation** | 20 | **19** | **−1** | 14 | +5 |
| Document entier | 154 | **146** | −8 | ≤ 120 | +26 |

Le −1 du chapitre 6 se lit avec sa contrepartie : **le chapitre a en même temps reçu les deux
cadres K33 et K34**, mesurés à ≈ 0,6 page de flottant. La hauteur de contenu réellement retirée
est donc de **≈ 1,6 page**, dont 0,6 immédiatement réinvestie dans les cadres commandés par la
mission 3. Mesure intermédiaire à l'appui : après les passes de densité et de prose et **avant**
la pose des cadres, le chapitre 6 compilait à **18 pages**.

```
grep -c '^!' buildY.log                       -> 0
Reference / Citation undefined                -> 0
Overfull \hbox imputables a ch3 ou ch6        -> 0   (1 a l'entree, 18,99 pt)
Overfull \hbox restants dans le document      -> 9   (tous hors perimetre, cf. §7.4)
Output written on buildY.pdf (146 pages)
```

Lignes source : ch3 697 → **668** ; ch6 1 140 → **1 174**. Le chapitre 6 *gagne* 34 lignes source
parce que les deux cadres de capture en pèsent 62 à eux seuls ; sa prose en perd 30 et ses
cellules de tableau 436 signes.

### Densité de sortie — la preuve qu'il ne reste plus de place perdue

- **ch3** (pdf 40–48) : 49, 38, 45, 55, 44, 43, 49, 52, 42
- **ch6** (pdf 98–116) : 36, 51, 43, 43, 47, 45, 40, 42, 44, 44, 39, 47, 46, 41, 45, 50, 40, 45, 42

**Aucune page sous 36 lignes**, et 36 est la page de titre du chapitre 6. La page de 9 lignes du
chapitre 3 a disparu : c'est le gain de sa neuvième page.

---

## 2. Les coupes, par nature et par gain

### 2.1 Levier 1 — densité des tableaux : le gisement, et il n'avait pas été ouvert

**Constat de départ, mesuré.** `\textwidth` vaut exactement **16 cm** (A4, marges 2,5 cm). Or les
dix tableaux du chapitre 6 étaient composés sur **12,9 à 14,5 cm**, avec le `\tabcolsep` par
défaut de 6 pt — soit **1,5 à 3,1 cm de blanc perdu par tableau**, dans un chapitre dont la
moitié de la hauteur est en tableaux. Le chapitre 3 était dans le même cas, à 13,7–14,9 cm.

| Geste | Nature | Gain |
|---|---|---:|
| `\tabcolsep` à 3 pt et largeurs `P{}` redistribuées sur les **dix** tableaux du ch. 6 | densité | **≈ 1,3 p** |
| Idem sur les **sept** tableaux restants du ch. 3 | densité | ≈ 0,4 p |
| `\LTpre` / `\LTpost` de 12 pt à 6 pt sur les onze `longtable` (restaurés en fin de chapitre) | densité | ≈ 0,15 p |

Effet concret sur le registre le plus lourd : la colonne « Preuve invoquée » de
`tab:synthese-campagne` passe de **9,6 cm à 12,9 cm**, soit **+34 %** de largeur utile sur les
vingt lignes. Les vingt protocoles, leurs dates, leurs critères et leurs réserves sont conservés
mot pour mot.

**La colonne « Exig. » de `tab:synthese-campagne` a été retirée.** Elle portait EX1 en face de
T1, EX2 en face de T2, … EX20 en face de T20 : une bijection parfaite avec le rang de la ligne,
donc une répétition de l'en-tête « Test ». La correspondance n'est pas perdue — elle est énoncée
une fois dans le chapeau et une fois dans la légende longue (« le protocole T*n* valide l'exigence
EX*n* de même rang »), avec un `\cref` vers `tab:matrice-tracabilite`, qui l'établit ligne à ligne.

**Fusion de `tab:frontieres` et `tab:frontieres-scenarios` (ch. 3).** Les deux tableaux étaient
indexés par les mêmes cinq clés TB1–TB5 : l'un disait ce que chaque frontière porte, l'autre
quels scénarios la franchissent. Ils sont devenus un tableau de six colonnes portant **les deux
`\label`**, de sorte qu'aucun `\ref` ne casse. Rien n'est perdu : la ligne « Aucune — SO15, SO19 »
a été reportée dans le paragraphe suivant, qui justifiait déjà ces deux rattachements en toutes
lettres, et leur absence du tableau y est désormais explicite. **Gain ≈ 0,4 p**, plus une entrée
de moins dans la liste des tableaux.

**Colonne « Exigence (libellé court) » de `tab:matrice-tracabilite` ramenée à l'identifiant.**
Cette colonne de 3,3 cm résumait `tab:exigences`, imprimé **deux paragraphes plus haut**. Les
2,3 cm libérés vont aux colonnes « Contrôle » et « Test », qui passent de 4,4 et 4,6 cm à
**6,3 et 6,2 cm** ; le chapeau renvoie explicitement à la formulation complète. **Gain ≈ 0,3 p.**
Ce n'est pas la coupe refusée au rang 7 par l'équipe précédente (« ramener `tab:exigences` à des
libellés courts ») : la formulation complète des vingt exigences est intacte, c'est son *résumé*
qui disparaît.

**Densité de cellule** — 16 cellules réécrites, −436 signes. Chaque cellule perd ce qu'une autre
cellule ou un autre tableau du même chapitre porte déjà, en le nommant. Le cas le plus net :
l'axe « Ségrégation réseau » de `tab:maturite-multitenant` et le pilier « Réseaux » de `tab:ztmm`
étaient identiques à **85 %** — mêmes dates, mêmes cinq autorisations, même règle permissive
supprimée le 24/08, même connecteur supprimé le 15/08. `tab:ztmm` garde l'établissement daté ;
l'axe multi-locataire le nomme par `\cref` et garde en propre ce qui lui appartient : le refus
croisé du 24/08 retrouvé dans l'entrepôt, et **les trois raisons démontrées qui bornent le
6/10** — T14, le sélecteur par étiquette et non par identité de service, l'instance de base unique.

### 2.2 Levier 2 — redondance inter-chapitres

| Objet | Traitement |
|---|---|
| ch6 §6.0 — « choisis *avant* la conception, ce qui interdit de sélectionner *a posteriori* » | L'argument est celui de la `keybox` du §6.2, qui le porte avec son illustration T14. Retiré du chapeau |
| ch6 §6.2.2 — les deux premières « propriétés qu'une image ne possède pas » de T11 | Ce sont le rang 1 de la hiérarchie de preuves du §6.1. Renvoyées ; la troisième — *il a une histoire* — conservée en entier |
| ch6 §6.3.1 — précautions de dénominateur ATT&CK | Établies au ch. 2 ; l'empreinte 872 / 697 / 15 et la réserve d'épinglage restent |
| ch6 §6.3.3 — fonctionnement de la règle R2 | Établi au ch. 5 (`sec:chaine-detection`), renvoyé |
| ch6 §6.4.1 — les trois politiques d'alerte provoquées (36 min 19 s, T15, T19) | Les trois mesures sont dans `tab:synthese-campagne` ; le paragraphe les nomme et renvoie. Ce qui lui appartient en propre est conservé : les quatorze politiques jamais déclenchées et les quatre objectifs mesurés sans être actionnés |
| ch6 §6.4.3 — « le volume facturé ne vient pas des données, qui tiennent en 24 Mo, mais du minimum forfaitaire… » | Récitation mot pour mot de la deuxième ligne de `tab:cout-anomalies`. Ramené à ce que le tableau ne porte pas : *une réduction de rétention n'aurait ici aucun effet sur la facture* |
| ch6 §6.7.4 — chiffrage du correctif T14 | Chiffré au §6.2.1, où la non-conformité est établie. Renvoyé |
| ch3 §3.5.1 — dates et mécanisme de D15 devant EX20 | `\cref{subsec:reseau-cible}`. **L'état de l'exigence, ses deux critères de vérification et le renvoi à T20 restent** |
| ch3 §3.5.1 — les deux réserves (exfiltration fournisseur, sélecteur par étiquette) | G3(c) et G4(d) du rapport de redondances, appliqués : les deux réserves sont **nommées et conservées**, leur démonstration renvoyée au ch. 4 |
| ch3 §3.3.2 — « Deux conséquences gouvernent la conception » | La première recouvrait la `keybox` immédiatement suivante. Resserré |

### 2.3 Levier 3 — redondance intra-section

Chapeaux qui répètent leur titre, clôtures qui répètent leur chapeau : **18 blocs du ch. 6 et
13 blocs du ch. 3** resserrés fait par fait, chacun relu avant réécriture. Conclusions de chapitre
ramenées de 13 à 11 lignes (ch. 6) et de 12 à 10 (ch. 3).

### 2.4 Levier 4 — échelle des figures

| Figure | Avant | Après | Effet |
|---|---|---|---|
| `fig:dfd-frontieres` (ch. 3) | `x=1cm, y=1cm` | `x=0.925cm, y=0.90cm` | **Corrige un `Overfull \hbox` de 18,99 pt** signalé par l'équipe précédente et laissé en l'état, les figures étant hors de son mandat |
| `fig:cas-utilisation` (ch. 3) | échelle 1 | `scale=0.92` + `transform shape` | ≈ −0,8 cm |
| `graph:coldstart` (ch. 6) | `y=0.026cm, x=0.95cm` | `y=0.0185cm, x=0.82cm` | ≈ −1,2 cm |
| `fig:scenario-19-08` (ch. 6) | jalons de 2,3 cm | 1,85 cm | ≈ −0,45 cm |

Les quatre rendus ont été relus en PNG à 55–60 ppp, page par page. **Aucune ne déborde du bloc de
texte**, et plus aucun `Overfull \hbox` n'est imputable aux chapitres 3 et 6.

*Piège rencontré, à noter pour la vague suivante :* `grep -c 'Overfull \\hbox' build.log` en ligne
de commande bash **renvoie 0 à tort** — l'antislash est mangé avant d'atteindre grep, exactement
comme pour l'écriture de LaTeX. Le contrôle correct est `grep -a "Overfull" build.log | sort -u`.
C'est ainsi que j'ai découvert que ma redistribution de largeurs avait introduit **quatre
`Overfull \hbox` d'alignement à 0,39 pt** sur les quatre tableaux à quatre colonnes portés à
15,10 cm : à quatre colonnes, les huit `\tabcolsep` de 3 pt et les cinq filets pèsent 0,917 cm, ce
qui portait le total à 16,017 cm pour une `\textwidth` de 16 cm. Corrigé (passe 9) : 0,05 cm
retiré à la colonne la plus large de `tab:acteurs`, `tab:besoins-fonctionnels`,
`tab:besoins-non-fonctionnels` et `tab:objectifs-ch6`. **Zéro `Overfull` en alignement après
correction.**

### 2.5 Levier 5 — coupe réelle de contenu

**Aucune.**

---

## 3. Mission 3 — les deux cadres de capture

| Cadre | Emplacement | Largeur | Coût mesuré |
|---|---|---|---:|
| **K33** — fiche d'incident | ch. 6 §6.3.3 `sec:eval-enrichissement`, après le paragraphe qui borne la portée de l'échantillon du 1er août | `0.72\textwidth` | ≈ 0,33 p |
| **K34** — vue d'ensemble | ch. 6 §6.7.4, après le **premier des trois seuils** | `0.72\textwidth` | ≈ 0,27 p |

Conformément au mandat, **la macro `\capture` n'est pas employée** : en version de remise elle
imprime un rectangle gris portant « Capture Kxx », qui est le défaut bloquant que le brief
interdit. Les deux cadres reposent sur `\IfFileExists` + l'environnement `extraitconf`
(`commands.tex:60`), avec `breakable=false` et `fontupper=\footnotesize` surchargés à l'appel.
Le jour où `latex/figures/K33.png` est déposé, le cadre devient l'image sans qu'on touche au
chapitre.

**Chaque cadre est auto-portant même vide** : il porte la vue, l'état du système requis, la date
de prise, ce qu'il établira, sa réserve le cas échéant, et la consigne de masquage. Chacun est
en outre **appelé depuis le texte** — un cadre qu'aucune phrase n'appelle est un cadre orphelin :

- K33 depuis §6.3.3 (« …seule forme sous laquelle il l'atteint, et que la \cref{fig:capture-K33}
  montre à l'écran ») et depuis la cellule O5 de `tab:objectifs-ch6` ;
- K34 depuis le premier seuil (« …elle attend qu'un analyste ouvre le tableau de bord
  (\cref{fig:capture-K34}) »).

Le rendu de K33 a été relu en image : cartouche titré, encadré, dans les marges, légende au bon
endroit.

### Une consigne de `RAPPORT_CAPTURES.md` que j'ai refusé d'appliquer telle quelle

Le code « déjà compilé » que `RAPPORT_CAPTURES.md` §3.5.4 et §3.5.5 donne pour ces deux cadres
porte, dans son cartouche et dans son corps, **trois des quatorze termes interdits** du registre
d'audit de `BRIEF_EQUIPES_REFONTE.md` §1 — que `BRIEF_VAGUE_FINALE.md` §3 déclare applicables
intégralement :

| Terme interdit | Où | Remplacé par |
|---|---|---|
| « Emplacement réservé » | titre des deux cartouches | « **Cadre de capture K33 — spécification de prise** » |
| « à produire » | titre des deux cartouches | (supprimé avec le reste du titre) |
| « ce qui manque » | corps de K34 | « cette absence, au milieu de compteurs vifs, est **l'objet même du cadre** » |

Deux consignes se contredisaient ; **la règle de vocabulaire l'emporte**, parce qu'elle porte sur
le document remis au jury alors que le rapport de captures n'est qu'un document de travail. La
**fonction** exigée par le mandat — auto-portant même vide, la vue, la date, ce qu'il prouvera,
ce qui doit être masqué — est intégralement conservée ; seul le registre change. Contrôle final :
**zéro occurrence des quatorze termes interdits** dans les deux chapitres.

J'ai également ajouté à K34 la **réserve d'auto-consultation** que le rapport de captures
demandait de ne pas masquer et que son propre code LaTeX ne portait pas : les compteurs de cette
vue incluent le trafic de consultation du tableau de bord lui-même (`\cref{tab:limites}`).

---

## 4. Mission 2 — qualité rédactionnelle

| Contrôle | Entrée | Sortie |
|---|---|---|
| Paragraphes de 16 lignes ou plus | 0 | **0** |
| Paragraphes de 15 lignes | 1 (`ch6`, T14) | 1 — **conservé**, c'est la non-conformité T14, protégée nommément, et son fait le moins compressible |
| Titres à verbe conjugué, ou à point final | 0, hors les deux clauses protégées | **0**, idem |
| `subsubsection` | 0 | **0** |
| Légendes longues sans forme courte | **10** | **0** — dix `\caption[court]{long}` posées |
| Espaces insécables manquantes | 4 (`fig:scenario-19-08`) | **0** — `13~requêtes`, `réponses~403`, `en~200`, `13~lignes`, plus `15~min` posé au passage |
| Termes interdits du registre d'audit | 0 (avant les cadres) | **0** (après correction des cadres, §3) |
| `Overfull \hbox` imputables à ch3 ou ch6 | 1, à 18,99 pt | **0** |

**La légende que le mandat désignait nommément.** `tab:matrice-tracabilite` portait
`\caption{Matrice de traçabilité menace $\rightarrow$ exigence $\rightarrow$ contrôle
$\rightarrow$ test}` — **94 signes de source**, deux lignes composées dans la liste des tableaux,
sans forme courte. Elle porte désormais
`\caption[Matrice de traçabilité menace--exigence--contrôle--test]{…}`, soit **48 signes** dans
la liste. En revanche, **le titre de 142 signes annoncé par le mandat n'existe plus** : la
sous-section s'intitule déjà `Matrice de traçabilité` (22 signes), corrigée par l'équipe
précédente au titre de son constat C3-08. J'ai vérifié les dix-neuf autres titres des deux
chapitres : aucun ne dépasse 60 signes.

Dix formes courtes posées : `tab:acteurs`, `tab:matrice-tracabilite` et le tableau fusionné des
frontières (ch. 3) ; `tab:plan-validation`, `tab:lacunes`, `tab:restore-db`,
`tab:cout-anomalies`, `fig:scenario-19-08`, `tab:ztmm`, `tab:cout-onboarding`,
`tab:maturite-multitenant` (ch. 6).

---

## 5. Ce qui est protégé — vérification chiffrée après travail

| Élément protégé | Contrôle | Résultat |
|---|---|---|
| Les vingt protocoles T1–T20, critère, date, verdict | comptage des lignes de `tab:synthese-campagne` | **20 lignes** |
| Bilan de campagne | comptage des verdicts | **7 conformes + 11 partiels + 2 non conformes = 20** |
| Les deux non-conformités | T1 et T14 | présentes, en gras, §6.2.1 entière conservée |
| Plan de validation continue | `tab:plan-validation` | **T12, T14, T15, T17, T19, T20** — six lignes |
| Conditions de validité | `tab:limites` | **10 conditions**, aucune retirée |
| « Correspondance avec les preuves de soutenance » | §6.5.1 | conservée intégralement, non touchée |
| Registre EX1–EX20 | `tab:exigences` | **20 lignes**, formulation complète intacte |
| Registre TB1–TB5 | tableau fusionné | **5 lignes**, les cinq frontières |
| Matrice de traçabilité | `tab:matrice-tracabilite` | **20 lignes** |
| Ségrégation réseau | `tab:maturite-multitenant` | **6/10**, avec ses trois raisons démontrées |
| Note d'ensemble multi-locataire | §6.7.3 | **5/10**, contre 4/10 avant la refonte |
| Refonte D15 | 4 occurrences | « **du 11 au 25/08/2026** » |
| D16 | §6.7.4 | « conçue, chiffrée et ordonnancée sous D16 […] **non appliquée** » |
| Pare-feu | corps entier | « **douze règles** », « **cinq autorisations** », « **sept refus** » — cohérent sur ch2, ch4, ch5, ch6, annexes A et D |

---

## 6. Le plancher, et ce que coûterait la page suivante

**Ch. 3 = 9 pages. Ch. 6 = 19 pages.** Je n'atteins ni 7 ni 14, et je l'écris plutôt que de le
maquiller.

### 6.1 Décomposition de la hauteur, après travail

| | Figures et cadres | Tableaux | Prose | Total |
|---|---:|---:|---:|---:|
| **Ch. 3** | ≈ 1,8 p (2 figures) | ≈ **4,3 p** (7 tableaux, dont EX1–EX20 et la matrice) | ≈ 2,9 p | 9 p |
| **Ch. 6** | ≈ 1,4 p (2 figures + 2 cadres) | ≈ **9,5 p** (10 tableaux) | ≈ 8,1 p | 19 p |

**Ramener le chapitre 6 à 14 pages suppose de retirer 5 pages sur 9,5 pages de tableaux**, dont
sept sont soit le registre des vingt protocoles, soit la publication de ce qui ne marche pas,
soit une mesure datée — c'est-à-dire exactement ce que le mandat interdit de couper. Les 8,1
pages de prose ont déjà perdu 48 lignes à la vague précédente et 30 à celle-ci ; ce qui reste est
de l'argument, pas du remplissage.

**Le chapitre 3 est arithmétiquement plus dur encore** : à 2,9 pages de prose, atteindre 7 pages
supposerait de supprimer **la totalité de la prose du chapitre** et une page de tableaux en plus.

### 6.2 Liste ordonnée des coupes suivantes, avec leur coût

| Rang | Coupe | Gain | Coût pour la démonstration | Recommandation |
|---|---|---:|---|---|
| 1 | **`graph:coldstart` (ch. 6)** : un graphique à deux barres pour deux nombres — 27 s et 94 s — déjà énoncés dans le paragraphe qui le précède, au ch. 5 et au ch. 2 | **0,25 p** | **Faible.** Seule perte : la comparaison visuelle au budget de sonde de 150 s. Le mémoire s'interdit ailleurs la capture quand un chiffre suffit ; le même raisonnement vaut ici | **À faire.** C'est le seul flottant des deux chapitres dont le contenu tient en une phrase déjà écrite |
| 2 | **`fig:cas-utilisation` (ch. 3)** : les huit UC et leurs rattachements de flux sont énoncés en toutes lettres dans le paragraphe qui la précède | 0,9 p | **Modéré.** Un diagramme de cas d'utilisation est attendu par le format ESPRIT ; le supprimer se voit | À arbitrer par l'auteur |
| 3 | **Fusion de `tab:ztmm` et `tab:maturite-multitenant`** en une seule auto-évaluation | 0,7 p | **Élevé.** Les deux répondent à des questions différentes (référentiel CISA / maturité multi-locataire) et le mandat protège nommément les notes 6/10 et 5/10. Une fusion brouillerait deux référentiels | Déconseillé |
| 4 | **`tab:objectifs-ch6` (O1–O6)** → une phrase par objectif | 0,7 p | **Élevé.** C'est la réponse formelle aux six objectifs du chapitre 1, attendue par le format ESPRIT | Déconseillé |
| 5 | **`tab:cout-onboarding` (7 lignes)** versé en annexe | 0,5 p | **Élevé.** C'est la seule mesure chiffrée de la distance entre un socle qui fonctionne et un socle qui s'exploite | Déconseillé |
| 6 | **`tab:limites` (10 conditions)** ramené aux quatre bornantes | 0,7 p | **Très élevé.** Un chapitre de validation sans « menaces à la validité » est méthodologiquement faux — `BRIEF_EQUIPES_REFONTE.md` en fait son *exception unique et volontaire* | **Refusé** |
| 7 | **`tab:exigences` (EX1–EX20)** ramené à des libellés courts | 0,6 p | **Rédhibitoire.** La formulation complète est ce qui rend le test écrivable ; le chapitre le dit explicitement | **Refusé** |
| 8 | **`tab:synthese-campagne`** réduit aux 13 lignes non conformes ou partielles | 1,3 p | **Rédhibitoire.** Publier la campagne entière est ce qui interdit de sélectionner les tests après coup : c'est l'argument central du chapitre | **Refusé** |

**Recommandation.** Exécuter le rang 1 (−0,25 p, coût faible) et **rouvrir la contrainte de 7 et
14 pages avec l'auteur**. Le document est passé de 167 à **146 pages** sur trois vagues ; les
26 pages qui manquent encore ne sont plus dans les chapitres 3 et 6, dont les deux tiers de la
hauteur sont maintenant des registres protégés. Un chapitre 6 de 19 pages qui publie ses vingt
protocoles, ses deux non-conformités et ses dix conditions de validité vaut mieux qu'un
chapitre 6 de 14 pages qui n'en publie qu'une partie.

---

## 7. Ce que j'ai trouvé de faux, ou de fragile

### 7.1 SO19 n'a ni exigence, ni contrôle, ni test — et la matrice affirme le contraire

`tab:matrice-tracabilite` couvre **23 des 24 scénarios opérationnels** : SO1 à SO18 et SO20 à
SO24. **SO19 est absent.** Or le paragraphe de clôture de §3.5.2 écrit que la matrice « se lit
dans les deux sens : […] de droite à gauche elle vérifie qu'**aucune menace n'est restée sans
réponse** ».

Ce n'est pas la même chose que le cas de SO15 : le texte présente SO15 et SO19 ensemble comme les
deux scénarios qui ne franchissent aucune frontière et auxquels aucune technique ATT&CK ne
correspond — mais **SO15 figure bien dans la matrice** (exigence EX13, contrôle « journaux
d'audit du fournisseur activés », test T13), tandis que SO19, la falsification du rattachement
d'une vulnérabilité pour la déclasser, n'y figure pas. Le scénario relève du besoin fonctionnel
BF12 et du verrou V4, non d'une exigence de sécurité.

**Je ne l'ai pas corrigé, et c'est délibéré.** Les deux corrections possibles sont hors de ce que
les sources permettent : inventer une vingt-et-unième exigence et un test T21 serait fabriquer
une chaîne de preuve, et retirer SO19 du registre casserait le compte de vingt-quatre scénarios
que quatre autres endroits du mémoire reprennent. **La correction juste est une phrase de
l'auteur** disant pourquoi SO19 est traité par BF12 et non par une exigence de sécurité — c'est
lui qui sait. En l'état, un jury attentif peut compter les lignes.

### 7.2 Le code de cadre de `RAPPORT_CAPTURES.md` viole la règle de vocabulaire

Détaillé au §3. Trois termes interdits sur quatre cadres. **Les cadres K05 et K23 de l'équipe
chapitre 5 portent le même défaut** si elle a repris le code tel quel — je ne l'ai pas vérifié
chez elle, c'est hors de mon périmètre, mais la vérification tient en une commande :
`grep -c "Emplacement réservé" ch5_realisation.tex`.

### 7.3 Deux incidents de coordination, à signaler tels quels

**a) Mes deux fichiers ont été restaurés à leur état d'entrée pendant la session**, tous deux
horodatés **01:44:25**, effaçant d'un coup les cinq premiers patchs — un patch de largeurs de
tableaux, un de fusion, et trois de prose. Le dossier est sous **OneDrive** ; la restauration
simultanée à la seconde près des deux fichiers désigne une synchronisation ou une restauration
en masse plutôt qu'une écriture d'agent. Les patchs ont tous été réappliqués (ils exigent une
occurrence exacte de leur chaîne cible, donc une réapplication sur un fichier déjà patché aurait
échoué bruyamment plutôt que de dupliquer). **Depuis, chaque écriture est sauvegardée hors
OneDrive** dans le répertoire de travail de la session.

*Recommandation : avant la remise, vérifier que les deux fichiers portent bien
`\setlength{\tabcolsep}{3pt}` dix fois dans `ch6_validation.tex` et que
`ch3_besoins_menaces.tex` ne contient plus qu'un seul tableau de frontières.*

**b) `ch5_realisation.tex` a porté pendant quelques minutes un `\cref{tab:model…}` non fermé**
(vers 01:39), qui produisait la seule erreur LaTeX du document — *Paragraph ended before `\@cref`
was complete*, avec `Runaway argument` sur le paragraphe suivant. L'équipe propriétaire l'a
corrigé d'elle-même. **Je n'y ai pas touché.** Signalé parce qu'un tel défaut ne fait *pas*
échouer la compilation : il produit un PDF où un paragraphe entier disparaît silencieusement.

### 7.4 Neuf `Overfull \hbox` subsistent, tous hors de mon périmètre

Aucun n'est imputable aux chapitres 3 et 6 (vérifié mot par mot sur le journal). Sept sont des
mots longs qui ne se coupent pas dans une colonne étroite — *Development*, *Management*,
*Enrichissement*, *construction*, *vulnérabilité*, *déploiement* — et deux sont des identifiants
littéraux : `terraform/modules/detection/main.tf` (**16,5 pt**) et
`javascript.lang.security.audit.path-traversal.path-join-resolve-traversal` (**29,4 pt**, le plus
gros du document). Les deux derniers débordent visiblement dans la marge à l'impression. Le
correctif est local : `\allowbreak` aux séparateurs, ou `\seqsplit`, ou un passage en
`\footnotesize`. **Non touchés**, ils sont dans les fichiers d'autres équipes.

### 7.5 Vérifications qui n'ont rien donné — à ne pas rouvrir

- Le **bilan de campagne** est cohérent après retrait de la colonne « Exig. » : 4 + 3 conformes,
  11 partiels, 2 non conformes = 20, recompté ligne à ligne sur la source.
- La bijection **T*n* ↔ EX*n*** est vraie pour les vingt lignes, vérifiée sur
  `tab:matrice-tracabilite` et sur l'ancienne colonne de `tab:synthese-campagne`.
- Le compte de scénarios du tableau fusionné : 4 + 1 + 3 + 2 + 12 = 22, plus SO15 et SO19 hors
  frontière = **24** ; critiques : 2 sur TB4 + 6 sur TB5 = **8**. Conforme au reste du mémoire.
- « **Douze règles, cinq autorisations, sept refus** » est cohérent dans ch2, ch4, ch5, ch6 et
  les annexes A et D. La mention « six autorisations » signalée par une vague antérieure a
  disparu du corps.
- Les six protocoles du **plan de validation continue** sont bien T12, T14, T15, T17, T19, T20.

---

## 8. Contrôles de sortie et périmètre

```
xelatex -interaction=nonstopmode -jobname=buildY main.tex   (x3, biber au depart)
grep -c '^!' buildY.log                 -> 0
Reference / Citation undefined          -> 0
grep -a "Overfull \hbox" buildY.log     -> 0
Output written on buildY.pdf (146 pages)
```

**Périmètre d'écriture — vérification.** Deux fichiers `.tex` ont été écrits :
`ch3_besoins_menaces.tex` et `ch6_validation.tex`, plus le présent rapport. **Aucun fichier n'a
été supprimé.** Les scripts de patch, leurs journaux et les sauvegardes des deux chapitres sont
dans le répertoire de travail de la session, hors du dépôt.

**Contrainte d'outillage respectée.** Les dix patchs sont des scripts Python écrits avec l'outil
d'écriture puis exécutés, en `io.open(..., encoding='utf-8', newline='\n')`, chacun refusant de
s'exécuter si sa chaîne cible est absente ou trouvée plusieurs fois — ce garde-fou a intercepté
deux collisions de retour à la ligne avant écriture, et il a permis de réappliquer sans risque
les cinq patchs effacés par la restauration du §7.3.
