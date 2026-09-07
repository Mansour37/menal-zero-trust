# RAPPORT_REDONDANCES.md — Carte des redondances inter-chapitres

**Équipe** : architecture documentaire. **Périmètre** : lecture seule sur le LaTeX.
**Date** : 29/08/2026.
**Corpus** : `latex/chapters/final/` (8 fichiers, 8 025 lignes, 121 p.) + `latex/appendices/`
(A–F, 1 478 lignes, 30 p.), mesurés sur `build.toc` / `build.pdf` du 29/08 17 h 29.

> **Aucun fichier `.tex` n'a été modifié.** Ce rapport est le seul fichier écrit par l'équipe.
> Vérification en fin de document (§D).

---

## 0. Étalonnage lignes de source → pages

Le brief propose 45 lignes de source par page. La mesure donne un chiffre brut très différent,
et il faut dire pourquoi avant de convertir quoi que ce soit.

| Chapitre | Lignes totales | dont **flottant** (figure/table/tikz) | **prose** | Pages | Lignes tot./p. |
|---|---:|---:|---:|---:|---:|
| ch1 | 789 | 343 | 361 | 12 | 65,8 |
| ch2 | 1 009 | 388 | 540 | 17 | 59,4 |
| ch3 | 717 | 388 | 264 | 11 | 65,2 |
| ch4 | 2 399 | **1 653** | 616 | 28 | 85,7 |
| ch5 | 1 724 | 742 | 835 | 27 | 63,9 |
| ch6 | 1 170 | 434 | 610 | 21 | 55,7 |
| **Corps** | **8 025** | **3 982** | **3 382** | **121** | **66,3** |

**La moitié du corps (3 982 lignes sur 8 025) est du code de figure et de tableau**, où une ligne
de source ne produit presque rien en hauteur de page — d'où les 66 lignes/page brutes, et les
85,7 du chapitre 4, qui n'est pas plus dense mais plus illustré.

**Conversion retenue, vérifiée sur un cas concret.** La largeur de texte est de 15,5 cm et une
ligne de source de ces fichiers fait 90 à 98 caractères : **une ligne de source de prose produit
une ligne composée**. Contrôle sur la conclusion générale, qui ne contient aucun flottant :
68 lignes de prose occupent p. 120–121, soit environ 1,7 page pleine → **40 lignes/page**.
Contrôle sur §6.6, également sans flottant : 52 lignes de source, p. 112–113, ~1,2 page → 43.

> **Règle de conversion de ce rapport : 42 lignes de prose supprimées = 1 page gagnée.**
> Pour un bloc flottant (longtable, tikzpicture), la conversion est sans objet — c'est la
> **hauteur composée** qui compte, et elle est indiquée au cas par cas en pages de `build.pdf`.

Le chiffre de 45 du brief est donc juste **pour la prose**, et faux pour les blocs flottants ; le
rapport n'exprime jamais un gain en lignes de flottant.

---

## 1. Le résultat en une page

**Le premier gisement n'est pas une somme de petites répétitions : c'est un objet unique, la
refonte réseau (décision D15), expliquée intégralement dans six endroits du mémoire.**

| Objet | Pages consacrées aujourd'hui | Après application des coupes | Gain |
|---|---:|---:|---:|
| **G1** Refonte réseau D15 (verrou, adressage, 12 règles, ordre des 12 étapes, coût, limites) | ~10,0 p. | ~4,5 p. | **−5,5 p.** |
| **G2** Isolation des données D16, *non appliquée* | ~6,8 p. | ~3,8 p. | **−3,0 p.** |
| **G3** Opposabilité de la frontière (étiquette / compte de service) | ~1,4 p. | ~0,4 p. | **−1,0 p.** |
| **G4** Exfiltration par les interfaces du fournisseur | ~0,8 p. | ~0,3 p. | **−0,5 p.** |
| **G5** Jeton côté serveur / tableau de bord sans autorisation | ~0,7 p. | ~0,3 p. | **−0,4 p.** |
| **G6** Anti-force-brute et clé de comptage | ~1,0 p. | ~0,6 p. | **−0,4 p.** |
| **G7** Démarrage à froid 27 s / 94 s | ~0,5 p. | ~0,25 p. | **−0,25 p.** |
| **G8** Passerelle de traduction « devenue sans objet » | ~0,6 p. | ~0,35 p. | **−0,25 p.** |
| **G9** Jointure enrichissement → score impossible | ~0,8 p. | ~0,5 p. | **−0,3 p.** |
| **G10** Plafond de traduction manuelle des règles (V2) | ~0,5 p. | ~0,3 p. | **−0,2 p.** |
| **G11** Dénominateur ATT&CK et refus du pourcentage | ~0,6 p. | ~0,4 p. | **−0,2 p.** |
| | | **Total redondance inter-chapitres** | **≈ −12 p.** |

Douze pages sur les trente-sept demandées, **sans aucune perte de contenu** : aucun fait, aucune
date, aucun chiffre, aucune réserve ne disparaît. Le reste du budget relève des équipes de
condensation (§B pour la structure, §5 pour ce qui suit).

**Répartition du gain par chapitre** — à comparer aux budgets du brief :

| | ch2 (−6) | ch3 (−3) | ch4 (−9) | ch5 (−9) | ch6 (−6) | annexes (−11) |
|---|---:|---:|---:|---:|---:|---:|
| Gain de redondance seule | −0,6 | −1,3 | −4,3 | −4,0 | −1,3 | −0,5 |
| Reste à trouver ailleurs | −5,4 | −1,7 | −4,7 | −5,0 | −4,7 | −10,5 |

---

## 2. Carte des redondances, par gain décroissant

Convention des tableaux : **G** = à garder (l'endroit où la notion est *établie*, c'est-à-dire
justifiée) ; **R** = à réduire ; **L** = légitime, à ne pas toucher (même fait, autre registre).

---

### G1 — La refonte réseau (D15) : six exposés complets du même mécanisme

C'est le gisement principal du mémoire. Le même événement — plan d'adressage, douze règles,
ordre des douze étapes, coût, limites — est raconté en entier six fois.

| # | Occurrence | `fichier:lignes` | Lignes | Contenu | Verdict |
|---|---|---|---:|---|---|
| a | ch4 §4.2.5 « Le verrou que la refonte a levé » + keybox | `ch4_conception.tex:402–420` | 19 | Pourquoi une règle de refus n'aurait rien bloqué | **G** — le verrou est établi ici, il justifie D15 |
| b | ch4 §4.2.5 plan d'adressage + `tab:adressage-cible` | `ch4_conception.tex:433–477` | 45 | Préfixes et justification | **G** — conception |
| c | ch4 §4.2.5 règles + `tab:regles-cibles` + trois lectures | `ch4_conception.tex:480–544` | 65 | 12 règles, E1–E9/I1–I3, refus nommés | **G** — conception |
| d | ch4 §4.2.5 « L'ordre de la migration… » + « La dixième étape… » | `ch4_conception.tex:701–727` | **27** | Règle d'ordre, dates 11→25/08, étape dangereuse | **R** → 4 l. + `\cref{subsec:migration-reseau}` |
| e | ch4 §4.2.5 « Chaque propriété revendiquée… » | `ch4_conception.tex:729–739` | **11** | Ce qui est vérifié / ce qui est au plan | **R** → 4 l. + `\cref{sec:plan-validation}` |
| f | ch5 §5.3.3 `subsec:migration-reseau` | `ch5_realisation.tex:630–671` | 42 | Ordre, dates, 7 jours d'observation, étape dangereuse | **G** — la *conduite d'opération* est établie ici, dans le chapitre de réalisation, sous un titre qui l'annonce |
| g | ch5 §5.5 « Posture de sortie réseau obtenue » | `ch5_realisation.tex:815–846` | **32** | Refus par défaut, six autorisations, refus journalisés, tableau de bord = une adresse, deux charges détachées | **R** → 7 l. + `\cref{subsec:reseau-cible}` |
| h | ch3 §3.5.1 précision EX20 | `ch3_besoins_menaces.tex:582–595` | **14** | Six autorisations, refus par défaut, dates, refus nommés | **R** → 5 l. + `\cref{subsec:reseau-cible}` |
| i | ch3 §3.3.2 TB5, § « Depuis la refonte… » | `ch3_besoins_menaces.tex:406–410` | **5** | La sortie passe par l'interface et se heurte au refus | **R** → 2 l. + `\cref{subsec:reseau-cible}` |
| j | ch2 §2.6.2 briques « VPC » et « sortie réseau directe » | `ch2_etat_art.tex:580–606` | 27 | Critère décisif / prix payé | **L** — registre d'inventaire, pas un exposé du mécanisme |
| k | annexe A.3 lignes « Réseau privé virtuel » et « Sortie réseau directe » | `annexe_a…tex:262–276` | 15 | Version et mode de verrouillage | **L** |
| l | ch5 §5.8.1 incident 5 « Une règle de sortie qui n'aurait rien gouverné » | `ch5_realisation.tex:1593–1605` | **13** | Redit *a* mot pour mot, puis énonce la leçon | **R** → 5 l. (garder la seule leçon transférable) |

**Textes de remplacement exacts.**

*(d) — `ch4_conception.tex:701–727`, remplacer les deux blocs par :*

```latex
\medskip
\noindent\textbf{L'ordre de la migration.} Les douze étapes ont obéi à une règle unique ---
\emph{on n'interdit jamais avant d'avoir observé, et on n'observe qu'après avoir fait passer le
trafic par l'endroit où on l'observe} --- qui commande le calendrier du 11 au 25/08/2026 : la
conduite de l'opération, la fenêtre d'observation de sept jours et le traitement de la seule
étape réellement dangereuse sont rapportés en \cref{subsec:migration-reseau}.
```
Gain : **27 → 6 lignes, soit 21 lignes.**

*(e) — `ch4_conception.tex:729–739`, remplacer par :*

```latex
Deux propriétés de cette sous-section sont établies par contrôle direct : l'exposition de la
sortie réseau directe dans la version verrouillée du fournisseur, relevée le 29/08/2026, et le
fait que les trois règles d'entrée supprimées ne protégeaient rien, l'inventaire des instances de
calcul étant vide. Les deux autres --- applicabilité du sélecteur par identité, et démonstration
que le tableau de bord ne joint plus qu'une adresse --- portent leur commande et leur critère au
plan de validation continue (\cref{sec:plan-validation}), avec le rapprochement des ordres de
grandeur de coût et de la facture.
```
Gain : **11 → 7 lignes, soit 4 lignes.**

*(g) — `ch5_realisation.tex:815–846`, remplacer par :*

```latex
\textbf{Posture de sortie réseau obtenue.} Depuis la migration rapportée en
\cref{subsec:migration-reseau}, les charges de travail portent leurs interfaces de sortie
\emph{dans} un sous-réseau : la totalité de leur trafic sortant traverse le pare-feu, le refus par
défaut en sortie est posé, et six autorisations seulement le percent, chacune ciblée par une
identité de service et par un port. Le plan d'adressage, les douze règles et les trois lectures
qu'elles appellent sont établis en \cref{subsec:reseau-cible} ; ce que la réalisation ajoute est
que \textbf{le pare-feu est devenu une source de journal nommée} --- les refus croisés entre
locataires et l'interdiction faite au tableau de bord de joindre la base portent chacun un nom de
règle qui dit ce qui a été tenté, et rejoignent l'entrepôt par le puits déjà en place,
\textbf{sans qu'aucune modification de la chaîne de détection ait été nécessaire}
(annexe~\ref{ann:extraits-realisation}). Les deux voies de sortie qui restent ouvertes --- les
interfaces du fournisseur, et les deux charges détachées du réseau --- sont énoncées en
\cref{subsec:reseau-cible} et mesurées par les protocoles T14 et T20.
```
Gain : **32 → 15 lignes, soit 17 lignes.** *(Rien ne se perd : le seul fait propre au chapitre 5,
l'absence de modification de la chaîne de détection, est conservé et mis en valeur.)*

*(h) — `ch3_besoins_menaces.tex:582–595`, remplacer par :*

```latex
Deux exigences appellent une précision d'état à la date de \dateref{}, postérieure à la refonte du
plan réseau (décision D15, \cref{subsec:reseau-cible}). \textbf{EX20} est portée par un contrôle
et non plus par l'autorisation implicite du fournisseur : la totalité du trafic sortant des charges
porteuses de données emprunte le réseau virtuel, six autorisations nommées par identité et par port
y ont été posées le 22/08/2026, et le refus par défaut du 23/08/2026 rejette tout le reste. Les
destinations autorisées sont celles inventoriées pendant la fenêtre d'observation du 15 au
22/08/2026, non celles supposées ; les refus sont journalisés depuis le 19/08/2026 (écart É1, clos)
et alimentent l'entrepôt sans adaptation. Le critère se vérifie en deux points : aucune règle
d'autorisation ne comporte de plage source, et une destination hors inventaire est refusée puis
retrouvée dans l'entrepôt ; c'est l'objet du protocole T20.
```
Gain : **14 → 12 lignes, soit 2 lignes** *(faible : ce bloc porte les dates, qui ne se coupent
pas ; la coupe utile y est la phrase sur les refus nommés, déjà en `ch4:526–538`).*

*(i) — `ch3_besoins_menaces.tex:406–410`, remplacer par :*

```latex
Depuis la refonte du plan réseau (\cref{subsec:reseau-cible}), l'appel emprunte bien l'interface
de sortie de la charge et se heurte au refus par défaut ; mais la règle qui le laisse passer ne
désigne qu'une plage de destination du fournisseur, la même pour l'entrepôt du socle et pour tout
autre entrepôt du même fournisseur.
```
Gain : **5 → 4 lignes, soit 1 ligne.**

*(l) — `ch5_realisation.tex:1593–1605`, remplacer par :*

```latex
\textbf{Une règle de sortie qui n'aurait rien gouverné.} Le refus par défaut en sortie figurait au
plan de correction bien avant d'être posé, et la lecture croisée de la topologie et du paramétrage
des charges a montré qu'il aurait été \emph{sans effet}, pour la raison analysée en
\cref{subsec:reseau-cible} : le trafic ne passait pas là où la règle se serait appliquée. La
correction a donc consisté à déplacer d'abord le trafic, puis à l'observer sept jours, et à
n'interdire qu'ensuite (\cref{subsec:migration-reseau}). La leçon est transférable telle quelle :
\textbf{un contrôle qui ne voit pas passer le trafic n'est pas un contrôle, c'est une déclaration}
--- avant de mesurer l'efficacité d'une règle, il faut établir qu'elle est sur le chemin.
```
Gain : **13 → 9 lignes, soit 4 lignes.**

**Bilan G1** : 49 lignes de prose sur ch4/ch5/ch3, plus la respiration de page que la disparition
du bloc `ch4:701–748` rend à la sous-section la plus longue du mémoire. Mesuré sur le TOC,
**§4.2.5 occupe 7 pages (p. 46–53)** ; la coupe (d)+(e) en retire 31 lignes et permet à la
figure `fig:topologie-cible` de remonter d'une page. **Gain net attendu : 1,5 p. sur ch4, 0,6 p.
sur ch5, 0,1 p. sur ch3 — auxquels s'ajoutent les 3,3 p. de la restructuration §B-1.**

---

### G2 — L'isolation des données (D16, non appliquée) : quatre exposés

Un mémoire qui consacre **6,8 pages à une décision qui n'a pas été appliquée** déséquilibre sa
démonstration. La conception doit rester complète — c'est un livrable —, mais elle n'a pas à être
redite.

| # | Occurrence | `fichier:lignes` | Lignes | Verdict |
|---|---|---|---:|---|
| a | ch4 §4.2.6 `subsec:isolation-donnees` (tout) | `ch4_conception.tex:772–925` | 154 (dont `tab:adversaires-donnees` 39) | **G** — D16 est établie ici |
| b | ch4 §4.2.6 « Le piège de la reprise… » | `ch4_conception.tex:895–912` | 18 | **G** |
| c | ch5 §5.7.1 alertbox « dix ordres SQL… chemin de perte » | `ch5_realisation.tex:1366–1380` | **15** | **R** → 6 l. + `\cref{subsec:isolation-donnees}` |
| d | ch5 §5.7.1 « Le plan qui reste partagé… » | `ch5_realisation.tex:1403–1412` | **10** | **R** → 5 l. |
| e | ch6 §6.7.4 ligne « Isolation des données applicatives 4/10 » | `ch6_validation.tex:950–953` | 4 | **L** — c'est la *mesure*, pas l'exposé |
| f | ch6 §6.7.5 « Modèle cible d'isolation » | `ch6_validation.tex:979–998` | **20** | **R** → 8 l. : les trois modèles cloisonné/mutualisé/mixte redisent les quatre niveaux de `ch4:843–847` |
| g | annexe A.1.2 note ligne 4 | `annexe_a…tex:123–135` | 13 | **L** — justifie un pictogramme, argument propre |
| h | annexe B.8 ordres SQL | `annexe_b…tex:145–168` | 24 | **L** — extrait de code |

*(c) — `ch5_realisation.tex:1366–1380`, remplacer par :*

```latex
\begin{alertbox}[boxsep=1pt, left=4pt, right=4pt, top=3pt, bottom=3pt]
S'ajoute à ces six étapes un geste non descriptible en code en l'état : \textbf{dix ordres SQL,
dont six révocations} qui retirent aux comptes applicatifs l'appartenance au rôle privilégié de
l'instance (annexe~\ref{ann:extraits-realisation}). Un contrôle quotidien vérifie qu'ils tiennent
toujours : \textbf{il détecte la dérive, il ne la prévient pas}. Le chemin par lequel cette
frontière se défait n'est pas la restauration elle-même mais la réconciliation qui la suit, et il
n'a aucune borne temporelle : le raisonnement complet, sa conséquence sur la conception et la
condition de clôture sont établis en \cref{subsec:isolation-donnees}.
\end{alertbox}
```
Gain : **15 → 9 lignes, soit 6 lignes.**

*(d) — `ch5_realisation.tex:1403–1412`, remplacer par :*

```latex
\textbf{Le plan qui reste partagé est celui du stockage.} Les deux locataires demeurent sur
\emph{une seule} instance de base de données et \emph{un seul} jeu de tables de supervision : la
ségrégation réseau empêche une identité d'atteindre les charges de l'autre locataire, elle
n'empêche pas les deux d'atteindre le même serveur, puisque les deux règles qui l'autorisent visent
la même adresse. Le contrôle y est, et reste, au niveau du moteur de base. L'isolation des données
est conçue, chiffrée et ordonnancée en \cref{subsec:isolation-donnees} ; elle n'est pas appliquée,
et la raison en est écrite plutôt que tue.
```
Gain : **10 → 7 lignes, soit 3 lignes.**

*(f) — `ch6_validation.tex:979–998`, remplacer par :*

```latex
\subsection{Modèle cible d'isolation}

Les quatre niveaux d'isolation évalués et le modèle retenu --- mutualiser ce qui est coûteux et
sans donnée client, cloisonner ce qui porte la donnée --- sont arrêtés en
\cref{subsec:isolation-donnees}, avec leur coût. Ce que la mesure ajoute ici est le motif de
proportion : ce modèle tranche exactement là où passe la frontière de maturité relevée
ci-dessus, excellente sur l'identité et quasi nulle sur la donnée, pour un surcoût de $+40$ à
$+60\,\%$ et un effort \emph{incrémental}. Une limite l'accompagne : tant qu'il n'existe qu'un
seul projet au sens du fournisseur, un droit mal attribué traverse d'un coup toutes les frontières
logiques --- la séparation par projet reste la seule frontière garantie nativement, et lever la
contrainte administrative est le prérequis de toute commercialisation.
```
Gain : **20 → 12 lignes, soit 8 lignes.**

**Bilan G2** : 17 lignes de prose. Le gain réel de 3 pages vient de la **restructuration**
proposée en §B-2, pas de ces coupes seules.

---

### G3 — « Opposable à une charge compromise, non à un opérateur capable de déployer »

La même réserve, dans les mêmes termes, six fois.

| # | Occurrence | `fichier:lignes` | Lignes | Verdict |
|---|---|---|---:|---|
| a | ch4 alertbox « Une limite du mécanisme, dite avant qu'un jury la trouve » | `ch4_conception.tex:649–665` | 17 | **G** — établie ici, avec son mécanisme et sa levée |
| b | ch5 §5.7.1 alertbox « Ce que la frontière réseau est opposable, et à qui » | `ch5_realisation.tex:1414–1426` | **13** | **R** → 4 l. — quasi verbatim de (a) |
| c | ch3 §3.5.1 « Et le sélecteur des règles est l'étiquette réseau… » | `ch3_besoins_menaces.tex:610–615` | **6** | **R** → 2 l. |
| d | ch2 brique « Réseau privé virtuel » (fin de cellule « prix payé ») | `ch2_etat_art.tex:586–592` | 7 | **L** — colonne « prix payé », registre d'inventaire |
| e | ch6 O1, colonne « Acquis » | `ch6_validation.tex:1105–1107` | 3 | **L** — portée d'un objectif |
| f | annexe E T20 « Réserves » | `annexe_e…tex:300–301` | 2 | **L** — réserve de protocole |

*(b) — `ch5_realisation.tex:1414–1426`, remplacer par :*

```latex
\begin{alertbox}[boxsep=1pt, left=4pt, right=4pt, top=3pt, bottom=3pt]
La portée exacte de cette frontière est celle établie en \cref{subsec:reseau-cible} : le sélecteur
disponible étant l'étiquette réseau et non le compte de service, elle est \textbf{opposable à une
charge de travail compromise, non à un opérateur capable de déployer}, qui poserait l'étiquette de
l'autre locataire. Ce second cas relève du resserrement du droit de déploiement
(\cref{subsec:delegation}), non du réseau ; et la conception ne tient pas au-delà de trois ou
quatre locataires, les refus croisés croissant comme le carré de leur nombre.
\end{alertbox}
```
Gain : **13 → 8 lignes, soit 5 lignes.**

*(c) — `ch3_besoins_menaces.tex:610–615`, remplacer par :*

```latex
Et le sélecteur des règles est l'étiquette réseau et non le compte de service : la frontière est
opposable à une charge de travail compromise, non à un opérateur capable de déployer
(\cref{subsec:reseau-cible}).
```
Gain : **6 → 3 lignes, soit 3 lignes.**

---

### G4 — « L'exfiltration par les interfaces du fournisseur n'est pas fermée »

Six énoncés complets, dont trois dans le même chapitre.

| # | Occurrence | `fichier:lignes` | Lignes | Verdict |
|---|---|---|---:|---|
| a | ch4 §4.2.5 « Ce que la refonte ne ferme pas » | `ch4_conception.tex:763–767` | 5 | **G** |
| b | ch4 §4.2.6 « Ce que la conception ne couvre pas » | `ch4_conception.tex:917–919` | **3** | **R** → renvoi à (a) : `qui est la réponse terminale déjà nommée en \cref{subsec:reseau-cible}` existe déjà l. 919 — **supprimer la répétition qui la précède** |
| c | ch5 §5.5 | `ch5_realisation.tex:836–840` | **5** | **R** — absorbé par la coupe G1(g) |
| d | ch3 §3.5.1 « Deux réserves accompagnent ces états » | `ch3_besoins_menaces.tex:606–610` | **5** | **R** → 2 l. + `\cref{subsec:reseau-cible}` |
| e | ch6 `tab:lacunes`, ligne « Exfiltration » | `ch6_validation.tex:383–387` | 5 | **L** — c'est la *lacune de détection*, angle différent |
| f | annexe E T20 « Réserves » | `annexe_e…tex:303–305` | 3 | **L** |

Gain cumulé (b)+(d) : **6 lignes**, (c) déjà compté en G1.

---

### G5 — « Le jeton ne quitte jamais le serveur / le tableau de bord n'a aucune autorisation »

Cinq énoncés en deux pages du chapitre 5. C'est la redondance la plus visible pour un lecteur.

| # | Occurrence | `fichier:lignes` | Lignes | Verdict |
|---|---|---|---:|---|
| a | ch5 §5.6.1 phrase d'ouverture | `ch5_realisation.tex:963–967` | 5 | **G** — c'est l'annonce de la sous-section |
| b | ch5 `fig:composants-logiciel`, note de bas de figure | `ch5_realisation.tex:948–953` | 6 | **L** — légende |
| c | ch5 `fig:chaine-donnees-vue`, encadré latéral + cartouche + légende | `ch5_realisation.tex:1001–1017` | 17 | **R partiel** — le cartouche « Ce que la figure démontre » (1006–1011) et la légende (1014–1017) disent la même phrase deux fois **dans la même figure** ; supprimer le cartouche, la légende suffit. Gain 6 lignes (flottant, ~0,15 p.) |
| d | ch5 keybox « Propriété qui en découle » | `ch5_realisation.tex:1021–1029` | **9** | **R** → 4 l. |
| e | annexe B.9 paragraphe de clôture | `annexe_b…tex:186–189` | **4** | **R** → 2 l. |

*(d) — `ch5_realisation.tex:1021–1029`, remplacer par :*

```latex
\begin{keybox}[boxsep=1pt, left=4pt, right=4pt, top=3pt, bottom=3pt]
Aucun script exécuté dans le navigateur ne peut lire le jeton, ni donc l'exfiltrer, y compris en
cas d'injection de script réussie dans une vue. \textbf{Le tableau de bord n'est pas un client
privilégié : c'est un client comme un autre, qui n'a de pouvoir que celui du jeton qu'on lui a
confié.}
\end{keybox}
```
Gain : **9 → 6 lignes, soit 3 lignes** *(la phrase supprimée — « son identité de service ne détient
aucune autorisation propre » — figure déjà textuellement en `ch5:1002–1004` et en `ch5:1025`).*

*(e) — `annexe_b_extraits_realisation.tex:186–189`, remplacer par :*

```latex
Aucun client d'entrepôt de données ni de base relationnelle ne figure parmi les dépendances de
production du tableau de bord : la propriété énoncée au chapitre~\ref{ch:realisation} est donc
vérifiable par simple inventaire.
```
Gain : **4 → 3 lignes, soit 1 ligne.**

---

### G6 — L'anti-force-brute et le choix de la clé de comptage

| # | Occurrence | `fichier:lignes` | Lignes | Verdict |
|---|---|---|---:|---|
| a | ch5 §5.6.3 « L'anti-force-brute repose sur deux couches » + keybox | `ch5_realisation.tex:1143–1164` | 22 | **G** — le raisonnement d'ingénieur est établi ici |
| b | ch4 §4.6.4 « Le compteur anti-force-brute applicatif… » | `ch4_conception.tex:2029–2033` | 5 | **L** — déjà un renvoi à `subsec:authent-dashboard` |
| c | ch4 `fig:seq-mfa`, note n5 | `ch4_conception.tex:2159–2163` | 5 | **L** — note de figure |
| d | ch5 §5.8.1 incident 2 | `ch5_realisation.tex:1568–1572` | 5 | **L** — registre des incidents, doit rester |
| e | ch6 §6.6.2 « La limitation de débit au bord voit une adresse » | `ch6_validation.tex:822–840` | **19** | **R** → 11 l. |

*(e) — `ch6_validation.tex:829–835`, remplacer les lignes 829 à 835 par :*

```latex
Le symétrique est plus gênant encore, et il a été rencontré. Là où de nombreux abonnés partagent
un petit nombre d'adresses publiques de sortie --- situation courante sur les réseaux mobiles du
pays visé par l'application hébergée, et explicitement anticipée par son éditeur --- un seuil par
adresse frappe des utilisateurs légitimes : le compteur agrège des personnes différentes. C'est la
généralisation de l'incident et du raisonnement de conception rapportés en
\cref{subsec:authent-dashboard}, dont la formulation générale est que \emph{le contrôle mesure la
mauvaise entité}.
```
Gain : **7 → 7 lignes**, mais la suite (836–840) devient lisible sans la redite ; en pratique
**4 lignes** de gain net. La valeur de cette coupe est ailleurs : elle supprime la troisième
occurrence du même raisonnement dans le mémoire.

---

### G7 à G11 — redondances moyennes

| Objet | Occurrences (`fichier:lignes`, lignes) | Garder | Réduire | Gain |
|---|---|---|---|---:|
| **G7** Démarrage à froid 27 s / 94 s | `ch2:576–578` (3) · `ch2:787–789` (3) · `ch2:902–904` (3) · `ch4:1500–1502` (3) · `ch5:1559–1566` (8) · `ch6:486–493` (8) + `graph:coldstart` | `ch6:486–493` (la mesure) et `ch5:1559–1566` (l'incident) | `ch2:787–789` et `ch2:902–904` → *« démarrage à froid mesuré (\cref{sec:performance}) »* ; `ch4:1500–1502` déjà un renvoi | **4 l.** |
| **G8** « La passerelle est devenue *sans objet* » | `ch2:822–837` (16) · `ch4:668–676` (9) · `ch5:650–657` (8) | `ch2:822–837` — l'argument PR1 (« corriger laisse dans l'inventaire, établir qu'il est sans objet l'en retire ») y est *établi*, et il porte le passage de 34 à 33 briques | `ch4:669–676` → 3 l. + `\cref{sec:trente-trois-briques}` | **6 l.** |
| **G9** Jointure enrichissement → score impossible | `ch4:1060–1070` (11) · `ch4` cartouches de `fig:cycle-donnee` et `fig:modele-donnees` · `ch5:876–886` (11) · `ch5` note de `fig:pipeline-detection` (5) · `ch6:419–423` (5) · `concl:195–198` (4) | `ch4:1060–1070` (le schéma) **et** `ch5:876–886` (la *décision* du 29/08, registre différent) | `ch6:421–423` → 2 l. + `\cref{subsec:avancement-enrichissement}` ; note de `fig:pipeline-detection` → 2 l. | **5 l.** |
| **G10** Plafond de traduction manuelle (V2) | `ch2:171–180` (10) · `ch2:758–763` (6) · `ch5:747–751` (5) · `ch5:797–802` (6) · `ch6:354–357` (4) · `ch6` `tab:lacunes` | `ch2:171–180` | `ch5:797–802` → 3 l. + `\cref{sec:detection-code}` | **3 l.** |
| **G11** Dénominateur ATT&CK / refus du pourcentage | `ch2:185–194` (10) · `ch6:338–352` (15) · annexe C note de version (7) | `ch2:185–194` pour le *principe*, `ch6:344–352` pour l'*empreinte* (872 vecteurs, 697 techniques, 15 tactiques) | `ch6:338–343` → 3 l. + `\cref{sec:attck-matrice}` | **4 l.** |

**Total G1–G11, coupes de prose seules : ≈ 130 lignes ≈ 3,1 pages.** Le reste des 12 pages
annoncées au §1 vient des **restructurations** de la partie B, qui sont la traduction en
sommaire de la même analyse.

---

### Redondances examinées et déclarées LÉGITIMES (faux positifs)

À ne pas couper — chaque équipe de condensation les rencontrera et il faut qu'elle sache pourquoi
elles restent.

| Objet | Occurrences | Pourquoi ce n'est pas une redondance |
|---|---|---|
| **Fédération d'identité sans clé** | `ch2:638–643` (brique) · `ch4:2000–2010` (principe + renvoi) · `ch5:354–380` (`subsec:wif`, la *forme* de la condition d'attribut) · `ch6` T7 · annexe B.5 (code) · annexe D « D08 » | Quatre registres distincts : inventaire, principe, mécanisme, mesure. `ch4:2008` porte **déjà** un `\cref{subsec:wif}` : c'est le modèle à imiter partout ailleurs dans le mémoire. |
| **Les sept règles R1–R7** | `ch2:758–763` · `ch5:747–802` · `ch6:354–357` · `ch6:805–811` | `ch6:805–811` énumère les sept règles pour démontrer qu'*aucune* ne voit la faille de logique métier : c'est une démonstration, pas un rappel. |
| **32 min 45 s / RPO 0** | `ch2:720` · `ch4:890` · `ch6:546–549` · `ch6:1129` · `concl:170` | Mesure unique citée dans cinq rôles différents (prix payé, réserve de D16, mesure, réponse à O6, récapitulation). Un mémoire *doit* rappeler son résultat le plus fort. |
| **Le second locataire, six vérifications sur six** | `ch4:808–810` · `ch5:1382–1401` · `ch6:691–695` · `concl:201` | Idem : conception / réalisation / preuve / bilan. |
| **Les quatre principes PR1–PR4** | `intro:55–58` · `ch4:22–44` · rappels ponctuels | L'introduction annonce, le chapitre 4 justifie. Attendu par le format ESPRIT. |
| **Les six constats bloquants B1–B6** | `ch1:527–534` · rappels en ch2/ch4/ch5 | Chaque rappel est un *rattachement* (« réponse directe au constat B5 »), jamais un ré-exposé. |

---

## A. Redondances intra-chapitre

Les cas sont classés par coût. Chacun relève de l'un des trois motifs annoncés : l'annonce qui
répète le titre, la clôture qui répète l'annonce, l'exemple qui redit la règle — auxquels
s'ajoute ici un quatrième, de loin le plus coûteux : **le paragraphe qui récite le tableau qui le
précède.**

### A-1. `ch4:1621–1681` — « Points de vigilance » récite `tab:conception-couches` (61 lignes)

C'est le cas le plus cher du mémoire. Le `tab:conception-couches` (`ch4:1519–1616`, 98 lignes,
~2,5 p. composées) donne pour chacun des sept niveaux ses composants, ses contrôles et ses
exigences. Les 61 lignes qui le suivent reprennent **niveau par niveau, dans le même ordre**, ce
que la colonne « Contrôles apportés » vient de dire.

| Paragraphe | `fichier:lignes` | Ce qu'il ajoute réellement à la ligne du tableau |
|---|---|---|
| L1 | `ch4:1628–1631` | Rien : « règles préconfigurées à leur niveau de sensibilité le plus bas » est déjà dans la cellule L1 |
| L2 | `ch4:1633–1638` | **La réserve sur la clé sans version** — à garder |
| L3 | `ch4:1640–1646` | **Le droit d'invocation anonyme et son contrôle compensatoire** — à garder |
| L4 | `ch4:1648–1659` | Rien, et **il est faux** (voir §C-2) |
| L5 | `ch4:1661–1668` | **Le point de méthode sur le seuil de rattachement** — à garder |
| L6 | `ch4:1670–1674` | **L'absence d'index vectoriel** — à garder |
| L7 | `ch4:1676–1681` | Rien : « le quatrième export sans filtre, poste de coût dominant » est déjà dans la cellule L7 |

**Coupe** : supprimer L1, L4 et L7 (22 lignes), fondre leur seul apport résiduel dans la cellule
correspondante du tableau. **Gain : 22 lignes ≈ 0,5 p.**, plus la disparition d'un bloc
contradictoire.

### A-2. `ch6:974–977` / `ch6:1002–1003` / `ch5:1429–1431` — la même phrase trois fois

Trois formulations quasi identiques du même verdict, dont deux séparées par **une seule page** :

- `ch6:974–977` : « Le socle est prêt à héberger plusieurs applications d'un même éditeur --- ce
  qu'il fait, correctement. Il n'est pas prêt à héberger les données de deux clients distincts sous
  engagement contractuel »
- `ch6:1002–1003` : « Le socle est prêt pour un environnement de démonstration et de pré-production
  multi-locataire. Il ne l'est pas pour un engagement contractuel »
- `ch5:1429–1431` : « L'état actuel est adapté à l'hébergement de plusieurs applications d'un même
  éditeur, ce qu'il fait. Il ne l'est pas à l'hébergement des données de deux clients distincts sous
  engagement contractuel. »

**Coupe** : garder `ch6:974–977` (elle clôt le tableau de maturité qu'elle commente) ; ouvrir
§6.7.6 directement sur « Trois seuils — exactement trois — séparent ces deux états, énoncés dans
l'ordre où ils doivent être franchis » ; en `ch5:1429–1431`, remplacer par
`Le seuil de bascule est l'accueil d'un troisième locataire (\cref{sec:socle-service}).`
**Gain : 6 lignes.**

### A-3. `ch2:420–425` + `ch2:496–501` — l'annonce qui récite le sommaire

`ch2:423–425` annonce : « Il commence donc par le critère qui le borne, puis énonce les
trente-trois briques retenues, les sept composants écartés et deux lectures transverses » — soit
les titres exacts des quatre sous-sections qui suivent immédiatement. `ch2:497–499` répète ensuite
« la dernière colonne --- le prix payé --- n'est jamais vide », déjà annoncé en `ch2:422–423` et
porté par la légende de `tab:briques-structurantes`.
**Coupe** : 6 lignes.

### A-4. `ch4:1495–1505` — un glossaire au milieu d'un chapitre

Onze lignes définissent *requête planifiée*, *fenêtre glissante*, *locataire* et *démarrage à
froid*. Les quatre termes sont déjà employés et expliqués plus haut (`ch4:1000–1004` pour la
fenêtre, `ch2` pour le locataire, `ch5:1559–1566` et `ch6:486–493` pour le démarrage à froid), et
le mémoire porte une **annexe G — glossaire** (`ann:glossaire`) qui n'est citée nulle part.
**Coupe** : 11 → 3 lignes ; verser les quatre définitions à l'annexe G, qui gagne ainsi la seule
raison d'être qui lui manque. **Gain : 8 lignes.**

### A-5. `ch6:170–179` — la lecture qui répète la convention

Dix lignes expliquent pourquoi sept résultats seulement sont conformes ; la raison est déjà
donnée intégralement en `ch6:39–51` (§6.1), et une troisième fois dans la conclusion du chapitre
(`ch6:1149–1152`). **Coupe** : `ch6:170–173` → 2 lignes, garder les six lignes de la « seconde
lecture », qui est le vrai argument. **Gain : 4 lignes.**

### A-6. `ch6:919–921` et `ch5:1216–1219` — le paragraphe qui récite le tableau

- `ch6:919–921` : « Quatre gestes manuels non versionnés subsistent donc » — la colonne
  « Automatisé ? » de `tab:cout-onboarding` les montre. Garder la seule phrase de conclusion
  (« C'est la mesure honnête de la distance… »). **Gain : 2 lignes.**
- `ch5:1216–1219` : « La couverture de 3,00 % du tableau de bord tient à ce que… Le seuil de 70 %
  est déclaré dans la configuration mais volontairement non imposé » — la cellule de
  `tab:logiciel-ecrit` dit déjà « pour un seuil de 70 % déclaré et non appliqué ». Garder la
  *cause* (« les vues ne sont pas testées ; deux des quatre suites éprouvent du code recopié »),
  supprimer la reprise du seuil. **Gain : 3 lignes.**

### A-7. `ch5:1006–1017` — la figure qui se commente deux fois

`fig:chaine-donnees-vue` porte un cartouche « Ce que la figure démontre » (`ch5:1006–1011`) **et**
une légende longue (`ch5:1014–1017`) qui énonce la même phrase. Le motif se répète sur
**neuf des douze figures du chapitre 4** et sur cinq des neuf du chapitre 5 : cartouche interne +
`\caption[court]{long}` disant la même chose.

> **Recommandation transverse, applicable à 14 figures** : garder le cartouche interne (il est lu
> avec la figure, il est le standard imposé par le brief §2.4) et **ramener la légende longue au
> texte court**. Chaque figure y gagne 3 à 5 lignes composées, et la *liste des figures* cesse de
> déborder — mesuré : la liste des figures occupe aujourd'hui p. x à xi.
> **Gain estimé : 30 à 45 lignes composées, soit 0,8 à 1,0 page**, et il est purement mécanique.

### A-8. `ch1:775–788` — la conclusion de chapitre à 14 lignes

Le standard du brief est 8 à 12 lignes. Celle de ch1 en fait 14, celle de ch4 12, celle de ch6 21
(`ch6:1147–1164`). **Coupe** : ramener ch6 à 12 lignes (le paragraphe reprend les sept/onze/deux
déjà donnés au §6.2 *et* les 32 min 45 s déjà donnés au §6.4.2). **Gain : 9 lignes sur ch6,
2 sur ch1.**

**Total partie A : ≈ 63 lignes de prose (1,5 p.) + 0,8 à 1,0 p. de légendes de figures.**

---

## B. Problèmes de structure et d'ordre

Toutes les mesures de pages viennent de `build.toc` (29/08, 17 h 29).

### B-1. Le déséquilibre majeur : §4.2 « Vues d'architecture », 14 pages pour six sous-sections

| Sous-section | Pages | Est-ce une *vue* ? |
|---|---:|---|
| 4.2.1 Vue de contexte | 1,0 | oui |
| 4.2.2 Modèle en couches et justification des deux plans transversaux | **0,5** | oui |
| 4.2.3 Vue de déploiement et chemins réseau effectifs | 1,0 | oui |
| 4.2.4 Topologie réseau avant la refonte | **0,5** | oui |
| 4.2.5 La refonte réseau appliquée : conception, migration et état obtenu | **7,0** | **non** — c'est un dossier de décision et un récit de migration |
| 4.2.6 Isolation des données entre locataires : ce qui tient, et la conception qui la referme | **4,0** | **non** — c'est un dossier de décision |

**Le rapport de 1 à 14 entre 4.2.2 et 4.2.5 est le déséquilibre le plus visible du mémoire**, et
il est doublé d'une erreur de catégorie : une section intitulée « Vues d'architecture » abrite
deux dossiers de décision qui pèsent 11 de ses 14 pages et ne montrent aucune vue nouvelle
(4.2.6 ne porte **aucune figure**).

**Ordre cible proposé pour le chapitre 4** — un seul déplacement, entièrement justifié :

```
4.1  Principes directeurs de conception                        (inchangé)
4.2  Vues d'architecture                                       ~3,5 p.
     4.2.1 Vue de contexte
     4.2.2 Modèle en couches et plans transversaux
     4.2.3 Vue de déploiement et chemins réseau
     4.2.4 Topologie réseau, avant et après la refonte   << 4.2.4 + les 2 figures de 4.2.5
4.3  Segmentation réseau et isolation des données              ~6,5 p.   << NOUVELLE
     4.3.1 Plan d'adressage et règles ciblées par identité (D15)
     4.3.2 Ce que la refonte ferme, ce qu'elle ne ferme pas
     4.3.3 Isolation des données proportionnée à la sensibilité (D16)
4.4  Vue dynamique : les sept flux et le cycle de la donnée    (ex-4.3)
4.5  De l'attaque à l'incident                                 (ex-4.4)
4.6  Conception détaillée par couche                           (ex-4.5)
4.7  Le plan d'identité : la segmentation réelle               (ex-4.6)
4.8  Décisions d'architecture et écarts d'implémentation       (ex-4.7)
```

Huit sections, soit exactement le plafond du brief. Le gain n'est pas seulement de forme : une
fois les deux dossiers de décision sortis de « Vues d'architecture », les coupes G1(d), G1(e) et
G2 deviennent naturelles, et les deux figures de topologie se lisent **côte à côte**, ce que le
texte demande explicitement deux fois (`ch4:541–544` et la légende de `fig:topologie-cible`) sans
l'obtenir aujourd'hui, sept pages les séparant. **Gain estimé : 3,3 p. sur ch4.**

### B-2. La notion utilisée avant d'être établie — et le mémoire s'en réclame

`fig:carte-memoire` (intro) affirme : *« aucun maillon de la démonstration ne repose sur une
affirmation qui ne soit établie en amont »*. Trois passages la contredisent.

| # | Où | Ce qui est utilisé avant d'être établi | Correctif |
|---|---|---|---|
| a | `ch3:582–617` (§3.5.1) | 36 lignes exposent D15 — six autorisations, refus par défaut, dates du 22 et 23/08, refus nommés — alors que D15 n'est établie qu'en `ch4:391` | Coupe G1(h) : ne garder que l'*état* de EX20 et renvoyer par `\cref{subsec:reseau-cible}` |
| b | `ch3:403–411` (§3.3.2) | Idem pour le refus par défaut en sortie | Coupe G1(i) |
| c | `ch2:426–430` | « postérieurement à la refonte du plan réseau, appliquée en douze étapes du 11 au 25/08/2026 au titre de la décision D15 » — D15 n'est définie qu'au ch. 4 | Ajouter le renvoi que `ch2:324–325` fait déjà correctement pour D00 : `au titre de la décision D15 (\cref{ch:conception})` |

Le cas (c) montre le bon geste déjà présent dans le mémoire : `ch2:324–325` écrit « argumentée ici
et enregistrée au chapitre~\ref{ch:conception} sous la référence D00 ». **C'est la formule à
généraliser à toutes les premières occurrences de D01–D16, É1–É11, R1–R7 hors de leur chapitre
d'établissement.**

### B-3. Une section sur cinq n'a pas d'existence propre

Sections à **une seule sous-section** (défaut structurel : une subdivision unique ne subdivise
rien) :

| Section | Sous-section unique | Correctif |
|---|---|---|
| §2.5 Choix de la plateforme d'hébergement (2 p.) | 2.5.1 Critères, critère décisif et prix du choix | Supprimer le niveau `\subsection`, le contenu de §2.5 *est* 2.5.1 |
| §4.5 Conception détaillée par couche (3 p.) | 4.5.1 Couverture des exigences (<1 p.) | Idem, ou remonter 4.5.1 en fin de section sans titre |
| §5.5 Couche d'enrichissement sémantique (2 p.) | 5.5.1 État d'avancement réel | Idem |

Sous-sections de **moins d'une demi-page** (candidates à la fusion, technique 4 du brief de
condensation) : 1.2.3, 1.4.2, 1.5.2, 2.1.1, 2.2.1, 2.3.1, 2.3.2, 2.4.2, 3.1.2, 3.2.2, 3.4.1,
3.4.2, 4.2.2, 4.2.4, 4.3.1, 4.5.1, 4.6.2, 4.6.4, 4.7.1, 5.2.3, 5.2.6, 5.3.2, 5.6.2, 5.8.2, 6.2.1,
6.5.1, 6.6.2, 6.7.1, 6.7.2, 6.7.5, 6.8.1. **Trente et une sur quatre-vingt-quatre.**
Les fusions les plus rentables, parce qu'elles portent sur des voisines de même objet :

- **§3.4.1 + §3.4.2** (« Valeurs métier… » + « Scénarios stratégiques », 0,5 p. à elles deux) →
  une seule sous-section « Valeurs métier, sources de risque et scénarios stratégiques ».
- **§6.7.1 + §6.7.2** (« Ce qui est apporté… » + « Ce qui incombe à l'éditeur ») → « Apport du
  socle et charge de l'éditeur » ; les deux disent les deux moitiés d'une même frontière.
- **§6.7.5 + §6.7.6** (« Modèle cible d'isolation » + « Trois seuils ») → « Modèle cible et seuils
  d'engagement », ce qui absorbe aussi la coupe A-2.
- **§2.3.1 + §2.3.2** (« Système de supervision acheté ou construit… » + « La matrice des
  techniques d'attaque ») : deux objets sans rapport tenus par un titre commun ; c'est la fusion
  la moins évidente et **je ne la recommande pas** — elle ferait perdre le repère ATT&CK.

**Gain estimé sur l'ensemble des fusions retenues : 0,8 p.**, essentiellement en blancs de titre.

### B-4. Titres : rupture de parallélisme et titres verbaux

Le brief impose des **groupes nominaux**, sans verbe conjugué et sans point final.

| Titre actuel | Défaut | Proposition |
|---|---|---|
| §4.2.5 « La refonte réseau appliquée : conception, migration et état obtenu » | participe + énumération, rompt le parallélisme avec « Vue de… » | supprimé par B-1 |
| §4.2.6 « Isolation des données entre locataires : ce qui tient, et la conception qui la referme » | deux relatives | « Isolation des données entre locataires (D16) » |
| §6.6.1 « Une faille de logique métier est invisible au socle » | **phrase verbale** | « Invisibilité d'une faille de logique métier » |
| §6.6.2 « La limitation de débit au bord voit une adresse, pas un compte » | **phrase verbale** | « Portée de la limitation de débit au bord » |
| §3.3.2 « TB5 : la frontière qu'aucun contrôle réseau ne garde » | relative | « TB5, frontière sans contrôle réseau » |
| §5.2.1 « Déclenchement, permissions, graphe des tâches et portes bloquantes » | énumération à quatre termes | « Déclenchement, permissions et portes bloquantes » |
| §2.3.1 « Système de supervision acheté ou construit, et détection comme code » | deux titres soudés | « Modèle de supervision et détection comme code » |
| §6.7.1 / §6.7.2 « Ce qui est apporté… » / « Ce qui incombe… » | clauses | fusionnés par B-3 |

**Cas protégés, à ne pas retitrer** : §6.3.2 « Ce que le système ne détecte pas » et §6.6 « Ce que
le filtrage applicatif ne protège pas ». Ce sont des clauses, donc des exceptions à la règle ;
mais le brief les protège nommément et leur formulation *est* l'argument. La rupture de
parallélisme y est un choix, pas un défaut — **l'écrire dans le rapport de l'équipe de titres**
pour qu'elle ne les « corrige » pas.

### B-5. Un chapitre de 17 pages sans une seule figure

Répartition des trente figures du corps : ch1 = 4, **ch2 = 0**, ch3 = 2, ch4 = 12, ch5 = 9,
ch6 = 2, intro = 1. Le chapitre 2 (17 p., le deuxième plus long) ne porte **aucune** figure et
six grands tableaux, dont un `longtable` de 5 pages (`tab:briques-structurantes`). Le chapitre 6,
qui est le chapitre de la mesure, n'en porte que deux.

Ce n'est pas une redondance et ce n'est pas mon périmètre de coupe, mais c'est le déséquilibre
que le jury verra en feuilletant. **Recommandation à l'équipe design** : ne rien ajouter au
ch. 2 — il est en dépassement de 6 pages — mais **déplacer une figure du ch. 4 vers le ch. 6**
n'est pas possible non plus (le brief interdit de déplacer les figures). La seule action utile est
donc la **réduction d'échelle** des douze figures du ch. 4, qui est explicitement autorisée
(levier 4 du brief) et sans perte.

### B-6. Ordre interne du chapitre 6 — un seul déplacement justifié

§6.7 « Du socle au service » (5 p.) et §6.8 « Conditions de validité » se lisent dans le mauvais
ordre : §6.7.4 et §6.7.6 prononcent des notes et des seuils (`4/10`, « trois seuils ») **avant**
que §6.8.1 n'énonce les conditions de validité qui bornent toute note du chapitre. Un lecteur
prend donc la note 4/10 pour un résultat, puis découvre une page plus loin qu'elle est
mono-opérateur et sans trafic réel.

**Proposition** : intervertir §6.7 et §6.8. Le chapitre se termine alors sur « Du socle au
service », qui est la vraie ouverture vers la conclusion générale, et les conditions de validité
précèdent les notes qu'elles conditionnent. **Coût : nul** (aucune dépendance croisée ; `ch6:1033`
ne cite que le chapitre lui-même). C'est le seul déplacement inter-section que je recommande hors
du chapitre 4.

### B-7. Ce que je ne recommande PAS de déplacer

- **`ch4:1257–1505` « De l'attaque à l'incident »** (3 p., deux figures) semble redonder avec le
  fil rouge du 19/08 annoncé en introduction et mesuré au ch. 6. Ce n'est pas une redondance : ch4
  montre l'*ordre d'évaluation des règles*, ch6 le *résultat daté*. Laisser.
- **La matrice de traçabilité (`ch3:619–671`)**, les registres D et É, la campagne T1–T20 : le
  brief les protège, et ils sont ce qui rend le mémoire défendable. Aucune coupe proposée n'y
  touche.
- **Les non-conformités T1 et T14** et la section « Ce que le système ne détecte pas » : intactes
  dans toutes les propositions ci-dessus.

---

## C. Ce que j'ai trouvé de FAUX

Vingt-quatre constats, classés par gravité. **C-1 et C-2 sont bloquants pour la soutenance** : un
membre du jury qui lit le chapitre 6 et le chapitre 4 y trouve deux descriptions incompatibles du
même réseau, à trois pages d'intervalle.

---

### C-1 (BLOQUANT) — Tout le §6.7 « Du socle au service » décrit le réseau *d'avant* la refonte

La décision D15 a été appliquée du 11 au 25/08/2026 : connecteur supprimé le 15/08, sous-réseau
par locataire, douze règles ciblées par identité, refus par défaut en sortie le 23/08, règle
interne permissive supprimée le 24/08. **Le §6.7, le `tab:ztmm` et le `tab:limites` du chapitre 6
n'ont pas été mis à jour.**

| # | Passage | Ce qu'il affirme | Ce que le mémoire établit ailleurs |
|---|---|---|---|
| a | `ch6:954–956` — `tab:maturite-multitenant`, ligne « Ségrégation réseau **1/10** » | « Un réseau, **un connecteur**, une instance de base partagés ; **une règle interne autorise tout protocole entre sous-réseaux sur la seule adresse source** ; le connecteur unique est un point de défaillance commun à sept charges de travail » | Connecteur supprimé le 15/08 (`ch4:472–475`, `ch5:647–648`, et `ch6:1058–1059` du même chapitre !). Règle interne supprimée le 24/08 (`ch4:531–534`). Un sous-réseau par locataire (`ch4:453–465`) |
| b | `ch6:752–756` — `tab:ztmm`, pilier « Réseaux : **Initial** » | « sortie limitée aux plages privées. Est-ouest quasi inexistant : une règle interne autorise tout protocole entre sous-réseaux sur la seule adresse source, et réseau, **connecteur** et instance de base sont partagés » | Idem. « Sortie limitée aux plages privées » est le réglage *antérieur* décrit en `ch4:405–409` comme le défaut que la refonte a corrigé |
| c | `ch6:1021–1025` — « Troisième seuil : segmenter le réseau entre locataires » | « règles de filtrage ciblées par identité de service et par port en remplacement de la règle interne permissive, refus de sortie par défaut, et **un connecteur par locataire** » | Les trois sont **faits**. `ch5:1432–1434` dit explicitement « sur les quatre travaux qu'il commandait, **deux sont faits** » ; `ch4:691–699` dit que le coût marginal d'un locataire est passé à **zéro**, précisément parce qu'il n'y a plus de connecteur |
| d | `ch6:883–884` | « La ségrégation réseau entre applications hébergées appartient à l'hébergeur, et **n'est pas couverte** » | `ch5:1480–1484` (`tab:frontiere-resp`) : « Réseau --- segmentation entre locataires : **Intégral au plan réseau** » ; `ch5:1534–1538` : « elle a basculé côté hébergeur, et c'est le **seul domaine du tableau à avoir changé de camp** » |
| e | `ch6:1053–1055` — `tab:limites` | « Isolation portée par l'identité, non par le réseau […] la conclusion **ne s'étend pas au plan réseau** » | T20 est **conforme** (`ch6:158–160`) sur un refus croisé entre locataires réellement opposé et journalisé le 24/08 — c'est exactement un résultat du plan réseau |

**Gravité** : le chapitre qui *mesure* contredit le chapitre qui *conçoit* et celui qui *réalise*,
et il se contredit lui-même (a vs `ch6:1058–1059`, e vs `ch6:158–160`). La note **1/10** de
ségrégation réseau et la note d'ensemble **4/10** qui en dépend sont fausses au sens strict : elles
notent un système qui n'existe plus depuis le 25/08/2026, alors que la date de référence du mémoire
est le 25/08/2026.

**Correctif minimal (ne rien inventer)** : réécrire les cinq cellules à partir des faits *déjà
publiés et datés* du ch. 4 et du ch. 5 — un sous-réseau par locataire, douze règles dont six
autorisations ciblées par identité et par port, refus croisés nommés et journalisés dans les deux
sens, refus par défaut en sortie, plus de connecteur — et **ramener le troisième seuil à ce qui
reste réellement** : la clé de locataire à l'ingestion et le cloisonnement au stockage
(`ch5:1435–1437`). La note de ségrégation réseau doit remonter ; **je ne propose pas de valeur** —
c'est un jugement de l'auteur, et le brief interdit de fabriquer un chiffre.

---

### C-2 (BLOQUANT) — `ch4:1648–1659` : le chapitre 4 se contredit sur son propre réseau

Le paragraphe « Points de vigilance » du niveau **L4** affirme :

> « L4 ne contrôle pas la sortie par le pare-feu --- **aucune règle de sortie, aucune liste
> d'autorisation** […] La **règle interne de priorité 900** autorise en outre tout protocole entre
> les deux sous-réseaux sur la seule base de l'adresse source, soit de la confiance de zone […]
> son exposition est nulle tant que ces sous-réseaux restent vides »

Or, **80 lignes plus haut dans le même fichier**, la ligne L4 de `tab:conception-couches`
(`ch4:1566–1576`) décrit « douze règles de filtrage dont six autorisations » et un « refus par
défaut **en entrée et en sortie** ». Et `ch4:531–534` établit que la règle 900 et les deux
sous-réseaux ont été supprimés les 23 et 24/08/2026.

Le paragraphe s'achève par « La conception qui lève ces trois réserves […] est **arrêtée** en
`\cref{subsec:reseau-cible}` » — le verbe *arrêtée* (décidée) était juste avant l'application ;
depuis le 25/08 il est faux : elle est **appliquée**.

**Correctif** : la coupe A-1 supprime ce paragraphe, ce qui résout la contradiction sans rien
réécrire. C'est le seul cas du rapport où une coupe de redondance corrige une erreur factuelle.

---

### C-3 — L'écart É2 est déclaré clos et ouvert dans le même chapitre

| Passage | Affirmation |
|---|---|
| `ch4:472–475` (`tab:adressage-cible`, cellule « Supprimés ») | « les deux sous-réseaux `10.0.1.0/24` et `10.0.2.0/24` […] le 24/08/2026 --- **ce qui ferme l'écart É2** » |
| `ch4:2338–2341` (`tab:ecarts-implementation`, ligne É2) | date « 25/08/2026 », statut « **Retrait conçu (D15), non appliqué** » |
| `ch6:725` | « le sous-réseau public inutilisé, dont le **retrait est décidé mais non appliqué** » |

Deux occurrences disent *non appliqué*, une dit *fermé*. Le récit de migration (`ch5:667–668`)
tranche : « les deux anciens sous-réseaux vides […] ont été retirés le lendemain », c'est-à-dire
le 24/08. **É2 est clos.** Corriger la ligne du registre en « 24/08/2026 --- Corrigé, appliqué et
vérifié » et supprimer la mention de `ch6:725`.

---

### C-4 — Le chapitre 5 décrit T8, T10, T14 et T20 comme non exécutés, alors qu'ils ont un résultat

Le chapitre 5 a manifestement été figé avant la campagne des 20–25/08. Il en résulte cinq
affirmations fausses :

| # | Passage | Affirmation | Réalité du ch. 6 |
|---|---|---|---|
| a | `ch5:456–461` | T10 et T8 « ne seront comptabilisés comme conformes qu'à l'archivage de leur trace horodatée […] au titre du **plan de validation continue** » | **T8 est conforme** sur un refus réellement survenu (`ch6:121–123`) ; T10 est partiellement conforme. **Ni l'un ni l'autre ne figure au plan de validation continue** (`tab:plan-validation` : T12, T14, T15, T17, T19, T20) |
| b | `ch5:627–628` | Le quatrième scénario de refus « relève du plan de validation continue […] **au même titre que T8 et T10** » | Idem |
| c | `ch5:846` | « l'absence de chemin public direct vers le service d'encodage l'est **par le protocole T14** » | **T14 est non conforme** (`ch6:139–142`) : la sonde atteint une destination externe en 412 ms |
| d | `ch5:865` (`tab:avancement-enrichissement`) | « Chemin public direct absent dans la configuration --- Oui --- Réalisé ; **T14 planifié** » | T14 a un relevé daté du 25/08 et un verdict **non conforme** |
| e | `ch5:743–744` | « le protocole T20 **relève du plan de validation continue** » (présenté comme non mesuré) | T20 est **conforme**, relevé le 24/08 (`ch6:158–160`) |

`ch6:48–50` est explicite : « À la date de \dateref, **aucun protocole ne porte** [le résultat
*Planifié*] ». Le chapitre 5 est donc en contradiction frontale avec le chapitre 6 sur cinq points.

**Correctif** : remplacer partout « relève du plan de validation continue » par le verdict daté du
chapitre 6, avec `\cref{sec:campagne}`. Pour (c) et (d), c'est plus qu'une mise à jour : `ch5:865`
affirme une propriété que la campagne a **réfutée**, et la conserver reviendrait à publier un
résultat favorable qui a été démenti — exactement ce que le brief interdit.

---

### C-5 — `ch4:1624` cite T4 au plan de validation continue ; T4 n'y est pas

`ch4:1624–1626` : « Les contrôles dynamiques qui les établiraient en propre --- **T4**, T14, T20
--- relèvent du plan de validation continue ». Le `tab:plan-validation` (`ch6:307–318`) contient
T12, T14, T15, T17, T19, T20. **T4 est absent.** T4 est partiellement conforme avec la réserve
« l'échec de connexion est déduit de l'absence de route » (annexe E, l. 76–78), ce qui appellerait
en effet un rejeu — mais il n'est pas au plan. Trancher : soit ajouter T4 au plan avec sa cadence,
soit retirer T4 de la phrase du ch. 4.

---

### C-6 — Six renvois de section pointaient au mauvais endroit (numéros écrits à la main) — trois restent ouverts

Le mémoire n'a **aucun `\cref` cassé** (vérifié : 200 labels, 159 références, zéro orpheline).
En revanche, dix renvois sont écrits en clair, et **cinq d'entre eux sont faux** — le chapitre 5
n'a que huit sections.

| `fichier:ligne` | Écrit | Cible réelle | État / correctif |
|---|---|---|---|
| `ch6:708` | « (**§5.5**) » pour l'alerte R2 | §5.5 = « Couche d'enrichissement sémantique » ; la chaîne de détection est §5.4 | **OUVERT** → `(\cref{sec:chaine-detection})` |
| `ch5:440` | « (**§6.4.2**) » pour l'utilité de F6 | §6.4.2 = « Reproductibilité et résilience » ; F6 est évalué en §6.3.3 | **OUVERT** → `(\cref{sec:eval-enrichissement})` |
| `annexe_e:26` | « (chapitre 5, **§5.1.1**) » | §5.1.1 = « Frontière entre le code et l'exploitation » ; la recette est décrite dans le chapeau de §5.1 | **OUVERT** → `(\cref{sec:env-travail})` |
| `ch6:69` | « (§5.10.2) » — §5.10 n'existait pas | — | ✅ **corrigé pendant cette analyse** en `\cref{subsec:incidents}` |
| `ch6:707` | « (§5.9, test T11) » — §5.9 n'existait pas | — | ✅ **corrigé** en `\cref{sec:locataire}` |
| `ch6:710` | « (§5.3, incident de la porte inerte) » | — | ✅ **corrigé** en `\cref{sec:chaine-livraison}` |

> **Note de coordination.** Les trois dernières lignes ont été corrigées par une autre équipe
> **pendant** la rédaction de ce rapport : `ch6_validation.tex` a été modifié à 18 h 09, après ma
> lecture. J'ai revérifié à 18 h 15 l'intégralité des ancres citées dans cette partie C
> (l. 160, 338, 754, 766, 884, 908, 954, 963, 974, 979, 1002, 1021, 1053) : **elles sont toutes
> inchangées**, et les constats C-1, C-18 et C-20 restent valides tels quels. Les autres fichiers
> n'ont pas bougé depuis ma lecture.

Les quatre renvois restants écrits en clair (`ch6:705` « §4.4 », `ch6:706` « §4.6 »,
`frontmatter/conventions.tex:15` « section 2.6 », `intro:34` « section 2.6 ») **sont exacts** —
mais ils se casseront à la première réorganisation, et la partie B en propose une.
**Recommandation ferme : convertir les sept restants en `\cref`.**

---

### C-7 — La page « Conventions de notation » est fausse sur huit lignes sur dix-sept

`frontmatter/conventions.tex` est la première page technique que le jury lit. Elle porte huit
erreurs.

| Ligne | Écrit | Correct | Preuve |
|---|---|---|---|
| `:28` | C1–C5 introduites au **§1.4** | **§1.3** (« Audit de l'existant », sous-section 1.3.2) | `ch1:582–597` |
| `:29` | O1–O6 au **§1.5** | **§1.4** | `ch1:652` |
| `:30` | Q1–Q6 au **§1.5** | **§1.4** | `ch1:623` |
| `:37` | Série « **SO1–SO18** » | **SO1–SO24** | `ch3:470` « vingt-quatre scénarios opérationnels SO1 à SO24 » ; `annexe C` les liste tous |
| `:41` | Série « **D00–D14** » | **D00–D16** | `ch4:2258` « Il en compte dix-sept, de D00 à D16 » |
| `:41` | D introduites au **§4.8** | **§4.7** (ch. 4 n'a que sept sections) | `build.toc` |
| `:42` | É introduits au **§4.9** | **§4.7** | `build.toc` |
| `:43` | R1–R7 au **§5.5** | **§5.4** (« Chaîne de détection ») ; §5.5 est l'enrichissement | `ch5:672` |

**Les colonnes « Série » sont le plus grave** : un jury qui compte vingt-quatre scénarios dans
l'annexe C et lit « SO1–SO18 » en page vi conclut qu'il manque six scénarios. Si la
réorganisation B-1 est retenue, la colonne « Introduit au » doit disparaître au profit d'un
`\cref` — c'est la seule façon de ne plus jamais la voir dériver.

---

### C-8 — La conclusion générale annonce quatre incidents ; le chapitre 5 en rapporte cinq

- `conclusion:189` : « **Quatre** incidents d'ingénierie ont été documentés au chapitre 5 », puis
  les énumère : démarrage à froid, blocage collectif, état divergent, porte SAST en faux vert.
- `ch5:1557` : « Chacun des **cinq** incidents ci-dessous » ; `ch5:1545` : « les **cinq** incidents
  rapportés ci-dessous ».

Le cinquième — « Une règle de sortie qui n'aurait rien gouverné » (`ch5:1593–1605`) — est
précisément celui qui porte la meilleure leçon transférable du mémoire, et c'est celui que la
conclusion oublie. **Corriger le compte et ajouter la cinquième phrase.**

---

### C-9 — Les perspectives de la conclusion présentent D15 comme restant à appliquer

`conclusion:216–219` : « Quatre axes d'amélioration sont identifiés. **Le premier est la
segmentation réseau par locataire**, désormais conçue et chiffrée plutôt qu'énoncée : plan
d'adressage, règles ciblées par identité, coût et plan de migration sont arrêtés au chapitre 4.
**Ce qui reste est l'application, non l'instruction.** »

C'est faux : D15 **a été appliquée** du 11 au 25/08/2026 (`ch4:396`, `ch5:633–636`), et T20 en
mesure le résultat. Seule **D16** (isolation des données) reste à appliquer. La conclusion sous-vend
donc le principal résultat d'ingénierie du projet — c'est une erreur qui coûte à l'auteur, pas au
lecteur.

**Correctif** : « Le premier est l'isolation des données par locataire, conçue, chiffrée et
ordonnancée au chapitre 4 sous la décision D16 : ce qui reste est l'application, non l'instruction
— la segmentation réseau qui l'accompagnait, elle, a été appliquée du 11 au 25/08/2026 et mesurée
par le protocole T20. »

---

### C-10 — Phrase agrammaticale et fait tronqué dans la conclusion

`conclusion:202–204` : « L'identité, les secrets et les données […] sont séparés par locataire ;
**la seule instance de base de données restent partagés**. »

Deux défauts : accord sujet/verbe (« la seule instance […] restent »), et **l'entrepôt de
supervision a disparu de l'énumération** alors qu'il est partagé lui aussi (`ch5:1404` : « une
seule instance de base de données **et un seul jeu de tables de supervision** »).
**Correctif** : « ; l'instance de base de données et le jeu de tables de supervision, eux, restent
partagés. »

---

### C-11 — `fig:composants-logiciel` dit « 11 pages » ; tout le reste dit « douze vues »

`ch5:915` : nœud « **11 pages** rendues au serveur ».
`ch5:1200` (`tab:logiciel-ecrit`) : « **douze vues**, dont **dix** rendues au serveur et deux
clientes » ; `ch5:1049` (légende de `tab:vues-dashboard`) : « **douze éléments rendus, dont dix au
serveur** » ; `ch2:697` : « douze vues, sept routes serveur ».

La correction F7 du brief de refonte a été passée sur les tableaux et **pas sur la figure**.
Le nœud doit lire « **12 vues, dont 10 rendues au serveur** ».

---

### C-12 — `fig:modele-couches` et `fig:deploiement` montrent des composants supprimés

Ces deux figures sont les vues d'architecture principales du mémoire, présentées sans réserve de
date comme l'état du socle.

| Figure | `fichier:ligne` | Composant nommé | État réel |
|---|---|---|---|
| `fig:modele-couches` | `ch4:135` | nœud L4 : « VPC · **Serverless VPC Access** · **Cloud NAT** » | Connecteur supprimé le 15/08, passerelle NAT le 24/08 (`ch4:472–475`, `ch4:668–673`) |
| `fig:deploiement` | `ch4:204` | nœud L4 : « refus par défaut, accès privé, **sortie par le connecteur** » | Idem |
| `fig:deploiement` | `ch4:249` | étiquette d'arc : « **par le connecteur** » | Idem |
| `fig:deploiement` | `ch4:253` | **légende** : « trait épais : chemin réseau privé, **par le connecteur** et l'accès privé » | Idem |
| `tab:ecarts-implementation`, ligne **É11** | `ch4:2363–2366` | « les services d'exécution **ne routent que les plages privées par le connecteur** » | C'est la description du réseau *antérieur* : depuis le 23/08 la sortie est intégrale et gouvernée par le pare-feu (`ch4:1566–1576`, `annexe_a:269–271`). É11 reste vrai sur le fond — l'entrepôt est joint par l'identité seule — mais **sa cause est écrite au passé et présentée au présent** |

Le mémoire prend pourtant soin, ailleurs, de dater ses figures : `fig:topologie-reseau` porte
« **avant la refonte** --- état du dépôt jusqu'au 11/08/2026 » et `fig:topologie-cible`
« **après la refonte appliquée du 11 au 25/08/2026** ». **Ces deux-là ne portent aucune date et
sont fausses.**

**Correctif sans toucher au TikZ** (le brief interdit de modifier le contenu des figures) : le
brief interdit de *supprimer ou déplacer* une figure, il n'interdit pas de corriger trois libellés.
Trois remplacements de chaînes suffisent : `Serverless VPC Access · Cloud NAT` →
`sortie réseau directe` ; `sortie par le connecteur` → `refus par défaut en sortie` ;
`par le connecteur` → `interface de sortie`. **Si l'équipe design refuse de toucher au TikZ, la
solution de repli est d'ajouter la date à la légende** — mais alors les deux vues principales du
mémoire décrivent explicitement un système périmé, ce qui est pire.

---

### C-13 — Le registre « complet » de l'annexe D s'arrête à D14

`ch4:2256–2258` : « chaque décision y figure avec son statut, **sa justification complète étant
reportée en annexe~\ref{ann:conception-detaillee}**. Il en compte dix-sept, de D00 à D16. »

L'annexe D §D.1, intitulée « **Registre complet** des décisions d'architecture », énumère D00 à
D14 (`annexe_d:26–97`) puis passe au second registre. **D15 et D16 n'y figurent pas** — les deux
décisions les plus lourdes du projet, et les seules dont le corps porte la justification.

**Correctif** : ajouter deux entrées renvoyant au corps, sans dupliquer :
```latex
\textbf{D15 --- Sortie réseau directe, refus par défaut en sortie et pare-feu ciblé par identité
(appliquée du 11 au 25/08/2026).} Justification complète, plan d'adressage, règles et limites en
\cref{subsec:reseau-cible} : le verrou levé était que le trafic ne passait pas là où une règle se
serait appliquée. Vérification : protocole T20, conforme le 24/08/2026.

\textbf{D16 --- Isolation des données proportionnée à la sensibilité (arrêtée le 29/08/2026, non
appliquée).} Justification, test d'admission d'un locataire, coût et prix payé en
\cref{subsec:isolation-donnees}. Le statut « non appliquée » est un choix d'ordonnancement, énoncé
comme tel : deux migrations d'infrastructure dans la même quinzaine ne sont pas soutenables par un
opérateur unique.
```

---

### C-14 — L'entrée D11 de l'annexe D est périmée

`annexe_d:76–80` décrit D11 comme une **réserve** dont « la vérification dynamique (T14, T20)
relève du plan de validation continue ». Or `ch4:2284` porte « Réserve, **levée par D15** », T20 est
**conforme** et T14 **non conforme** — deux verdicts, aucun « à venir ».
**Correctif** : « D11 --- Sortie réseau par le chemin contrôlé (**réserve levée par D15**). […] La
réserve a été levée par la refonte du plan réseau ; T20 la confirme (conforme, 24/08/2026) et T14
en délimite la portée résiduelle (non conforme, 25/08/2026). »

Même défaut au chapeau de `annexe_d:152–155` : « les protocoles dont le premier passage n'est pas
encore intervenu sont inscrits au plan de validation continue » — `ch6:48–50` dit qu'il n'y en a
plus aucun.

---

### C-15 — `ch4:49` : « Quatre vues statiques » pour six sous-sections et cinq figures

`ch4:49–51` annonce « **Quatre** vues statiques décrivent le socle ». §4.2 compte **six**
sous-sections et porte **cinq** figures (`fig:contexte`, `fig:modele-couches`, `fig:deploiement`,
`fig:topologie-reseau`, `fig:topologie-cible`) ; §4.2.6 n'en porte aucune. La restructuration B-1
règle le problème mécaniquement : quatre sous-sections de vue, quatre vues.

---

### C-16 — `ch3:694` cite l'OWASP 2021 quand le chapitre 2 a établi l'édition 2025

`ch3:694` (`tab:rattachement-referentiels`) : `Applicatif (\cite{owasp2021})`.
`ch2:141–143` : « la référence est le classement de l'OWASP \cite{owasp2025} : **sa dernière
édition** place le contrôle d'accès défaillant en tête et la mauvaise configuration en deuxième
position, **contre la cinquième en 2021** ». `ch2:948` cite également `owasp2025`.

Le mémoire argumente donc *depuis* l'édition 2025 au ch. 2, puis rattache ses exigences à
l'édition 2021 au ch. 3. Les deux clés existent bien dans `references.bib` (l. 38 et l. 59) : ce
n'est pas une clé cassée, c'est un **mauvais choix de clé**. Remplacer par `owasp2025`.

---

### C-17 — Trois comptes différents pour les mêmes ordres SQL d'isolation

| Source | Compte |
|---|---|
| `ch4:788`, `ch5:1367`, `ch6:952` | « **dix** ordres, dont **six** révocations » |
| `annexe_b:150–161` (l'extrait qui les montre) | **huit** ordres, dont six révocations |
| `ch6:908` (`tab:cout-onboarding`) | « **Sept** ordres de base de données » |

Les six révocations sont cohérentes partout. Les totaux ne le sont pas.
**Ce n'est peut-être pas une erreur** : sept peut être le coût d'un *troisième* locataire là où dix
couvrait l'accueil du *deuxième*, et l'extrait de l'annexe B peut être volontairement tronqué.
**Mais rien ne le dit**, et trois nombres non réconciliés sur une chaîne de preuve sont
indéfendables. **Correctif minimal** : ajouter à `ch6:908` la mention de périmètre — « Sept ordres
de base de données *pour un locataire supplémentaire* (dix pour l'accueil du second, qui incluait
la fermeture symétrique) » — et signaler l'extrait comme partiel en annexe B.

---

### C-18 — Dénominateur de la clé de locataire : « huit » tables ou « dix » ?

`ch6:766` : « clé de locataire absente de **sept tables sur huit** ».
`ch6:962–965` : « **une table sur huit** porte une clé de locataire fiable ».
Partout ailleurs — `ch2:724`, `ch4:1581`, `ch5:703`, `annexe A` — l'entrepôt compte **dix** tables.

Les deux énoncés du ch. 6 sont cohérents entre eux (1 + 7 = 8) mais leur dénominateur n'est pas
celui du reste du mémoire. En lisant `tab:modele-donnees`, on compte sept tables portant une
colonne « clé d'application » exploitable et trois « sans objet » — d'où sans doute le 8, mais le
compte ne tombe pas juste. **Correctif** : écrire le dénominateur en toutes lettres — « sur les
dix tables de l'entrepôt, huit pourraient porter une clé de locataire ; une seule la porte
renseignée systématiquement » — ou ramener le dénominateur à dix.

---

### C-19 — `ch5:1086–1087` : « une seule table » contre trois lignes renseignées

`ch5:1086–1087` : « une vue ne peut être filtrée par locataire que si la table qu'elle interroge
porte une clé de locataire fiable ; or **une seule table de l'entrepôt en porte une renseignée
systématiquement** ».
`tab:modele-donnees` (`ch5:713–722`) montre **trois** tables avec une clé d'application :
`access_logs` (`service`), `raw_logs` (`resource_name`), `detections` (`service`).

L'adverbe « systématiquement » est probablement ce qui distingue les trois — `ch6:962–965` précise
que le champ est vide sur 75 à 90 % des détections produites par R2, R3 et R6. **Ce n'est donc pas
une contradiction, c'est une imprécision** : le lecteur qui remonte au tableau compte trois et lit
une. **Correctif** : « une seule de ces trois clés est renseignée sur la totalité des lignes ».

---

### C-20 — Le résumé de T20 au ch. 6 retient l'intervalle le plus flatteur

`ch6:158–160` (`tab:synthese-campagne`) : « les trois lignes de refus retrouvées dans l'entrepôt,
**les horodatages se recoupant à 10,3 s près** ».
`annexe_e:293–296` : les lignes sont « interrogeables à 09:18, **de 2 min 55 s à 4 min 12 s après
l'événement** ; chacune précède l'échec client de 10,2 à 10,3 s ».

Le 10,3 s est l'écart entre le refus du pare-feu et l'expiration côté client ; le délai de
disponibilité de la preuve dans l'entrepôt est de 3 à 4 minutes. Le résumé, en ne retenant que le
premier, laisse croire que la preuve est disponible en dix secondes. **Ce n'est pas faux, c'est
sélectif** — et le mémoire s'interdit ailleurs cette pratique (`ch5:1563–1565` : « l'estimation
initiale n'a pas été corrigée discrètement mais conservée avec la mesure qui la contredit »).
**Correctif** : « les trois lignes retrouvées dans l'entrepôt en 2 min 55 s à 4 min 12 s, les
horodatages du refus et de l'échec client se recoupant à 10,3 s près ».

---

### C-21 à C-24 — Constats mineurs

| # | `fichier:ligne` | Constat |
|---|---|---|
| **C-21** | `ch4:2384` | « **Neuf vues** rendent ces choix vérifiables » alors que le chapitre 4 porte **douze** figures. Le compte est défendable si l'on exclut les trois diagrammes de séquence et de chronologie (`fig:seq-refus`, `fig:chronologie-incident`, `fig:seq-mfa`) — 12 − 3 = 9 — mais rien ne le dit et le lecteur compte douze. **Écrire « neuf vues d'architecture et trois diagrammes de comportement ».** *(Faux positif partiel : ce n'est pas une erreur, c'est une ambiguïté.)* |
| **C-22** | `ch5:263` | « Les cas de refus correspondants sont décrits **au** section~\ref{subsec:refus} » — faute d'accord (« à la section »). Le `\cref` la supprimerait. |
| **C-23** | `ch4:313` / `ch4:405` / `ch5:1595` / `ch6:956` | « **sept** charges de travail » desservies par le connecteur, alors que le socle en compte **huit** (« cinq services et trois tâches », `ch2:572`, `ch4:1555`). Les quatre occurrences sont cohérentes entre elles ; la huitième charge — celle qui n'empruntait pas le connecteur — **n'est jamais nommée**. *(Probablement l'interface web de l'application hébergée, cf. `ch4:768–770`. À nommer une fois, ou à écrire « sept des huit charges ».)* |
| **C-24** | `tab:briques-structurantes`, `tab:adressage-cible`, `tab:regles-cibles`, `tab:frontieres` | Quatre tableaux portent un `\label` que **rien n'appelle** : le texte les désigne par leur position (« le tableau ci-dessous », « les six autorisations »). Un tableau non appelé est un défaut de composition et il flotte librement. Ajouter le `\cref` correspondant dans la phrase d'annonce. |

### Vérifications conduites qui n'ont RIEN donné (faux positifs à ne pas rouvrir)

Pour éviter que l'équipe suivante ne refasse le travail :

- **Aucun `\cref` / `\ref` cassé** : 200 labels, 159 références, zéro orpheline, zéro doublon
  (script `xref.py`, exécuté sur les 8 chapitres, les 8 annexes, le frontmatter et `main.tex`).
- **Registres complets** : EX1–EX20 (20 lignes), D00–D16 (17), É1–É11 (11), T1–T20 (20),
  R1–R7 (7), F1–F7 (7), PR1–PR4 (4), TB1–TB5 (5), A1–A11 (11), BF1–BF13 (13), BNF1–BNF7 (7),
  SO1–SO24 (24), SS1–SS7 (7), C1–C5 (5), O1–O6 (6), Q1–Q6 (6), V1–V4 (4), PH0–PH7 (8), M1–M7 (7).
  **Aucun trou.**
- **Cohérence de `tab:frontieres-scenarios`** : 4+1+3+2+12+2 = 24 ✓ ; six critiques sur TB5 et deux
  sur TB4 = huit ✓, conformes à la cartographie de l'annexe C.
- **Bilan de campagne** : 7 + 11 + 2 = 20 ✓, cohérent entre `ch6:165`, `ch6:1147` et `concl:176`.
- **Quantités répétées vérifiées et cohérentes** : sept identités de service, neuf secrets (dont
  huit sous clé gérée), cinq services et trois tâches, dix tables, sept règles R1–R7, douze
  exécutions planifiées (5 normalisations + 7 détections), quatre exports, douze règles de
  pare-feu dont six autorisations, trente-trois briques, sept composants écartés, dix-sept
  politiques d'alerte, deux sondes, quatre objectifs de service, trois certificats, quatre services
  publiés, 872 vecteurs / 697 techniques / 15 tactiques, 41 critères (12+7+22), 3,00 % de
  couverture (11/367), 21 points d'entrée dont 9 de supervision, 612 → 606 règles d'analyse
  statique, 32 min 45 s / RPO 0 / 314 lignes sur 314.
- **`fig:composants-logiciel` : « treize points d'entrée de données »** (`ch5:952`) contre « neuf
  points d'entrée de supervision » (`ch5:1176`) : **pas une contradiction** — 9 (supervision) + 4
  (comptes, journaux, alertes) = 13, et les deux périmètres sont nommés. Ne pas y toucher.
- **Trois dates de démarrage à froid** (27 s moyenne, 94 s pic, 10,5 s tableau de bord) : trois
  mesures, trois objets, cohérentes partout.
- **Les corrections F1 à F9 du brief de refonte** ont toutes été appliquées **sauf F7**, qui n'a pas
  atteint `fig:composants-logiciel` (constat C-11).

---

## D. Ordre d'exécution recommandé, et vérification

### D-1. Ordre d'exécution pour les équipes de condensation

L'ordre compte : certaines coupes en rendent d'autres possibles, et deux d'entre elles **corrigent
une erreur factuelle**. À exécuter dans cet ordre exact.

| Rang | Action | Équipe | Gain | Pourquoi ce rang |
|---|---|---|---:|---|
| **1** | **C-1** : réécrire les cinq cellules du §6.7, de `tab:ztmm` et de `tab:limites` à partir des faits datés déjà publiés au ch. 4 et ch. 5 | ch6 | 0 p. | **Bloquant.** Aucune coupe ne doit être faite sur un texte faux : on couperait le vrai et on garderait le faux |
| **2** | **C-2 + A-1** : supprimer les paragraphes L1, L4 et L7 des « Points de vigilance » | ch4 | −0,5 p. | La coupe *est* le correctif de C-2 |
| **3** | **C-3 à C-5, C-13, C-14** : mettre à jour les statuts de protocole et le registre des décisions | ch5, annexes | 0 p. | Doit précéder toute coupe dans ch5, dont les phrases périmées sont justement celles à réécrire |
| **4** | **B-1** : restructurer le chapitre 4 (§4.2 → §4.2 + §4.3) | ch4 | **−3,3 p.** | Rend G1(d), G1(e) et G2 naturelles au lieu d'arbitraires |
| **5** | **G1** : les six exposés de la refonte réseau | ch3, ch4, ch5 | −1,2 p. | Le gisement principal |
| **6** | **G2** : les quatre exposés de l'isolation des données | ch4, ch5, ch6 | −0,5 p. + −3,0 p. via B-1 | |
| **7** | **G3 à G11** | tous | −1,0 p. | |
| **8** | **A-2 à A-8** | tous | −1,5 p. | |
| **9** | **A-7 transverse** : ramener les légendes longues au texte court sur les 14 figures qui doublent leur cartouche | design | **−0,9 p.** | Purement mécanique, sans perte, à faire en dernier pour ne pas re-toucher des figures déplacées |
| **10** | **B-3, B-4, B-6** : fusions de sous-sections, titres, ordre de ch. 6 | tous | −0,8 p. | Cosmétique, à faire quand le contenu est stabilisé |
| **11** | **C-6 à C-12, C-15 à C-24** : renvois, conventions, chiffres | qualité | 0 p. | Passe finale |

**Total du présent rapport : ≈ −12,7 pages du corps**, dont −0,9 sur les légendes de figures.

### D-2. Ce que ce rapport NE fournit pas

Le budget demandé est de **−37 pages sur le corps et −11 sur les annexes**. La redondance
inter-chapitres, la redondance intra-chapitre et la restructuration en donnent **environ 13**.
**Il en manque 24 sur le corps et 11 sur les annexes**, et je préfère le dire que le maquiller.

Le plancher de ce levier est atteint pour une raison qui mérite d'être écrite : **le mémoire est
déjà largement expurgé de ses redondances triviales**. Ce que j'ai trouvé n'est presque jamais un
paragraphe recopié par paresse — c'est le même mécanisme réécrit sous un angle différent à chaque
fois, par un auteur qui a voulu que chaque chapitre se tienne seul. C'est un défaut de plan, pas
un défaut d'écriture, et c'est pourquoi la partie B rapporte plus que la partie 2.

**Les 24 pages suivantes, par ordre de coût croissant pour la démonstration** — à trancher par
l'auteur, pas par une équipe de condensation :

1. **Prose → tableau** dans les six « points de vigilance » restants du ch. 4 et les huit
   paragraphes de commentaire des tableaux du ch. 6. *Coût : nul.* Gain estimé **2 à 3 p.**
2. **Réduction d'échelle des figures.** Douze figures au ch. 4, dont quatre pleine page. Le brief
   l'autorise explicitement et la nomme sans perte. Gain estimé **3 à 4 p.**
3. **Annexe E, §E.2 (6 pages)** : les vingt protocoles y sont écrits en prose continue. Les
   ramener au format à quatre champs (protocole / critère / résultat / preuve) en `longtable`
   diviserait la place par deux. *Coût : nul, la lisibilité y gagne.* Gain **3 p.**
4. **`tab:briques-structurantes` (5 pages)** : appliquer la technique 3 du brief de condensation —
   la colonne « alternatives évaluées » est déjà sortie du tableau (`ch2:503–535`) mais elle occupe
   33 lignes de prose illisible. La ramener à une phrase par couche. Gain **1,5 p.**
5. **Annexe A, §A.3 « Fiche de version » (3 pages)** : c'est du matériel de reproduction pur, mais
   trois pages pour trente-trois lignes de version est disproportionné à un budget de 19 pages
   d'annexes. Passage en trois colonnes serrées. Gain **1 p.**
6. **Annexe C, §C.4 (2 pages)** : `tab:scenarios-operationnels` a **neuf colonnes**. Fusionner
   « G » et « V » en une colonne de risque, et « Flux » et « TB » en une. Gain **0,7 p.**
7. **Fusion des sous-sections < 0,5 p.** (trente et une recensées en B-3). Gain **0,8 p.**
8. **Coupe réelle, en dernier** : le §4.4 « De l'attaque à l'incident » porte **deux** figures
   (`fig:seq-refus`, 3 pages composées, et `fig:chronologie-incident`) qui racontent la même
   séquence sous deux angles. Le brief autorise nommément la fusion de deux figures voisines
   montrant le même système sous deux angles. **C'est la seule coupe de ce rapport qui coûte
   quelque chose** — la séquence UML porte l'argument du premier-match-gagne que la chronologie ne
   porte pas. Gain **1,5 p.**, coût : un argument de conception perd sa vue.

Les points 1 à 7 sont sans perte et donnent **12 à 14 pages**. Avec les 13 du présent rapport, on
atteint **25 à 27 des 48 demandées**. **Le reste exige une décision de l'auteur sur ce qu'il
accepte de ne plus démontrer** — et le brief prévoit précisément cette réponse (§1, « Si le budget
est inatteignable »).

**Ma recommandation** : viser **130 à 135 pages** en appliquant les points 1 à 7, et **rouvrir la
contrainte de 120** avec l'auteur, en lui présentant le coût des quatre coupes suivantes plutôt que
de les faire. Un mémoire à 132 pages dont chaque chaîne de preuve est complète vaut mieux qu'un
mémoire à 119 pages dont une chaîne est rompue — et le §« Sur le volume de ce document »
(`intro:96–110`), que le brief protège, défend déjà exactement cette position.

### D-3. Vérification — aucun fichier hors périmètre n'a été touché

Périmètre d'écriture déclaré : **un seul fichier**, `rapport PFE/RAPPORT_REDONDANCES.md`.

```
$ git status --porcelain -- "rapport PFE/RAPPORT_REDONDANCES.md"
?? "rapport PFE/RAPPORT_REDONDANCES.md"
```

Preuve que le LaTeX n'a pas été modifié par cette équipe — comparaison des dates de dernière
écriture (`stat`), le rapport ayant été ouvert à 18 h 12 :

| Fichier | Dernière écriture | Postérieure à mon intervention ? |
|---|---|---|
| `RAPPORT_REDONDANCES.md` | 18:12 | — (c'est mon livrable) |
| `ch1` … `ch5`, `intro`, `conclusion` | 13:16 → 17:28 | **non** |
| `annexes A` … `G`, `conventions`, `main.tex` | 02:45 → 17:19 | **non** |
| `ch6_validation.tex` | **18:09** | **oui — mais pas par moi** : c'est une autre équipe (correction de trois renvois, cf. note de C-6). Aucun outil d'écriture n'a été employé sur ce fichier depuis cette session ; les 26 fichiers `.tex` en état ` M` l'étaient déjà à l'ouverture de la session. |

Les 26 modifications `.tex` visibles dans `git status` sont **antérieures** à cette session et
proviennent des vagues précédentes.

**Aucun fichier n'a été supprimé.** Deux scripts d'analyse en lecture seule ont été écrits dans le
répertoire temporaire de la session (`xref.py`, contrôle des 200 labels et 159 renvois ;
`calib.py`, mesure du ratio prose/flottant) et n'ont produit aucune écriture dans le dépôt.

### D-4. Un fichier que je crois devoir être supprimé, et que je laisse

`latex/chapters/drafts/` contient des versions périmées de `intro_generale.tex` et
`ch01_contexte_problematique.tex` qui portent encore des `\todo{}` et des renvois à
`\ref{sec:problematique}` — un label qui **n'existe plus** dans le corpus final. Ces fichiers ne
sont pas inclus par `main.tex` et n'affectent donc pas la compilation, mais ils faussent toute
recherche `grep` faite par les équipes suivantes : c'est de là que viendraient des « renvois
cassés » fantômes. **Je ne les supprime pas** (consigne §0.4 du brief). Recommandation : les
exclure des recherches, ou les déplacer hors de `latex/` par une décision de l'auteur.





