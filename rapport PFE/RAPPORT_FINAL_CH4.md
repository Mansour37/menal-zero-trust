# RAPPORT_FINAL_CH4 — vague finale, chapitre 4 « Conception de l'architecture »

**Périmètre d'écriture** : `latex/chapters/final/ch4_conception.tex` et le présent fichier.
**Aucun autre fichier n'a été ouvert en écriture. Aucun fichier n'a été supprimé.**
**Nom de travail de compilation** : `buildW`. **Date** : 30/08/2026.
Les vingt patchs ont tous été appliqués par script Python
(`io.open(..., encoding='utf-8', newline='\n')`), jamais par heredoc, `sed`, `perl` ou `echo`.
Les scripts sont conservés **hors du dossier OneDrive**, dans le scratchpad de session.

---

## 1. Pages avant / après — mesurées

Chaîne : `xelatex -interaction=nonstopmode -jobname=buildW main.tex`, `biber buildW`, deux passes.
Pages relevées sur `buildW.toc`, en prenant la première page du chapitre suivant comme borne.

| | Avant | **Après** | Gain | Cible de mission |
|---|---:|---:|---:|---:|
| Ch. 4 — Conception de l'architecture | 27 p (p. 40–66) | **25 p** (p. 36–60) | **−2** | 18 |
| Document entier | 154 p | 145 p | −9 | ≤ 120 |

*(Le total du document est une cible mouvante : trois autres équipes écrivent en parallèle et il
est passé de 154 à 153, 152, 150, 147 puis 145 pages au fil de mes compilations. Seule la
**différence** entre les deux bornes du chapitre 4 est imputable à cette équipe.)*

Contrôles de sortie, état final :

```
grep -c '^!' buildW.log        → 0
grep -ac undefined buildW.log  → 0
Output written on buildW.pdf (145 pages)
Overfull \hbox dans ch4        → 1 (0,95 pt, tab:conception-couches)
                                 contre 2 avant (10,91 pt et 4,69 pt)
```

**Le gain de 2 pages est net de l'ajout du tableau de recette des vues (mission 3, ≈ 0,5 page).**
Le travail éditorial représente donc ≈ **−2,5 pages**.

Lignes source : 2 336 → **2 237**. Un flottant supprimé (12 figures → **11**), un tableau ajouté
(8 → **9**), neuf pavés de prose sortis des figures, deux `keybox` fondues dans le paragraphe
qu'elles reformulaient.

---

## 2. Le plancher, et pourquoi 18 pages n'est pas atteignable — mesuré, non estimé

C'est le point le plus important de ce rapport, et il est **mesuré caractère par caractère**, pas
argumenté.

`pdftotext` sur les 25 pages du chapitre renvoie **77 417 caractères**. Densité par page, relevée
page par page :

```
p.36 2624 · 37 2501 · 38 2851 · 39 2653 · 40 3468 · 41 3284 · 42 3046 · 43 3771 · 44 2712
p.45 3503 · 46 3323 · 47 3322 · 48 3332 · 49 2545 · 50 3397 · 51 5454 · 52 2856 · 53 3596
p.54 3095 · 55 2636 · 56 3391 · 57 2265 · 58 3348 · 59 2996 · 60 1448 (dernière page)
```

Une page pleine de prose de ce gabarit porte **≈ 3 400 caractères** ; une page de tableau en
`\footnotesize` monte à 5 454 (p. 51). La moyenne du chapitre est de **3 097 caractères par page**,
soit **91 % de la densité maximale**. Aucune page n'est une page de flottant : **les onze figures
partagent toutes leur page avec du texte** (vérifié au rendu, §5).

**Conséquence arithmétique.** 18 pages à la densité maximale de 3 400 caractères représentent
61 200 caractères. Le chapitre en porte 77 417. **Atteindre 18 pages suppose donc de retirer
16 200 caractères, soit 21 % du contenu du chapitre** — pas de la mise en forme, du contenu. Il
n'existe pas 21 % de matière dans ce chapitre qui ne soit ni un registre, ni une date, ni un
critère d'acceptation, ni une réserve, ni une démonstration.

**Plancher atteint sans casser de chaîne de preuve : 25 pages.**

### 2.1 Ce qu'il faudrait faire pour aller plus bas, dans l'ordre, avec son coût

| Rang | Coupe | Gain mesuré ou estimé | Coût pour la démonstration | Verdict |
|---|---|---:|---|---|
| 1 | **Verser les dossiers de décision D15 (§4.2.5, 6 p) et D16 (§4.2.6, 3 p) en annexe D**, en gardant au chapitre la décision, `fig:topologie-cible`, `tab:regles-cibles`, les critères et les réserves | **−6 p** | **Nul.** L'annexe D s'intitule déjà « Conception détaillée » et le chapitre y renvoie explicitement pour « la justification complète » de chaque décision. §4.2 s'intitule « Vues d'architecture » et abrite deux dossiers de décision qui pèsent 9 de ses 12 pages : c'est une erreur de catégorie, déjà relevée par `RAPPORT_REDONDANCES.md` §B-1 | **À faire — hors de mon périmètre** : l'annexe appartient à une autre équipe et porte son propre budget (−11 p). **C'est le seul chemin qui mène ch4 à 19 pages.** |
| 2 | Retirer `fig:topologie-reseau` (vue de l'état antérieur, 0,60 p) et lui substituer un tableau « avant / après » de cinq lignes (0,35 p) | −0,45 p | **Réel.** C'est la seule image du diagnostic qui justifie D15, et le chapitre l'énonce : « cette vue n'est pas un état des lieux mais le dossier d'instruction de D15 ». Les faits survivent (prose, `tab:adressage-cible`, É2/É4), la démonstration visuelle non | **Non appliqué** — casse une chaîne de preuve pour 0,45 page. Recommandé seulement si le rang 1 est refusé |
| 3 | Fusionner `fig:modele-couches` et `fig:deploiement` (même socle, mêmes produits, deux angles) | −0,32 p | Faible mais réel : la vue fusionnée perd la lisibilité des quatre styles de lien réseau, qui est l'apport propre de `fig:deploiement` (chemin public / privé / managé É11 / journal) | **Non appliqué** — mauvais rapport gain/perte une fois les deux figures ramenées sous 46 % d'une page |
| 4 | Verser `tab:adversaires-donnees` (0,85 p) en annexe D | −0,85 p | **Réel.** C'est le seul endroit du mémoire qui confronte la frontière d'isolation à chaque adversaire, et son argument — « trois circonstances d'exploitation, pas des attaques » — est ce qui justifie D16 | Déconseillé |
| 5 | Ramener `tab:conception-couches` (2,2 p) à ses seules colonnes « Niveau » et « Exigences » | −1,5 p | **Rédhibitoire.** La colonne « Contrôles apportés » est la conception détaillée elle-même ; elle n'existe nulle part ailleurs, l'annexe D ne portant que le registre des décisions, les composants écartés et la couverture des exigences | **Refusé** |
| 6 | Supprimer les points de vigilance L2, L3, L5, L6, L7 | −0,7 p | **Rédhibitoire.** Ce sont cinq réserves nommées — clé sans version, droit d'invocation anonyme, chiffrement non rétroactif, absence d'index vectoriel, quatrième export sans filtre — protégées par le brief | **Refusé** |

**Recommandation au coordinateur** : le rang 1 est le seul geste qui amène le chapitre 4 à sa
cible sans rien perdre, et il demande un arbitrage entre le budget du chapitre et celui de
l'annexe D. Il se conduit en un seul mouvement, par l'équipe qui détient
`appendices/annexe_d_conception_detaillee.tex`.

---

## 3. Les coupes appliquées — nature, localisation, gain

### 3.1 Figures (levier 1 du brief)

| # | Figure | Nature | Contenu | Gain |
|---|---|---|---|---:|
| F-01 | `fig:chronologie-incident` | **fusion** | Ses cinq repères sont les étapes 1, 2, 3, 4 et 6 de `fig:cycle-donnee`, avec les mêmes durées (`RAPPORT_FIGURES` §2.16). La colonne d'horodatage relatif ($t_0$, $t_0+$ qq. s, $t_0+0$ à 5 min, $t_0+\approx15$ min, $+0$ à 10 s) et l'origine $t_0$ entrent dans `fig:cycle-donnee` ; le flottant disparaît | **−0,34 p** |
| F-02 | `fig:modele-donnees` | **allègement** | 20,94 cm → ≈ 15,5 cm. Le Cadre A passe de deux rangées à une rangée compacte ; les **six tables du Cadre B qui ne portent aucun arc** deviennent une ligne de texte renvoyant au `tab:modele-donnees` du chapitre 5 ; le pavé de prose rejoint la légende | −0,24 p |
| F-03 | `fig:delegation-identite` | **allègement** | 17,90 cm → ≈ 10,6 cm. Le pavé de prose rejoint la légende (le plus gros gain unitaire du corpus, −2,98 cm mesuré par l'audit) ; la bande « trois chaînes secondaires » devient une phrase du texte courant, où elle est citable | −0,30 p |
| F-04 | `fig:seq-mfa` | **allègement** | 17,99 cm → ≈ 14,6 cm. Pavé de prose sorti ; la note « limitation de débit à deux niveaux » rejoint le texte de la sous-section, dont elle relevait (elle y apporte les valeurs : 10 requêtes/60 s, bannissement 300 s) ; toute la partie basse remonte de 1,20 cm | −0,15 p |
| F-05 | `fig:seq-refus` | **allègement** | Les deux pavés de bas de figure sortent : l'un dupliquait la légende, l'autre — « encart de mesure » — porte les deux seules mesures datées et **devient un paragraphe du texte courant**, où il est citable | −0,07 p |
| F-06 | `fig:contexte` | **allègement** | Le pavé de dix lignes devient une légende interne de deux traits ; les deux faits qu'il portait seul (dégradation limitée des imports différés, zone de noms consultée avant tout contact) montent dans la prose qui précède | −0,07 p |
| F-07 | `fig:topologie-reseau`, `fig:topologie-cible`, `fig:cycle-donnee`, `fig:plan-identite` | **allègement** | Quatre pavés de prose de plus sortis des figures (contenu versé en légende de flottant ou en texte) | −0,10 p |
| | **Sous-total figures** | | **Neuf pavés « Ce que la figure démontre » retirés — il n'en reste zéro dans le chapitre** | **≈ −1,3 p** |

### 3.2 Tableaux (levier du coordinateur, appliqué avant les coupes réelles)

Les neuf tableaux du chapitre étaient posés sur **12,9 à 14,4 cm** quand `\textwidth` en vaut 16.
Largeurs redistribuées et `\tabcolsep` déclaré à 4 pt là où il ne l'était pas :

| Tableau | Somme `P{}` avant | après | Effet |
|---|---:|---:|---|
| `tab:adressage-cible` | 13,50 cm | **14,70** | + `\tabcolsep` 6 → 4 pt |
| `tab:regles-cibles` | 12,90 | **14,10** | + `\tabcolsep` 6 → 4 pt |
| `tab:adversaires-donnees` | 13,70 | **15,00** | + `\tabcolsep` 6 → 4 pt |
| `tab:recette-vues` | 14,10 | **14,70** | |
| `tab:flux` | 13,60 | **15,10** | |
| `tab:conception-couches` | 13,90 | **14,98** | **supprime les deux `Overfull` de 10,91 pt et 4,69 pt** signalés par l'équipe précédente |
| `tab:matrice-identites` | 14,40 | **15,10** | |
| `tab:registre-decisions` | 13,90 | **15,10** | |
| `tab:ecarts-implementation` | 14,20 | **14,59** | |

**Gain mesuré : ≈ −0,4 p**, plus la disparition d'un débordement de `tab:adressage-cible` sur une
seconde page. C'est moins que la 1,3 page rendue sur le chapitre 6 par la même opération, et la
raison est mesurable : les tableaux du chapitre 4 étaient déjà en `\footnotesize` avec un
`\arraystretch` resserré, et deux d'entre eux (`tab:regles-cibles`, `tab:registre-decisions`) ont
des cellules courtes que l'élargissement ne fait pas remonter d'une ligne.

S'y ajoutent le resserrement des sept cellules « Contrôles apportés » de `tab:conception-couches`
et des cellules de justification de `tab:adressage-cible` et `tab:adversaires-donnees`
(**reformulation, aucun contrôle ni verdict retiré**) : **≈ −0,4 p**.

### 3.3 Prose (leviers 1 et 2 du brief : redondance inter- puis intra-section)

| # | Localisation | Nature | Contenu | Lignes |
|---|---|---|---|---:|
| P-01 | §4.2.5 chapeau | annonce qui récite le sommaire | « Ce qui suit expose donc d'abord le verrou levé, puis… » — le brief §3 l'interdit | −4 |
| P-02 | §4.2.5 `keybox` « Le verrou réseau » | **redondance intra-section** | L'encadré reformulait le paragraphe qui le précédait immédiatement. Fondu dans ce paragraphe, **sans perte d'un seul fait** ; l'encadré et son cadre disparaissent | −12 |
| P-03 | §4.2.5 `keybox` « La conséquence la plus structurante » | **redondance intra-section** | Idem : le coût marginal nul est fondu dans le paragraphe de coût qui la précède | −9 |
| P-04 | §4.2.5 « L'ordre de la migration » + « Deux propriétés » + « Un dernier point » | reformulation | Trois paragraphes courts fondus en un | −14 |
| P-05 | §4.2.5 « Trois lectures », alertbox, « Ce que la refonte ne ferme pas » | reformulation | **Les cinq limites sont conservées, T14 comprise** | −12 |
| P-06 | §4.2.6 `keybox` « Test d'admission » | **structure** | Le test reste un **critère opposable**, énoncé en trois questions numérotées dans le texte plutôt que dans un encadré qui coûte son cadre | −8 |
| P-07 | §4.2.6 (tout) | reformulation | 7 blocs densifiés ; **aucune date, aucun chiffre, aucune réserve retirés** — 32 min 45 s, 08/08/2026, 19/08/2026, les trois circonstances d'exploitation et la réserve d'énumération des attributs de rôle sont intactes | −26 |
| P-08 | §4.5 « Points de vigilance » | reformulation | **Les sept réserves L1–L7 sont conservées**, T14 et son relevé de 412 ms compris | −16 |
| P-09 | §4.1, §4.2, §4.2.3, §4.2.4, §4.3, §4.5.1, §4.6, §4.7, conclusion | reformulation | Passe de densification, une idée par paragraphe | −34 |
| | **Sous-total prose** | | | **−135 l ≈ −1,1 p composée** |

### 3.4 Coupe réelle

**Une seule, chiffrée** : le flottant `fig:chronologie-incident` (F-01), **−0,34 page**. Sa
proposition — *le délai est dominé par une attente de cycle, pas par un traitement* — est celle de
`fig:cycle-donnee`, mot pour mot ; ses cinq repères en sont les étapes 1, 2, 3, 4 et 6, avec les
mêmes durées. La colonne d'horodatage relatif qu'elle portait seule, et sa réserve d'échelle
(« les repères 2 et 5 décrivent la configuration, pas une latence mesurée »), sont entrées dans
`fig:cycle-donnee`. Les deux mesures datées qu'elle citait (6 min 15 s le 10/08/2026, ≈ 15 min le
19/08/2026) sont désormais dans le texte de §4.4, une seule fois, avec leur heure UTC et leur
comptage exact.

---

## 4. Mission 3 — les critères de validation de l'état final

`tab:recette-vues` est inséré **en fin de §4.2**, après la dernière vue d'architecture, avec une
légende **au-dessus** et un `\caption[court]{long}`. Il porte six vues, une par ligne :
**contexte, couches, déploiement, topologie cible, plan d'identité, frontières de confiance**.
Quatre colonnes : la vue, le **point de vue et la décision servie**, les **critères de recette
datés avec leur protocole T**, et la **réserve**.

Le raisonnement de sélection de `RAPPORT_FIGURES.md` §4.2 est repris et écrit dans le paragraphe
d'introduction, parce qu'un jury demandera pourquoi six et non dix-huit :

- on ne prononce pas la recette d'un état qu'on a supprimé → `fig:topologie-reseau` écartée ;
- une vue de latence ou de schéma se valide par une mesure ou par une propriété du schéma, non par
  une revue d'architecture → `fig:cycle-donnee` et `fig:modele-donnees` écartées ;
- les vues de comportement illustrent un protocole sans le remplacer → `fig:seq-refus` et
  `fig:seq-mfa` écartées ;
- **`fig:delegation-identite` n'est pas recettable par construction** : elle décrit ce qui *serait*
  atteignable et non ce qui est vérifié — sa réserve est son objet entier.

Les valeurs employées sont celles publiées par le mémoire (T5, T7, T11, T20 conformes ; T4, T6,
T15 partiels ; **T1 et T14 non conformes**). Les deux non-conformités figurent dans le tableau,
en réserve — c'est ce qui le rend crédible. **Aucun chiffre n'a été produit pour ce tableau.**
Coût mesuré : ≈ 0,5 page, financé sur les coupes ci-dessus. Le renvoi est repris dans la
conclusion du chapitre.

---

## 5. Mission 2 — qualité visuelle : ce que chaque trait veut dire, et le rendu regardé

**Les onze figures ont été extraites en PNG à 130–150 dpi et lues une par une.** Compiler sans
erreur ne prouve rien : les quatre défauts corrigés au §5.2 ne produisaient aucun `Overfull`.

### 5.1 La signification décidée, figure par figure

| Figure | Aspect → signification décidée | Légende interne | Bandes de plan | Rendu lu |
|---|---|---|---|---|
| `fig:contexte` | `fluxdonnee` = échange synchrone sur le chemin de la requête · `fluxevenement` = **import différé**, hors du chemin (le pointillé d'origine devient tiret : un import différé est asynchrone, pas une décision) | **ajoutée** | — | ✅ p. 36 |
| `fig:modele-couches` | `fluxdonnee` = traversée d'un saut · `fluxevenement` = collecte des journaux F4 · **`fluxcontrole` = vérification d'identité par L2**, rendue visible et orientée de L2 vers la frontière de couche (elle n'était écrite que dans un libellé tourné à 90°) | **ajoutée** | déjà conforme (cadres L2/L7) | ✅ p. 38 |
| `fig:deploiement` | `fluxdonnee` fin = chemin public · `fluxdonnee` épais = chemin réseau privé · `fluxevenement` = journal F4 · **`fluxcontrole` = chemin managé du fournisseur, admis par l'identité seule (É11)** — les deux derniers **échangent leur aspect** : un journal est asynchrone, une admission par identité est une décision d'autorisation | **ajoutée** (4 aspects, défaut bloquant du corpus) | **ajoutées** : contrôle (L1, L4), données (services, données), observation (L7) | ✅ p. 39 |
| `fig:topologie-reseau` | `fluxdonnee` = flux réseau · `fluxdonnee` épais = sortie effective (accent) · **trait fin gris tireté barré = arc absent**, chemin que le code n'atteste pas | **ajoutée** | panneaux de règles sur `menalplanB` = plan de contrôle | ✅ p. 40 |
| `fig:topologie-cible` | `fluxdonnee` = flux autorisé par identité · **`fluxrefuse` + `croixrefus` = refus réellement opposé par le pare-feu** (E7–E8 / I1–I2) — c'était un tireté bidirectionnel, aspect que la convention réserve à l'asynchrone | **ajoutée** | bloc des règles sur `menalplanB` | ✅ p. 42 |
| `fig:cycle-donnee` | `fluxdonnee` = passage d'étape · `fluxevenement` = branche d'enrichissement · **arc absent** barré | **ajoutée** + définition de $t_0$ + réserve d'échelle | — | ✅ p. 49 |
| `fig:modele-donnees` | patte-d'oie conservée (déjà exemplaire) · **jointure impossible = `croixrefus`** | déjà présente, complétée | Cadres A / B déjà exemplaires | ✅ p. 50 |
| `fig:seq-refus` | `fluxdonnee` = appel synchrone · `fluxreponse` = réponse · `fluxevenement` = message asynchrone · **`fluxrefuse` = le 403** | présente, complétée du fond des bandes | **ajoutées** : données (Client, Périmètre), observation (Journalisation, Entrepôt), contrôle (requêtes planifiées, API) | ✅ p. 51 |
| `fig:plan-identite` | `fluxdonnee` = droit accordé · **`fluxrefuse` + `croixrefus` = interdiction structurante** (elle était en tirets fins gris : un refus doit peser plus qu'un droit, pas moins) · **`lienstructure` tireté = séparation appliquée par le code et non par les autorisations (É9)** | **prose de six lignes remplacée par une clé graphique** | **ajoutées** : identités = contrôle, ressources = données | ✅ p. 55 |
| `fig:delegation-identite` | `fluxdonnee` = étape de la chaîne · **`fluxcontrole` = atteinte d'une ressource par un droit délégué** (elle ne différait de l'étape que par dix points de gris) · `lienstructure` = rattachement · **`fluxsynthese` = le chemin composé, accent unique** | **ajoutée** (3 aspects, défaut bloquant) | — | ✅ p. 56 |
| `fig:seq-mfa` | `fluxdonnee` / `fluxreponse` / **`fluxrefuse` + `croixrefus`**, les quatre refus reprenant la croix de la convention à la place d'un dessin manuscrit | présente, conservée | bandeau `refus` déjà exemplaire | ✅ p. 58 |

**Deux idiomes distincts et déclarés, pour ne pas confondre deux choses différentes** :

1. **`fluxrefuse` + `croixrefus`** (trait épais à l'encre d'accent, barré) = **un refus opposé** —
   un contrôle dit non : 403, 401, refus de pare-feu, interdiction structurante ;
2. **trait fin gris tireté barré de la même croix** = **un arc absent** — le chemin n'existe pas
   dans le système décrit : « chemin que le code n'atteste pas », « arc absent », « jointure
   structurellement impossible ».

La croix est la même dans les deux cas — c'est bien la même idée, *rien ne passe* —, l'épaisseur
et la couleur du trait disent lequel des deux. Les deux sont déclarés dans la légende interne de
chaque figure qui les emploie.

`fig:seq-refus` et `fig:seq-mfa` avaient déjà été traitées : je n'y ai touché que ce qui restait
(bandes de plan, croix manuscrites, pavés de prose).

### 5.2 Quatre défauts trouvés **au rendu**, qu'aucune compilation ne signalait

1. **`fig:modele-couches`** — le nœud « L3 — API de supervision et tableau de bord », qui compte
   quatre lignes et non trois, **recouvrait la bordure haute de L4 et coupait « Cloud Run »**.
   Défaut antérieur à mon intervention. Corrigé : les deux rangées hautes remontent de 0,20 à
   0,26 cm et la bande L2 est recalée sur la nouvelle pile.
2. **`fig:modele-donnees`** — mon propre recalage avait estimé le corps des nœuds à deux lignes
   quand il en fait quatre : `api_keys` **mordait sur le bas de `users` et débordait du Cadre A**,
   et le paragraphe de tête du Cadre B **recouvrait le nœud `detections`**. Corrigé en deux
   passes, en relisant le rendu à chaque fois.
3. **`fig:deploiement`** — la légende interne que je venais d'ajouter **mordait sur la bande
   d'observation** et masquait la bordure basse du nœud L7. Corrigée.
4. **`fig:topologie-reseau`** — le titre du cadre du réseau virtuel était posé **sur** la bordure
   haute, entre les deux étiquettes d'arc qui descendent jusqu'à lui ; un premier resserrement
   vertical de 0,70 cm l'a rendu illisible sur la moitié de sa longueur. **Resserrement annulé**,
   puis le titre est passé à l'intérieur du cadre, dans le couloir libre entre les deux arcs —
   l'idiome que `fig:topologie-cible` emploie déjà.
5. **`fig:seq-mfa`** — mon resserrement de 1,20 cm faisait **recouvrir l'étiquette du message 4
   par celle du message 6**. Les messages 6 et 7 ne remontent plus que de 0,60 cm.

Autrement dit : **trois des cinq défauts ont été introduits par mes propres corrections et n'ont
été vus qu'en regardant les images.** C'est la démonstration de la règle du brief.

### 5.3 Ce que j'ai vérifié et qui était déjà bon

- **Aucune figure ne déborde de la justification.** Les deux débordements du chapitre
  (`fig:topologie-cible` 0,9 pt, `fig:seq-refus` 1,7 pt) sont fermés par le retrait des pavés de
  prose qui les causaient.
- **Toute étiquette posée sur un trait a un fond blanc** (styles `et`, `etq`, `etg`, `etqa`, `fx`,
  et `croixrefus`, dont le fond blanc masque le trait sous la croix).
- **Aucun pavé « Ce que la figure démontre » ne subsiste** : `grep` renvoie 0.
- La réduction d'échelle globale (`y=0.86cm`) n'a **pas** été employée : `RAPPORT_FIGURES` §5.3
  démontre par l'essai qu'elle fait se recouvrir les nœuds, dont la hauteur est absolue. Toute la
  hauteur gagnée vient **du contenu retiré**, jamais de l'échelle.

### 5.4 Un dernier levier, typographique et sans perte

`\topfraction`, `\bottomfraction`, `\textfraction` et `\floatpagefraction` sont calibrés par LaTeX
pour un document peu illustré : une figure dépassant la moitié de la justification se voit
réserver une page entière. Le chapitre en porte onze. Les quatre paramètres sont donc redéfinis
**localement au chapitre 4** (0,92 / 0,75 / 0,08 / 0,88) et **restaurés en fin de fichier**, comme
les ressorts de flottants que l'équipe précédente avait déjà resserrés. Effet mesuré :
`fig:modele-donnees` passe de 2 320 à 3 397 caractères sur sa page — **elle ne monopolise plus sa
page**, et aucune page du chapitre n'est plus une page de flottant.

---

## 6. Ce que j'ai trouvé de faux — et corrigé

### 6.1 « Six autorisations » : la dernière occurrence du mémoire (CORRIGÉE)

`ch4:489` écrivait encore « **Les six autorisations** portent chacune une identité nommée et un
port nommé ». C'était **la dernière occurrence du mémoire** : `grep` sur `chapters/`,
`appendices/` et `frontmatter/` montre que ch3, ch5 et ch6 disent tous « cinq autorisations »
depuis la correction de la vague précédente, et que `tab:conception-couches` (cellule L4, deux
lignes plus loin dans le même chapitre) disait déjà « douze règles de filtrage dont **cinq**
autorisations ». Le chapitre 4 se contredisait donc lui-même à cent lignes d'intervalle.
**Corrigé** : « Douze règles --- **cinq autorisations et sept refus** --- ont remplacé les quatre
antérieures ». C'est aussi le seul compte qui ferme à douze sur `tab:regles-cibles`.

### 6.2 « Par le connecteur » dans `fig:deploiement` (CORRIGÉE)

L'étiquette d'arc `ch4:251` portait encore « par le connecteur » entre la tâche d'enrichissement et
le service d'encodage. **Le connecteur d'accès sans serveur a été supprimé le 15/08/2026** (É4,
`tab:adressage-cible`, `ch5:647`), et la légende du flottant avait été corrigée par l'équipe
précédente sans que le libellé TikZ le soit — l'arbitrage de périmètre de cette équipe
(« la légende est du texte, les nœuds sont de la figure ») laissait ce point ouvert pour moi.
**Corrigé** : « par l'interface de sortie ». Les deux autres libellés signalés par le constat F-4
de `RAPPORT_EXEC_CH3_CH4.md` (`fig:modele-couches` nœud L4, `fig:deploiement` nœud L4) **avaient
déjà été corrigés** entre-temps : ils disent « VPC · sortie réseau directe · règles de pare-feu ».

### 6.3 « Cinq repères se succèdent » (CORRIGÉE)

L'ouverture de §4.4 annonçait « cinq repères se succèdent », compte hérité de
`fig:chronologie-incident`. Après l'absorption de celle-ci, la phrase n'avait plus de référent.
**Corrigée** : « deux registres se partagent le récit sans se recouvrir ».

### 6.4 « Neuf vues d'architecture et trois diagrammes de comportement » (CORRIGÉE)

La conclusion du chapitre annonçait douze figures. Le chapitre en portait douze, mais leur
répartition était fausse : les vues d'architecture étaient **huit** et non neuf. Après le retrait
de la chronologie, le compte exact est **huit vues d'architecture et trois diagrammes de
comportement**. **Corrigé**, avec renvoi au `tab:recette-vues`.

### 6.5 Deux `Overfull` de `tab:conception-couches` (CORRIGÉS)

L'équipe précédente avait mesuré 10,91 pt et 4,69 pt sur les mots « Enrichissement sémantique » et
« Observabilité » dans une première colonne de 1,35 cm, et avait renoncé à y toucher pour ne pas
recomposer deux pages avant la passe figures. La colonne passe à 1,70 cm dans la redistribution
générale des largeurs : **il ne reste qu'un `Overfull` de 0,95 pt dans tout le chapitre.**

---

## 7. Ce que j'ai trouvé de faux et **pas** corrigé — hors périmètre

### 7.1 `\pastilleOK` et `\pastilleWarn` sont définies à l'intérieur d'un environnement `figure`

`ch4:1720–1729` définit ces deux macros par `\providecommand` **dans** l'environnement `figure` de
`fig:delegation-identite`. Elles devraient rejoindre `config/convention_graphique.tex`, à côté de
`\gcprod`, et y être déclarées `\DeclareRobustCommand` comme les pictogrammes de couverture — pour
la raison exacte qui a motivé ce choix pour eux : **une commande TikZ fragile casse dès qu'elle
remonte dans une légende ou dans la liste des figures.** Elles ne sont aujourd'hui employées que
dans des nœuds, donc rien ne casse ; le jour où l'une d'elles passe en légende, si.
**Non corrigé : `config/` n'est pas dans mon périmètre.**

### 7.2 Un `\label` de tableau posé sur une sous-section

`\subsection{Composants évalués puis écartés}` porte `\label{tab:composants-ecartes}`, appelé
depuis `ch4:28` par `\cref{tab:composants-ecartes}`. `cleveref` rend donc « section 4.7.2 » sous un
nom de label qui annonce un tableau. Sans conséquence de compilation. **Non corrigé** : renommer
le label suppose de vérifier tous les appels, y compris hors de mon périmètre. Signalé déjà par
`RAPPORT_EXEC_CH3_CH4.md` §F-7 ; le constat tient toujours.

### 7.3 Deux étiquettes tournées à 90° subsistent

`fig:delegation-identite` porte « assertion signée » et « jeton de courte durée » tournées à 90°,
signalées par `RAPPORT_FIGURES` §2.18 comme un défaut de lisibilité. Elles sont lisibles au rendu
à `\scriptsize`, et l'écart horizontal entre les colonnes 1, 2 et 3 (0,75 cm) ne permet pas de les
écrire horizontalement sans élargir la figure au-delà de la justification. **Conservées, et le
motif est écrit ici.**

### 7.4 Le débordement de `fig:dfd-frontieres` (chapitre 3)

`RAPPORT_FIGURES` §5.4 mesure un débordement de **22,0 pt, soit 7,7 mm dans la marge extérieure**,
sur `fig:dfd-frontieres`. C'est le plus grave du mémoire et il est **visible sur un tirage
recto-verso relié**. Il est dans `ch3_besoins_menaces.tex`, hors de mon périmètre. **À traiter en
priorité par l'équipe qui détient ce fichier** ; aucune compilation ne le signalera.

---

## 8. Vérification — périmètre, et l'incident OneDrive

### 8.1 Périmètre

```
$ git status --porcelain | grep "^ *D" | wc -l
0                       ← aucun fichier supprimé dans tout le dépôt
```

`chapters/final/` renvoie huit fichiers en ` M` : les sept autres étaient déjà modifiés à
l'ouverture de ma session par les équipes travaillant en parallèle. **Mes seules écritures sont
`chapters/final/ch4_conception.tex` et le présent rapport.** `config/convention_graphique.tex`
n'a **pas** été ouvert en écriture, conformément à la consigne.

### 8.2 L'incident OneDrive — confirmé, et ce qu'il a coûté

À **01 h 44**, OneDrive a restauré une version antérieure de `ch4_conception.tex` et **annulé
d'un coup les sept premiers patchs** (figures `contexte`, `modele-couches`, `deploiement`,
`topologie-reseau`, `topologie-cible`, `cycle-donnee` + suppression de la chronologie,
`modele-donnees`). Les patchs 8 et 9, écrits juste après, se sont appliqués **sur le fichier
restauré** sans échouer, parce que leurs motifs de recherche correspondaient au texte d'origine —
la perte était donc silencieuse.

Détection : le compte de pages est remonté de 150 à 151, et `grep -c "chronologie-incident"`
renvoyait 1 au lieu de 0.

Remédiation : les sept scripts ont été rendus **idempotents** (si le nouveau texte est déjà
présent, on saute au lieu d'échouer), puis rejoués dans l'ordre. Contrôle final :

```
legendecadre 8 · fluxevenement 9 · fluxrefuse 4 · croixrefus 13 · bandecontrole 3
« par l'interface de sortie » 1 · « Ce que la figure démontre » 0 · tab:recette-vues 3
« cinq autorisations et sept refus » 1 · chronologie-incident 0 · floatpagefraction 2
```

**Recommandation à toutes les équipes** : garder les scripts hors du dossier OneDrive (c'est fait
ici), et **vérifier par `grep` la présence d'un marqueur de chaque patch avant de conclure** — le
compte de pages seul ne suffit pas à détecter la perte, puisque les autres équipes le font bouger
en permanence.

### 8.3 Contrôles de nomenclature

Les quatorze termes interdits du registre d'audit (« non exécuté », « reste à produire », « faute
de temps », « à rejouer », « il faudrait », « on pourrait », « reste à », « ce qui manque », « NON
TROUVÉ », « emplacement réservé », « capture attendue », « à confirmer », « prévu mais non
réalisé », « aucun jeu de résultats ») : **zéro occurrence**. « pipeline » : **zéro occurrence**.
Aucun `\subsubsection`. Aucun titre avec point final. Sept `\section`, inchangées — **aucun
renvoi manuel des autres équipes (`ch6` « §4.4 » et « §4.6 », `frontmatter/conventions.tex`
« §4.3 » et « §4.9 ») n'a été décalé**, la restructuration B-1 du rapport de redondances n'ayant
pas été appliquée pour cette raison exacte.

---

## 9. Points de coordination

1. **Coordinateur** — la cible de 18 pages n'est pas atteignable par la rédaction : le chapitre
   est à 91 % de sa densité maximale (§2). Le seul geste qui l'y amène est le **rang 1** :
   verser les dossiers de décision D15 et D16 en annexe D, ce qui rend 6 pages sans rien perdre,
   et qui demande un arbitrage entre le budget de ch4 et celui de l'annexe D.
2. **Équipe chapitre 3** — `fig:dfd-frontieres` déborde de 7,7 mm dans la marge extérieure (§7.4).
   Aucune compilation ne le signale, et c'est visible à l'impression.
3. **Équipe qui détient `config/`** — `\pastilleOK` et `\pastilleWarn` sont à déplacer dans
   `convention_graphique.tex` en `\DeclareRobustCommand` (§7.1).
4. **Équipe chapitre 5** — la note de `fig:seq-mfa` sur la limitation de débit est passée dans le
   texte de §4.6.4 avec ses valeurs (10 requêtes / 60 s, bannissement 300 s) ; vérifiez qu'elles
   ne sont pas répétées à l'identique en §5.8.1, qui porte la mesure.
5. **Toutes les équipes** — le levier des largeurs de tableau signalé par le coordinateur rend
   moins sur ce chapitre (0,4 p) que sur le chapitre 6 (1,3 p), parce que les tableaux du
   chapitre 4 étaient déjà en `\footnotesize` avec `\arraystretch` resserré. Il vaut la peine
   d'être appliqué partout, mais son rendement dépend de l'état de départ.
