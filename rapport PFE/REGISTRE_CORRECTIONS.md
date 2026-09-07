# REGISTRE DES CORRECTIONS C01 à C30

> État au 26/08/2026, après audit contradictoire par six experts et refonte par sept experts
> d'implémentation. Chaque ligne a été **vérifiée dans les sources LaTeX**, et non dans un
> registre déclaratif.
>
> Statuts : **Appliquée** · **Appliquée avec réserve** (le fait est écrit, une condition
> extérieure reste ouverte) · **Sans objet**.

| ID | Correction demandée | Statut | Ce qui a été fait, et où |
|---|---|---|---|
| C01 | Date de référence unique, statuts harmonisés | Appliquée | `\dateref` = 25/08/2026. Statuts d'écarts et de tests exprimés à cette date dans les chapitres 4, 5 et 6 et en annexes. Date de l'écart É3 corrigée (elle portait 25/08 en colonne alors que son statut disait 19/08). |
| C02 | É1, journaux de refus réseau, corrigé le 19/08 et vérifié | Appliquée | §5.5.1, tableau des écarts du chapitre 4, §6.2.2. Test T20 reste non exécuté, ce qui est écrit. |
| C03 | É3, identité du service d'encodage, un seul statut | Appliquée | Statut unique « corrigé le 19/08/2026, vérifié », date de colonne alignée. |
| C04 | Politiques d'organisation inapplicables, écart É7 | Appliquée | **Correction majeure** : §4.6.2 affirmait l'inverse (« une politique du fournisseur interdisant la création de clés complète ce contrôle »). Réécrite : l'absence de clé est vérifiée par inventaire du 19/08, pas garantie structurellement. Cohérente avec §5.1.1, É7 et le critère révisé de T7. |
| C05 | Déploiement par étiquette égale au SHA, écart É8 | Appliquée | §4.2.3, §5.3.1, écart É8, critère de T9 révisé. Le terme anglais *digest* est désormais défini puis traduit par « empreinte » partout. |
| C06 | Deux environnements réels, production non provisionnée, développement non miroir | Appliquée | §5.1.1 réécrite. La ligne « Production / dimensionnement complet » du tableau des environnements devient « non provisionné ». La réserve sur le développement non miroir est ajoutée. |
| C07 | §5.9 réécrite, accueil du second locataire | Appliquée | Faits du 07/08, deux rôles, base et utilisateur dédiés, six alertes et une sonde, chiffrement par clés gérées, contrôle quotidien, 6/6 du 19/08, et les limites nommées (isolation par identité et non par réseau). |
| C08 | Convention de nommage unique | Appliquée | Le lien manquant est écrit en tête de §5.9 : le second locataire **est** l'application pilote ELSON du chapitre 1. |
| C09 | Incident de la porte d'analyse statique en faux vert | Appliquée | §5.10.2 : run identifié, 612 règles sur 439 fichiers, 74 constats, code de sortie 1, 19/08/2026. Emplacement de capture double posé (exécution verte du 16/08 contre exécution rouge du 19/08). |
| C10 | Retour arrière mesuré, 11,6 s et 16,5 s | Appliquée | **Correction majeure** : le texte parlait d'une « reconstruction depuis le dépôt ». Ce sont deux bascules de trafic entre révisions existantes, mesurées le 07/08/2026 sur le service d'API en recette, non répétées. |
| C11 | Restauration : portée de la mesure explicitée | Appliquée | Tableau reconstruit avec RTO 32 min 45 s, **RPO 0**, 314 lignes sur 314, fenêtre de 7 jours, 7 sauvegardes, et la portée : configuration zonale, antérieure à la haute disponibilité régionale du 08/08. |
| C12 | T1 partiellement conforme, motif brut en 302 | Appliquée | Statut, et explication du 302 ajoutée en §6.7.4 : redirection faute de règle de blocage couvrant cette forme. |
| C13 | Chaîne d'infrastructure : apply manuel, T18 révisé | Appliquée | §5.4 réécrite. La publication du plan et l'approbation ne sont plus présentées comme des étapes de la chaîne : trois étapes automatisées, puis un geste manuel de l'administrateur. La phrase « réalise l'exigence EX18 » est retirée. |
| C14 | Limitation de débit sur la vérification du second facteur | Appliquée | §5.7. Le mot n'apparaissait nulle part dans le rapport. Onze requêtes, dix refus puis un refus pour dépassement de seuil, 19/08/2026 : c'est la preuve de T2. |
| C15 | Chiffrement du secret du second facteur | Appliquée | §5.7. Chiffrement symétrique applicatif du 19/08, clé gérée par le service de secrets, et la réserve : la migration des valeurs déjà en base n'est pas documentée comme exécutée. |
| C16 | Quantisation testée puis rejetée, modèle en précision simple | Appliquée | §4.5, §5.6.1, annexes D et F. La formulation agrammaticale de §5.6.1 est réécrite. |
| C17 | « le sixième flux (F6) », « sept niveaux L1–L7 » | Appliquée | Cohérent en §4.2.1, conclusion du chapitre 4 et conclusion générale. |
| C18 | Angles morts : exfiltration, abus des droits, seuils codés en dur, absence de test par règle | Appliquée | Tableau des lacunes de §6.3.2, sept causes. |
| C19 | Décision datée sur l'enrichissement non joint au score | Appliquée | §5.6.2 : décision du 25/08/2026, positionnement informationnel assumé, condition technique de la jointure nommée. |
| C20 | Attribution du modèle à ATT&CK-BERT / SMET, références complétées | Appliquée | Entrée `attackbert_model` créée. La référence BERT générique ne sert plus que pour l'architecture Transformer. Cinq entrées sans date complétées, une entrée jamais citée désormais utilisée (BeyondCorp). |
| C21 | Journaux d'audit : accès aux données non centralisé | Appliquée | §5.5.1. L'écart n'apparaissait nulle part : les journaux d'accès aux données restent dans l'espace par défaut, conservation de trente jours modifiable. C'est une des raisons du rejeu de T13 sur les deux plans. |
| C22 | — | Sans objet | Fusionnée dans C18 par le cahier des charges. |
| C23 | Chronologie cohérente entre le texte et le planning | Appliquée | Le planning n'était pas reconstructible selon l'ancienne version. La chronologie datée existe dans le journal d'exploitation : le diagramme de Gantt est construit à partir d'elle et sort du mode brouillon. |
| C24 | Statuts des tests dans la synthèse et l'annexe E | Appliquée | Déjà conformes ; la colonne « preuve datée » a été enrichie et le doublon de l'annexe E supprimé. |
| C25 | Coût par poste | Appliquée avec réserve | Aucun relevé de facturation n'existe. Le chiffre non sourcé « environ 60 % de la facture » est supprimé. Le fait attesté est cité, et un ordre de grandeur reconstitué à partir du dimensionnement réel est ajouté, présenté comme reconstitution. |
| C26 | Tableau des acronymes hors numérotation | Appliquée | Cause racine corrigée : l'environnement de tableau long incrémentait le compteur sans légende, la liste des tableaux commençait donc à 2. Compteur rendu, même correction sur le glossaire. |
| C27 | Budget de latence, règle sur le chiffre « 45 s » | Appliquée | §4.4 et sa figure de chronologie à cinq repères. Aucun « 45 s » n'apparaît. Deux mesures réelles sont citées : 6 min 15 s le 10/08 et environ 15 min le 19/08. |
| C28 | §6.7 démonstration du fonctionnement global | Appliquée | Scénario du 19/08, figure de chronologie réelle, tableau de correspondance avec les preuves de soutenance, et ce que le scénario ne couvre pas. |
| C29 | Rôles réels du tableau de bord | Appliquée | §5.7 : administrateur, analyste, **service**. L'ancien libellé « utilisateur (application hébergée) » était faux. |
| C30 | Cadence des requêtes planifiées et fenêtre | Appliquée | Vérifiée dans le code d'infrastructure : réévaluation toutes les 5 minutes, fenêtre glissante de 15 minutes, enrichissement toutes les 15 minutes. Harmonisée dans les chapitres 4, 5 et 6 et dans les figures. |

## Bilan

- **29 corrections appliquées**, dont **quatre erreurs factuelles dures** qu'un jury aurait pu opposer au rapport : la politique d'organisation présentée comme en vigueur (C04), la haute disponibilité régionale déclarée non appliquée alors qu'elle est fermée depuis le 08/08 (hors registre, détectée à l'audit), le retour arrière décrit comme une reconstruction (C10), et les rôles du tableau de bord (C29).
- **1 sans objet** (C22, fusionnée).
- **3 chiffres non sourcés supprimés** : « environ 60 % de la facture », « 11,5 s / 1,1 s / 0,26 s » de rendu du tableau de bord, « environ 0,3 s mesuré le 25/08 ». Remplacés par les valeurs réellement attestées ou par une formulation sans chiffre.
- **4 mesures réelles récupérées des sources et absentes du rapport** : détection chronométrée à 6 min 15 s le 10/08, démarrage à froid du tableau de bord à environ 10,5 s, RPO égal à 0, et 872 vecteurs couvrant 697 techniques.

---

# Corrections C31 à C47 — passe de contrôle qualité du 27/08/2026

> Passe issue de `MENAL_CONTROLE_QUALITE_PROMPTS.md` : cadrage, complétude ciblée et finition.
> **Aucun fait, aucun chiffre et aucune date du rapport n'a été modifié.** Aucune preuve n'a été
> fabriquée : les captures restent des emplacements réservés en annexe H. Chaque affirmation
> nouvelle a été vérifiée dans le code du projet (Terraform, API) avant d'être écrite.

| ID | Correction | Statut | Ce qui a été fait, et où |
|---|---|---|---|
| C31 | Échelle des objectifs : binaire → trois niveaux | Appliquée | Tableau 24 (§6.9) : colonne « Atteint ? / Partiel » remplacée par **Conçu / Réalisé / Mesuré**. Chaque ligne commence par l'acquis, puis nomme ce qui n'est pas mesuré. Aucun fait modifié ; O1–O5 « Réalisé », O6 « Réalisé, mesuré en partie ». Paragraphe de définition de l'échelle ajouté avant le tableau, et paragraphe de synthèse après. |
| C32 | Cadrage des 12 protocoles non exécutés | Appliquée | §6.2.1 (paragraphe de distinction ajouté), colonne « Résultat » du tableau 17 → « Non exécuté, protocole prêt », conclusion du chapitre 6 et conclusion générale. Le statut et le décompte (3 / 5 / 12) sont **inchangés**. |
| C33 | Justification du volume du corps | Appliquée | Fin de l'introduction générale : corps « approche les soixante-dix pages » contre une quarantaine indiquée comme repère, avec l'énumération des pièces de preuve qui expliquent l'écart. Chiffre vérifié sur le PDF compilé (corps p. 1 à 68). |
| C34 | Limites réseau explicitées | Appliquée | Tableau 23 (§6.8) : trois lignes ajoutées — isolation portée par l'identité et non par le réseau ; connecteur d'accès privé et instance de base partagés = point de défaillance unique et vecteur de contagion ; compteurs de la vue d'ensemble issus du trafic de recette. |
| C35 | Posture de sortie réseau réellement configurée | Appliquée | §5.6.1, paragraphe dédié. Vérifié dans `terraform/modules/vpc/main.tf` et `modules/ml-pipeline/main.tf` : passerelle de traduction d'adresses sur le sous-réseau privé, adresses attribuées automatiquement, journalisation restreinte aux erreurs, sortie des services limitée aux plages privées sauf la tâche d'enrichissement. Conclusion écrite sans complaisance : la configuration **n'établit pas** l'absence de sortie ; T14 et T20 restent à rejouer. |
| C36 | §4.5 : phrase dense scindée | Appliquée | La phrase sur « quatre couches sur six désignent une confiance résiduelle » est coupée en deux constats numérotés et explicités. |
| C37 | `pending_embeddings` : schéma mort traité | Appliquée | Tableau 14 (§5.5.1) : la ligne porte désormais « retrait décidé le 25/08/2026, non appliqué ». Un court paragraphe l'assume explicitement après le tableau. |
| C38 | Version ATT&CK fixée | Appliquée avec réserve | §6.3.1, annexe E (paramètres de campagne) et annexe F (jeu d'évaluation). Aucun numéro de version n'a été inventé : le script de chargement récupère le lot STIX sur la **branche courante** du dépôt MITRE, sans épinglage — fait vérifié dans `scripts/load_attack_catalogue.py`. L'instantané est donc identifié par une **empreinte vérifiable** (872 vecteurs, 697 techniques, 15 tactiques dont TA0005 « Stealth » et TA0112 « Defense Impairment », vérifiée dans `api/app/bigquery.py`), et l'absence d'épinglage est nommée comme correction à faire. |
| C39 | Score d'incident qualifié d'heuristique de tri | Appliquée | §5.5.1. Vérifié dans `api/app/routers/siem.py` : poids par gravité plus prime fixe lorsque au moins deux tactiques distinctes sont rattachées à une même entité. Le texte précise que le score ordonne la file et ne constitue pas un verdict, cohérent avec la colonne « verdict » laissée vide. |
| C40 | Observabilité de sécurité vs observabilité d'exploitation | Appliquée | §6.5.1, paragraphe dédié. Les dix règles d'alerte et la sonde sur le point de santé `/health` sont vérifiées dans `terraform/modules/monitoring/main.tf`. Écrit noir sur blanc : aucune alerte n'a été déclenchée volontairement, T12 et T19 restent à rejouer, aucune règle d'alerte sur le budget d'erreur des objectifs de service, aucune alerte de budget de facturation. |
| C41 | Reconstruction : capacité acquise, mesure manquante | Appliquée | §6.5.2 reformulée pour séparer la capacité (acquise, l'environnement a été reconstruit depuis le code) de la mesure (durée de bout en bout non chronométrée), avec renvoi à l'emplacement de preuve K19. |
| C42 | Direction de remédiation par constat de coût ouvert | Appliquée | Tableau 20 (§6.5.3) : colonne « Direction de remédiation » ajoutée pour les trois constats. Statuts **inchangés**. Paragraphe explicatif : la facture tient au nombre de balayages, pas au volume ; une réduction de rétention n'aurait aucun effet. Aucune remédiation n'est déclarée appliquée. |
| C43 | Comparaison qualitative à l'alternative commerciale | Appliquée | §6.5.3. Comparaison de **structure** de coût (facturation à la donnée ingérée et abonnement plancher, contre coût dominé par l'ingestion sans plancher, aux paliers gratuits), explicitement bornée : aucun montant avancé, faute de grille tarifaire datée. Garde-fou manquant nommé : aucune alerte de budget déclarée, prérequis de T19. |
| C44 | « Temps réel » clarifié, compteurs de recette signalés | Appliquée | §5.7 : le rafraîchissement de l'interface porte sur des résultats déjà calculés, la détection reste bornée par la cadence de 5 min sur fenêtre de 15 min. §6.8 : ligne de limite sur les compteurs de la vue d'ensemble (trafic de recette, pas usage réel). |
| C45 | Autorisation des 9 points d'entrée | Appliquée | §5.7.2. Vérifié dans `api/app/routers/siem.py` : les neuf points d'entrée déclarent le **même** composant d'autorisation, huit admettant administrateur et analyste, le neuvième (verdict) l'administrateur seul. Le risque résiduel est écrit : la déclaration reste à la charge de chaque route, et le test d'inventaire qui le fermerait n'existe pas. |
| C46 | Dédicace et remerciements à la famille | Appliquée | `frontmatter/dedicace.tex` rédigée et **sortie du mode brouillon** dans `main.tex` (elle n'était imprimée qu'en version de travail). Paragraphe famille ajouté aux remerciements. |
| C47 | Maximes limitées à une par chapitre | Appliquée | Chapitre 6 : « la mesure fait foi » (§6.5.1) remplacée par l'énoncé du fait. La maxime d'introduction du chapitre est conservée. Chapitre 4 : une seule maxime, conservée. |

| C48 | Collisions de libellés dans les schémas d'architecture | Appliquée | **Deux défauts visibles corrigés en TikZ**, sans changer de moteur de rendu ni rompre la cohérence typographique. *Figure 5 (p. 30)* : le libellé « identité seule (É11) » recouvrait le texte « refus par » de la boîte L4 — canal horizontal remonté de 5,05 à 5,20, libellé déporté sur le segment vertical dans la zone libre à droite ; canal « étiquette SHA (F3) » remonté à 5,50 pour séparer les deux canaux de 0,30 ; « par le connecteur » descendu sous la rangée, l'entre-deux des boîtes (1 cm) étant plus étroit que le mot. *Figure 8 (p. 33)* : « lecture / écriture » était rayé par une diagonale — **cause racine** : TikZ dessine dans l'ordre du source et les diagonales étaient tracées après les libellés. Ordre inversé (diagonales d'abord), fond blanc sur tous les libellés d'arête, « non cloisonné (É9) » déplacé de pos 0,70 à 0,82 pour sortir du croisement, et passé en noir pour rester lisible sous un trait gris. |

| C49 | Nombre de fichiers analysés par la porte d'analyse statique | Appliquée | **Erreur factuelle**, trouvée le 28/08/2026 en relisant le journal réel de l'exécution CI du 19/08 (`gh run view 32265394559 --log`). Le journal dit `Ran 612 rules on 439 files: 74 findings.` et `Scanning 439 files tracked by git`. Le rapport écrivait **438**. Corrigé en **439** au §5.10.2 et dans la légende de la figure 16, ainsi que dans `PLAN_CAPTURES.md` et la ligne C09 ci-dessus. Sans cette vérification, la capture K02 aurait affiché 439 sous une légende annonçant 438 — exactement la contradiction interne que le cahier de preuves cherche à éviter. |

## Vérifications sans changement

- **Écarts É9 et É11** : bien deux écarts distincts, cohérents partout (figure 5, figure 8, §4.6.1, tableau des écarts). Aucun doublon de numérotation. Aucune correction nécessaire.
- **Sous-réseau public (É2)** : déjà tranché au registre — « 25/08/2026, retrait décidé, non appliqué », repris en annexe D.1. Aucune correction nécessaire.
- **Nommage ELSON** : neuf occurrences, toutes en majuscules. Uniforme.
- **Couches L1–L7** : « sept niveaux, soit cinq couches et deux plans transversaux », identique au chapitre 4 et en conclusion générale.
- **Listes** : table des figures, liste des tableaux et liste des graphiques présentes et appelées dans la table des matières.
