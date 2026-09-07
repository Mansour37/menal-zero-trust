# CHECKLIST DE CONFORMITÉ ESPRIT

> Vérifiée le 27/08/2026 sur le PDF réellement compilé (`output/pdf/rapport_menal_remise.pdf`,
> **116 pages**) et sur les sources LaTeX. Chaque ligne porte la preuve du contrôle, pas une
> déclaration.

## Forme du document

| # | Critère | État | Preuve |
|---|---|---|---|
| 1 | Page de garde selon le modèle | ✅ | Fond officiel ESPRIT pleine page, titre sur trois lignes, « DevSecOps » insécable. **Le champ de spécialité était imprimé par-dessus le libellé « SPÉCIALITÉ : » du gabarit : corrigé le 27/08** |
| 2 | Police Times New Roman | ✅ | `\setmainfont{Times New Roman}` |
| 3 | Corps en 12 pt | ✅ | Classe `[12pt]`, mesuré à 11,96 pt dans le flux du PDF |
| 4 | Marges 2,5 cm sur les quatre côtés | ✅ | `\usepackage[a4paper,margin=2.5cm]{geometry}` |
| 5 | Interligne 1,15 | ✅ | `\setstretch{1.15}` |
| 6 | Texte justifié | ✅ | Seule la bibliographie est en drapeau, pour éviter l'étirement des URL |
| 7 | Alinéa de 0,5 cm | ✅ | `\setlength{\parindent}{0.5cm}` |
| 8 | Titres numérotés en gras | ✅ | Chapitres, sections et sous-sections |
| 9 | Police minimale de 8 pt dans les figures | ✅ | Toutes les mises à l'échelle réductrices supprimées ; **plus aucun `\tiny` dans les schémas** (il en restait trois au 26/08) |

## Structure

| # | Critère | État | Preuve |
|---|---|---|---|
| 10 | Introduction générale en cinq mouvements | ✅ | Sujet, Problématique (sans annoncer aucun résultat), Démarche, Objectifs, Plan du mémoire |
| 11 | Chaque chapitre : introduction, développement, conclusion | ✅ | Feuille de route en tête et « Conclusion du chapitre » en fin, pour les six chapitres |
| 12 | Conclusion générale en cinq points | ✅ | Récapitulation, Résultats chiffrés, Problèmes rencontrés, Apports, Perspectives |
| 13 | Description du travail proposé | ✅ | §1.1.3 et §1.4.2 (six objectifs mesurables) |
| 14 | Description du travail réalisé | ✅ | Chapitres 4 à 6, et §5.10.1 rédigée à la première personne |
| 15 | Planning sur une page complète | ✅ | Diagramme de Gantt refait le 27/08 : traits de jalon tracés sous les barres, étiquettes regroupées, cellules d'en-tête fusionnées, cinq niveaux de gris. **Il était auparavant en flottant de page dédiée, avec un tiers de page vide et quatre libellés barrés par les traits** |
| 16 | Difficultés rencontrées | ✅ | §5.10.2, quatre incidents avec diagnostic, correction et leçon |
| 17 | Changements apportés aux objectifs initiaux | ✅ | §5.10.3, deux changements documentés |
| 18 | Bibliographie complète | ✅ | **34 entrées**, toutes citées, aucune citation non résolue, date de consultation affichée |
| 19 | Page de validation en dernière page | ✅ | Formulaire de dépôt en dernière page |

## Figures, tableaux et code

| # | Critère | État | Preuve |
|---|---|---|---|
| 20 | Numérotation par type, avec légende | ✅ | 23 figures, 47 tableaux, 2 graphiques ; trois compteurs et trois listes séparées |
| 21 | Numérotation continue à partir de 1 | ✅ | Figures 1 à 23, tableaux 1 à 47, graphiques 1 et 2, **sans aucun trou** |
| 22 | Chaque figure et chaque tableau appelé dans le texte | ✅ | Les flottants jamais appelés ont reçu leur phrase d'appel |
| 23 | Entrées des trois listes dans la table des matières | ✅ | Table des figures, Liste des tableaux, Liste des graphiques |
| 24 | Aucune ligne de code dans le corps | ✅ | Aucun environnement de code dans les six chapitres ; extraits encadrés en annexe B |
| 25 | Citations courtes entre guillemets | ✅ | Guillemets français |
| 26 | Aucune page de trois lignes, aucune figure orpheline | ✅ | **Une seule page du corps sous 120 mots** (112 mots), contre neuf avant correction. La cause racine — une macro de réservation d'espace qui éjectait des pages — a été désactivée |
| 27 | Nomenclature technologique dans les schémas | ✅ | **Ajoutée le 27/08.** Les schémas ne nommaient aucun produit ; ils portent désormais Cloud Load Balancing, Cloud Armor, Cloud Run, Cloud SQL, BigQuery, Secret Manager, Cloud KMS, Artifact Registry, Cloud Logging, Workload Identity Federation, Gitleaks, Semgrep, Trivy. Conforme à la règle officielle Google « Use full trademarked product names » |

## Volume

| # | Critère | État | Mesure |
|---|---|---|---|
| 28 | Pages liminaires | ✅ | 14 pages (i à xiv), plafond de 14 |
| 29 | Corps, de l'introduction à la conclusion | ✅ | **64 pages** : introduction 2, ch. 1 : 9, ch. 2 : 7, ch. 3 : 8, ch. 4 : 11, ch. 5 : 14, ch. 6 : 11, conclusion 2. Maximum 65 |
| 30 | Annexes | ⚠️ | 33 pages pour un plafond indicatif de 28. Dépassement assumé : les tableaux de détail ont été déplacés du corps vers les annexes pour tenir le budget du corps |
| 31 | Décompte total | ✅ | 1 page de garde + 14 liminaires + 64 de corps + 3 de bibliographie + 33 d'annexes + 1 formulaire = **116** |
| 32 | Écart au format « environ 40 pages » | ⚠️ assumé | Justifié en une phrase à la fin de l'introduction générale |

## Compilation

| Contrôle | Résultat |
|---|---|
| Erreurs LaTeX | **0** |
| Références croisées non résolues | **0** |
| Citations non définies | **0** |
| Labels définis plusieurs fois | **0** |
| Occurrences de `??` dans le PDF | **0** |
| Débordements horizontaux | **0** (il y en avait 16 au départ) |
| Débordements verticaux | **0** |
| Références croisées en français | « tableau 4 », « sections 1.4 et 1.5 » |

## Style, critères chiffrés du cahier des charges

| Critère | Cible | Mesuré |
|---|---|---|
| Moyenne de mots par phrase, corps entier | ≤ 22 | **21,3** ✅ |
| Phrases de plus de 40 mots | < 5 % | **3,9 %** ✅ |
| Tirets cadratins hors tableaux | < 100 | **66** ✅ |
| Termes de la liste interdite | 0 | **0** ✅ |
| Marqueurs `\acompleter{}` ou `\attente{}` restants | 0 | **0** ✅ |

## Les deux points administratifs restants

Ils n'affectent ni la compilation ni la relecture :

1. **Intitulé officiel de la filière** : la valeur générique « Cycle ingénieur » est en place, avec
   un commentaire dans le source. Aucun intitulé n'a été inventé.
2. **Date de soutenance** : aucun texte factice n'est imprimé, un espace de saisie est prévu.

## Ce qui reste ouvert, et qui n'est pas de la mise en forme

- **Onze emplacements de capture attendent leur image.** Le document est cohérent sans elles :
  chaque cadre porte son identifiant, et `PLAN_CAPTURES.md` donne pour chacune la commande de
  reproduction et la consigne de masquage. Il suffit de déposer `latex/figures/<ID>.png` et de
  recompiler ; aucune modification LaTeX n'est nécessaire.
- **L'écart É9 est ouvert et documenté** : l'identité du tableau de bord conserve un droit de
  lecture sur l'entrepôt de supervision, alors que le rapport affirmait auparavant une
  interdiction structurante. Deux issues possibles — retirer les deux rôles dans le code
  d'infrastructure et redéployer, ce qui rendrait l'affirmation d'origine vraie ; ou conserver
  l'écart tel qu'il est désormais écrit.
- **Les écarts É10 et É11** — zone DNS hors du code, et accès à l'entrepôt ne traversant pas le
  réseau privé — sont eux aussi déclarés, datés et rattachés.
