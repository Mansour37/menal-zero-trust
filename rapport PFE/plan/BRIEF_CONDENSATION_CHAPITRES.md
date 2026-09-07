# Brief commun — condensation des chapitres Markdown vers LaTeX final

Document de travail interne aux agents de rédaction — à supprimer avant remise, comme les
autres fichiers de `plan/`. Chaque agent reçoit un chapitre ; ce brief donne les règles
communes aux six pour éviter de les répéter.

## 0. Où sont les choses

- Source de contenu réel : `CH<N>_*.md` à la racine de `rapport PFE/` (déjà rédigé, riche,
  quasiment sans `\todo`/`[À COMPLÉTER]` — c'est la matière première, pas un brouillon).
- Cible : `latex/chapters/final/ch<N>_*.tex` (fichier stub déjà créé, à écraser entièrement).
- Config déjà en place, ne pas y toucher : `latex/config/{packages,formatting,commands}.tex`.
- Compilation : XeLaTeX + Biber, déjà vérifiée sur le squelette. Ne pas casser la
  compilation — si un doute existe sur une commande LaTeX, rester simple.

## 1. Ce qu'il ne faut JAMAIS faire

- **Ne jamais inventer un fait, un chiffre, une date, un nom, une mesure absente de la
  source Markdown ou des autres documents du dépôt.** Si une information exigée par le plan
  n'existe nulle part (ex. nom de l'encadrant, tâches quotidiennes précises, mission
  formulée telle quelle), insérer `\todo{ce qui manque, précisément}` — ne pas combler par
  extrapolation. C'est la convention déjà en usage dans tout le projet.
- Ne pas laisser de caractères `_` non échappés dans le texte LaTeX rendu (write `\_`) —
  piège réel rencontré en préparant ce squelette. Les noms de fichiers cités en commentaire
  `%` n'ont pas besoin d'échappement, seul le texte réellement composé en a besoin.
- Ne pas utiliser `\cref{}`/`\Cref{}` sur le type `graphique` (bug d'interaction
  cleveref/MiKTeX isolé sur ce projet) : écrire la référence à la main, ex.
  « le graph.~\ref{graph:xxx} ». `\cref{}` reste OK pour `figure` et `table`.
- Ne pas ajouter de nouveaux paquets LaTeX : le poste de travail n'a pas d'accès réseau pour
  en installer (`needspace`, `emptypage`, `float`, `newfloat` ne sont pas disponibles — déjà
  contourné dans `config/`, ne pas les réintroduire).
- Ne pas citer avec `\cite{clé}` une clé qui n'existe pas dans `bibliography/references.bib`
  (liste des clés disponibles ci-dessous, §5). Si la source Markdown cite un ouvrage non
  présent dans ce fichier, utiliser `\citetodo{Auteurs, Titre, année}` (déjà défini dans
  `commands.tex`) plutôt qu'un `\cite{}` cassé.

## 2. Objectif de volume et méthode de coupe

Le corps actuel (six chapitres Markdown, ~35 000 mots) doit passer d'environ 78 pages à
40 pages **au total pour les six chapitres + intro + conclusion**. Le budget de mots par
chapitre est donné dans la fiche de chaque agent — le respecter à ±15 % près (LaTeX Times
12 pt interligne 1,15 ≈ 450 mots/page pleine, moins avec tableaux/figures).

**Règle de coupe (norme ESPRIT §G.4) :**
1. Conserver l'affirmation et le résultat ; déplacer la démonstration détaillée en annexe.
2. Conserver un tableau de synthèse court dans le corps, avec renvoi explicite
   (`cf. annexe~\ref{ann:xxx}`) vers le détail complet, à écrire dans le fichier d'annexe
   cible indiqué dans la fiche de l'agent.
3. Réduire le commentaire méthodologique (les paragraphes qui expliquent le choix rédactionnel
   plutôt que d'apporter un résultat) — c'est le premier gisement de pages.

**Ce qu'il ne faut jamais couper** (norme ESPRIT §G.5) : la matrice de traçabilité (ch.3), les
objectifs mesurables et leur réponse, les incidents d'ingénierie et les écarts documentés, la
déclaration des lacunes de détection (ch.6), le planning de travail.

## 3. Conventions LaTeX du projet

- `\chapter{Titre}` + immédiatement `\soustitrechapitre{Sous-titre italique}` (déjà utilisé
  dans le fichier stub — le conserver, ajuster le texte si besoin).
- Titres de section : `\section{}`, `\subsection{}`, `\subsubsection{}` numérotés
  automatiquement (`1.1`, `1.1.1`) — ne jamais numéroter à la main.
- Chaque chapitre : un paragraphe d'introduction juste après le sous-titre (annonce l'objectif
  du chapitre), et une section `\section*{Conclusion du chapitre}` en fin de fichier qui
  résume les résultats et annonce le chapitre suivant (`\addcontentsline{toc}{section}{Conclusion du chapitre}`
  si l'on veut qu'elle apparaisse dans la table des matières, sinon laisser non numérotée hors
  toc — au choix, cohérence entre chapitres appréciée mais pas bloquante).
- Figures : `\begin{figure}[htbp] \centering ... \caption{Titre} \label{fig:xxx} \end{figure}`
  — la numérotation `Fig. N` est automatique et continue sur tout le document, ne pas
  l'écrire à la main dans la légende.
- Tableaux : `\begin{table}[htbp]` (ou `longtable` pour les tableaux longs, déjà chargé) avec
  `\caption{}` **avant** le contenu du tableau (convention LaTeX standard) et `\label{tab:xxx}`.
  Utiliser `\begin{tabular}{@{}P{Xcm}P{Ycm}@{}}` (colonne `P` définie dans `commands.tex`,
  texte en drapeau, pas de justification forcée dans les colonnes étroites).
- Graphiques (histogrammes, courbes) : environnement `graphique` (pas `figure`) —
  `\begin{graphique}[htbp] \centering ... \caption{Titre} \label{graph:xxx} \end{graphique}`.
- **Toute figure/tableau/graphique doit être appelé explicitement dans le texte** (« comme le
  montre la figure~\ref{fig:xxx} ») — norme ESPRIT §C.1. Ne jamais insérer une illustration
  non appelée.
- **Aucune ligne de code ni rendu texte de type arborescence/config dans le corps** (norme
  ESPRIT §D.1, interdiction explicite). Si la source Markdown contient un bloc de code, une
  arborescence de fichiers ou un extrait de configuration :
  - s'il illustre un point important → le transformer en figure avec `\figureaproduire{ce qui
    doit apparaître}` (schéma/capture à produire plus tard) plutôt que reproduire le texte brut ;
  - sinon → le déplacer intégralement dans le fichier d'annexe cible indiqué dans la fiche de
    l'agent, où les extraits courts encadrés (`extraitconf`, déjà défini dans `commands.tex`)
    restent autorisés.
- Captures d'écran non encore prises (tests à rejouer, interface à capturer) :
  `\begin{figure}[htbp] \centering \figureaproduire{ce qui doit apparaître, ce qui doit être
  masqué} \caption{...} \label{fig:xxx} \end{figure}` — jamais de description en texte brut à
  la place d'une image annoncée.
- Exemples concrets : en italique (`\textit{}` ou `\emph{}`). Citations courtes : guillemets
  français `\og ... \fg{}` (babel-french) ou directement « » si le clavier le permet.
  Conclusions et éléments essentiels : en gras (`\textbf{}`).
- Encadrés déjà définis, à réutiliser tels quels : `keybox` (principe clé), `alertbox` (point
  de vigilance), `attentedoc` (bloqué par une source non fournie), `extraitconf` (court extrait
  technique encadré).

## 4. Renumérotation des sections par rapport au Markdown source

Le Markdown source suit une numérotation de travail différente de celle du plan détaillé
définitif. La fiche de chaque agent donne la structure de sections **cible** (celle du plan
détaillé définitif) — réorganiser le contenu source pour l'y faire correspondre, ce n'est pas
une simple conversion 1:1. Le contenu source peut être fusionné, réordonné, condensé ; aucune
information factuelle réelle ne doit disparaître silencieusement — ce qui ne rentre pas dans
le corps va en annexe (cf. §2).

## 5. Clés de citation disponibles dans bibliography/references.bib

`nist800207`, `kindervag2010`, `beyondcorp2014`, `owasp2021`, `gcp_architecture_framework`,
`mitre_attack`, `mitre_attack_design2018`, `devlin_bert2019`, `cisa_aa20_352a`,
`gitguardian_sprawl`, `gcp_container_best_practices`, `owasp_cicd_top10`,
`shiftleft_smith2001`, `iac_morris2020`, `hashicorp_drift`, `cisa_zt_maturity_model`,
`slsa_framework`.

Usage : `\cite{nist800207}` ou `\textcite{nist800207}` (biblatex, déjà configuré, style
numérique). Faire correspondre ces clés aux références numérotées `[N]` citées dans le
Markdown source quand le sujet correspond clairement (ex. NIST SP 800-207 → `nist800207`,
BERT → `devlin_bert2019`, MITRE ATT&CK → `mitre_attack`). Pour toute référence du Markdown
source sans clé correspondante évidente, utiliser `\citetodo{Auteurs, Titre, année}`.

## 6. Contenu personnel manquant (F1-F8, norme ESPRIT §F) — ne pas fabriquer

Certaines sections attendues par le plan détaillé n'existent dans aucune source (service
d'accueil, mission formulée, rôle, tâches quotidiennes, planning réel, difficultés, apports
personnels). Si la fiche de l'agent indique une telle section, insérer un `\todo{}` clair
décrivant précisément ce qui manque et sa taille visée (ex. `\todo{Décrire le service
d'accueil : équipe, effectif, positionnement dans l'organigramme MENAL --- 0,5 page,
information à obtenir auprès de l'encadrant entreprise}`) plutôt que d'improviser un texte
plausible.

## 8. Aucune image réelle n'est disponible — que faire selon le type de figure

`latex/figures/` ne contient aucune capture d'écran ni graphique réel (seulement le logo et
les fonds de page de garde). Toutes les figures listées dans
`plan/PLAN_DETAILLE_DEFINITIF.md` et `plan/PLAN_DES_FIGURES_ET_CAPTURES.md` comme
« disponible » le sont sur la machine de l'auteur, pas ici. En conséquence, pour chaque
figure prévue dans la fiche de l'agent :

- **Schéma/diagramme (architecture, UML — cas d'utilisation, séquence, déploiement, modèle en
  couches) :** tenter un schéma TikZ simple (boîtes + flèches, `tikz` déjà chargé), construit
  à partir des noms de composants et étapes réels décrits dans la source Markdown — pas besoin
  d'être élaboré, la clarté prime. C'est particulièrement attendu pour les quatre diagrammes
  UML identifiés comme le principal écart de conformité du mémoire (cas d'utilisation,
  séquence flux nominal, séquence chaîne de livraison, déploiement) — cf.
  `plan/REVUE_CRITIQUE_vs_REFERENTIELS_PFE.md` §3.1. Si le TikZ devient trop complexe pour le
  temps disponible, utiliser `\figureaproduire{}` plutôt que produire un schéma bâclé ou faux.
- **Graphique à partir de données réellement présentes dans la source Markdown** (ex. un
  tableau de pourcentages, une mesure chiffrée déjà écrite noir sur blanc dans le
  Markdown) : le rendre en `graphique` avec un histogramme/diagramme TikZ simple utilisant
  ces chiffres réels — jamais des chiffres inventés.
- **Capture d'écran d'un système réel** (console CI/CD, terminal, interface, résultat de test)
  ou **graphique issu d'une mesure non présente dans le Markdown** : `\figureaproduire{...}`
  avec une description précise de ce qui doit apparaître et de ce qui doit être masqué
  (s'inspirer du vocabulaire de `plan/PLAN_DES_FIGURES_ET_CAPTURES.md` §1-2 quand le contenu y
  est déjà décrit).
- **Tableau de données réel présent dans le Markdown source** : le composer en LaTeX
  (`table`/`longtable`), ce n'est pas concerné par cette limitation — les tableaux ne sont pas
  des images.

## 7. Livrable attendu de chaque agent

1. Le fichier `latex/chapters/final/ch<N>_*.tex` réécrit intégralement (écraser le stub),
   conforme à la structure de section cible fournie, dans le budget de mots indiqué.
2. Le contenu déplacé en annexe écrit dans le(s) fichier(s) d'annexe cible indiqué(s) par la
   fiche (écraser le stub `\todo{}` de ce fichier par le contenu réel, en gardant le
   `\chapter{}`/`\label{}` existant en tête de fichier et en ajoutant des `\section{}` pour
   distinguer les apports de plusieurs chapitres si le fichier en reçoit de plusieurs).
3. Un court résumé texte (pas un fichier) listant : nombre de mots produits, nombre de
   figures/tableaux/graphiques insérés (et combien sont `\figureaproduire` en attente), et la
   liste des `\todo{}` restants avec leur raison.
