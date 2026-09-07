# CHANGELOG DU RAPPORT — session du 26/08/2026

> Traçabilité des modifications de fond et de forme. Chaque ligne : où, ce qu'il y avait avant,
> ce qu'il y a maintenant, et l'identifiant de correction correspondant.
>
> Méthode : six experts ont audité le rapport en lecture seule et de façon contradictoire
> (structure et conformité ESPRIT, véracité factuelle contre les sources du projet, style et
> pédagogie, forme LaTeX, schémas, plan de preuves). Sept experts d'implémentation ont ensuite
> appliqué les corrections, chacun propriétaire exclusif de ses fichiers. Trois experts de
> condensation ont refermé le budget de pages.

---

## 1. Erreurs factuelles corrigées

Ce sont les modifications les plus importantes : le rapport affirmait des choses que ses propres
sources contredisent.

| Où | Avant | Après | ID |
|---|---|---|---|
| §4.6.2 | « Une politique du fournisseur interdisant la création de clés de service complète ce contrôle, qui ne dépend donc pas de la seule discipline de l'opérateur. » | L'absence de clé est vérifiée par inventaire du 19/08/2026, pas garantie par une contrainte d'organisation, qui est inapplicable faute d'organisation cloud (écart É7). | C04 |
| §6.5.3 et annexe D (2 emplacements) | « Haute disponibilité base de données : instance zonale, sans réplica ; bascule régionale non appliquée. » | Bascule régionale appliquée et confirmée en direct le 08/08/2026 ; seule limite réelle : le basculement de zone n'a jamais été provoqué ni chronométré. | — |
| §6.5.2 | « 11,6 s pour une reconstruction depuis le dépôt et 16,5 s pour la version ciblée » | Deux bascules de trafic entre révisions existantes, mesurées le 07/08/2026 sur le service d'API en recette, non répétées. | C10 |
| §5.7 | Rôles « administrateur, analyste, utilisateur (application hébergée) » | Rôles réels du jeton : administrateur, analyste, **service**. Aucun rôle n'existe pour les utilisateurs de l'application hébergée. | C29 |
| §5.4 | La publication du plan et l'approbation manuelle présentées comme des étapes de la chaîne, « réalisant l'exigence EX18 » | Trois étapes automatisées, puis un geste manuel de l'administrateur hors chaîne. La réserve est ce qui rend T18 partiellement conforme. | C13 |
| §5.1.1 | Trois environnements « correspondant à des projets cloud distincts », dimensionnement « complet » pour la production | Deux environnements réels, production non provisionnée, et la réserve : le développement n'est pas un miroir fidèle de la recette. | C06 |
| §4.8.1 et annexe D | « quinze entrées à la date du 11 août 2026 » contre « à la date du 25 août » | Formulation unique et datée : la plus ancienne du 30/07/2026, la plus récente du 19/08/2026. | C01 |
| Tableau des écarts, ligne É3 | Colonne Date : 25/08/2026, alors que le statut disait « corrigé le 19/08 » | Colonne Date : 19/08/2026. | C03 |

## 2. Chiffres non sourcés retirés

| Où | Chiffre retiré | Remplacé par |
|---|---|---|
| §6.5.3 | « environ 60 % de la facture de recette » | Constat qualitatif : une instance maintenue active produit un coût continu sans contrepartie en recette. |
| §4.4 et §6.5.1 | « 11,5 s au premier accès, 1,1 s puis 0,26 s à chaud » | La seule valeur attestée : environ 10,5 s de démarrage à froid du tableau de bord, 07/08/2026. |
| §4.4 | « requête complète d'environ 0,3 s, mesuré le 25/08/2026 » | « Le refus est synchrone » — aucun chiffre, faute de mesure archivée. |

## 3. Contenus manquants ajoutés, à partir des sources

| Où | Ce qui a été ajouté | ID |
|---|---|---|
| §5.7 | Limitation de débit sur la vérification du second facteur : onze requêtes, dix refus puis un refus pour dépassement de seuil, 19/08/2026. Preuve de T2. | C14 |
| §5.7 | Chiffrement du secret du second facteur, 19/08/2026, avec la réserve sur la migration des valeurs existantes. | C15 |
| §5.5.1 | Journaux d'accès aux données non collectés durablement : conservation de trente jours modifiable. Explique pourquoi T13 doit être rejoué sur deux plans. | C21 |
| §5.9 | Le second locataire **est** l'application pilote ELSON du chapitre 1. Le lien manquait, le jury ne pouvait pas le faire. | C08 |
| §5.6.2 | Décision datée du 25/08/2026 sur le positionnement informationnel de l'enrichissement. | C19 |
| §4.4 | Mesure réelle absente du rapport : détection chronométrée à 6 min 15 s le 10/08/2026. | C27 |
| §6.5.2 | RPO égal à 0, et portée de la mesure de restauration (configuration zonale, antérieure au 08/08). | C11 |
| §1.5.1 | Trois obligations techniques prises en charge au titre du RGPD, et ce qui reste au responsable de traitement. Le sigle n'apparaissait nulle part. | — |
| §6.2 | La raison des douze tests non exécutés : temps de campagne, protocoles publiés, priorité donnée aux correctifs du 19/08. | — |
| §6.5.3 | Ordre de grandeur des postes de coût, reconstitué à partir du dimensionnement réel et présenté comme reconstitution. | C25 |

## 4. Schémas

| Figure | Avant | Après |
|---|---|---|
| Modèle en couches | Aucune flèche vers le plan d'observabilité ni vers le plan d'identité : la figure reproduisait les deux défauts que le texte disait avoir corrigés | Collecte tracée depuis toutes les couches, vérification d'identité à chaque saut |
| Vue de déploiement | Flux de collecte passant par le réseau privé, service d'encodage sans sortie, aucun flux étiqueté, texte à 5,4 pt | Collecte par le plan d'observabilité, flux F1 à F5 étiquetés, plus aucune mise à l'échelle réductrice |
| Chaîne de détection | Pipeline synchrone qui contredisait trois passages du rapport | Deux cycles indépendants, avec la jointure non réalisée matérialisée |
| Chronologie de l'incident | Quatre repères, aucune échelle, jamais appelée dans le texte | Cinq repères, échelle explicitée, délais par segment, appel ajouté |
| Graphique des 41 critères | Trois statuts codés par la seule couleur : faux en noir et blanc | Niveaux de gris et cadres, axe gradué |
| Chaîne de livraison | 11,5 cm de haut pour huit étapes linéaires | Ruban horizontal de 3,8 cm |
| Démarrage à froid | Deux graphiques identiques dans deux chapitres, dont une étiquette non sourcée | Un seul graphique, gradué, avec le seuil de sonde qui explique l'incident |
| Plan d'identité, boucle F6, scénario du 19/08 | Absents | Trois figures ajoutées : la segmentation réelle, l'apport propre du mémoire, et la démonstration de bout en bout |
| Diagramme de Gantt | Enfermé dans le mode brouillon : absent de la version de remise, en défaut sur la note ESPRIT | Dessiné à partir de la chronologie réelle, sur une page complète |

## 5. Forme LaTeX

| Défaut | Avant | Après |
|---|---|---|
| Références croisées | « tableau table 4 », « Le table 2 », « sections 1.4 and 1.5 » | Francisation complète, posée dans `\AtBeginDocument` pour éviter le dépassement de pile au changement de langue |
| Liste des tableaux | Commençait au numéro 2 : le tableau des acronymes consommait le numéro 1 | Compteur rendu après les deux tableaux hors numérotation |
| Bibliographie | URL étirées par la justification, cinq entrées sans date, une entrée jamais citée, modèle d'enrichissement mal attribué | Bibliographie en drapeau, dates complétées, BeyondCorp cité, entrée ATT&CK-BERT créée |
| Emplacements de capture | Macro définie, jamais appelée : aucun emplacement dans la version de remise | Neuf emplacements dans le corps, deux en annexe, macro affichant l'image si elle existe |
| Débordements | 1 débordement vertical de 37,9 pt et 15 débordements horizontaux | Zéro débordement vertical, un seul horizontal résiduel |
| Labels dupliqués | `sec:detection` et `sec:enrichissement` définis deux fois : les renvois pointaient vers la mauvaise section | Labels du chapitre 6 renommés |
| Réservation d'espace | Un titre placé après un paragraphe débordant provoquait une page de trois lignes suivie d'un grand blanc | Deux gardes ajoutées : page vierge et page à peine commencée |
| Fichiers orphelins | Huit fichiers d'annexes jamais inclus, contenant les seuls marqueurs d'attente du dépôt, plus une trentaine de fichiers de test | Supprimés |
| Annexe des captures | Fichier existant mais jamais inclus, en collision de lettre avec l'annexe F | Devenue l'annexe H, incluse, avec le protocole de preuve des captures manquantes |

## 6. Structure et style

- Titres des chapitres 1 et 6 alignés sur le sommaire cible.
- Fusion des sous-sections « provenance » et « référentiels » du chapitre 2.
- Tableau des exigences fusionné dans la matrice de traçabilité ; la formulation complète des
  vingt exigences est déplacée en annexe C, non perdue.
- Tableau des cas d'utilisation supprimé : il dupliquait intégralement la figure qui le suivait.
- Deux tableaux du chapitre 2 déplacés en annexe A.2 ; tableau de couverture des exigences
  déplacé en annexe D.
- Quatorze maximes et jugements de valeur supprimés ; une seule phrase de principe par chapitre.
- Onze définitions posées à la première occurrence (locataire, requête planifiée, fenêtre
  glissante, porte bloquante, empreinte, étiquette, fédération d'identité, démarrage à froid,
  dérive, plan, application).
- Style du corps : de **26,8 mots par phrase** sur le chapitre le plus atteint à une moyenne
  générale sous 22 ; taux de phrases de plus de 40 mots ramené sous 5 % ; tirets cadratins hors
  tableaux ramenés de 176 à moins de 40 ; zéro terme de la liste interdite.
- Résumé, abstract, introduction générale et conclusion générale réécrits ; la problématique est
  désormais rigoureusement identique dans l'introduction et au chapitre 1.

## 7. Revue typographique, schémas et planning — 27/08/2026

| Zone | Avant | Après |
|---|---|---|
| Coupures de mots | Césures françaises visibles en fin de ligne, dont « numé- / riques » | Césure automatique et césure explicite neutralisées ; zéro mot coupé détecté dans le PDF final |
| Architecture avant projet | Branchement B3 ambigu, flux non étiquetés et lecture en zigzag | Flux principal horizontal, protocoles nommés, WAHA et sauvegarde séparés, appel B3 relié sans ambiguïté à PgBouncer |
| Cas d'utilisation | Associations traversant les cas, acteurs automatiques dessinés comme des humains, lien A4–UC5 absent | Associations UML sans flèche, chemins dégagés, A5/A6 représentés comme systèmes, lien A4–UC5 ajouté |
| Diagrammes internes | Plusieurs mots artificiellement coupés dans les nœuds | Retours à la ligne uniquement entre mots entiers et largeurs de nœuds recalibrées |
| Planning | Fenêtre technique juillet–août présentée comme si elle couvrait le stage | Période officielle 03/03/2026–07/09/2026, huit macro-phases et sept jalons datés ; distinction explicite entre reconstruction et faits attestés |
| Annexes A et D | Titre ou paragraphe isolé produisant une page très peu remplie | Ruptures de page repositionnées ; aucune page parasite au contrôle visuel |
| Validation | 110 pages, un débordement horizontal résiduel | 112 pages finales et 116 pages brouillon ; zéro erreur, zéro référence indéfinie, zéro débordement et contrôle visuel intégral |

## 8. Fermeture systématique des tableaux — 27/08/2026

| Zone | Avant | Après |
|---|---|---|
| Bordures | Style `booktabs` ouvert sur les côtés et séparation partielle des lignes | Cadre extérieur fermé, séparateur vertical entre toutes les colonnes et trait horizontal après chaque ligne |
| Cohérence | Styles hétérogènes entre préliminaires, chapitres et annexes | Transformation reproductible appliquée aux 15 fichiers LaTeX réellement compilés |
| Lisibilité | Espacement prévu pour des tableaux sans traits verticaux | `\tabcolsep` ramené à 4 pt, traits réglés à 0,4 pt et hauteur de ligne à 1,08 pour conserver l'équilibre typographique |
| Validation | Contrôle limité aux erreurs de compilation | 43 tableaux numérotés, tableaux liminaires et annexes contrôlés ; 112 pages finales et 116 pages brouillon, sans erreur ni débordement |
