# RAPPORT_EXEC_CH1_CH2.md — équipe ch. 1, ch. 2, introduction, conclusion

**Date** : 29/08/2026. **Périmètre d'écriture** (quatre fichiers, aucun autre) :
`latex/chapters/final/ch1_cadre_existant.tex`, `ch2_etat_art.tex`, `intro_generale.tex`,
`conclusion_generale.tex`.
**Chaîne de compilation** : `xelatex -jobname=buildC` → `biber buildC` → deux passes.
**Aucun `tikzpicture` n'a été modifié. Aucun fichier n'a été supprimé.**

---

## 1. Pages avant / après — mesurées, pas estimées

Relevé sur `buildC.toc` aux deux extrémités du travail. **Départ** : `buildC.pdf` du 29/08 18 h 41,
167 p. **Arrivée** : `buildC.pdf` du 29/08, 155 p.

| Partie | Bornes départ | **Départ** | Bornes arrivée | **Arrivée** | Cible | Écart à la cible |
|---|---|---:|---|---:|---:|---:|
| Introduction générale | p. 1–3 | 3 | p. 1–3 | **3** | 3 | **0** ✅ |
| Ch. 1 — Contexte et existant | p. 4–15 | 12 | p. 4–14 | **11** | 8 | **+3** |
| Ch. 2 — État de l'art | p. 16–32 | 17 | p. 15–29 | **15** | 11 | **+4** |
| Conclusion générale | p. 120–121 | 2 | p. 112–113 | **2** | 2 | **0** ✅ |
| **Périmètre** | | **34** | | **31** | **24** | **+7** |
| Document entier | | 167 | | **155** | ≤ 120 | (les −12 p. du document
incluent le travail concurrent des trois autres équipes sur ch. 3 à 6 et les annexes) |

Contrôles de sortie, à l'arrivée :

```
grep -c '^!' buildC.log        →  0
grep -ac undefined buildC.log  →  0
Output written on buildC.pdf (155 pages).
```

Source : ch1 788 → 743 lignes, ch2 1 008 → 965, intro 145 → 146, conclusion 82 → 97
(la conclusion **grandit** : elle gagne le cinquième incident et deux découpes de paragraphe,
et tient toujours en 2 pages parce que la condensation compensatoire a été faite dans le même
mouvement).

---

## 2. Liste des coupes, par nature

### 2.1 Redondance inter-chapitres (contrat `RAPPORT_REDONDANCES.md`)

| Réf. | Où | Geste | Gain source |
|---|---|---|---:|
| A-3 | `ch2` §2.6 chapeau | L'annonce récitait les titres des quatre sous-sections qui la suivent | −2 l. |
| A-3 | `ch2` §2.6.2 | « le prix payé n'est jamais vide » est déjà la légende du tableau | −3 l. |
| B-2(c) | `ch2` §2.6 chapeau | D15 était utilisée avant d'être établie → `(\cref{ch:conception})` | 0 |
| G7/G11 | `ch2` §2.6.4, 1<sup>re</sup> puce | Les quatre mesures de performance (démarrage à froid, cadence, délai, reconstruction) sont établies au ch. 6 et déjà portées par la colonne « prix payé » → renvoi `\cref{ch:validation}` | −1 l. |
| G8 | `ch2` §2.6.2 | **Conservé** — l'argument PR1 « corriger laisse dans l'inventaire, établir qu'il est sans objet l'en retire » est établi ici. Seule la phrase de clôture qui le redisait a été retirée | −4 l. |
| G10 / G11 | `ch2` §2.3.1 et §2.3.2 | **Conservés intacts** — V2 et le refus du pourcentage sont établis ici | 0 |
| — | `ch1` §1.1.2 | La prose récitait l'organigramme (les neuf unités nommées deux fois) | **−9 l.** |
| — | `ch1` §1.1.2 | Les trois interlocuteurs de la chaîne de revue sont déjà dans la légende de `fig:organisation-menal` | **−10 l.** |
| — | `ch1` §1.1.1 | La contrainte humaine/économique est le registre de `subsec:contraintes` → renvoi | −4 l. |
| — | `ch1` §1.5.2 | La phrase de clôture qui suivait le registre des six contraintes remontée dans l'annonce (supprime aussi le paragraphe isolé d'une ligne) | −3 l. |

### 2.2 Prose → forme dense

| Où | Geste | Gain |
|---|---|---:|
| `ch2:503` (bloc « Alternatives évaluées puis écartées ») | **33 lignes → 16**, en deux paragraphes au lieu d'un pavé. Aucune famille d'alternative ne disparaît ; les doublons de formulation sont fondus et les deux comparaisons formalisées renvoient à l'annexe A | **−17 l.** |
| `ch1` `tab:fiche-menal` | Fusion des lignes « Secteur d'activité » et « Marchés adressés », adresse postale abrégée | −1 ligne composée |
| `ch2` `tab:briques-structurantes` | Colonnes portées de 14,2 cm à 14,75 cm (zone de texte : 15,5 cm) + resserrement des 33 cellules « prix payé ». **Les 33 briques, les 33 critères décisifs et les 33 prix payés sont intégralement conservés**, ainsi que toutes les valeurs datées | **de ~5 p. à ~4 p.** |
| `ch2` `tab:zt-principes`, `tab:enrichissement-approches`, `tab:critere-application` | `\small` → `\footnotesize`, la taille des autres tableaux du mémoire | ~−0,3 p. |

### 2.3 Reformulation (aucune information retirée)

Vingt-huit blocs de `ch1` et vingt-neuf de `ch2` réécrits à contenu constant : suppression des
doublons de formulation à l'intérieur d'une même phrase, verbes plus courts, subordonnées fondues.
Les renvois numériques écrits à la main (« chapitre~2 », « chapitre~5 », « chapitre~6 ») ont été
convertis en `\cref` partout dans le périmètre — c'est ce qui les rendra insensibles à la
restructuration du chapitre 4 proposée en §B-1 du rapport de redondances.

### 2.4 Coupes réelles — trois, toutes justifiées

1. `ch2` §2.6.4 — « *l'usage voulant qu'un durcissement se paie en composants supplémentaires* ».
   Glose de la phrase qu'elle suit. **Coût : nul.**
2. `ch2` §2.6.4 — « *Ce qui s'affirme sans réserve est plus modeste, et suffit : le socle ne paie
   plus d'organe permanent pour un service que la plateforme lui rend sans objet.* » Clôture qui
   redit le §2.6.2, où l'argument « sans objet » est établi. **La réserve qui la précédait — le
   solde financier est un ordre de grandeur de tarification publique et non une facture relevée —
   est conservée mot pour mot.**
3. `ch1` §1.2.2 — « *aux requêtes bien formées et aux quotas respectés* » conservé, mais
   « le dépôt ne contient aucune donnée bancaire » fondu dans la phrase principale. **Coût : nul.**

Aucune date, aucune mesure, aucune réserve, aucun identifiant de registre n'a été supprimé.
Vérification : C1–C5, O1–O6, Q1–Q6, V1–V4, PH0–PH7, B1–B6, les 33 briques et les 7 composants
écartés sont tous présents à l'arrivée.

---

## 3. Mission 2 — corrections factuelles, et ce que j'ai vérifié pour chacune

### 3.1 Quatre incidents annoncés, cinq rapportés (C-8) — **corrigé**

**Vérifié en lecture seule** dans `ch5_realisation.tex` : ligne 1546 « celle qui a produit les
**cinq** incidents rapportés ci-dessous », ligne 1557 « Chacun des **cinq** incidents ci-dessous ».
Le cinquième est « Une règle de sortie qui n'aurait rien gouverné » (`ch5:1593–1605`).

La conclusion générale annonce désormais **cinq** incidents, énonce le cinquième avec sa cause
(le trafic ne passait pas là où la règle se serait appliquée) et porte sa leçon, qui est la plus
transférable du mémoire : *un contrôle qui ne voit pas passer le trafic n'est pas un contrôle,
c'est une déclaration.*

### 3.2 D15 présentée comme restant à appliquer (C-9) — **corrigé**

**Vérifié en lecture seule** :

- `ch4_conception.tex:2290–2291`, registre des décisions : « D15 --- Sortie réseau directe, refus
  par défaut en sortie et pare-feu ciblé par identité --- **Appliquée du 11 au 25/08/2026** ».
- `ch4_conception.tex:2292–2293` : « D16 --- […] **Arrêtée le 29/08/2026, non appliquée** ».
- `BRIEF_REFONTE_APPLIQUEE.md` §1 : chronologie en douze étapes, du 11/08 (trois sous-réseaux) au
  25/08 (régime permanent) ; §« Ce qui est appliqué » confirme que **seule D16 ne l'est pas**, pour
  un motif d'ordonnancement à écrire.
- `ch6_validation.tex:158–160` : **T20 conforme**, 24/08/2026, trois sorties refusées dont un refus
  croisé entre locataires, trois lignes retrouvées dans l'entrepôt.
- `ch6_validation.tex:139–142` : **T14 non conforme**, 25/08/2026, sonde atteignant une destination
  externe en 412 ms.

Les perspectives ouvrent désormais sur **D16 — isolation des données par locataire**, avec la
raison de l'ordonnancement écrite (deux migrations d'infrastructure dans la même quinzaine ne sont
pas soutenables par un opérateur unique), et disent que la segmentation réseau **a été appliquée du
11 au 25/08/2026 et mesurée par T20**.

**La réserve qui reste vraie est conservée et datée**, dans « Problèmes rencontrés » : « deux
charges de travail détachées du sous-réseau lui échappent encore par une sortie managée ---
**non-conformité T14 du 25/08/2026** ». Elle était auparavant énoncée sans son identifiant de
protocole ni sa date.

### 3.3 OWASP — **le chapitre 2 est cohérent, la bibliographie n'a pas à changer**

- `ch2` cite `owasp2025` en deux endroits (§2.2.2 et §2.7) et **jamais `owasp2021`**. Cohérent.
- `bibliography/references.bib` contient **les deux clés** : `owasp2021` (l. 38) et `owasp2025`
  (l. 59, « OWASP Top 10:2025 », urldate 2026-08-26). **Aucune modification de la bibliographie
  n'est nécessaire** ; je ne l'ai pas ouverte en écriture.
- **Contrôle de contenu** : l'argument de `ch2` — le contrôle d'accès défaillant en tête, la
  mauvaise configuration en deuxième position contre la cinquième en 2021, et l'ajout d'une
  catégorie pour la chaîne d'approvisionnement logicielle — correspond exactement à l'édition
  2025 (A01 / A02 / A03) et à l'édition 2021 (A05 pour la mauvaise configuration). **L'argumentaire
  est exact, il n'y a rien à corriger côté ch. 2.**
- `ch3_besoins_menaces.tex:694` porte encore `\cite{owasp2021}` dans
  `tab:rattachement-referentiels`. **Hors périmètre** — signalé ici pour l'équipe du chapitre 3,
  qui aligne de son côté.

### 3.4 Bilan de campagne — non contredit

`7 conformes + 11 partiellement conformes + 2 non conformes = 20`, les vingt protocoles portant une
preuve nommée : la formulation de la conclusion générale a été conservée et mise en gras, elle
reste identique à `ch6:165`.

---

## 4. Mission 3 — corrections rédactionnelles

| Défaut signalé | État |
|---|---|
| Paragraphe `ch1:211`, 18 l. | **14 l.** — sous le seuil |
| Paragraphe `ch2:503`, **33 l.** | **16 l.**, en deux paragraphes |
| Paragraphe `ch2:822`, 16 l. | scindé en **10 + 6**, contenu intégralement conservé |
| Paragraphe `ch2:851`, 20 l. | scindé en **13 + 6** |
| Paragraphe isolé `ch1:36` | étoffé à 3 l. (il porte désormais l'argument des deux axes d'activité et dit ce qu'on lit dans le tableau) |
| Paragraphe isolé `ch1:733` | absorbé : la phrase de clôture qui suivait le registre des six contraintes est remontée dans l'annonce |
| Paragraphe isolé `ch2:262` | étoffé à 3 l. : il dit maintenant qu'il faut lire le tableau par sa colonne « limite décisive » |
| Légende longue sans forme courte `ch1:497` | `\caption[Modèle de sécurité de l'hébergement initial]{…}` |
| Légendes longues de `fig:organisation-menal` (6 l.) et `fig:elson-fonctionnel` (5 l.) | ramenées à 4 l. (recommandation A-7) |
| Titres : groupes nominaux, sans verbe conjugué, sans point final | **vérifié sur les 22 titres de ch. 1 et les 20 de ch. 2** — un seul défaut trouvé et corrigé : §2.3.1 « Système de supervision acheté ou construit, et détection comme code » (deux titres soudés) → **« Modèle de supervision et détection comme code »** (B-4) |
| Section à sous-section unique | §2.5 « Choix de la plateforme d'hébergement » n'avait que §2.5.1 : le niveau `\subsection` est supprimé, les deux `\label` remontent à la section (B-3). Les deux renvois existants (`ch2` et `annexe_a:201`) composent désormais « §2.5 » et restent exacts |
| Veuve en fin de chapitre | la conclusion du ch. 2 débordait d'une ligne sur une page à elle seule : corrigée, ce qui vaut **1 page pleine** |

**Espaces insécables** — recherche systématique `[0-9]+ [a-zà-ÿ]` sur les quatre fichiers, puis
correction : `34\,600~lignes`, `165~derrière`, `41~critères` (×3), `7~jours`, `3~portes`, `0~clé`,
`16~modules`, `90~jours`, `version~19`, `222~techniques`, `475~sous-techniques`, `SP~800-207`,
`314~lignes`, `treize~requêtes`, `quinze~minutes`, `sept~jours`, `15~au 22~août`, `treize~euros`,
`deux~euros`. **Une occurrence reste, et je ne l'ai pas touchée** : `intro_generale.tex:123`,
« 41 critères » dans un nœud de `fig:carte-memoire` — c'est du code `tikzpicture`, interdit à mon
équipe. **À traiter par l'équipe design.**

---

## 5. Ce que j'ai trouvé de faux — et qui n'était pas dans le contrat

### 5.1 Corrigé : `ch2` §2.2.1 se contredisait sur le compte des familles de contrôles

Le texte disait : « Quatre familles de contrôles sont couramment intégrées […] ; **la grille
complète en compte huit** […] ; **les huit familles qu'elle ne couvre pas** sont nommées au
§2.2.2. »

Faux à deux titres, et l'arithmétique se voit à l'œil nu :

- 8 familles au total − 4 retenues = **4** non couvertes, pas huit ;
- §2.2.2 (« Provenance, intégrité et référentiels ») n'en nomme que **deux** — nomenclature
  logicielle et signature d'artefact — cohérent avec `ch2:779` : « deux familles de contrôle
  restent découvertes (décision D07) ».

Réécrit sans avancer de compte contesté : « La grille complète des familles de contrôles en compte
huit, dont le chapitre 5 dresse l'état une à une ; les familles de provenance --- nomenclature
logicielle et signature d'artefact --- font l'objet du §2.2.2. »

### 5.2 **Non résolu, hors périmètre** : 4 familles (ch. 2) contre 5 réalisées (ch. 5)

`ch2` compte **quatre** familles de contrôles couramment intégrées, d'où les quatre briques de
chaîne de livraison de l'inventaire. `ch5_realisation.tex:274` intitule pourtant sa sous-section
« **Les huit familles de contrôles** » et `ch5:1645` conclut sur « **cinq familles de contrôles
réalisées** ». Quatre et cinq recouvrent des partitions différentes — l'analyse d'images et
l'analyse de la description d'infrastructure sont un seul outil (Trivy) et une seule brique au
ch. 2, deux familles au ch. 5 — **mais aucune phrase du mémoire ne le dit**, et un jury qui compte
trouve 4 d'un côté, 5 de l'autre, pour la même chaîne.

**Recommandation à l'équipe du chapitre 5** : ajouter une demi-phrase dans `tab:familles-controles`
ou dans son chapeau, du type « les familles *images* et *description d'infrastructure* sont portées
par un outil unique, d'où les quatre briques de l'inventaire du chapitre 2 ». Coût : une ligne.

### 5.3 Confirmations qui n'ont rien donné (à ne pas rouvrir)

- **Aucun renvoi cassé** après la suppression du niveau `\subsection` de §2.5 et le changement de
  titre de §2.3.1 : `grep -ac undefined buildC.log` = 0, deux passes après `biber`. Les labels
  `sec:plateforme-criteres`, `sec:plateforme-decision` et `sec:detection-code` sont conservés.
- **Aucun terme du registre d'audit interdit** dans les quatre fichiers (recherche des quatorze
  formules, insensible à la casse) : zéro occurrence.
- **Registres complets à l'arrivée** : C1–C5, O1–O6, Q1–Q6, V1–V4, PH0–PH7, B1–B6, les six
  contraintes, les 33 briques (contrôle mécanique : 66 séparateurs de cellule dans le corps du
  `longtable`, soit 33 lignes × 2), les 7 composants écartés, les 6 couches N1a–N1f.
- **La bibliographie n'a pas besoin d'être touchée** (§3.3).
- **Le paragraphe « Sur le volume de ce document »** (`intro:96–110`) est **intact**, y compris ses
  15 lignes, qui dépassent le standard : c'est délibéré et le brief le protège.

---

## 6. Planchers atteints — et ce qu'il faudrait couper ensuite

### 6.1 Le constat de mesure : ces deux chapitres sont dominés par leurs flottants

C'est le fait qui explique l'écart, et il n'était pas visible avant de compiler. L'étalonnage de
42 lignes de prose = 1 page **ne s'applique pas** à un chapitre où la moitié de la hauteur composée
est du flottant : retirer de la prose y déplace des flottants sans réduire le nombre de pages.

| | Prose (lignes source) | Hauteur composée des flottants | Pages |
|---|---:|---:|---:|
| Ch. 1 au départ | 326 | ~4,15 p. (4 figures, 4 tableaux) | 12 |
| **Ch. 1 à l'arrivée** | **289** | **~3,8 p.** | **11** |
| Ch. 2 au départ | 540 | ~7,5 p. (6 tableaux, dont un de 5 p.) | 17 |
| **Ch. 2 à l'arrivée** | **463** | **~6,4 p.** | **15** |

J'ai retiré **114 lignes de prose** (soit 2,7 pages au barème) et **1,45 page de flottant**, pour un
gain effectif de **3 pages**. Le reste a été absorbé par le repositionnement des flottants. J'ai
vérifié qu'il ne restait pas de blanc récupérable : le dernier tiers de la p. 14 (ch. 1) et le
dernier tiers de la p. 29 (ch. 2) sont pleins, et `[htbp]` a été relâché en `[!htbp]` sur les six
flottants du chapitre 1 sans gain, ce qui prouve qu'ils étaient déjà placés au mieux.

### 6.2 Le plancher, chiffré

> **Ch. 1 : 11 pages. Ch. 2 : 15 pages.** À contenu de preuve constant, et sans toucher au TikZ.

Ch. 1 porte **3,8 pages de flottants pour un budget de 8** : près de la moitié du chapitre. Ch. 2
porte **6,4 pages de flottants pour un budget de 11**, dont 4 pour le seul inventaire des
trente-trois briques que le brief protège nommément (« l'inventaire des briques structurantes avec
le prix payé pour chacune » ne se coupe pas). **Les 7 pages qui manquent ne sont pas dans la prose,
elles sont dans les tableaux et les figures.**

### 6.3 Les coupes suivantes, par coût croissant pour la démonstration

| # | Coupe | Gain | Coût pour la démonstration | Mon avis |
|---|---|---:|---|---|
| 1 | `ch2` `tab:briques-structurantes` en `\scriptsize` au lieu de `\footnotesize` | **−0,8 p.** | Aucun sur le fond ; 4 pages de tableau en `\scriptsize` sont pénibles à lire, et le jury imprime | **Faisable**, à trancher par l'auteur |
| 2 | `ch1` `tab:sensibilite-elson` (7 lignes, ~0,8 p.) déplacé en annexe A, section « ch. 1 » | **−0,7 p.** | Faible **si** le corps garde les deux catégories irréversibles (identifiant national, empreinte vocale) et le renvoi. Le reste est de la nomenclature de champs | **Recommandé** — mais le déplacement se fait dans un fichier hors de mon périmètre, et l'annexe a elle-même un budget |
| 3 | `ch1` `tab:actifs-adversaires` (3 lignes, ~0,4 p.) → trois phrases en prose | −0,25 p. | Faible : trois lignes de même structure, la mise en tableau est ici un luxe | Faisable |
| 4 | `ch2` `tab:critere-application` (5 lignes, ~0,5 p.) ramené à 3 lignes (une admission, un rejet, le cas frontière) | −0,25 p. | **Réel** : le rapport de redondances note que « les deux rejets sont plus instructifs que les deux admissions » ; en garder un seul de chaque affaiblit la démonstration du critère | À éviter |
| 5 | `ch1` `graph:audit-41` (figure, ~0,4 p.) supprimée, les chiffres restant en prose | −0,4 p. | **Réel** : c'est la seule vue de l'audit, et elle porte l'écart entre un fonctionnel presque prêt et un technique à zéro, qui est l'argument du chapitre | **Non** |
| 6 | `ch2` `tab:supervision-cinq` ou `tab:plateforme-10-criteres` supprimés | −0,6 p. chacun | **Rédhibitoire** : ce sont les deux études comparatives attendues par le format ESPRIT, et les critères décisifs du mémoire s'y lisent | **Non** |
| 7 | `ch2` `tab:briques-structurantes` réduit à 20 briques | −1,5 p. | **Rédhibitoire** : casse la chaîne « décision → prix payé » que le mémoire revendique et que le brief protège | **Non** |

**Recommandation.** Les points 1 à 3 donnent **1,7 à 1,8 page** sans perte de contenu et amènent le
périmètre à **ch. 1 = 10 p., ch. 2 = 14 p.**, soit 29 pages pour 24 demandées. Au-delà, chaque page
gagnée coûte un élément de démonstration, et le point 2 exige une décision de l'auteur parce qu'il
touche un fichier d'annexe.

**Ce que je recommande à l'auteur** : accepter 29 pages sur ce périmètre et reporter l'effort sur
les gisements que le rapport de redondances chiffre à 12–14 pages sans perte ailleurs (annexe E en
`longtable`, réduction d'échelle des douze figures du ch. 4, restructuration §B-1). Le ch. 2 est le
chapitre le plus dense en tableaux du mémoire et le seul qui n'en porte aucun de superflu : c'est
le mauvais endroit où aller chercher les dernières pages.

---

## 7. Vérification de périmètre

```
$ git status --porcelain -- "rapport PFE/latex/chapters/final/"
 M ch1_cadre_existant.tex      <- moi
 M ch2_etat_art.tex            <- moi
 M ch3_besoins_menaces.tex     <- autre équipe (déjà modifié à l'ouverture de session)
 M ch4_conception.tex          <- autre équipe
 M ch5_realisation.tex         <- autre équipe
 M ch6_validation.tex          <- autre équipe
 M conclusion_generale.tex     <- moi
 M intro_generale.tex          <- moi
```

Les quatre fichiers de mon périmètre sont les seuls que j'ai ouverts en écriture. `ch3` à `ch6`,
les annexes, le frontmatter, `main.tex`, `config/` et `bibliography/references.bib` ont été lus,
**jamais écrits** — `references.bib` en particulier, malgré la question OWASP (§3.3), parce que la
réponse est qu'il n'y a rien à y changer. **Aucun fichier n'a été supprimé.** Les fins de ligne des
quatre fichiers sont restées en LF, comme les quatre autres fichiers du répertoire que je n'ai pas
touchés (contrôle : `tr -cd '\r' | wc -c` = 0 sur les cinq fichiers testés, dont `ch3`).

Tous les patchs ont été appliqués par script Python écrit avec l'outil `Write` puis exécuté, avec
`io.open(..., encoding='utf-8', newline='\n')` et un contrôle d'unicité de chaque motif avant
écriture : **aucune ligne de LaTeX n'est passée par un heredoc, `sed`, `perl` ou `echo`.**
