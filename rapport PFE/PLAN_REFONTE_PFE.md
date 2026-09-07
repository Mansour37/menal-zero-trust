# PLAN DE REFONTE — extrait de référence pour les équipes

> Extrait matérialisé sur disque le 29/08/2026. Contient les parties que les prompts d'équipe
> référencent nommément. Le brief commun (`BRIEF_EQUIPES_REFONTE.md`) prime en cas de conflit.
> **Toute affirmation de ce document doit être vérifiée contre `DOSSIER_TECHNIQUE_MENAL.md`,
> qui fait foi.**

---

# §4.3 — INVENTAIRE TECHNOLOGIQUE DU SOCLE (§2.6 du mémoire)

## §4.3.0 — Le critère de sélection : qu'est-ce qu'une brique structurante ?

**À écrire en premier dans la section.** Un mémoire d'ingénieur ne recense pas ses
bibliothèques ; il recense ses **décisions d'architecture matérialisées par un composant**.

Trois critères cumulatifs. Une technologie qui n'en satisfait pas au moins deux relève de la
sous-technologie et n'entre pas dans l'inventaire :

1. **Elle a fait l'objet d'un arbitrage** : au moins une alternative sérieuse évaluée puis écartée.
2. **Son retrait modifierait l'architecture**, pas seulement une implémentation. Retirer
   l'entrepôt de supervision change le système ; retirer une bibliothèque de graphiques change
   une page.
3. **Elle porte une propriété du système** — sécurité, coût, disponibilité, reproductibilité —
   que le mémoire revendique quelque part.

Exemples d'application du critère, à écrire dans la section :

| Technologie | Brique structurante ? | Pourquoi |
|---|---|---|
| Entrepôt de données comme système de supervision | Oui | Arbitrage documenté (décision D04), porte le coût **et** la capacité de détection |
| Bibliothèque de graphiques du tableau de bord | Non | Aucune alternative évaluée, aucune propriété du système n'en dépend |
| Fédération d'identité de la chaîne d'intégration | Oui | Supprime une classe de risque entière (décision D08) |
| Bibliothèque de génération de codes temporels | Non | Implémentation d'un standard ; le standard est la brique, pas la bibliothèque |
| Pilote de base de données synchrone | Frontière | Traité comme sous-technologie, mais **son caractère synchrone est cité** au ch. 5 car il justifie un choix de conception de l'API |

## §4.3.1 — Les six tableaux d'inventaire

> **Format imposé, cinq colonnes.** La colonne « prix payé » est obligatoire et ne peut jamais
> être vide : c'est elle qui distingue une justification d'ingénieur d'une plaquette commerciale.

### Tableau N1a — Socle et infrastructure (9 briques)

| Brique | Rôle dans le socle | Alternatives évaluées | Critère décisif | Prix payé |
|---|---|---|---|---|
| **Fournisseur de cloud public unique** | Support de l'ensemble du socle | Deux autres grands fournisseurs, un fournisseur européen généraliste, un hébergeur à forfait, un hébergeur local | Seul à réunir dans un même service le stockage, le langage de détection et la recherche vectorielle — ce qui supprime la base spécialisée qu'imposeraient les autres | Réversibilité perdue : l'architecture d'origine, faite de conteneurs et d'un fichier de composition, était portable ; le socle ne l'est plus. Aucune région en Afrique de l'Ouest |
| **Infrastructure décrite en code** | Provisionnement, reproductibilité, détection de dérive | Outil de description en langage général, service de déploiement du fournisseur, provisionnement manuel | Maturité de l'écosystème de modules et portabilité de la description | Langage déclaratif : toute logique conditionnelle passe par des compteurs et des expressions, moins lisibles qu'un langage général |
| **Exécution de conteneurs sans serveur** | Support des cinq services et des trois tâches | Orchestrateur de conteneurs managé, machines virtuelles, fonctions à la demande | Aucun système d'exploitation à durcir ni cluster à exploiter — décisif sous contrainte mono-opérateur | Démarrage à froid mesuré (27 s en moyenne, 94 s au pic sur le service d'encodage) ; aucune charge de travail à état ; aucune tâche longue |
| **Réseau privé virtuel en mode personnalisé** | Isolation réseau, accès privé aux données | Réseau par défaut, réseau partagé entre projets | Contrôle explicite des plages et refus par défaut en entrée | Deux sous-réseaux déclarés et inoccupés : la topologie est plus large que l'usage réel (écart É2) |
| **Connecteur d'accès réseau sans serveur** | Sortie des charges de travail vers le réseau privé | Sortie réseau directe, absence de connecteur avec adresse publique sur la base | Seul mécanisme disponible à la date de conception pour joindre une base sans adresse publique depuis une plateforme sans serveur | Coût plancher permanent, indépendant du trafic, et **point de défaillance unique** pour sept charges de travail |
| **Traduction d'adresses de sortie** | Sortie contrôlée vers Internet | Absence de sortie, mandataire filtrant | Point de sortie unique et observable | Adresses attribuées automatiquement : aucune adresse de sortie stable, donc aucune liste d'autorisation possible chez un tiers |
| **Accès privé aux services managés** | Connexion à la base sans adresse publique | Point de terminaison privé, adresse publique avec liste d'autorisation | Élimine structurellement l'exposition de la base | Plage allouée automatiquement par le fournisseur, non maîtrisée dans la description ; module de base non réinstanciable en l'état |
| **Répartiteur de charge applicatif global** | Point d'entrée public unique, terminaison du chiffrement | Répartiteur régional, passerelle d'API, service de bord tiers | Point d'entrée unique = point de contrôle unique ; certificats gérés par le fournisseur | Variante classique retenue : la gestion avancée du trafic (pondération, mise en miroir, politiques de réessai) n'est pas disponible. Aucune n'est utilisée, mais la limite doit être énoncée |
| **Filtrage applicatif managé au bord** | Refus des charges d'attaque connues, limitation de débit, restriction géographique | Filtrage auto-hébergé en amont, service de bord tiers, absence de filtrage | Aucun composant à exploiter ; règles maintenues par le fournisseur ; application uniforme aux quatre points d'entrée | Cinq familles de règles retenues sur onze disponibles, à la sensibilité la plus basse : arbitrage explicite entre faux positifs et évasions. Aucune protection adaptative — le seuil anti-saturation est fixe |

> **À signaler explicitement** : le service de noms de domaine **n'est pas** une brique du socle.
> Les enregistrements sont créés chez le bureau d'enregistrement, hors de la description en code.
> C'est le seul maillon de la chaîne d'exposition qui échappe au principe de description en code
> (PR4). C'est l'écart É10.

### Tableau N1b — Identité, secrets et chiffrement (6 briques)

| Brique | Rôle dans le socle | Alternatives évaluées | Critère décisif | Prix payé |
|---|---|---|---|---|
| **Gestion des identités et des accès du fournisseur** | Sept identités de service, droits au moindre privilège | Identité unique partagée, droits au niveau du projet | Une identité par charge de travail : c'est ce qui remplace les pare-feux internes (PR2) | Deux liaisons restent à portée de projet là où une portée par ressource serait possible ; la granularité par instance n'existe pas pour la base |
| **Fédération d'identité pour la chaîne de livraison** | Authentification de la chaîne sans clé permanente | Clé de compte de service exportée, agent d'exécution auto-hébergé | Supprime la classe de risque au lieu de la gérer : il n'y a pas de clé à faire fuir | Dépendance à la forge logicielle comme émetteur d'assertion : sa compromission devient un chemin d'accès |
| **Coffre de secrets managé** | Neuf secrets, un par usage | Coffre auto-hébergé, variables d'environnement chiffrées, secrets de la forge | Chiffrement par clé gérée et liaison d'accès **par secret**, jamais au niveau du projet | Dépendance réseau à l'exécution pour un secret, là où le montage natif de la plateforme était disponible |
| **Service de gestion de clés, chiffrement par clés gérées** | Chiffrement de l'entrepôt, des secrets, de l'espace média | Chiffrement géré par le fournisseur, module matériel de sécurité | Contrôle de la rotation et de la révocation, exigé par la nature des données de l'application hébergée | Niveau de protection logiciel et non matériel ; le chiffrement de l'entrepôt n'est pas rétroactif — il ne s'applique qu'aux tables créées après son activation ; il est structurellement inapplicable à la base, le champ étant immuable après création |
| **Authentification applicative par jeton signé et rôles** | Contrôle d'accès à l'API de supervision | Sessions serveur, délégation à un fournisseur d'identité externe, passerelle d'authentification du fournisseur | Aucune dépendance externe ; le rôle devient visible dans la signature de chaque point d'entrée, donc auditable en lecture | Aucun mécanisme de révocation : un jeton reste valide jusqu'à son expiration après une déconnexion ou un changement de rôle |
| **Second facteur par code temporel à usage unique** | Renforcement de l'accès au tableau de bord | Facteur résistant à l'hameçonnage, envoi par message, notification poussée | Standard ouvert, vérifiable hors ligne, sans dépendance ni coût par usage | Pas de résistance à l'hameçonnage ; aucun code de secours, donc la perte du terminal exige une intervention en base ; le secret est protégé par un chiffrement applicatif et non par une enveloppe du service de clés |

### Tableau N1c — Exécution, conteneurisation et applications (6 briques)

| Brique | Rôle dans le socle | Alternatives évaluées | Critère décisif | Prix payé |
|---|---|---|---|---|
| **Conteneurisation multi-étage, utilisateur non privilégié** | Format de livraison de tous les services | Image mono-étage, construction par assemblage automatique, image minimale sans interpréteur | Surface réduite et image finale débarrassée des outils de construction — ce qui a permis d'éliminer une vulnérabilité critique en retirant le gestionnaire de paquets | Construction plus longue et fichiers de description plus complexes à maintenir |
| **Registre d'images privé du fournisseur** | Stockage des artefacts déployés | Registre public, second registre miroir, registre auto-hébergé | Un registre unique : deux registres constituent deux surfaces de chaîne d'approvisionnement et une ambiguïté sur la source de vérité (décision D07) | Aucune immuabilité d'étiquette déclarée, aucune politique de nettoyage, et l'analyse de vulnérabilité reste entièrement externe à la plateforme |
| **Cadre applicatif à validation typée pour l'API** | Vingt et un points d'entrée, unique accès aux données de sécurité | Cadre synchrone classique, cadre complet avec couche d'objets, absence d'interface intermédiaire | Validation déclarative en entrée **et** contrat de sortie forcé : le contrôle d'accès devient visible dans la signature de chaque point d'entrée | Aucun bénéfice de l'asynchronisme : les pilotes retenus sont synchrones, et écrire de l'asynchrone par-dessus des appels bloquants aurait figé la boucle d'événements. Aucune version portée par les points d'entrée |
| **Cadre web à rendu serveur pour le tableau de bord** | Douze vues, sept routes serveur | Application monopage classique, générateur de tableaux de bord en langage de script, absence d'interface | Le jeton d'authentification reste côté serveur et n'est jamais lisible par un script client — propriété de sécurité, pas de confort | Rendu dynamique à chaque requête, aucune mise en cache statique ; démarrage à froid d'environ dix secondes |
| **Accès à la base par connecteur applicatif chiffré** | Liaison entre l'API et la base | Socket local monté par la plateforme, adresse publique avec liste d'autorisation, mandataire local | Tunnel chiffré mutuellement authentifié vers l'adresse privée : c'est le plus strict des trois modes disponibles | Dépendance à une bibliothèque cliente supplémentaire et à un pilote purement interprété, donc synchrone |
| **Outil de migration de schéma versionné** | Évolution du schéma relationnel de la plateforme | Scripts appliqués manuellement, outil de migration déclaratif, absence de versionnement | Le schéma devient reconstructible depuis le dépôt — réponse directe au constat bloquant B5 de l'audit | Aucune automatisation dans la chaîne : les migrations de la plateforme sont déclenchées manuellement, là où l'application hébergée les exécute par une tâche avant déploiement |

### Tableau N1d — Données et entrepôt de supervision (5 briques)

| Brique | Rôle dans le socle | Alternatives évaluées | Critère décisif | Prix payé |
|---|---|---|---|---|
| **Base relationnelle managée, haute disponibilité régionale** | Comptes, rôles, journal d'audit applicatif, données de l'application hébergée | Base répartie du fournisseur, base compatible haute performance, base non relationnelle, base auto-hébergée | Restauration à un instant donné et bascule régionale sans exploitation à charge — décisif sous contrainte mono-opérateur ; mesuré à 32 min 45 s pour zéro perte | Instance de gamme d'entrée facturée au tarif haute disponibilité ; chiffrement par clés gérées structurellement impossible ; **une seule instance partagée entre les locataires** |
| **Entrepôt de données généraliste comme système de supervision** | Dix tables, journaux normalisés, détections, enrichissement, verdicts | Solution commerciale, service de supervision du fournisseur, pile de recherche libre auto-hébergée, solution libre intégrée | Seule option offrant stockage, langage de détection **et** recherche vectorielle dans le même service, sans base spécialisée | Ni règles, ni interface, ni corrélation, ni support fournis : trois chantiers à construire. Plafond de règles maintenables par une personne. Poste de coût dominant, avec un minimum forfaitaire par table balayée qui domine le volume réel |
| **Requêtes planifiées de l'entrepôt comme ordonnanceur** | Douze exécutions : cinq normalisations et sept règles de détection | Moteur d'orchestration du fournisseur, ordonnanceur externe déclenchant des tâches, orchestrateur de flux de travail | Aucun composant supplémentaire : l'ordonnancement vit là où vivent les données (PR1) | Cadence plancher de cinq minutes imposée par le service ; aucune dépendance entre exécutions, donc aucune garantie d'ordre ; les seuils sont figés dans les requêtes |
| **Stockage objet avec prévention d'accès public et clés gérées** | Espace média de l'application hébergée | Disque local du conteneur, système de fichiers managé | L'application d'origine écrivait sur le disque local, ce qui interdisait toute mise à l'échelle et toute reprise — c'était le constat bloquant B6 | Aucun versionnement d'objet, aucune règle de cycle de vie : une suppression accidentelle est irréversible |
| **Collecte de journaux et exports vers l'entrepôt** | Quatre exports, filtrage à la source | Agent de collecte tiers, transfert par lots, absence de centralisation | Filtrage **au moment de la collecte** et non après stockage : c'est le levier de coût principal (besoin BNF3) | Les journaux d'accès aux données ne disposent pas d'export dédié et restent dans l'espace par défaut, avec une conservation modifiable |

### Tableau N1e — Détection et enrichissement sémantique (4 briques)

| Brique | Rôle dans le socle | Alternatives évaluées | Critère décisif | Prix payé |
|---|---|---|---|---|
| **Règles de détection versionnées, écrites dans le dialecte de l'entrepôt** | Sept règles R1 à R7, fenêtre glissante, déduplication | Format de règles neutre avec moteur de conversion, moteur de règles du fournisseur, règles saisies dans une interface | Aucun moteur de conversion ne cible ce dialecte : la traduction manuelle évite une dépendance de conversion pour sept règles (verrou V2) | Aucune portabilité vers un autre système de supervision, aucun accès au corpus communautaire, et un plafond de couverture directement lié au volume maintenable par une personne |
| **Référentiel de techniques d'attaque** | Vocabulaire commun conception-détection, grille de couverture, cible de l'enrichissement | Modèle de chaîne d'attaque, classification des motifs d'attaque, référentiel de contre-mesures | Seul référentiel qui fournit à la fois un vocabulaire de détection et un catalogue textuel encodable | Le dénominateur est la matrice intégrale, qui couvre des systèmes absents du périmètre : tout taux de couverture rapporté à ce dénominateur est structurellement bas |
| **Modèle de représentation de phrases spécialisé en cybersécurité** | Encodage des détections et des techniques en vecteurs comparables | Modèle généraliste, pondération de termes sans apprentissage de domaine, table de correspondance manuelle, modèle génératif | Représentation par phrase entraînée sur le vocabulaire du domaine ; **et surtout** : un modèle qui produit un vecteur n'exécute aucune instruction, là où soumettre des journaux à un modèle génératif transmettrait une entrée contrôlée par l'attaquant à un composant qui suit des instructions | Aucune explication en langue naturelle ; poids d'environ 440 mégaoctets embarqués dans l'image ; consommation mémoire au pic de l'ordre de 900 mégaoctets |
| **Moteur d'inférence embarqué, exécution sur processeur généraliste** | Service d'encodage interne, sans sortie publique | Service d'inférence managé du fournisseur, service de modèles dédié, appel à un modèle distant | Exécution locale et déterministe, sans appel externe ni coût par appel, et sans transmission de données de sécurité à un tiers | Démarrage à froid mesuré à 94 secondes au pic, qui a imposé de recalibrer le budget de la sonde de disponibilité ; l'export quantifié a été testé puis rejeté sur mesure, donc les poids restent en précision flottante simple |

### Tableau N1f — Chaîne d'intégration et de livraison (4 briques)

| Brique | Rôle dans le socle | Alternatives évaluées | Critère décisif | Prix payé |
|---|---|---|---|---|
| **Forge logicielle et son moteur d'intégration continue** | Deux chaînes : livraison applicative et provisionnement d'infrastructure | Service d'intégration du fournisseur, moteur auto-hébergé, autre forge | Intégration native avec la fédération d'identité, qui supprime la clé permanente | Les actions réutilisées sont référencées par étiquette mobile : une redirection d'étiquette ferait exécuter un code différent sans qu'une ligne du dépôt change |
| **Détection de secrets versionnés** | Première porte bloquante de la chaîne | Autre analyseur de secrets, service de la forge, revue manuelle | Coût quasi nul, gain élevé, et **placement en tête de chaîne** : un secret est compromis dès sa publication, le détecter tôt déclenche la rotation pendant qu'elle sert encore | Jeu de règles par défaut, non spécialisé au domaine ; résultats disponibles dans les journaux de la chaîne uniquement |
| **Analyse statique du code** | Deuxième porte bloquante | Analyseur commercial, analyse sémantique de la forge, revue manuelle | Exécutable localement, jeu de règles ouvert, exclusions justifiables ligne à ligne plutôt que globalement | Le jeu de règles distant évolue : le verdict de la chaîne pouvait varier à version d'outil identique, ce qui a imposé un verrouillage de version. Sept exclusions nominatives à maintenir |
| **Analyse de vulnérabilité des images et de la configuration** | Troisième porte bloquante, sur les deux chaînes | Autres analyseurs d'images, analyseurs dédiés à la description d'infrastructure, service d'analyse du fournisseur | **Un seul outil couvre les images et la description d'infrastructure** : un composant en moins, application directe de PR1 | Aucune génération de nomenclature logicielle ni de signature d'artefact, alors que l'outil en est capable : deux familles de contrôle restent découvertes (décision D07) |

### Tableau N1g — Référentiels et méthodes mobilisés (§2.7)

| Référentiel ou méthode | Ce qu'il apporte | Alternatives évaluées | Critère décisif | Limite assumée |
|---|---|---|---|---|
| **Référentiel normatif d'architecture Zero Trust** | Sept principes directeurs servant de grille d'exigences | Modèle propriétaire d'un grand acteur, cadre d'un cabinet d'analyse | Référence normative publique, citable et vérifiable | Suppose une équipe de sécurité : aucune déclinaison n'est dimensionnée pour une exploitation par une personne (verrou V1) |
| **Modèle de maturité Zero Trust en cinq piliers** | Grille d'auto-évaluation, pilier par pilier | Auto-évaluation libre, absence d'évaluation | Permet une évaluation nuancée et honnête : « avancé sur l'identité, traditionnel sur les terminaux » plutôt qu'un verdict binaire | Auto-évaluation non auditée par un tiers |
| **Méthode d'analyse de risque orientée métier** | Valeurs métier, sources de risque, scénarios stratégiques | Cadre général de gestion du risque, autres méthodes d'analyse de menaces | Relie le risque technique à l'enjeu métier — indispensable quand l'actif est un corpus et une identité, pas un serveur | Plus lourde à dérouler ; les cinq ateliers ne sont pas tous menés au même niveau de détail |
| **Méthode de dérivation de menaces par flux** | Scénarios opérationnels, catégorie par catégorie et flux par flux | Approche par listes de contrôle, approche par arbres d'attaque | S'applique directement à une architecture décrite par flux nommés, ce qui est le cas ici | Exige un diagramme de flux avec frontières de confiance : c'est la figure du §3.3 |
| **Classement des risques applicatifs de référence** | Rattachement des règles de filtrage aux catégories de risque | Autres classements de vulnérabilités | Vocabulaire partagé avec les jeux de règles du filtrage managé | Un classement de risques n'est pas une couverture : cinq familles de règles sur onze sont activées |
| **Référentiel de configuration de la plateforme** | Grille de durcissement de la plateforme | Guides du fournisseur, absence de référentiel | Permet d'exprimer un écart **assumé** : documenté et justifié, un écart est une décision ; non documenté, une négligence | Aucun taux de conformité n'est publié, faute d'audit contrôle par contrôle |
| **Règlement européen sur la protection des données** | Cadre des obligations sur les données de l'application hébergée | Cadres nationaux applicables | Le traitement s'exécute dans une région européenne : le règlement s'applique au moins par le lieu du traitement | La détermination de la base légale, des durées de conservation et des modalités du droit d'effacement relève du responsable de traitement, hors périmètre du socle |

## §4.3.2 — Les sept composants écartés (§2.6.3)

| Composant écarté | Motif du rejet | Condition de réévaluation |
|---|---|---|
| Périmètre de service anti-exfiltration | Exige une organisation cloud, indisponible sur le périmètre administratif du projet | Création d'une organisation |
| Orchestrateur de conteneurs et maillage de services | Souplesse dont le périmètre n'a pas besoin, au prix d'un cluster à exploiter — contrainte mono-opérateur | Charges de travail à état ou besoin de communication de service à service maillée |
| Cache distribué | Aucun besoin de performance mesuré le justifiant | Volume de trafic réel dépassant les objectifs de latence |
| Déploiement multi-région | Hors périmètre déclaré au chapitre 1 | Engagement contractuel de disponibilité |
| Signature d'artefacts et nomenclature logicielle | Traçabilité recherchée obtenue par un chemin moins coûteux ; le mémoire énonce ce que ce chemin ne couvre pas | Ouverture du socle à un éditeur tiers |
| Passerelle d'authentification du fournisseur | Exige une organisation d'entreprise ; compensée par l'entrée restreinte au répartiteur | Création d'une organisation |
| **Modèle de langue génératif pour l'enrichissement** | **Seul rejet motivé par la sécurité** : sortie non déterministe et surface d'injection par instruction, rédhibitoires pour une chaîne de preuve | **Aucune. Ce refus ne sera pas révisé si le contexte change** — contrairement aux six autres |

> La dernière ligne mérite une phrase dans le texte : six rejets sont réversibles, un seul ne
> l'est pas. Écrire cette distinction montre qu'on sait la faire.

## §4.3.3 — Les deux lectures transverses (§2.6.4)

**Premier paragraphe — le fil conducteur.** Les trente-quatre briques ne résultent pas de
trente-quatre décisions indépendantes. Elles découlent de **deux contraintes** du chapitre 1 —
une personne pour concevoir, réaliser et exploiter, et un budget de quelques dizaines d'euros
par mois — et d'**un principe** : le principe de justification (PR1). La contrainte humaine
écarte tout ce qui demande une exploitation permanente : orchestrateur, maillage, filtrage
auto-hébergé, coffre de secrets auto-hébergé, pile de recherche auto-hébergée. La contrainte
économique écarte les modèles au forfait et les solutions de supervision commerciales. Le
principe écarte tout ce qui fait doublon : la base vectorielle séparée, le second registre
d'images, l'ordonnanceur externe, l'analyseur de configuration distinct de l'analyseur d'images.
**Trois filtres, et il reste trente-quatre briques : c'est peu pour un système qui couvre le
bord, l'identité, l'exécution, le réseau, les données, la détection, l'enrichissement,
l'observabilité et deux chaînes de livraison.**

**Second paragraphe — ce que la colonne « prix payé » enseigne**, lue verticalement :

- **Des prix de performance**, tous mesurés : démarrage à froid de 94 secondes au pic, cadence
  plancher de cinq minutes, délai de détection d'environ quinze minutes. Ils sont acceptés parce
  qu'ils sont connus.
- **Des prix de couverture**, tous nommés : cinq familles de règles de filtrage sur onze, aucune
  signature d'artefact, aucune nomenclature logicielle, aucune protection adaptative. Ils
  délimitent ce que le socle ne prétend pas faire.
- **Un prix structurel, et il est unique** : la réversibilité. Le socle n'est plus portable d'un
  fournisseur à l'autre, et sa reconstruction ailleurs demanderait de remplacer le filtrage,
  l'entrepôt, la gestion des clés et la fédération d'identité. **C'est le seul prix que le projet
  ne peut pas réduire par un travail supplémentaire** — les deux autres familles se referment
  avec du temps d'ingénieur, celle-ci non.

## §4.3.4 — Annexe A.4, la fiche de version

Quatre colonnes : brique / version ou paramètre retenu / **mode de verrouillage** / date de relevé.

1. **Une brique par ligne**, dans l'ordre des six tableaux du corps.
2. La colonne « mode de verrouillage » distingue trois cas : verrouillé par fichier de
   verrouillage versionné, épinglé explicitement, ou suivi d'étiquette mobile. **C'est cette
   colonne qui intéresse un jury**, pas le numéro : elle dit si la chaîne est reproductible.
3. Note finale : le verrouillage des versions d'outils ne verrouille pas les **jeux de règles
   distants**, qui restent mutables. Le nombre de règles chargées par l'analyseur statique a
   varié entre deux exécutions séparées de quatre jours, à version d'outil identique.

---

# §4.6 — CE QUE LE FILTRAGE APPLICATIF NE PROTÈGE PAS

> Le socle est structurellement aveugle à une classe d'attaque, et il faut l'énoncer précisément
> parce que c'est ce qui délimite sa valeur.
>
> Considérons un contributeur authentifié de l'application pilote qui exploite une faiblesse de
> logique métier : le signalement d'une phrase la retire immédiatement du corpus, sans quorum. Il
> envoie des requêtes parfaitement bien formées, depuis un compte légitime, dans son quota
> d'usage, depuis une zone géographique autorisée. Il peut ainsi désactiver le corpus phrase par
> phrase.
>
> Que voit le socle ? Le filtrage applicatif voit du trafic légitime : aucune signature, aucune
> anomalie de protocole, aucun taux anormal. Aucune des sept règles de détection ne se déclenche :
> ni codes de refus (R1), ni blocages au bord (R2), ni traversée de chemin (R3), ni agent scripté
> (R4), ni latence anormale (R5), ni motif d'injection (R6), ni accès à un fichier sensible (R7).
>
> **La conclusion est nette : un filtrage applicatif ne corrige pas une faille de logique métier,
> et une chaîne de détection fondée sur des signaux de transport ne la voit pas.** Le correctif
> appartient à l'éditeur — en l'occurrence l'introduction d'un quorum de signalement. C'est
> précisément la raison pour laquelle la frontière de responsabilité doit être contractuelle et
> non implicite.

Seconde limite du même ordre : **la limitation de débit au bord voit une adresse, pas un compte.**
Efficace contre une salve depuis une adresse, sans effet contre un adversaire distribué, et —
dans un contexte où de nombreux abonnés partagent un petit nombre d'adresses publiques, ce qui
est le cas de la zone visée — elle risque de bloquer des utilisateurs légitimes.

---

# §12.3 — DU SOCLE AU SERVICE (angle commercial)

**C-1 — Section « Du socle au service » (0,7 p., fin du chapitre 6).** Quatre paragraphes :

1. **Ce que le socle apporte automatiquement**, sans modification de l'application hébergée :
   chiffrement en transit géré et redirection permanente · filtrage applicatif avec restriction
   géographique, cinq familles de règles, limitation de débit et bannissement · journalisation
   centralisée et normalisée · sept règles de détection avec rattachement aux techniques d'attaque
   · enrichissement sémantique · restitution dans un tableau de bord · surveillance et alertes
   d'exploitation · identité dédiée, secrets par usage chiffrés par clés gérées, base et espace
   média dédiés · chaîne de livraison avec trois portes bloquantes.
2. **Ce qui reste à la charge de l'éditeur** : renvoi à la matrice de responsabilité du ch. 5.
3. **Le coût d'accueil d'une application supplémentaire**, chiffré :

| Nature | Détail | Automatisé |
|---|---|---|
| Un fichier de description | Environ 120 lignes, calquées sur l'existant | Recopie |
| Cinq variables d'environnement | Avec le piège documenté des replis à réinclure | Manuel |
| Une chaîne de livraison dédiée | Environ 300 lignes, non factorisées | Manuel |
| Sept ordres d'isolation en base | Hors description en code | **Manuel, à surveiller** |
| Une tâche, un ordonnancement, une alerte | Contrôle quotidien de dérive | Recopie |
| Deux modifications de code | Table de correspondance des locataires et sélecteur | Manuel |
| Un enregistrement de nom de domaine | **Avant** l'application | Manuel |

4. **Le seuil, énoncé sans détour** : « Le socle est prêt à héberger plusieurs applications d'un
   même éditeur — ce qu'il fait, et le mémoire le mesure. Il n'est pas prêt à héberger les données
   de deux clients distincts sous engagement contractuel, et les trois seuils à franchir sont
   identifiés dans l'ordre : alerter réellement sur les détections de sécurité, verrouiller la
   rétention des journaux d'audit, segmenter le réseau entre locataires. »

**C-2 — Évaluation de maturité multi-locataire, axe par axe (0,4 p.).** Sept axes : isolation
d'identité, isolation des secrets, isolation des données, ségrégation réseau, cloisonnement de la
supervision, attribution d'un incident à un locataire, reproductibilité de l'accueil. Une note et
une justification chiffrée par ligne. **Le résultat est asymétrique et c'est ce qui le rend
crédible** : excellent sur l'identité et les secrets, faible sur le réseau et le cloisonnement de
la supervision. Un acheteur qui lit cela sait exactement ce qu'il achète, et il sait que le
vendeur sait.

**C-3 — Le modèle cible d'isolation, en trois options (0,3 p.).** Tout mutualisé · tout cloisonné
· l'intermédiaire qui mutualise ce qui est coûteux et sans donnée client tout en cloisonnant ce
qui porte la donnée. Tableau à quatre colonnes : modèle, coût relatif, effort, niveau d'isolation.
Puis la recommandation et sa justification en trois lignes.

**C-4 — Phrase de positionnement, en conclusion générale :**

> « Ce travail ne produit pas un service commercialisable en l'état : il produit un socle
> reproductible, mesuré, dont les limites sont chiffrées et dont le chemin vers un engagement
> contractuel est identifié et estimé. C'est précisément parce que ces limites sont écrites que
> le chemin est crédible. »
