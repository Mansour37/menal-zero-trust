# Conformité à la note pédagogique ESPRIT — contrôle du 30/08/2026

**Document contrôlé :** `latex/build.pdf`, compilé le 30/08/2026 (XeLaTeX + Biber, deux passes).
**Référentiel :** note pédagogique ESPRIT (*Rapport de stage — forme du rapport*) et lot P6 du
plan d'exécution `04_Prompts_Agent_LaTeX.md`.

## 0. Chiffres de sortie, mesurés et non estimés

```
Output written on build.pdf (147 pages).
grep -c '^!'        build.log  ->  0   (aucune erreur de compilation)
grep -ac undefined  build.log  ->  0   (aucune référence, aucune citation indéfinie)
Overfull \hbox > 10 pt         ->  0
Flottants étiquetés            ->  89, tous appelés au moins une fois dans le texte
```

| Bloc | Pages | Détail |
|---|---:|---|
| Page de garde | 1 | non numérotée |
| Liminaires (i à x) | 10 | dédicace, remerciements, résumé + abstract, acronymes, conventions, table des matières (2 p.), table des figures, liste des tableaux (2 p.) |
| **Corps** — introduction à conclusion générale | **103** | intro 1–3 · ch. 1 4–14 · ch. 2 15–25 · ch. 3 26–34 · ch. 4 35–57 · ch. 5 58–81 · ch. 6 82–101 · conclusion 102–103 |
| Bibliographie/Netographie | 3 | 104–106 |
| Annexes A à E | 29 | 107–135 |
| Formulaire de dépôt | 1 | 136 |
| **Total PDF** | **147** | |

Illustrations : **33 figures** (dont 7 cadres de restitution de preuve) et **56 tableaux**,
numérotés en continu et séparément par type.

## 1. Grille de contrôle

| # | Exigence ESPRIT | État | Où cela se vérifie |
|---|---|:--:|---|
| 1 | Page de garde conforme au modèle, titre 24 pt centré | ✅ | p. de garde ; `frontmatter/cover.tex` l. 24 (`\fontsize{24}{28}`, corrigé le 30/08 : le titre était à 23 pt) |
| 2 | Times New Roman 12 pt pour le corps | ✅ | `config/formatting.tex` l. 8 ; polices incorporées vérifiées par `pdffonts` (TimesNewRomanPSMT + variantes, Consolas pour le code) |
| 3 | Marges 2,5 cm sur les quatre côtés | ✅ | `config/packages.tex` l. 15 : `geometry[a4paper,margin=2.5cm]` |
| 4 | Interligne 1,15 | ✅ | `config/formatting.tex` l. 19 : `\setstretch{1.15}`. Exception assumée : table des matières, table des figures et liste des tableaux à interligne simple — l'interligne de la norme porte sur le texte courant, non sur des listes de renvois |
| 5 | Justification à droite et à gauche | ✅ | comportement par défaut, césure neutralisée (`\hyphenpenalty=10000`) |
| 6 | Alinéa de première ligne 0,50 cm | ✅ | `config/formatting.tex` l. 23 : `\parindent=0.5cm` |
| 7 | Pagination bas-droite, forme « n / total » | ✅ | pied de page de chaque page numérotée, p. ex. « 82 / 136 » ; `\fancyfoot[R]{\thepage\,/\,\pageref{LastPage}}` |
| 8 | Titres gras, numérotés 1, 1.1, 1.1.1, tailles décroissantes | ✅ | 18/16/14/12 pt, `config/formatting.tex` l. 60–80 |
| 9 | Retraits de titre 0,20 / 0,30 / 0,20 cm | ✅ | `\titleformat` et `\titlespacing*`, mêmes lignes |
| 10 | Exemples en italique, définitions encadrées, essentiel en gras | ✅ | encadrés `keybox` (principe clé), `alertbox` (point de vigilance), `extraitconf` (extrait de configuration) |
| 11 | Chaque figure et tableau : légende, numérotation par type, **appel dans le texte** | ✅ | 89 flottants étiquetés, **89 appelés** — vérifié par script après chaque lot ; trois orphelins corrigés le 30/08 (`tab:adressage-cible`, `tab:ann-securite-etat`, alias inutilisé `tab:frontieres`) |
| 12 | Légendes de la table des figures / des tableaux non tronquées | ✅ | trois légendes courtes rétablies le 30/08 : Tab. 5, Tab. 24 (« …justification complète en » — coupée en plein milieu) et Tab. 33 |
| 13 | Aucune ligne de code dans le corps ; détails techniques en annexe | ✅ | tous les extraits de configuration sont en annexe B (9 encadrés). Les 7 encadrés présents dans le corps sont des **spécifications de prise de capture**, pas du code |
| 14 | Planning du stage sur une page complète, en fin de description du travail | ✅ | Fig. 28, p. 81 — dernière page du chapitre 5, placement `[p]` (page de flottant) posé le 30/08 : la figure partageait auparavant sa page avec la fin de §5.8.1 |
| 15 | Chapitres : introduction, développement, conclusion de transition | ✅ | « Conclusion du chapitre » présente aux six chapitres |
| 16 | Introduction générale : sujet, problématique, démarche, objectifs, plan — sans résultats | ✅ | p. 1–3 |
| 17 | Conclusion générale : récapitulation, résultats, problèmes rencontrés, apports, perspectives | ✅ | p. 102–103, les cinq points présents |
| 18 | Bibliographie/Netographie : auteur, titre, éditeur, date ; URL et date pour le web | ✅ | p. 104–106, style `biblatex numeric`, `urldate=long`, 0 citation indéfinie |
| 19 | Présentation de l'entreprise brève, centrée sur le service d'accueil | ✅ | §1.1, 2 pages (fiche signalétique + organigramme + périmètre d'accueil) |
| 20 | Pas d'illustration orpheline, pas de page quasi vide | ⚠️ | **deux résidus**, voir §2 |
| 21 | Aucun chapitre ne se termine sur quelques lignes | ⚠️ | **deux résidus**, voir §2 |
| 22 | Total ≤ 120 pages (plafond fixé par l'auteur) | ❌ | **147 pages.** Voir §3 : l'écart est mesuré et son coût de fermeture est chiffré |
| 23 | ~40 pages hors annexes (consigne ESPRIT) | ❌ | corps de 103 pages. Arbitrage à porter devant l'encadrant académique |

## 2. Les deux résidus de mise en page

| Où | Ce qu'on voit | Pourquoi il subsiste |
|---|---|---|
| p. 14, fin du chapitre 1 | la conclusion du chapitre déborde de six lignes sur une page autrement vide | la page 13 est remplie à 88 % ; résorber le débordement demanderait de retirer six lignes à une conclusion qui en compte dix, soit d'amputer le récapitulatif. Deux tentatives ont été faites — resserrement du texte, puis `\looseness=-1` — sans effet, la césure étant désactivée par la norme (`\hyphenpenalty=10000`) |
| p. 101, fin du chapitre 6 | idem, deux lignes | même cause : la page 100 est remplie à 98 % |

Ces deux pages sont le seul écart de mise en page connu. Elles se résorberont d'elles-mêmes à la
première modification de contenu en amont dans le chapitre concerné.

## 3. L'écart de volume, mesuré

Le plafond de 120 pages n'est pas atteint, et le motif est arithmétique et non éditorial.

```
Corps + annexes            = 456 000 caractères de texte composé
Densité moyenne mesurée    = 3 081 caractères par page
Densité maximale du gabarit≈ 3 400 caractères par page (page de prose pleine)
                             -> le document est à 91 % de sa densité maximale
```

À cette densité, **136 pages numérotées représentent le plancher du contenu actuel**. Tenir 120
pages au total suppose de retirer de l'ordre de **80 000 caractères, soit 19 % du contenu** — pas
de la mise en forme. Les leviers typographiques ont été exploités et rendus : blanc
inter-paragraphe ramené à zéro, blancs de flottants divisés par deux, espacement des titres de
chapitre réduit, table des matières et listes à interligne simple, blanc inter-groupes des listes
ramené de 10 pt à 2 pt. Le total de ces réglages est de **deux pages**.

**Ce qu'il faudrait couper pour tenir 120 pages, par ordre de coût croissant :**

| # | Coupe | Gain | Ce qu'on perd |
|---|---|---:|---|
| 1 | Colonne « prix payé » du tableau des 33 briques (annexe A.3.1) | ≈ 3 p | l'arbitrage nommé de chaque brique — c'est l'argument que le mémoire oppose à un inventaire de catalogue |
| 2 | Détail règle par règle du pare-feu et longueur de préfixe (annexe D.4) | ≈ 2 p | l'opposabilité du critère « aucune règle d'autorisation ne comporte de plage source » |
| 3 | Colonne « contrôles apportés » de la conception par couche (annexe D.3) | ≈ 3 p | le lien entre chaque niveau et le contrôle qu'il exerce |
| 4 | Protocoles T1 à T20 in extenso (annexe E) ramenés à leurs critères | ≈ 3 p | la reproductibilité des tests par un tiers |
| 5 | Jeu d'évaluation sémantique (annexe E.4) | ≈ 3 p | la condition de publication de chaque grandeur |
| 6 | Registres D00–D16 et É1–É11 ramenés à leur libellé | ≈ 3 p | la justification des décisions d'architecture |
| 7 | Sous-sections « ce que le système ne détecte pas » et « ce que le filtrage ne protège pas » | ≈ 3 p | la partie du mémoire qui établit sa propre crédibilité |
| 8 | Fusion des chapitres 4 et 5 | ≈ 6 p | la lisibilité de la traçabilité PH0–PH7 |

Les coupes 1 à 6 sortent du mémoire des pièces qui pourraient être **citées comme pièce jointe**
plutôt que supprimées (`DOSSIER_TECHNIQUE_MENAL.md` porte déjà ces registres) : c'est la seule
voie identifiée qui tienne 120 pages sans détruire de contenu. Les coupes 7 et 8 sont déconseillées.

## 4. Ce qui a été vérifié et n'appelle aucune action

- **Aucune formule creuse.** Balayage lexical sur le PDF : 0 occurrence de « crucial », « il est
  important de noter », « robuste », « joue un rôle », « en somme », « notamment », « afin de »,
  « en effet », « il convient de », « pierre angulaire ». « Par ailleurs » : 4 occurrences sur
  147 pages.
- **Format de date.** JJ/MM/AAAA partout dans le corps et les annexes ; treize occurrences en
  toutes lettres normalisées le 30/08. Seule exception conservée : la citation de la loi
  tunisienne n° 2004-63 du 27 juillet 2004, forme juridique usuelle.
- **Cohérence chronologique.** Aucune date hors de la fenêtre [03/03/2026 ; 29/08/2026] ; le
  scénario du 19/08/2026 et la date de référence du 25/08/2026 sont inchangés.
- **Renvois.** 0 numéro de section ou de chapitre écrit à la main : les 172 renvois qui en
  portaient un ont été convertis en `\cref` (voir le changelog).
