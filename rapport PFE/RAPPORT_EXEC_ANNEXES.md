# RAPPORT_EXEC_ANNEXES.md — Annexes, conventions de notation, `main.tex`

**Équipe** : annexes + `frontmatter/conventions.tex` + `main.tex`. **Date** : 29/08/2026.
**Périmètre d'écriture** : `latex/appendices/*`, `latex/frontmatter/conventions.tex`,
`latex/main.tex`. Aucun autre fichier n'a été ouvert en écriture, aucun fichier n'a été supprimé
(vérification au §7).
**Chaîne de compilation** : `xelatex -interaction=nonstopmode -jobname=buildD main.tex`, `biber
buildD`, deux passes. **État final : `grep -c '^!' buildD.log` = 0, `grep -c undefined` = 0,
`Output written on buildD.pdf (155 pages)`.**

Toutes les pages ci-dessous sont **lues sur `buildD.toc` et sur `buildD.pdf`**, jamais estimées ;
la densité de chaque page a été mesurée caractère par caractère (`pdftotext`) pour distinguer une
page pleine d'une page de débordement.

---

## 1. Budget de pages — avant / après, mesuré

| Annexe | Avant (folios) | Avant | Après (folios) | Après | Delta |
|---|---|---:|---|---:|---:|
| A — Études comparatives détaillées | 125–130 | 6 | 117–121 | **5** | −1 |
| B — Extraits techniques de la réalisation | 131–134 | 4 | 122–125 | **4** | 0 |
| C — Modèle de menaces détaillé | 135–139 | 5 | 126–129 | **4** | −1 |
| D — Conception détaillée | 140–143 | 4 | 130–132 | **3** | −1 |
| E — Protocoles et preuves de validation | 144–150 | 7 | 133–138 | **6** | −1 |
| F — Jeu d'évaluation de l'enrichissement | 151–152 | 2 | 139–140 | **2** | 0 |
| **Total A–F** | | **28** | | **24** | **−4** |

Le document entier est passé de 167 à **155 pages** pendant la session, mais une partie de cet
écart appartient aux trois autres équipes qui écrivaient les chapitres en parallèle ; seule la
colonne « Total A–F » mesure mon travail.

> **Écart avec le brief.** Le brief annonce **30 pages** d'annexes avec « F ≈ 4 ». La mesure du
> 29/08 à 18 h 41 sur `buildD.pdf` donne **28 pages** et **F = 2**. L'annexe F se termine au folio
> 152 ; les folios 153–154 comptés par le brief sont le formulaire de dépôt, qui n'est pas une
> annexe. **La cible réelle n'était donc pas −11 mais −9.**

**Cible : 19 pages. Atteint : 24. Plancher déclaré au §5, avec la liste ordonnée des coupes
suivantes et leur coût.**

---

## 2. Mission 1 — Les conventions de notation

`frontmatter/conventions.tex` annonçait dix-sept familles. **Chaque série a été recomptée par
script sur les huit fichiers du corps, les huit annexes et le frontmatter**, en relevant toutes les
occurrences de chaque préfixe et en vérifiant qu'aucun numéro ne manque à l'intérieur d'une série.
Le point d'établissement de chaque famille a été relocalisé à la main, en excluant les simples
annonces de l'introduction générale et de `fig:carte-memoire`.

### 2.1 Les dix-sept lignes, une par une

| # | Préfixe | Série écrite | Série **comptée** | Série écrite désormais | « Introduit au » écrit | Établi au (vérifié) | Écrit désormais |
|---|---|---|---|---|---|---|---|
| 1 | C | C1–C5 | **C1–C5** (5) ✔ | C1–C5 | §1.4 ❌ | §1.3.2 « Cinq carences structurantes » | bandeau **ch. 1** |
| 2 | O | O1–O6 | **O1–O6** (6) ✔ | O1–O6 | §1.5 ❌ | §1.4.2 « Objectifs et critères de succès » | bandeau **ch. 1** |
| 3 | Q | Q1–Q6 | **Q1–Q6** (6) ✔ | Q1–Q6 | §1.5 ❌ | §1.4.1 « Problématique et questions dérivées » | bandeau **ch. 1** |
| 4 | PH | PH0–PH7 | **PH0–PH7** (8) ✔ | PH0–PH7 | §1.5 ✔ | §1.5.3 « Démarche méthodologique » | bandeau **ch. 1** |
| 5 | V | V1–V4 | **V1–V4** (4) ✔ | V1–V4 | concl. ch. 2 ✔ | conclusion du ch. 2, `ch2:986` | bandeau **ch. 2** |
| 6 | A | A1–A11 | **A1–A11** (11) ✔ | A1–A11 | §3.1 ✔ | §3.1.1 | bandeau **ch. 3** |
| 7 | BF | BF1–BF13 | **BF1–BF13** (13) ✔ | BF1–BF13 | §3.2 ✔ | §3.2.1 | bandeau **ch. 3** |
| 8 | BNF | BNF1–BNF7 | **BNF1–BNF7** (7) ✔ | BNF1–BNF7 | §3.2 ✔ | §3.2.2 | bandeau **ch. 3** |
| 9 | TB | TB1–TB5 | **TB1–TB5** (5) ✔ | TB1–TB5 | §3.3 ✔ | §3.3.1 | bandeau **ch. 3** |
| 10 | SO | **SO1–SO18** ❌ | **SO1–SO24** (24) | **SO1–SO24** | §3.4 ✔ | §3.4 « Scénarios opérationnels » | bandeau **ch. 3** |
| 11 | EX | EX1–EX20 | **EX1–EX20** (20) ✔ | EX1–EX20 | §3.5 ✔ | §3.5.1 | bandeau **ch. 3** |
| 12 | PR | PR1–PR4 | **PR1–PR4** (4) ✔ | PR1–PR4 | §4.1 ✔ | §4.1 | bandeau **ch. 4** |
| 13 | F | F1–F7 | **F1–F7** (7) ✔ | F1–F7 | §4.3 ✔ | §4.3 « Vue dynamique » | bandeau **ch. 4** |
| 14 | D | **D00–D14** ❌ | **D00–D16** (17) | **D00–D16** | **§4.8** ❌ (le ch. 4 n'a que 7 sections) | §4.7.1 « Registre des décisions » | bandeau **ch. 4** |
| 15 | É | É1–É11 | **É1–É11** (11) ✔ | É1–É11 | **§4.9** ❌ (section inexistante) | §4.7.3 | bandeau **ch. 4** |
| 16 | R | R1–R7 | **R1–R7** (7) ✔ | R1–R7 | **§5.5** ❌ (= enrichissement sémantique) | §5.4 « Chaîne de détection » | bandeau **ch. 5** |
| 17 | T | T1–T20 | **T1–T20** (20) ✔ | T1–T20 | §6.2 ✔ | §6.2 « Résultats de la campagne » | bandeau **ch. 6** |

**Bilan : huit valeurs fausses sur sept lignes** (D en portait deux : la série *et* la section).
Le titre du constat C-7 de `RAPPORT_REDONDANCES.md` dit « fausse sur huit lignes sur dix-sept » ;
son propre tableau en liste huit *erreurs* réparties sur **sept** lignes. La correction porte donc
sur sept lignes, et les dix autres séries sont confirmées justes après recomptage.

### 2.2 Ce qui a été ajouté, et pourquoi

- **Dix-huitième ligne : L1–L7, niveaux du modèle en couches.** La famille est employée dans tout
  le chapitre 4, dans `tab:conception-couches`, dans l'annexe B (« les niveaux L1--L7 ») et dans la
  colonne « Couche(s) » de l'annexe D — mais elle ne figurait dans aucune légende. Un lecteur de
  l'annexe D voyait « L1, L5 » sans clé. Elle est ajoutée, et le brief demande de le signaler :
  **le mémoire compte désormais dix-huit familles, pas dix-sept.**

### 2.3 La colonne « Introduit au » a disparu

Les huit erreurs venaient toutes de **numéros de section écrits à la main**, qui dérivent à chaque
réorganisation. Or les chapitres 3 et 4 sont en cours de restructuration par deux autres équipes
au moment où j'écris (`ch3` a déjà fusionné §3.4.1 et §3.4.2 ; la restructuration B-1 de
`RAPPORT_REDONDANCES.md` déplacerait D et É de §4.7 à §4.8). Réécrire les bons numéros aujourd'hui
serait réintroduire le défaut demain.

Un `\cref` par ligne était impossible : **les sections de ch3 et de ch4 ne portent aucun `\label`**
(vérifié : seul §3.3 en a un), et ces fichiers sont hors de mon périmètre d'écriture.

Le tableau est donc **regroupé par bandeaux de chapitre**, chaque bandeau portant un
`\ref{ch:...}` — labels qui existent tous et qui ne peuvent pas dériver. Effets :
- la colonne fragile disparaît, et ses 2,1 cm reviennent à la colonne « Signification » ;
- l'ordre du tableau devient l'ordre de lecture du mémoire ;
- la page reste **une seule page** (folio vi), vérifié après recompilation.

### 2.4 Trois autres faits corrigés sur cette page

1. **« Les jalons du planning (M) » étaient rangés parmi les familles d'annexe.** C'est faux :
   M1–M7 sont établis dans le **corps**, au chapitre 5, avec la figure du planning
   (`ch5:1545`, « les losanges M1 à M7 »). Reformulé.
2. **Les biens supports BS1–BS9 n'étaient nulle part.** Ils n'apparaissent que dans l'annexe C
   (vérifié : zéro occurrence dans les chapitres). Ajoutés à la phrase des familles d'annexe, avec
   leurs bornes.
3. **Collision de préfixe non signalée.** L'annexe C emploie **V1–V4 pour la vraisemblance** et
   **G1–G4 pour la gravité**, alors que V1–V4 désigne déjà les quatre verrous de l'état de l'art.
   Les deux séries coexistent dans le même document sans que rien ne le dise. La page le dit
   maintenant, avec le critère de désambiguïsation (le contexte est une case de la cartographie).
4. Le dernier numéro écrit à la main de la page — « la section 2.6 » — est remplacé par
   `\cref{sec:trente-trois-briques}`.

---

## 3. Mission 2 — L'annexe G, et l'annexe H

### 3.1 Décision : l'annexe G reste hors document

`annexe_g_glossaire.tex` contient neuf définitions réelles, n'était appelée par aucun `\input`, et
`main.tex:70` affirmait pourtant : *« le glossaire technique complémentaire […] devient l'annexe
G »*. **`main.tex` est corrigé** ; le fichier est conservé, et son en-tête porte désormais
l'argument complet. Trois raisons, dans l'ordre où elles pèsent :

1. **Fonction.** Une annexe porte le matériel de reproduction que le corps ne doit pas alourdir.
   Les neuf termes ne servent **aucune reproduction et aucune vérification** : ils sont tous
   définis *in situ*, à leur première occurrence dans le corps (chaîne d'attaque, dérive de
   configuration, empreinte de contenu au ch. 5 ; fédération d'identité, micro-segmentation, point
   d'application de politique au ch. 4 ; modèle non génératif, montée à zéro, similarité sémantique
   aux ch. 2 et 4). Ce glossaire **redit le corps au lieu de le compléter** — exactement le critère
   de retrait posé par le brief.
2. **Budget.** Il coûte une page pleine, à financer sur du matériel que le brief protège
   nommément : protocoles T1–T20 avec leur critère et leur date, statuts d'exigences,
   non-conformités. Le budget des annexes n'est déjà pas tenu (24 pour 19).
3. **Coût de réintégration.** **Aucun fichier du corps ne cite `\ref{ann:glossaire}`** (vérifié sur
   les huit chapitres, le frontmatter et `main.tex`). Une annexe qu'aucun renvoi n'appelle est
   précisément le défaut qu'un jury repère ; la rendre utile supposerait d'ajouter un renvoi dans
   six fichiers appartenant à trois autres équipes, ce soir.

**Condition de réouverture, écrite dans l'en-tête du fichier.** Si la coupe A-4 de
`RAPPORT_REDONDANCES.md` est appliquée — retrait des onze lignes de glossaire de
`ch4_conception.tex:1495–1505` au profit de cette annexe —, la décision doit être reprise : le
glossaire cesserait de redire le corps et deviendrait le seul endroit où quatre termes sont
définis. **Dans ce cas seulement**, rétablir l'`\input` et financer la page.

### 3.2 Annexe H

`annexe_h_captures.tex` est déjà démontée, correctement : le fichier ne contient qu'un en-tête qui
retrace la redistribution de son contenu, et **rien dans `main.tex` ne l'annonçait**. Vérifié
également qu'aucun `\ref{ann:captures}` ne subsiste dans le corpus. **Le commentaire de `main.tex`
dit maintenant explicitement qu'il n'y a ni annexe G ni annexe H**, et pourquoi il ne faut pas les
rétablir sans rouvrir le budget — pour que la prochaine vague ne refasse pas l'aller-retour.

`RAPPORT_CAPTURES.md` conclut qu'elle doit rester dehors ; c'est le cas, et rien n'a été touché
dans ce fichier.

---

## 4. Mission 3 — Les coupes, annexe par annexe

Convention : **R** = redondance avec le corps ramenée à un renvoi · **F** = reformulation sans
perte de fait · **T** = densification typographique ou tabulaire · **S** = restructuration ·
**C** = coupe réelle de contenu.

### Annexe A — 6 → 5 pages

| Type | Coupe | Gain |
|---|---|---:|
| R | `A.1.2`, note de la ligne 4 : treize lignes ré-exposaient la refonte réseau (plan d'adressage, refus croisés, refus par défaut) établie en `subsec:reseau-cible`. Ramenées à huit, avec `\cref`. Le fait propre à l'annexe — *le verdict n'a pas bougé mais sa raison a changé du tout au tout* — est conservé intact. | 5 l. |
| R | `A.2.1`, précision sur l'isolation réseau : même mécanisme, onze lignes → huit, avec `\cref`. | 3 l. |
| R | Encadré final de `A.3` : les 612 / 606 règles chargées les 20 et 24/08 sont **déjà publiées en `ch5:349`**. Le raisonnement est conservé, la mesure devient un renvoi. | 5 l. |
| F | `A.1.1`, `A.1.2` « Lecture du tableau », chapeaux de `A.2` et `A.3` : reformulations. | 12 l. |
| T | `tab:fiche-versions` : `\footnotesize` → `\scriptsize`, `tabcolsep` 4 → 3 pt, colonne 2 élargie. Trois cellules réseau qui recopiaient `tab:adressage-cible` et `tab:regles-cibles` ramenées au périmètre d'une fiche de version (version + mode de verrouillage). | ≈ 0,6 p. |

**Plancher A.** Les trois sections restantes sont toutes citées depuis le corps —
`ann:modes-execution`, `ann:etudes-comparatives-plateforme`, `ann:fiche-versions` depuis `ch2`,
`ann:etudes-comparatives-ch1` et `tab:positionnement-15-complet` depuis `ch1` — et
`tab:positionnement-15-complet` n'existe nulle part ailleurs. **Rien ne peut y être coupé sans
casser un renvoi du corps.**

### Annexe B — 4 → 4 pages (plancher atteint)

| Type | Coupe | Gain |
|---|---|---:|
| S | Dix sections ramenées à **trois**. Les intitulés supprimés deviennent des amorces en gras : aucun extrait n'est perdu, aucun n'est réordonné, et la table des matières perd sept lignes. | ≈ 0,3 p. |
| S | `tab:ann-securite-etat` remonté en B.1, section à laquelle il se rapporte (l'état du dépôt d'infrastructure). | — |
| T | Neuf encadrés `extraitconf` resserrés par options de boîte ; tableau d'état en `\footnotesize`. | ≈ 0,15 p. |
| F | Chapeau, commentaire du découpage, clôture de la vue du tableau de bord. | 6 l. |

**Plancher B, atteint et documenté.** B est du **matériel de reproduction pur** : neuf extraits de
code, tous commentés par le chapitre 5 sans y être reproduits. Le seul élément non-extrait,
`tab:ann-securite-etat`, est **explicitement appelé par le corps** (`ch5` : « cinq mesures
détaillées en annexe~\ref{ann:extraits-realisation} ») ; le supprimer casserait un renvoi dans un
fichier hors de mon périmètre. La dernière page ne porte que le dernier extrait et sa clôture :
la faire disparaître exige de retirer un extrait, c'est-à-dire une coupe réelle.

### Annexe C — 5 → 4 pages

| Type | Coupe | Gain |
|---|---|---:|
| T | `tab:echelles` : dix lignes empilées (bandeau Gravité + 4, bandeau Vraisemblance + 4) ramenées à **quatre lignes en vis-à-vis**, gravité et vraisemblance côte à côte. Les huit critères sont conservés mot pour mot. | ≈ 0,35 p. |
| T | `tab:scenarios-operationnels` : neuf colonnes → **sept** (Flux+TB fusionnées, G+V fusionnées), `\small`, `tabcolsep` 4 pt. La colonne de scénario passe de 4,4 à 5,9 cm : moins de lignes repliées sur 24 rangs. **Les 24 scénarios, leurs techniques ATT&CK et leurs cotations sont intacts.** | ≈ 0,45 p. |
| S | Six sections → **trois** (codification + stratégiques + échelles ; opérationnels ; cartographie + traitement). | ≈ 0,15 p. |
| R/F | Chapeau « Rattachement des frontières » : la règle générale est énoncée au ch. 3 ; l'annexe garde les deux précisions qui lui sont propres (SO12, SO16). Clôture SO17/SO19 reformulée. | 6 l. |

### Annexe D — 4 → 3 pages, **avec du contenu ajouté**

C'est la seule annexe où j'ai ajouté du contenu tout en gagnant une page.

**Ajouts (corrections factuelles) :**

| Ajout | Motif |
|---|---|
| **D15 et D16** au registre | `ch4:2256` promet que « la justification complète » de chaque décision est reportée en annexe D, et `ch4` compte « dix-sept décisions, de D00 à D16 ». Le registre « complet » s'arrêtait à **D14** : les deux décisions les plus lourdes du projet en étaient absentes. Ajoutées en renvoi au dossier de décision du corps, sans duplication. |
| **T7 conforme** sur la ligne EX7, **T9 partiellement conforme** sur la ligne EX9 | `tab:couverture-exigences` ne nommait de verdict que pour dix-huit protocoles. Sans T7 et T9, un lecteur qui recompte l'annexe D trouve **6 conformes, 10 partiels, 2 non conformes = 18**, en contradiction avec le bilan officiel du chapitre 6 (**7 / 11 / 2 = 20**). Rétablis d'après l'annexe E : les comptes tombent désormais juste. |

**Corrections :**

| Correction | Avant | Après |
|---|---|---|
| Entrée **D11** | « réserve […] sa vérification dynamique (T14, T20) relevant du plan de validation continue » | « réserve, **levée par D15** […] T20 conforme le 24/08/2026, T14 non conforme le 25/08/2026 ». Les deux protocoles ont un verdict depuis la campagne des 20–25/08 ; `ch4:2284` porte déjà « Réserve, levée par D15 ». |
| Chapeau de D.3 | « les protocoles dont le premier passage n'est pas encore intervenu sont inscrits au plan de validation continue » | « les vingt protocoles portent tous un résultat daté ; six sont rejoués à la cadence du plan ». `ch6:48–50` est explicite : **aucun protocole ne porte le résultat *Planifié*.** |

**Gains :**

| Type | Coupe | Gain |
|---|---|---:|
| T | D.1 : dix-sept justifications en paragraphes → **`longtable` à deux colonnes en `\small`**. Levier 3 du brief (prose → tableau quand trois éléments ou plus partagent la même structure) : les dix-sept décisions ont exactement la structure *décision / statut / justification*. Aucune justification n'est raccourcie. | ≈ 0,5 p. |
| T | D.2 : sept paragraphes → `longtable` *composant / motif de rejet / condition de réévaluation*. Les sept conditions de réévaluation, qui sont l'apport propre de l'annexe, sont conservées. | ≈ 0,25 p. |
| T | `tab:couverture-exigences` en `\small`, colonne « Statut » élargie de 9,3 à 10,2 cm. | ≈ 0,2 p. |
| R | Chapeau de l'annexe : il récitait les trois titres de section qui le suivent. | 3 l. |

### Annexe E — 7 → 6 pages

**Rien de protégé n'a été touché** : les vingt protocoles gardent leur action tentée, leur critère
d'acceptation formulé avant exécution, leur attendu, leur résultat, leur date, leur preuve et leur
réserve. Les deux non-conformités T1 et T14 sont intactes, horodatages et adresses compris.

| Type | Coupe | Gain |
|---|---|---:|
| **R** | **Section E.3, « Mesures complémentaires »** : ses deux relevés sont **publiés mot pour mot dans le corps** — 12:16:15 UTC / similarité 0,698 / T1556.003 en `ch6:665–666`, retour arrière 11,6 s et 16,5 s en `ch6:543–544`. Section supprimée ; les deux mesures deviennent un renvoi d'une phrase dans le chapeau. | 9 l. + 1 titre |
| **C** | **Note de masquage** (dix lignes, héritée de l'annexe H démontée) : elle réglait la production de **preuves visuelles**, dont le mémoire ne comporte plus aucune. La règle qui vaut pour toute preuve — *la sortie brute est la preuve, l'image n'en est que la restitution ; masquage par rectangle opaque, jamais par floutage* — est conservée et remontée en E.1, où elle conditionne toute la campagne. Le reste ne servait plus rien. | 6 l. |
| R/F | E.1 « Conditions de mesure » resserrée ; onze protocoles reformulés là où l'annexe restituait la colonne « Preuve invoquée » de `tab:synthese-campagne` (T3, T6, T7, T9, T10, T13, T16, T17, T18, T19, T20). | ≈ 30 l. |
| — | Correction du renvoi faux `annexe_e:26` « (chapitre 5, §5.1.1) » → `\cref{sec:env-travail}` : §5.1.1 est « Frontière entre le code et l'exploitation », la recette est décrite dans le chapeau de §5.1. C'est le constat **C-6** de `RAPPORT_REDONDANCES.md`, resté ouvert. | — |

### Annexe F — 2 → 2 pages (plancher atteint)

| Type | Coupe | Gain |
|---|---|---:|
| R | L'encadré `alertbox` sur le biais d'annotation disait, pour la troisième fois en deux pages, ce que dit déjà la fin de F.1 et la dernière ligne de `tab:resultats-methodes`. Fondu en prose, sans perdre les deux atténuations exigées. | 5 l. |
| F | Clôture « trois questions » et paragraphe de la porte int8 resserrés. | 6 l. |

**Plancher F, atteint et documenté.** F tient sur deux pages dont la première est amputée du tiers
par le titre de chapitre ; pour la ramener à une page il faudrait retirer environ 2 300 caractères,
soit la moitié de l'annexe. Or F est le **protocole d'évaluation de l'objectif O5** : jeu de test,
trois méthodes M0/M1/M2, six grandeurs, et surtout les **conditions de publication énoncées avant
tout relevé**. C'est le seul endroit du mémoire qui démontre que l'auteur s'interdit de publier un
chiffre avant que la condition de validité ne soit réunie ; le couper contredirait le §5 du brief.

---

## 5. Plancher : 24 pages pour 19 demandées

**Ce qui a été essayé et mesuré, et qui ne rapporte rien.** Composer les six annexes en `\small`
(les annexes sont hors du « corps de 40 pages » que la norme ESPRIT impose en Times 12 pt, la
manœuvre était donc licite) : mesuré sur une compilation complète, le document passe de **155 à
156 pages** et l'annexe D **remonte de 3 à 4**, les grands `longtable` déjà en `\small` se coupant
plus mal. **Levier nul, écarté sur mesure et non sur estimation.**

**Les cinq coupes suivantes, par coût croissant pour la démonstration.** Aucune n'a été faite :
elles engagent toutes ce que le mémoire accepte de ne plus démontrer, et le brief réserve cette
décision à l'auteur.

| Rang | Coupe | Gain | Coût |
|---:|---|---:|---|
| 1 | **Fusionner `tab:cartographie-risque` dans `tab:scenarios-operationnels`** (annexe C). La cartographie est un **croisement strict** des colonnes G et V du tableau qui la précède de deux pages : elle n'apporte aucune donnée nouvelle, seulement une mise en forme. | 0,5 p. | Faible, mais réel : `ch3:511` la désigne nommément (« le croisement gravité × vraisemblance, détaillé en annexe C ») et c'est le livrable normalisé de l'atelier 5 d'EBIOS Risk Manager. Un jury qui connaît la méthode l'attend. |
| 2 | **Retirer `tab:echelles`** (annexe C) et reporter les huit critères de cotation en une phrase. | 0,4 p. | Les colonnes G et V des 24 scénarios deviennent illisibles sans leur échelle. |
| 3 | **Retirer un extrait de l'annexe B** — le plus probable étant l'arborescence du dépôt. | 1,0 p. | La norme ESPRIT la dirige explicitement vers l'annexe B (« l'arborescence du dépôt d'infrastructure en texte brut → annexe B »). C'est une coupe contre la norme. |
| 4 | **Réduire `tab:fiche-versions`** (annexe A) aux seules briques dont le mode de verrouillage n'est pas « épinglé ». | 1,0 p. | La fiche cesse d'être une fiche : sa valeur est d'être **exhaustive sur trente-trois briques**, c'est ce qui rend l'affirmation de reproductibilité vérifiable ligne à ligne. |
| 5 | **Supprimer l'annexe F.** | 2,0 p. | Le protocole d'évaluation de O5 disparaît, et avec lui la seule démonstration que l'auteur publie ses conditions de validité *avant* le résultat. C'est la coupe qui casse une chaîne de preuve. |

**Recommandation.** S'en tenir à **24 pages** et arbitrer le dépassement sur le corps, où le
gisement restant est plus large et moins coûteux. Le rang 1 est le seul acceptable sans discussion
avec l'auteur, et il ne rapporte qu'une demi-page. Les rangs 3 à 5 sont des coupes qui retirent
au mémoire une capacité de preuve, pour un gain de quatre pages sur un document de cent cinquante.

---

## 6. Mission 4 — Contrôles

### 6.1 Les points de suspension de l'annexe B : élision volontaire, laissée telle quelle

Les lignes `--exclude-rule=...path-join-resolve-traversal` sont une **élision délibérée du préfixe
d'espace de noms** de l'identifiant de règle, pas une scorie. Vérifié contre la source réelle,
`.github/workflows/ci.yml:96–102` : l'identifiant complet est
`javascript.lang.security.audit.path-traversal.path-join-resolve-traversal`, qui ne tient pas dans
la largeur de l'encadré. **L'élision est conservée**, et l'annexe dit maintenant explicitement ce
qu'elle remplace, avec un exemple déplié.

**En revanche, l'extrait était faux par omission** : il montrait **six** exclusions quand la phrase
qui l'introduit — et le descripteur réel — en comptent **sept**. La septième,
`...express-path-join-resolve-traversal`, est rétablie. Les deux premières se ressemblent
justement parce que l'élision efface ce qui les distingue (`javascript.express.…` contre
`javascript.lang.…`), ce que l'exemple déplié permet maintenant de comprendre.

### 6.2 `longtable` sans légende suivi de `\addtocounter{table}{-1}`

Contrôle par script sur les huit annexes, `conventions.tex` et `main.tex` : **deux `longtable` sans
`\caption`** dans le corpus, `conventions.tex:28` et `annexe_g_glossaire.tex`, et **les deux
portent bien le décrément**. Aucun `longtable` **avec** légende ne porte de décrément parasite —
l'erreur symétrique, qui décalerait la numérotation dans l'autre sens. Le compteur de tableaux est
juste. Les cinq `longtable` que j'ai créés ou remaniés portent tous une `\caption`.

### 6.3 Légendes longues

**Sept légendes de plus de 60 caractères n'avaient pas de forme courte** : trois en annexe A, deux
en C, deux en D. Toutes reçoivent un `\caption[court]{long}`. La liste des tableaux ne porte plus
de légende débordante. Contrôle final : **zéro légende longue sans forme courte** dans mon
périmètre.

### 6.4 Espaces insécables

Contrôle automatique sur les unités (`min`, `s`, `ms`, `h`, `Go`, `%`, `euros`, `bits`) : **aucune
occurrence fautive**, le corpus était propre. Trois codes de retour étaient en revanche liés à leur
verbe par une espace sécable et pouvaient se couper en fin de ligne : `code 204`, `erreur 403`,
`code 200` en annexe E — corrigés en `code~204`, `erreur~403`, `code~200`. Les codes ajoutés dans
mes réécritures (`403`, `302`, `422`, `429`) portent tous leur insécable.

### 6.5 Titres

Les dix-huit titres de section des six annexes et les six titres de chapitre ont été relus : **tous
des groupes nominaux**, sans verbe conjugué et sans point final. Les titres créés par les fusions
respectent le parallélisme de leur niveau (« Codification, scénarios stratégiques et échelles de
cotation » / « Scénarios opérationnels » / « Cartographie et traitement du risque »).

---

## 7. Ce que j'ai trouvé de faux dans le mémoire

Les points 1 à 8 sont **corrigés** (dans mon périmètre). Les points 9 à 13 sont **hors de mon
périmètre d'écriture** et signalés aux équipes concernées.

| # | Constat | Où | État |
|---|---|---|---|
| 1 | « SO1–SO18 » alors qu'il y a **vingt-quatre** scénarios opérationnels, tous présents et listés en annexe C. Un jury qui compte les scénarios conclut qu'il en manque six. | `conventions.tex` | **corrigé** |
| 2 | « D00–D14 » alors que le registre en compte **dix-sept**, D00 à D16. | `conventions.tex` | **corrigé** |
| 3 | Deux renvois vers des **sections qui n'existent pas** : « §4.8 » pour D et « §4.9 » pour É, alors que le chapitre 4 n'a que sept sections. | `conventions.tex` | **corrigé** |
| 4 | Quatre renvois de section faux : C au §1.4 (c'est §1.3), O et Q au §1.5 (c'est §1.4), R au §5.5 — qui est l'enrichissement sémantique — au lieu de §5.4, la chaîne de détection. | `conventions.tex` | **corrigé** |
| 5 | Le registre « **complet** » des décisions s'arrêtait à **D14** : D15 (refonte réseau appliquée) et D16 (isolation des données) manquaient, alors que `ch4:2256` promet que la justification complète de *chaque* décision est reportée en annexe D. | `annexe_d` | **corrigé** |
| 6 | L'entrée **D11** décrivait sa vérification (T14, T20) comme « relevant du plan de validation continue » : les deux ont un verdict depuis la campagne des 20–25/08, et `ch4:2284` porte déjà « réserve levée par D15 ». Le chapeau de D.3 portait la même affirmation périmée, que `ch6:48–50` contredit explicitement. | `annexe_d` | **corrigé** |
| 7 | **Le tableau de couverture des exigences contredisait le bilan de campagne du chapitre 6.** Les lignes EX7 et EX9 ne portaient aucun verdict : on y comptait 6 conformes / 10 partiels / 2 non conformes = **18**, contre le bilan officiel 7 / 11 / 2 = **20**. | `annexe_d` | **corrigé** (T7 conforme, T9 partiel) |
| 8 | L'extrait d'exclusions de l'annexe B montrait **six** règles là où sa propre phrase d'introduction, et le descripteur réel, en comptent **sept**. | `annexe_b` | **corrigé** |
| 9 | **Trois comptes irréconciliés pour les mêmes ordres SQL d'isolation** : « dix ordres dont six révocations » (`ch4:788`, `ch5:1367`, `ch6:952`), **huit** dans l'extrait de l'annexe B, « **sept** ordres » dans `tab:cout-onboarding` (`ch6:908`). C'est le constat C-17. J'ai fait ce que mon périmètre permet : **l'annexe B déclare désormais son extrait partiel** et nomme le compte du corps. Il reste à réconcilier `ch6:908` — sept pour un locataire supplémentaire, dix pour l'accueil du second ? Rien ne le dit. | `ch6` | **ouvert** |
| 10 | `\subsection{Composants évalués puis écartés}` de `ch4:2306` porte `\label{tab:composants-ecartes}` : **un label de tableau posé sur une sous-section**. Le renvoi fonctionne (cleveref résout sur le bon compteur) mais le nom ment sur la cible, et l'annexe D le cite. | `ch4` | **ouvert** |
| 11 | Les sections des chapitres 3 et 4 **ne portent presque aucun `\label`** (une seule, `sec:dfd-frontieres`, sur onze sections). C'est la cause racine des huit erreurs de la page de conventions et des renvois écrits à la main que C-6 recense. Tant que ces labels n'existent pas, tout renvoi vers ch3 ou ch4 depuis une autre partie du mémoire doit être écrit à la main, donc dérivera. | `ch3`, `ch4` | **ouvert** |
| 12 | Le **plancher de 24 pages contredit la norme ESPRIT**, qui fixe elle-même les annexes A–F à « 30 à 40 » pages (`plan/NORME_ESPRIT_parametres_et_conformite.md`, l. 362) et qui dirige explicitement vers les annexes la grille des 41 critères, le tableau à quinze critères, l'arborescence du dépôt, le gabarit de fiche de test et les protocoles des vingt tests. La contrainte de la vague (19 pages) et la norme tirent en sens contraires ; l'écart mérite d'être arbitré par l'auteur plutôt que subi. | — | **à arbitrer** |
| 13 | Le constat C-7 de `RAPPORT_REDONDANCES.md` annonce « huit lignes fausses sur dix-sept » ; son propre tableau liste huit **erreurs** réparties sur **sept** lignes (la ligne D en porte deux). Détail, mais il figure dans le rapport qui sert de contrat à trois équipes. | `RAPPORT_REDONDANCES.md` | signalé |

---

## 8. Vérification — périmètre et intégrité

**Fichiers écrits, et eux seuls :**

```
rapport PFE/latex/appendices/annexe_a_etudes_comparatives.tex
rapport PFE/latex/appendices/annexe_b_extraits_realisation.tex
rapport PFE/latex/appendices/annexe_c_modele_menaces.tex
rapport PFE/latex/appendices/annexe_d_conception_detaillee.tex
rapport PFE/latex/appendices/annexe_e_protocoles_tests.tex
rapport PFE/latex/appendices/annexe_f_evaluation_semantique.tex
rapport PFE/latex/appendices/annexe_g_glossaire.tex      (en-tête seul)
rapport PFE/latex/frontmatter/conventions.tex
rapport PFE/latex/main.tex                               (commentaire seul, 4 lignes)
rapport PFE/RAPPORT_EXEC_ANNEXES.md                      (ce fichier)
```

- **`annexe_h_captures.tex` n'a pas été touchée.** Elle figure en ` M` dans `git status` : elle
  l'était déjà à l'ouverture de la session, du fait d'une vague antérieure.
- **`main.tex` : diff vérifié ligne à ligne.** Ma seule modification est le bloc de commentaire de
  l'en-tête des annexes (4 lignes remplacées par 4 lignes). Le reste du diff par rapport à `HEAD`
  provient des vagues précédentes (dédicace, ajout de `conventions`, retrait de
  `\listofgraphiques`, retrait des `\input` de G et H). Le fichier a été sauvegardé avant l'essai
  de mesure en `\small` et restauré à l'identique après.
- **Aucun fichier supprimé.** Les annexes G et H restent sur le disque, avec en tête la raison
  écrite de leur mise hors document.
- Tous les patches ont été appliqués par **script Python** écrit avec l'outil `Write` puis exécuté,
  chaque motif de remplacement étant vérifié unique avant écriture, avec
  `io.open(..., encoding='utf-8', newline='\n')`. **Aucun `sed`, `perl`, `echo` ni heredoc n'a
  produit de LaTeX.**

**Compilation finale**, chaîne complète (`xelatex`, `biber buildD`, deux passes) :

```
grep -c '^!' buildD.log        →  0
grep -c undefined buildD.log   →  0
Output written on buildD.pdf (155 pages)
```

Page « Conventions de notation » : **une page**, folio vi, dix-huit familles, aucun numéro de
section écrit à la main.
