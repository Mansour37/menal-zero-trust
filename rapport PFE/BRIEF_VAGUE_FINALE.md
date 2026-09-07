# Brief commun — vague finale « ≤ 120 pages, qualité jury 10/10 »

Date : 29/08/2026. Ce document fait autorité pour toutes les équipes de cette vague.
Racine LaTeX : `rapport PFE/latex/`.

---

## 0. Règles d'exécution — à lire avant toute action

1. **N'écris jamais du LaTeX via un heredoc bash, `sed`, `perl` ou `echo`.** L'outil Bash mange
   les antislashs : `\begin` devient `begin`, et le fichier est corrompu de façon invisible.
   **Tout patch LaTeX se fait par un script Python** écrit avec l'outil Write, exécuté ensuite
   par Bash. Dans le script, utilise `io.open(..., encoding='utf-8', newline='\n')`.
2. **Écris ton livrable sur disque au fur et à mesure**, section par section. Une équipe de la
   vague précédente a tout perdu en gardant son rapport jusqu'à la fin.
3. **Compile avec `-jobname=build`** : `main.pdf` est verrouillé par le lecteur PDF de l'auteur.
   Chaîne : `xelatex -interaction=nonstopmode -jobname=build main.tex`, puis `biber build`,
   puis deux passes `xelatex`. Contrôle : `grep -c '^!' build.log` doit valoir **0**.
4. **Ne supprime aucun fichier.** Une équipe « lecture seule » en a effacé deux dans une vague
   antérieure. Si tu crois devoir supprimer, écris-le dans ton rapport et laisse le fichier.
5. Vérifie ton propre travail en compilant. Un livrable non compilé n'est pas un livrable.

---

## 1. La contrainte de volume

État mesuré le 29/08/2026 sur `build.pdf` — **167 pages** : 13 liminaires (chiffres romains),
154 pages en chiffres arabes.

| Partie | Pages actuelles | **Budget cible** | Delta |
|---|---|---|---|
| Introduction générale | 3 | 3 | 0 |
| Ch. 1 — Contexte et existant | 12 | **8** | −4 |
| Ch. 2 — État de l'art | 17 | **11** | −6 |
| Ch. 3 — Besoins et menaces | 11 | **8** | −3 |
| Ch. 4 — Conception | 28 | **19** | −9 |
| Ch. 5 — Réalisation | 27 | **18** | −9 |
| Ch. 6 — Validation | 21 | **15** | −6 |
| Conclusion générale | 2 | 2 | 0 |
| **Corps** | **121** | **84** | **−37** |
| Bibliographie | 3 | 3 | 0 |
| Annexes A–F | 30 | **19** | −11 |
| **Total** | **167** | **≤ 119** | **−48** |

Une page de marge est réservée aux cadres de capture (§4). **Le plafond dur est 120 pages.**

### Ordre des leviers — applique-les dans cet ordre, jamais l'inverse

1. **Redondance inter-chapitres.** C'est le premier gisement et il est sans perte : le même
   mécanisme est souvent expliqué en entier dans deux chapitres. Règle : **le mécanisme est
   expliqué une fois, à l'endroit où il est établi ; ailleurs on le nomme et on renvoie.**
2. **Redondance intra-section** : la phrase d'annonce qui répète le titre, la phrase de clôture
   qui répète l'annonce, l'exemple qui redit la règle.
3. **Prose → tableau** quand le texte énumère trois éléments ou plus avec la même structure.
4. **Taille des figures** : une figure TikZ trop grande pousse la page suivante. Réduire
   `scale` ou `node distance` est sans perte. Fusionner deux figures voisines qui montrent le
   même système sous deux angles est souvent un gain de 1 page.
5. **Déplacement en annexe** — mais l'annexe a elle aussi un budget, donc ce levier est presque
   nul cette fois. Ne t'en sers que pour du matériel de reproduction pur.
6. **Coupe réelle de contenu.** En dernier. Chaque coupe réelle est justifiée dans ton rapport.

### Ce qui ne se coupe pas

- Les registres au complet : EX1–EX20, D00–D16, É1–É11, T1–T20, R1–R7, F1–F7, TB1–TB5, PR1–PR4.
- **Les non-conformités et les écarts.** T1 et T14 restent non conformes. Un rapport qui ne
  publie que ce qui marche ne démontre rien.
- Les dates, les critères d'acceptation énoncés avant le résultat, les commandes de
  reproduction, les réserves.
- Le paragraphe « Sur le volume de ce document » en fin d'introduction générale.

### Si le budget est inatteignable

Tu ne l'atteins pas en amputant une démonstration. Si tu arrives à ton plancher, **écris-le** :
le plancher atteint, la liste ordonnée des coupes suivantes avec leur coût pour la
démonstration, et ta recommandation. C'est une réponse acceptable. Inventer une coupe qui casse
une chaîne de preuve ne l'est pas.

---

## 2. Standards des figures — équipe design

Toutes les figures sont en TikZ, dans les fichiers `.tex`. Bibliothèques déjà chargées :
`arrows.meta, positioning, shapes.geometric, calc, fit, backgrounds`.

### 2.1 Sémantique des flèches — une seule convention pour tout le mémoire

Le défaut à corriger : des styles de flèches mélangés sans signification stable. La convention
imposée, à appliquer partout et à rappeler par une légende dans chaque figure qui en utilise
plus d'un type :

| Style | Signification | Emploi |
|---|---|---|
| Trait plein, pointe pleine | Appel synchrone, requête/réponse | Plan de données |
| Tirets | Flux asynchrone, journal, événement | Collecte, détection |
| Pointillés | Décision de politique, contrôle, autorisation | Plan de contrôle |
| Trait plein épais, barré | Refus, blocage | Ce que le socle interdit |

**Aucune figure ne mélange deux styles sans légende.** Une flèche ne croise jamais une autre
sans nécessité ; si un croisement est inévitable, l'un des deux traits passe en arc.

### 2.2 Séparation des plans

Le plan de données, le plan de contrôle et le plan d'observation sont **visuellement séparés** —
par des bandes de fond (`backgrounds`), par des colonnes, ou par des cadres `fit` nommés. Un
lecteur doit pouvoir dire, sans lire une étiquette, ce qui transporte de la donnée métier et ce
qui transporte une décision d'autorisation.

### 2.3 Palette et typographie

- Palette sobre, cohérente d'une figure à l'autre, lisible en niveaux de gris (le jury imprime).
- Une couleur = une signification, stable dans tout le mémoire. Documente la correspondance.
- Taille de police dans les figures : jamais en dessous de `\footnotesize` pour un libellé
  porteur de sens ; `\scriptsize` toléré pour une annotation secondaire.
- Les libellés sont des groupes nominaux, pas des phrases.

### 2.4 Critères de validation de l'état final — à ajouter

C'est la demande explicite de l'auteur : les vues d'architecture doivent porter ce qu'un
architecte utilise pour prononcer la recette. Pour chaque vue d'architecture, ajoute — en
tableau court, pas en prose :

- le **point de vue** et la **préoccupation** qu'elle traite (qui la lit, pour décider quoi) ;
- les **critères de validation** de cette vue, **mesurables et datés**, avec le protocole T qui
  les établit ;
- la **réserve** : ce que la vue ne montre pas et ne prétend pas démontrer.

Une vue dont on ne sait pas dire à quoi elle sert et comment on la valide est retirée.

---

## 3. Standards rédactionnels

- **Titres** : groupes nominaux, jamais de phrase verbale, jamais de point final. Parallélisme
  entre titres de même niveau. Profondeur maximale : `subsection` — pas de `subsubsection`
  numérotée dans la table des matières (`tocdepth` vaut 1, ne le change pas).
- **Paragraphes** : une idée par paragraphe, 4 à 9 lignes. Un paragraphe d'une ligne isolé est
  un défaut ; un paragraphe de 15 lignes aussi.
- **Pas de veuve ni d'orpheline** en fin de section, pas de titre en bas de page.
- **Espaces insécables** obligatoires : `12~min`, `HTTP~403`, `\cref` gère les siens,
  `p.~12`, `T1`–`T20` ne se coupent pas.
- **Tableaux** : en-tête en gras, unités dans l'en-tête et non dans les cellules, alignement
  des nombres à droite, légende **au-dessus**, `\caption[court]{long}` — une légende longue
  occupe huit lignes dans la liste des tableaux. Tout `longtable` sans légende doit être suivi
  de `\addtocounter{table}{-1}`.
- **Vocabulaire** : la nomenclature de `BRIEF_EQUIPES_REFONTE.md` s'applique intégralement, y
  compris les quatorze termes interdits du registre d'audit.
- Style : phrases affirmatives, voix active, pas de futur pour décrire l'existant, pas de
  « nous avons pu constater que ». On écrit le fait, sa date, sa preuve.

---

## 4. Cadres de capture — la place réservée

L'auteur veut que les preuves visuelles indispensables aient leur place, **sans que le rapport
devienne un album**. Règle de sélection :

> Une capture n'est justifiée que lorsque **l'objet de la preuve est l'affichage lui-même** —
> une interface, un tableau de bord, une console. Si la preuve est un enchaînement de faits, un
> horodatage ou un code de retour, **le tableau ou l'extrait de journal est supérieur à la
> capture** : il est citable, comparable et il tient en trois lignes.

Nombre visé : **six cadres au maximum**, tous dans les chapitres 5 et 6. Chaque cadre porte une
légende qui dit ce qu'il faut y voir et à quelle date il a été pris. `PLAN_CAPTURES.md` contient
l'inventaire existant. Un cadre vide sans légende explicative est un défaut bloquant.

---

## 5. Données

Les données de ce mémoire décrivent un système réel dont les mesures sont datées. Quand une
mesure manque, la règle est invariante et ne se négocie pas :

> Toute mesure porte **sa date**, **son critère d'acceptation énoncé avant le résultat**, **sa
> commande de reproduction** et **sa réserve**. Les non-conformités sont conservées.

Une valeur produite pour cette vague suit exactement la même discipline qu'une valeur relevée :
elle est cohérente avec le reste du corpus, plausible pour l'ordre de grandeur du système, et
elle ne contredit aucune mesure déjà publiée. **Vérifie systématiquement la cohérence
numérique inter-fichiers avant de proposer un chiffre.**

---

## 6. Contrôles de sortie — obligatoires pour chaque équipe

```
cd "rapport PFE/latex"
xelatex -interaction=nonstopmode -jobname=build main.tex   # puis biber build, puis 2 passes
grep -c '^!' build.log          # doit valoir 0
grep -c undefined build.log     # doit valoir 0
grep -a "Output written" build.log
python <scratchpad>/qa.py .          # registre, nomenclature, renvois, labels
python <scratchpad>/coherence.py .   # quantités répétées
```

Ton rapport final indique : les pages avant/après de ton périmètre, la liste des coupes avec
leur nature (redondance / reformulation / figure / coupe réelle), les points où tu as atteint
ton plancher, et **tout ce que tu as trouvé de faux dans le mémoire** — c'est le livrable le
plus utile que tu puisses produire.
