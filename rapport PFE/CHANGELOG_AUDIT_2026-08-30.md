# Changelog — application de l'audit qualité au rapport LaTeX

**Date :** 30/08/2026. **Périmètre :** `latex/` (chapitres finaux, annexes, liminaires,
configuration). **Spécification appliquée :** `01_Audit_Qualite_Rapport.md`,
`02_Plan_Restructure_Sommaire.md`, `03_Plan_Preuves_Captures.md`, `04_Prompts_Agent_LaTeX.md`.

**Arbitrage de cadrage retenu par l'auteur avant exécution :** ramener le **corps** du mémoire par
déport des tableaux-catalogues en annexe, **sans aucune perte d'information** — le total du
document n'étant pas la variable optimisée. Toutes les décisions ci-dessous en découlent.

**Outillage.** Chaque lot est un script Python en `io.open(..., encoding='utf-8', newline='\n')`
qui refuse de s'exécuter si sa chaîne cible est absente ou trouvée plusieurs fois. Aucun LaTeX
écrit par heredoc, `sed`, `perl` ou `echo` : le heredoc bash mange les antislashs, y compris quoté,
et le piège s'est reproduit deux fois pendant la session.

---

## Bilan chiffré

| | Avant (30/08, 02 h 37) | Après | Δ |
|---|---:|---:|---:|
| Total PDF | 144 p | **147 p** | +3 |
| Liminaires (page de garde comprise) | 11 p | 11 p | 0 |
| **Corps** (intro → conclusion) | **105 p** | **103 p** | **−2** |
| — chapitre 2 | 13 p | **11 p** | −2 *(cible du plan : 11)* |
| — chapitre 4 | 25 p | **23 p** | −2 |
| — chapitre 5 | 24 p | 24 p | 0 *(+1 page pour le planning en pleine page)* |
| Bibliographie | 3 p | 3 p | 0 |
| Annexes | 25 p (A–F) | 29 p (A–E) | +4 |
| Erreurs de compilation | 0 | 0 | |
| Références indéfinies | 0 | 0 | |
| Overfull > 10 pt | 2 | **0** | −2 |
| Flottants orphelins | 3 | **0** | −3 |
| Cadres de restitution de preuve | 4 | **7** | +3 |

**Pourquoi le total monte alors que le corps baisse.** Le déport d'un tableau du corps vers une
annexe n'est pas neutre : la ligne d'en-tête se répète à chaque page de continuation, la section
d'accueil coûte son titre, et le flottant perd le texte avec lequel il partageait sa page. Mesuré
sur les six tableaux déplacés : **1,4 page d'annexe pour 1 page de corps gagnée.** C'est le prix de
l'arbitrage retenu ; il est explicite et réversible.

---

## P0 — État des lieux

Compilation de référence relevée avant toute modification : 144 pages, 0 erreur, 0 référence
indéfinie, 2 débordements de ligne au-delà de 10 pt. Densité mesurée page à page (`pdftotext`) :
3 049 caractères par page pour un maximum de gabarit d'environ 3 400, soit **91 % de la densité
maximale** — mesure qui a commandé toute la suite.

## P1 — Corrections factuelles

Les anomalies 1 à 5 de l'audit (renvoi « §5.10.2 » cassé, « §5.9, test T11 », « §5.3 », faute
« décrits au section 5.2.6 », discontinuité de numérotation en 4.6.x et 4.7.x) **étaient déjà
corrigées** dans l'état de départ : vérifié renvoi par renvoi. Restaient à traiter :

1. **Légendes tronquées dans la liste des tableaux.** Tab. 24 y apparaissait comme « Registre
   synthétique des décisions d'architecture (justification complète en » — la légende courte avait
   été fabriquée en coupant la longue au milieu d'un `\ref`. Corrigé pour Tab. 24, Tab. 5, et
   Tab. 33 (dont la légende courte laissait fuiter un `{}` dans la liste).
2. **Numéros de section et de chapitre écrits à la main — 172 occurrences éliminées.**
   `chapitre~4` → `\cref{ch:conception}` (94), `chapitre~\ref{}` → `\cref{}` (14),
   `tableau~\ref{}` → `\cref{}` (22), `\S~\ref{}` → `\cref{}` (20), `§\ref{}` → `\cref{}` (10),
   `figure~\ref{}`, `section~\ref{}` (10), plus les deux derniers renvois réellement codés en dur
   du chapitre 6 : `(§4.4, test T1)` → `\cref{sec:bout-en-bout}` et `(§4.6, test T5)` →
   `\cref{sec:plan-identite}`. Les commentaires du source ne sont pas touchés.
3. **Trois flottants n'étaient appelés nulle part** dans le texte, ce que la note ESPRIT interdit :
   `tab:adressage-cible` (renvoi ajouté au chapitre 4), `tab:ann-securite-etat` (phrase d'appel
   ajoutée en annexe B, avec le bon décompte : cinq protections, pas quatre), et l'alias mort
   `tab:frontieres` du chapitre 3, supprimé.

## P2 — Liminaire

Contrôlé, **déjà conforme** : 11 pages page de garde comprise, contre une cible de 12. Les
« Conventions de notation » tiennent en une page sous forme d'un tableau unique préfixe /
signification / série. Aucune action.

## P3 — Restructuration

### Chapitre 2 — les trente-trois briques *(13 p → 11 p, cible du plan atteinte)*
Le tableau des 33 briques (critère décisif et prix payé, ≈ 4,5 pages) quitte le corps pour
l'annexe A, où il rejoint la fiche de version des mêmes 33 briques. Le corps reçoit à sa place un
**tableau de synthèse par couche** de six lignes : les briques retenues et le critère qui a décidé
de la couche entière, construit uniquement à partir des cellules existantes.

L'audit demandait la **fusion** des deux tableaux en un seul. Elle n'est pas praticable :
cinq colonnes de prose (brique, critère décisif, prix payé, version, verrouillage) demandent
23,3 cm de largeur utile pour 16 cm disponibles en A4 portrait, et supprimer une colonne
contredirait la consigne de non-perte. Les deux tableaux sont donc **rendus adjacents** dans une
section unique « Inventaire technologique détaillé des trente-trois briques » (A.3), avec la
mention explicite qu'ils décrivent les mêmes briques dans le même ordre et se lisent ligne pour
ligne. Le doublon signalé par l'audit — un tableau au corps, l'autre en annexe — disparaît.

### Chapitre 4 — conception par couche et topologie réseau *(25 p → 23 p)*
- Le tableau de conception détaillée des sept niveaux (4 colonnes, ≈ 4 pages) part en annexe D.3.
  Le corps garde une synthèse d'une page **extraite mécaniquement** des colonnes 1, 2 et 4 du même
  tableau : niveau, composants et produits, exigences couvertes. La colonne « contrôles apportés »,
  la plus longue, reste intégralement disponible en annexe.
- Les sous-sections 4.2.4 « Topologie réseau avant la refonte » et 4.2.5 « Refonte du plan réseau
  appliquée (D15) » sont **fusionnées** en une seule, « Topologie réseau : l'état antérieur et la
  cible en service », les deux volets devenant des paragraphes titrés.
- Le plan d'adressage et les douze règles de pare-feu partent en annexe D.4, appelés depuis le
  corps par deux renvois qui en donnent la substance.

### Chapitre 5 — tableaux de consultation *(24 p, dont +1 pour le planning)*
Quatre tableaux que le chapitre appelle sans les lire ligne à ligne partent en annexe B.4 :
familles de contrôles de la chaîne de livraison, modèle de données de l'entrepôt, cartographie des
vues du tableau de bord, caractérisation quantifiée des deux logiciels écrits. Le corps reçoit,
pour les familles de contrôles, la **synthèse de cinq lignes** prévue par le plan : cinq familles
réalisées et bloquantes, trois arbitrées, et la seule dont le résultat quitte la chaîne.

### Chapitre 3 — décision motivée de ne pas appliquer le plan
Le plan demandait le déport en annexe du tableau des vingt exigences EX1–EX20. **Non appliqué** :
le tableau tient en une page à raison d'une ligne par exigence, et la remplacer par « une
énumération compacte » produirait exactement le même volume au corps tout en ajoutant une page
d'annexe. La coupe aurait coûté une page et n'aurait rien rendu.

### Annexes — l'annexe F devient la section E.4
Le jeu d'évaluation de l'enrichissement sémantique est une pièce du dossier de validation, non une
annexe à part entière. Le mémoire compte désormais **cinq annexes, A à E**. Les deux renvois du
chapitre 6 ont suivi.

## P4 — Preuves et captures

Le mémoire portait quatre cadres de restitution (tableau de bord servi à un analyste, porte
d'analyse statique verte puis en échec, fiche d'incident, vue d'ensemble). Le plan de preuves en
attendait trois de plus, qui manquaient. Ils sont posés, au gabarit exact des cadres existants —
`\IfFileExists` sur `figures/<ID>.png`, encadré de spécification de prise tant que l'image n'est
pas déposée, légende courte pour la table des figures :

| Cadre | Emplacement | Ce qu'il restitue |
|---|---|---|
| **K35** | ch. 1, §1.2.1, après la boucle fonctionnelle | l'écran de contribution de l'application pilote — le cas réel, matérialisé dès le premier chapitre |
| **K36** | ch. 5, §5.1 | les charges de travail du socle sur la plateforme d'exécution : une identité par charge, une seule région |
| **K14** | ch. 6, §6.5 | les treize refus en 403 du 19/08/2026 dans le collecteur de journaux — le premier maillon du scénario de bout en bout |

Le cadre K35 a été replacé **après** la figure de la boucle fonctionnelle : posé avant, il prenait
le numéro 3 et sa légende renvoyait à la figure 4, ce qui faisait remonter la numérotation.

La phrase d'articulation prévue par le plan de preuves est posée en §6.1, juste après la hiérarchie
des rangs de preuve : elle nomme les sept cadres et rappelle qu'ils illustrent des preuves nommées
sans jamais en tenir lieu.

## P5 — Finition typographique

- **Débordements de ligne :** les deux au-delà de 10 pt (16,5 pt et 29,4 pt) venaient de deux
  chaînes en chasse fixe insécables en annexe B — un chemin de module Terraform et l'identifiant
  complet d'une règle d'analyse statique. Des points de coupure y ont été ouverts. **0 restant.**
- **`microtype` :** demandé par le plan, **non installable** — absent de l'installation MiKTeX
  locale et la machine n'a pas d'accès réseau (`mpm --install` échoue sur `api2.miktex.org`).
  La note est écrite dans `config/packages.tex`, à côté de celles de `needspace` et `emptypage`,
  qui sont dans le même cas.
- **Format de date :** treize occurrences en toutes lettres ramenées en JJ/MM/AAAA. Les dates de
  stage passent par les macros `\datedebutstage` / `\datefinstage`. La citation de loi conserve sa
  forme juridique.
- **Formules creuses :** balayage lexical du PDF, 0 occurrence des dix-huit tournures listées.
  Aucune réécriture nécessaire.
- **Filets verticaux des tableaux :** le plan demandait `booktabs` partout. **Non appliqué.** La
  grille à filets est un choix documenté du projet (`config/formatting.tex`), homogène sur les
  56 tableaux ; la conversion aurait modifié tous les tableaux du mémoire sans que la note
  pédagogique ne l'exige, pour un gain de place marginal.

## P6 — Conformité et mise en page

- **Titre de la page de garde porté de 23 pt à 24 pt**, taille imposée par la norme. Vérifié sans
  débordement.
- **Planning en page complète.** La figure 28 partageait sa page avec la fin de §5.8.1 ; son
  placement passe en `[p]` (page de flottant), ce qui satisfait « une page complète, en fin de
  description du travail » sans laisser de page blanche avant elle. Elle est désormais la dernière
  page du chapitre 5. Coût : une page.
- **Densification typographique**, appliquée en tête de session : blanc inter-paragraphe de 2 pt à
  0, blancs de flottants de 20/12/12 pt à 8 pt, légendes resserrées, espacement après titre de
  chapitre de 24 pt à 14 pt, table des matières et listes à interligne simple, blanc entre groupes
  de chapitre des listes de 10 pt à 2 pt. **Rendement total : deux pages** — le document était déjà
  à 91 % de sa densité maximale.
- Le détail point par point est dans `CONFORMITE_ESPRIT.md`.

## P7 — Livraison

- `latex/build.pdf` — 147 pages, compilation propre.
- `Rapport_PFE_vFinale_30-08-2026.pdf` — copie datée à la racine du dossier du rapport.
- `CONFORMITE_ESPRIT.md` — grille de contrôle ESPRIT, les 23 points, avec les deux résidus de mise
  en page et le chiffrage de l'écart de volume.
- `LISTE_CAPTURES_A_REALISER.md` — les sept cadres, ce que chacun doit montrer, ce qu'il faut
  masquer, et l'ordre de priorité.

## Ce qui n'est pas atteint

Le plafond de **120 pages n'est pas tenu : le document en compte 147.** L'écart est mesuré, pas
estimé : à la densité constatée, le contenu actuel occupe 136 pages numérotées au minimum, et
descendre à 120 suppose de retirer environ 19 % du contenu. La liste ordonnée des coupes
possibles, avec le coût de chacune, est au §3 de `CONFORMITE_ESPRIT.md`. Aucune n'a été appliquée :
elles relèvent d'un arbitrage de l'auteur, pas d'une décision d'exécution.
