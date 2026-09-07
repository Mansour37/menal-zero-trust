# DÉCISIONS D-01 à D-14 — toutes tranchées

> État au 26/08/2026. Le cahier des charges prévoyait quatorze décisions à renvoyer à l'auteur.
> Elles sont ici **toutes fermées** : soit par une source du projet, soit par un arbitrage
> explicite et daté. Aucune n'est laissée en attente dans le rapport.
>
> Convention : **Source** = la décision découle d'un fait attesté (le rapport ne fait que le
> refléter). **Arbitrage** = aucune source ne tranchait ; la décision est prise, justifiée, et
> le rapport en porte la trace datée.

| ID | Question | Décision retenue | Nature | Où c'est écrit |
|---|---|---|---|---|
| D-01 | Délai « détection écrite → incident affiché » | Budget de latence par étape, sans chiffre global inventé. Deux mesures réelles sont citées : **6 min 15 s** le 10/08/2026 sur un scénario de force brute, et **environ 15 min** le 19/08/2026 sur le scénario de bout en bout. Le segment « détection → affichage » est décrit comme calculé à la requête, non mesuré. Le chiffre « 45 s » n'apparaît nulle part. | Source | §4.4, figure de chronologie, §6.3.3 |
| D-02 | Nommage du second locataire | **ELSON**, désigné une seule fois comme « l'application pilote ELSON » puis « le second locataire ». Le socle héberge la plateforme MENAL (API et tableau de bord) et, à côté, ELSON comme premier locataire client. La double graphie des sources est supprimée. | Arbitrage | §1.2.1, §5.9, §6.7 |
| D-03 | Enrichissement non joint au score | **Positionnement informationnel assumé**, décision datée du 25/08/2026 ; la jointure au score est renvoyée en perspective, avec sa condition technique (ajout d'une clé d'entité à la table d'enrichissement). | Arbitrage | §5.6.2, §6.4, conclusion générale |
| D-04 | Chronologie du projet | Période officielle confirmée par l'auteur : **03/03/2026–07/09/2026**. Le Gantt distingue les barres macroscopiques reconstruites des jalons exactement datés : 29/07 audit, 01/08 rejet int8, 03/08 restauration, 07/08 ELSON, 19/08 correctifs et scénario, 25/08 gel des preuves, 07/09 clôture. | Source + arbitrage | §1.1.3, §5.10.4, diagramme de Gantt |
| D-05 | Statuts des tests T1–T20 | Statuts conservés tels qu'audités : **3 conformes, 5 partiellement conformes, 0 non conforme, 12 non exécutés**. La raison des douze non exécutés est désormais écrite (temps de campagne, protocoles prêts). | Source | §6.2, annexe E |
| D-06 | Cadence des requêtes planifiées | **Règles réévaluées toutes les 5 minutes, sur une fenêtre glissante de 15 minutes ; enrichissement toutes les 15 minutes.** Vérifié dans le code d'infrastructure (`every 5 minutes` et `*/15`). Le délai d'environ 15 min du 19/08 correspond à la fenêtre, pas à la cadence. | Source | §4.4, §5.5, §6.3.3 |
| D-07 | Coût mensuel par poste | Aucun relevé de facturation n'existe dans les sources : **aucun montant ventilé n'est publié**. Le rapport cite le seul fait attesté (paliers gratuits, quelques dizaines d'euros par mois, poste dominant l'ingestion de journaux) et ajoute un **ordre de grandeur reconstitué** à partir du dimensionnement réellement déclaré dans le code, explicitement présenté comme une reconstitution et non comme une mesure. | Arbitrage | §6.5.3 |
| D-08 | Rôle de l'élève-ingénieur | **Décrit à la première personne**, projet mono-porteur : audit, exigences, architecture, infrastructure en code, deux chaînes de livraison, chaîne de détection, campagne de validation, exploitation quotidienne. | Arbitrage | §1.1.3, §5.10.1, conclusion générale |
| D-09 | Formulation initiale de la mission | La lettre de mission n'existe pas dans les pièces disponibles. Le rapport décrit **la mission effectivement réalisée** et dit explicitement qu'il ne reconstruit pas a posteriori un libellé initial. | Arbitrage | §1.1.3 |
| D-10 | Service d'accueil | Périmètre cloud et sécurité de MENAL-SARL, encadrement entreprise nommé, **aucun organigramme formel dans cette structure jeune** : le fait est écrit tel quel, sans effectif inventé. | Arbitrage | §1.1.2 |
| D-11 | Plafond de traduction des règles | Le nombre de règles publiques non traduites n'est pas inventorié. Le rapport publie la **cause** (traduction manuelle, coût par règle, plafond tenable par une personne) sans publier de taux de couverture, faute d'inventaire versionné du dénominateur. | Arbitrage | §6.3.1, §6.3.2 |
| D-12 | Période d'observation | Bornes réelles de la campagne : **29/07/2026 (audit initial) au 23/08/2026 (dernières preuves capturées)**, statuts exprimés à la date de référence du 25/08/2026. | Source | §6.1 |
| D-13 | Disponibilité et latence sur 30 jours | Aucune observation sur trente jours de trafic réel n'existe. Le rapport publie la seule mesure attestée, en §6.5.1 : **latence au 95ᵉ centile comprise entre 9,5 ms et 1004 ms sur 48 heures, relevée le 07/08/2026, avec un seul point au-dessus de 800 ms**. Il dit explicitement que cette fenêtre est trop courte, et le trafic trop artificiel, pour valider un objectif de service sur trente jours. | Arbitrage | §6.5.1, §6.8 |
| D-14 | Planning prévu contre réalisé | Le calendrier **prévisionnel** n'a pas été conservé. Le Gantt couvre toute la période administrative et présente une reconstruction macroscopique du réalisé ; les jalons prouvés sont graphiquement distingués. Aucun prévisionnel n'est inventé a posteriori. | Arbitrage | §5.10.4 |

## Deux points restant du ressort administratif de l'auteur

Ils ne concernent pas le contenu technique et ne bloquent pas la remise :

1. **Intitulé officiel de la filière ESPRIT** sur la page de garde. Un commentaire est posé dans le source ; aucun intitulé n'a été inventé.
2. **Date de soutenance**, à porter sur la page de garde et le formulaire de dépôt dès qu'elle est fixée. Un espace de saisie est prévu, aucune date factice n'est imprimée.
