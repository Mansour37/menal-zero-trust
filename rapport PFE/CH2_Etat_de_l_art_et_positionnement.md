# Chapitre 2 — État de l'art et positionnement

---

## Introduction du chapitre

Ce chapitre établie l'état de l'art et justifie les choix techniques du projet. Il répond aux six questions (Q1–Q6) du chapitre 1 en exposant les solutions existantes — normes, outils, travaux de recherche — et en identifiant ce que l'état de l'art **ne résout pas**, où se situe la contribution du mémoire.

Les domaines couverts sont l'architecture Zero Trust (2.1), la sécurité de la chaîne de développement (2.2), l'ingénierie de la détection (2.3), le traitement automatique du langage appliqué à la sécurité (2.4), et les méthodes d'analyse de risque (2.5). La synthèse (2.6) identifie les verrous et positionne la contribution.

Les référentiels cités sont datés, et la version utilisée dans le projet est précisée lorsqu'elle diffère de la version courante. Le chapitre suivant applique la méthode d'analyse de risque retenue ici pour dériver les exigences de sécurité.

---

## 2.1 L'architecture Zero Trust

### 2.1.1 Origine et définition

Le modèle de sécurité traditionnel repose sur une frontière : un intérieur réputé sûr, un
extérieur réputé hostile, et un dispositif de filtrage entre les deux. C'est le modèle
décrit en section 1.2.3, et c'est celui de l'existant.

Ce modèle s'est dégradé pour trois raisons devenues structurelles : les ressources ne sont
plus dans un seul lieu, les utilisateurs se connectent depuis n'importe où, et les attaques
les plus coûteuses proviennent d'un accès légitime détourné plutôt que d'une intrusion
frontale. Dès lors, la question n'est plus « comment empêcher d'entrer ? » mais « que peut
faire un intrus une fois entré ? ».

Le terme *Zero Trust* est popularisé par Forrester Research à partir de 2010 [1]. Il est
formalisé en 2020 par le NIST dans la publication spéciale **SP 800-207** [2], qui en
constitue aujourd'hui la référence normative.

La définition retenue par le NIST peut se résumer ainsi : la confiance n'est jamais
accordée de façon implicite ; elle est évaluée à chaque accès, en fonction de l'identité du
demandeur, de l'état de son équipement et du contexte de la demande.

### 2.1.2 Les sept principes du NIST SP 800-207

La publication énonce sept principes directeurs [2]. Ils sont reproduits ici sous forme
reformulée, avec leur traduction concrète dans le contexte du projet.

| # | Principe (reformulé) | Traduction pour le projet |
|---|---|---|
| P1 | Toute ressource de données ou de calcul est traitée comme une ressource à protéger | Base de données, entrepôt de journaux, dépôt d'images et secrets sont tous des ressources contrôlées |
| P2 | Toute communication est sécurisée, quelle que soit sa position dans le réseau | Le chiffrement en transit ne dépend pas du fait d'être « à l'intérieur » |
| P3 | L'accès est accordé par session, et jamais définitivement | Jetons à durée courte, jamais de clé permanente |
| P4 | L'accès est déterminé par une politique dynamique tenant compte de l'identité et du contexte | Une identité par charge de travail, droits accordés au cas par cas |
| P5 | L'organisation mesure et surveille en continu l'état de ses ressources | Journalisation centralisée, analyse de posture |
| P6 | L'authentification et l'autorisation sont strictement appliquées avant chaque accès | Vérification à chaque requête, jamais une seule fois à l'entrée |
| P7 | L'organisation collecte le plus d'informations possible pour améliorer sa posture | Détection, mesure, et amélioration à partir des observations |

Ces sept principes constituent les sept premières lignes du tableau de positionnement
présenté en section 1.4.3. Ils fournissent également la grille d'évaluation de conformité
utilisée au chapitre 6.

### 2.1.3 Du principe à la mise en œuvre : NIST SP 1800-35

Le SP 800-207 décrit une cible, non un chemin. Cette lacune a été comblée en **juin 2025**
par la publication finale du **NIST SP 1800-35**, guide pratique produit par le NCCoE au
terme d'un travail de quatre ans mené avec vingt-quatre industriels, et présentant dix-neuf
mises en œuvre différentes d'architectures Zero Trust [3].

Deux enseignements de ce guide sont directement utiles au projet.

**Le premier est l'absence de solution unique.** Le guide organise ses exemples selon une
progression en trois paliers — que l'on peut traduire par *ramper, marcher, courir* — et
affirme qu'il n'existe pas de mise en œuvre valable pour tous les contextes. Cela légitime
la démarche du projet : construire une architecture adaptée à une contrainte d'exploitation
donnée, plutôt que reproduire une architecture de référence conçue pour de grandes
organisations.

**Le second est l'importance de la surveillance continue**, identifiée par le guide comme
un principe central et non comme un complément. Ce point conforte la place donnée à la
détection dans ce projet : sans surveillance, un déploiement Zero Trust reste une
affirmation invérifiable.

### 2.1.4 Limites reconnues du modèle

Un état de l'art qui ne présenterait que les avantages d'une approche ne serait pas un état
de l'art. Trois limites doivent être mentionnées.

- **Le coût de mise en œuvre.** La vérification systématique introduit des composants,
  donc de la latence, de la complexité et des points de défaillance supplémentaires. C'est
  la ligne 13 du tableau de positionnement du chapitre 1.
- **Le déplacement du risque vers le fournisseur d'identité.** Lorsque toute décision
  d'accès dépend d'un système d'identité central, la compromission de ce système devient
  l'unique point de défaillance majeur.
- **L'écart entre le discours commercial et le contenu technique.** Le terme est devenu un
  argument de vente. Un système ne devient pas Zero Trust parce qu'un produit portant ce
  nom y a été installé. C'est précisément pourquoi ce mémoire insiste sur la démonstration
  par le test plutôt que sur la déclaration de conformité.

### 2.1.5 Ce que le projet retient

Le projet retient les sept principes du SP 800-207 comme grille d'exigences, et l'approche
progressive du SP 1800-35 comme méthode. Il retient également la limite du point de
défaillance unique : le chapitre 6 comporte un scénario de test consacré à la compromission
d'une identité de service.

---

## 2.2 DevSecOps et sécurité de la chaîne de développement

### 2.2.1 Du DevOps au DevSecOps

Le mouvement DevOps a réduit le délai entre l'écriture du code et sa mise en production. Ce
gain a produit un effet secondaire : la sécurité, historiquement vérifiée par un audit
avant la mise en production, est devenue un goulot d'étranglement incompatible avec un
rythme de livraison élevé.

Le DevSecOps répond à ce problème en déplaçant les contrôles vers l'amont — pratique connue
sous le nom de *shift-left* — et en les automatisant. Le principe est simple : un contrôle
qui s'exécute automatiquement à chaque modification du code coûte moins cher qu'un audit
annuel, et détecte plus tôt.

Le point important, souvent négligé, est le caractère **bloquant** du contrôle. Un contrôle
qui produit un avertissement sans empêcher le déploiement ne modifie pas le comportement
des équipes ; il produit un rapport que personne ne lit. La différence entre un contrôle
informatif et un contrôle bloquant n'est pas technique, elle est organisationnelle — et
c'est elle qui détermine l'efficacité réelle du dispositif.

### 2.2.2 Les familles de contrôles automatisés

Quatre familles de contrôles sont couramment intégrées à une chaîne de livraison.

| Famille | Objet | Question posée | Exemples d'outils libres |
|---|---|---|---|
| Détection de secrets | Rechercher des identifiants dans le code et l'historique | Un secret a-t-il été versionné ? | Gitleaks, TruffleHog |
| Analyse statique (SAST) | Rechercher des motifs de code dangereux | Le code contient-il une vulnérabilité connue par construction ? | Semgrep, CodeQL, SonarQube |
| Analyse de composition (SCA) et images | Rechercher des vulnérabilités connues dans les dépendances et les images | Utilisons-nous un composant vulnérable ? | Trivy, Grype, Dependency-Check |
| Analyse de l'infrastructure en code | Rechercher des configurations dangereuses avant création | La ressource sera-t-elle créée de façon non sécurisée ? | Checkov, tfsec, Terrascan |

La quatrième famille mérite une attention particulière. Elle n'est possible **que si
l'infrastructure est décrite en code**. C'est un argument rarement mis en avant en faveur de
l'infrastructure as code : au-delà de la reproductibilité, elle rend la configuration
d'infrastructure analysable statiquement, donc contrôlable avant existence. Cet argument
est repris au chapitre 5.

### 2.2.3 Provenance et intégrité des artefacts

Les quatre familles ci-dessus contrôlent le contenu. Une préoccupation plus récente porte
sur la **provenance** : comment prouver qu'un artefact déployé provient bien du code
attendu, construit par la chaîne attendue ?

Trois éléments de réponse coexistent aujourd'hui :

- le **SBOM** (*Software Bill of Materials*), inventaire des composants d'un artefact,
  normalisé par les formats SPDX et CycloneDX ;
- la **signature d'artefacts**, associant une image à une identité de construction
  vérifiable (projet Sigstore) ;
- le cadre **SLSA**, qui définit des niveaux progressifs d'exigence sur l'intégrité de la
  chaîne de construction [4].

Ces mécanismes ne sont pas mis en œuvre dans ce projet. Ce choix est assumé et justifié au
chapitre 4 : ils supposent une chaîne de livraison déjà stabilisée, et leur ajout aurait
augmenté la complexité sans répondre à une carence identifiée au chapitre 1. Ils figurent
en perspectives.

### 2.2.4 Le référentiel applicatif : OWASP Top 10:2025

L'OWASP publie tous les quatre ans environ un classement des dix risques applicatifs les
plus critiques. La version **2025**, présentée en novembre 2025 et publiée dans sa forme
définitive en janvier 2026, succède à celle de 2021 [5]. Trois évolutions concernent
directement ce projet.

| Évolution | Détail | Conséquence pour le projet |
|---|---|---|
| Le contrôle d'accès défaillant reste en première position | Il absorbe désormais la falsification de requête côté serveur, auparavant classée séparément | Confirme la priorité donnée aux contrôles d'autorisation et à la maîtrise des flux sortants |
| La mauvaise configuration passe en deuxième position | Elle était cinquième en 2021 | Valide directement le constat central du chapitre 1 : les défauts relevés par l'audit sont, pour l'essentiel, des défauts de configuration |
| Une nouvelle catégorie apparaît : les défaillances de la chaîne d'approvisionnement logicielle | Catégorie inexistante en 2021 | Fait des contrôles de la section 2.2.2 une exigence de référentiel, et non plus une bonne pratique optionnelle |

Une quatrième évolution mérite d'être signalée pour son intérêt méthodologique : les
failles d'injection, qui occupaient la première place de 2003 à 2017, sont désormais en
cinquième position. Ce recul illustre l'effet des pratiques de développement sécurisé sur
une classe entière de vulnérabilités — et rejoint le constat de l'audit du chapitre 1,
qui n'a identifié aucune injection dans une application de trente-cinq mille lignes.

> **Note de traçabilité.** L'audit du chapitre 1 a été conduit avec la classification 2021.
> Le chapitre 3 reprend les risques identifiés selon la classification 2025. Le tableau de
> correspondance entre les deux versions figure en annexe.

### 2.2.5 Le référentiel d'infrastructure : CIS Google Cloud Foundation Benchmark

Pour la configuration de la plateforme elle-même, la référence est le **CIS Google Cloud
Platform Foundation Benchmark**, ensemble de plus de cent contrôles répartis en sept
domaines : gestion des identités, journalisation et supervision, réseau, machines
virtuelles, stockage, bases de données et entrepôt de données [6].

La version **4.0.0** date de mai 2025 ; la version **5.0.0** a été publiée en mai 2026. Le
projet a été conçu sur la base de la version 4.0.0. Cet écart est signalé au chapitre 6,
où la mesure de conformité précise la version employée.

L'intérêt de ce référentiel pour le mémoire est double : il fournit une grille de contrôles
concrets, et il permet d'exprimer les **écarts assumés**. Un écart documenté et justifié
— par exemple le maintien désactivé d'une journalisation coûteuse — constitue une décision
d'ingénierie ; le même écart non documenté constitue une négligence.

---

## 2.3 Supervision de sécurité et ingénierie de la détection

### 2.3.1 Du SIEM produit au SIEM construit

Un système de gestion des informations et des événements de sécurité (SIEM) remplit
historiquement quatre fonctions : collecter les journaux de sources hétérogènes, les
normaliser, y appliquer des règles de détection, et présenter les alertes à un analyste.

Le modèle économique dominant de ces produits repose sur le volume de données ingérées. Ce
modèle a une conséquence directe et bien connue des praticiens : **il incite à collecter
moins**, ce qui est exactement l'inverse du septième principe du Zero Trust. Pour une
structure au budget contraint, ce modèle est simplement inaccessible.

Une évolution s'est dessinée : dissocier le **stockage et l'interrogation** des données,
confiés à un entrepôt de données analytique généraliste, de la **logique de détection**,
maintenue sous forme de code dans un dépôt versionné. Cette approche porte le nom de *SIEM
sur entrepôt de données* ou de *détection découplée du stockage*.

Ses avantages sont réels : coût aligné sur le volume réellement interrogé, langage
d'interrogation standard, rétention longue à faible coût, absence de dépendance à un
éditeur. Ses inconvénients le sont tout autant : aucune règle n'est fournie au départ,
aucune interface d'analyste n'existe, aucune corrélation n'est native, et aucun support
éditeur n'est disponible. C'est un compromis, non une supériorité.

### 2.3.2 La détection comme code : le format Sigma

Le format **Sigma** est à la détection ce que le langage SQL est aux bases de données : une
manière neutre d'exprimer une règle, indépendante du moteur qui l'exécutera [7]. Une règle
Sigma est un fichier YAML lisible décrivant la source de journal, la condition de détection,
les faux positifs connus, le niveau de criticité et les techniques d'attaque associées.

L'outillage a évolué : l'outil historique de conversion a été remplacé par la bibliothèque
**pySigma** et l'interface en ligne de commande **sigma-cli**, qui produisent des requêtes
pour les principaux moteurs de recherche du marché [7].

Deux constats importants pour ce projet :

1. **Sigma permet de traiter les règles de détection comme du code source** : revue par les
   pairs, versionnement, test sur jeux d'exemples, déploiement automatisé. C'est la
   transposition directe des pratiques du DevSecOps au domaine de la détection.
2. **Il n'existe pas, parmi les moteurs officiellement pris en charge, de moteur ciblant
   l'entrepôt de données retenu par ce projet.** Des moteurs existent pour les principaux
   produits du marché et pour SQLite, mais la traduction vers le dialecte SQL de l'entrepôt
   utilisé ici doit être réalisée manuellement.

Ce second constat est une limite du projet autant qu'une part de son travail : la
traduction manuelle réduit le volume de règles réalistement maintenable, ce qui plafonne
mécaniquement la couverture de détection. Ce plafond est mesuré et déclaré au chapitre 6.

### 2.3.3 MITRE ATT&CK : langage commun et mesure de couverture

La matrice **MITRE ATT&CK** est une base de connaissances des comportements d'attaquants
observés en conditions réelles, organisée en tactiques (l'objectif poursuivi) et en
techniques (le moyen employé) [8]. Elle joue trois rôles dans ce mémoire : vocabulaire
commun entre la conception et la détection, grille de mesure de la couverture, et
référentiel cible pour l'enrichissement automatique des alertes (section 2.4).

**Un fait survenu pendant le projet impose une précaution méthodologique.** La version 19
de la matrice, publiée le 28 avril 2026, a scindé la tactique d'évasion des défenses en
deux tactiques distinctes : les techniques visant à ne pas être remarqué d'une part, celles
visant à dégrader activement les défenses d'autre part. La matrice Entreprise comporte
désormais quinze tactiques, deux cent vingt-deux techniques et quatre cent soixante-quinze
sous-techniques [8].

La conséquence est directe et doit être énoncée : **toute mesure de couverture publiée sans
indiquer la version de la matrice n'est pas comparable.** Un taux de couverture calculé sur
une version antérieure et présenté sans mention de version induit le lecteur en erreur. Le
chapitre 6 précise donc systématiquement la version utilisée.

Cet épisode illustre plus largement une caractéristique du domaine : les référentiels de
sécurité ne sont pas des constantes. Une architecture doit prévoir leur évolution — ce qui
constitue un argument supplémentaire en faveur de règles de détection maintenues sous forme
de code versionné plutôt que saisies dans une interface.

### 2.3.4 Étude comparative des solutions de supervision

Cinq options ont été considérées. La légende reprend celle du chapitre 1 : ● favorable,
◐ intermédiaire, ○ défavorable.

| Critère | Produit SIEM commercial | Service SIEM du fournisseur cloud | Pile de recherche libre auto-hébergée | Solution libre intégrée (agents + règles) | **Entrepôt de données + détection en code** |
|---|:-:|:-:|:-:|:-:|:-:|
| Coût pour un volume faible | ○ | ○ | ◐ | ● | ● |
| Coût de l'exploitation courante | ● | ● | ○ | ◐ | ◐ |
| Règles de détection fournies au départ | ● | ● | ◐ | ● | ○ |
| Interface d'analyste fournie | ● | ● | ● | ● | ○ |
| Détection versionnée et testable | ◐ | ◐ | ◐ | ◐ | ● |
| Rétention longue à coût maîtrisé | ○ | ◐ | ○ | ◐ | ● |
| Absence de dépendance à un éditeur | ○ | ○ | ● | ● | ● |
| Extension par traitement analytique sur les données | ○ | ◐ | ◐ | ○ | ● |
| Maturité et support | ● | ● | ● | ◐ | ○ |

**Justification du choix.** La contrainte budgétaire du chapitre 1 élimine les deux
premières options. Entre les trois restantes, le critère décisif n'est pas le coût mais
l'avant-dernière ligne : le projet doit pouvoir appliquer un traitement d'apprentissage
automatique aux alertes stockées, directement là où elles se trouvent. Seule la dernière
option le permet sans exporter les données vers un système tiers.

**Le prix de ce choix est visible dans les colonnes du tableau** : ni règles initiales, ni
interface d'analyste, ni support. Ces trois absences constituent précisément trois parties
du travail de réalisation, décrites au chapitre 5. Elles constituent également trois
risques, repris au chapitre 6.

### 2.3.5 Comparaison des modes d'exécution

Le choix du mode d'exécution des charges conditionne l'ensemble de l'architecture. Trois
options ont été examinées, au regard des contraintes établies au chapitre 1.

| Critère | Machines virtuelles | Orchestrateur de conteneurs managé | Exécution de conteneurs sans serveur |
|---|:-:|:-:|:-:|
| Charge d'administration pour une personne | ○ | ○ | ● |
| Coût à faible trafic | ◐ | ○ | ● |
| Compatibilité avec un système de fichiers persistant | ● | ● | ○ |
| Isolation réseau fine entre charges | ◐ | ● | ◐ |
| Adéquation aux tâches longues | ● | ● | ◐ |
| Démarrage à froid | ● | ● | ○ |

Aucune option n'est supérieure sur tous les critères. Le choix retenu, sa justification et
ses conséquences — notamment sur le démarrage à froid, qui a produit un incident réel
documenté au chapitre 5 — relèvent du registre des décisions d'architecture présenté au
chapitre 4.

---

## 2.4 Traitement automatique du langage appliqué à la sécurité

### 2.4.1 Le problème posé

Une règle de détection produit une alerte. Cette alerte est une ligne technique : un
horodatage, une adresse, un identifiant de ressource, un message. Pour agir, l'analyste doit
répondre à trois questions que l'alerte ne contient pas : *à quel comportement d'attaquant
cela correspond-il ? est-ce grave ? que dois-je faire ?*

Ce travail d'interprétation est le principal poste de charge d'un analyste, et il est le
premier à disparaître lorsque l'équipe est réduite à une personne. L'automatiser revient à
associer automatiquement chaque alerte à une technique de la matrice ATT&CK, puis à afficher
la conduite à tenir correspondante.

### 2.4.2 Les approches disponibles

Quatre familles d'approches permettent cette association.

| Approche | Principe | Avantages | Limites |
|---|---|---|---|
| Correspondance par mots-clés ou expressions régulières | Table de correspondance écrite à la main | Simple, rapide, entièrement explicable | Ne reconnaît pas les reformulations ; maintenance manuelle permanente |
| Pondération de termes (TF-IDF) et similarité vectorielle | Représentation statistique du texte | Peu coûteux, sans apprentissage supervisé | Ignore le sens : deux formulations différentes d'une même action restent éloignées |
| Modèles de langue spécialisés produisant des représentations vectorielles | Le texte est projeté dans un espace où la proximité traduit la proximité de sens | Reconnaît les reformulations ; sortie déterministe ; exécution locale possible | Nécessite un modèle adapté au domaine ; pas d'explication en langue naturelle |
| Modèles de langue génératifs | Le modèle rédige l'interprétation | Explication lisible, grande souplesse | Sortie non déterministe, coût par appel, dépendance externe, et surtout exposition à l'injection d'instructions par le contenu des journaux |

**La troisième approche est retenue.** Le dernier point de la quatrième ligne est
déterminant et mérite d'être explicité, car il constitue un argument de sécurité et non de
performance : les journaux analysés contiennent, par construction, du texte fourni par des
tiers non fiables — chemins d'URL, en-têtes, messages d'erreur. Soumettre ce texte à un
modèle génératif revient à transmettre une entrée contrôlée par l'attaquant à un composant
qui suit des instructions. Un modèle produisant uniquement un vecteur numérique n'exécute
aucune instruction : il ne présente pas cette surface d'attaque.

### 2.4.3 Modèles de langue spécialisés en cybersécurité

Les modèles généralistes fondés sur l'architecture Transformer [9] traitent mal le
vocabulaire de la cybersécurité, qui emploie des termes courants dans un sens spécifique.
Plusieurs modèles spécialisés ont donc été proposés, dont **SecureBERT**, adapté au domaine
par apprentissage sur un corpus de textes de sécurité [10].

Pour la tâche qui nous intéresse — rapprocher deux descriptions d'action d'attaque — un
modèle produisant une représentation par **phrase**, et non par mot, est nécessaire. C'est
l'objet de l'architecture Sentence-BERT, fondée sur un réseau siamois [11].

**ATT&CK-BERT** combine ces deux caractéristiques : c'est un modèle de représentation de
phrases, entraîné spécifiquement pour que deux descriptions d'une même action d'attaque
soient proches dans l'espace vectoriel [12]. Il est publiquement disponible et peut être
exécuté localement, sans appel à un service externe — propriété essentielle compte tenu de
la contrainte de coût et de la nature des données traitées.

### 2.4.4 Le travail le plus proche : SMET

Le travail le plus proche du nôtre est **SMET** (*Semantic Mapping of CVE to ATT&CK*),
présenté à la conférence IFIP DBSec en 2023 et étendu dans une version de revue en 2024
[12][13].

SMET associe automatiquement une vulnérabilité publiée à une ou plusieurs techniques
d'attaque, en s'appuyant sur ATT&CK-BERT pour la similarité sémantique et sur un modèle de
régression logistique pour classer les techniques candidates. Les auteurs rapportent des
résultats supérieurs aux approches antérieures, qui dépendaient toutes de jeux de données
annotés — dépendance qui limitait à la fois leur qualité et leur couverture.

**Cette proximité doit être énoncée clairement plutôt que occultée.** L'idée d'utiliser
un modèle de représentation sémantique spécialisé pour rattacher un texte de sécurité à une
technique ATT&CK n'est pas nouvelle, et ce mémoire ne la revendique pas.

Trois différences précises séparent néanmoins notre travail de SMET :

| Aspect | SMET | Ce projet |
|---|---|---|
| **Nature de l'entrée** | Description de vulnérabilité publiée, texte rédigé et structuré | Alerte produite par une règle de détection, texte court, bruité, non rédigé |
| **Régime d'exécution** | Traitement hors ligne, sur un corpus constitué | Traitement en continu, dans une chaîne de production, avec contrainte de latence et de coût |
| **Finalité** | Enrichir la connaissance d'une vulnérabilité | Refermer une boucle : réordonner les vulnérabilités détectées à la livraison en fonction des menaces réellement observées en production |

La troisième ligne constitue l'apport du mémoire. SMET relie vulnérabilité et technique
d'attaque ; le présent projet utilise ce lien pour **réintroduire l'observation de production
dans la décision de développement**. C'est l'objet de la question Q6 du chapitre 1.

### 2.4.5 Ce que l'état de l'art ne résout pas

Trois lacunes ressortent de l'examen ci-dessus.

- **L'évaluation en conditions réelles est peu documentée.** Les travaux publiés évaluent
  ces modèles sur des corpus de descriptions de vulnérabilités, textes bien formés. Le
  comportement sur des alertes courtes et bruitées issues d'un système en exploitation est
  peu étudié.
- **La boucle n'est pas refermée.** La littérature associe des textes à des techniques.
  Elle ne réinjecte pas cette association dans la priorisation des correctifs à appliquer.
- **Le coût n'est presque jamais mesuré.** Les travaux comparent des scores de précision ;
  ils indiquent rarement le coût d'exécution et la latence, alors que ce sont les deux
  facteurs qui déterminent si l'approche est déployable dans une petite structure.

Le chapitre 6 apporte une réponse mesurée aux trois, y compris si cette réponse est
défavorable.

---

## 2.5 Méthodes d'analyse de risque

La conception d'une architecture de sécurité suppose d'avoir d'abord déterminé contre quoi
l'on se protège. Trois méthodes ont été considérées.

| Méthode | Origine | Principe | Adaptation au projet |
|---|---|---|---|
| **STRIDE** | Microsoft, années 1990 | Six catégories de menaces appliquées systématiquement à chaque flux et composant d'un schéma d'architecture | Très adaptée à une analyse technique par flux ; ne traite ni les enjeux métier ni les sources de risque |
| **EBIOS Risk Manager** | ANSSI, version actuelle 2018 | Cinq ateliers : cadrage et valeurs métier, sources de risque, scénarios stratégiques, scénarios opérationnels, traitement du risque | Relie le risque technique à l'enjeu métier ; largement reconnue en France ; plus lourde à mettre en œuvre |
| **ISO/IEC 27005** | Organisation internationale de normalisation | Cadre général de gestion du risque de sécurité de l'information | Fournit un cadre, mais pas de méthode opératoire directement applicable |

**Choix retenu : une combinaison des deux premières.** EBIOS Risk Manager structure
l'analyse de haut niveau — quelles valeurs métier protéger, contre quelles sources de
risque, selon quels scénarios stratégiques — tandis que STRIDE est appliquée
systématiquement à chacun des flux de l'architecture pour dériver les scénarios
opérationnels.

Cette combinaison est justifiée par la nature du projet : les valeurs à protéger sont
clairement identifiées (corpus de données, identités des contributeurs, intégrité d'une
compétition dotée de prix), ce qui rend l'apport d'EBIOS pertinent ; et l'architecture est
décrite par un ensemble de flux nommés, ce qui rend l'application de STRIDE immédiate.

Le chapitre 3 met en œuvre cette combinaison et produit la matrice de traçabilité
*menace → exigence → contrôle → test*, qui constitue l'élément central méthodologique du
mémoire.

---

## 2.6 Synthèse : verrous identifiés et positionnement

### 2.6.1 Verrous

L'examen de l'état de l'art fait apparaître quatre verrous, c'est-à-dire quatre points où
les réponses disponibles ne s'appliquent pas directement au contexte du projet.

| # | Verrou | Origine | Traité au chapitre |
|---|---|---|---|
| **V1** | Les architectures Zero Trust de référence sont conçues pour des organisations disposant d'une équipe de sécurité. Aucune n'est dimensionnée pour une exploitation par une seule personne | 2.1.3, 2.1.4 | 4, 5 |
| **V2** | La détection comme code ne dispose pas de moteur de conversion vers l'entrepôt de données retenu : la traduction est manuelle, ce qui plafonne la couverture atteignable | 2.3.2 | 5, 6 |
| **V3** | Les modèles de rapprochement sémantique sont évalués sur des textes bien formés, non sur des alertes courtes et bruitées issues d'un système en exploitation | 2.4.5 | 6 |
| **V4** | Aucun des travaux examinés ne referme la boucle entre les vulnérabilités détectées à la livraison et les menaces effectivement observées en production | 2.4.4, 2.4.5 | 5, 6 |

### 2.6.2 Positionnement de la contribution

Le mémoire ne revendique aucune contribution théorique nouvelle. Sa contribution est
d'ingénierie, et se formule en quatre points :

1. **Une architecture Zero Trust dimensionnée pour la contrainte réelle** d'une entreprise
   émergente, avec ses arbitrages explicités et ses composants écartés justifiés (verrou
   V1).
2. **Une chaîne de détection entièrement versionnée** sur un entrepôt de données
   généraliste, avec la traduction manuelle des règles et la mesure rigoureuse du plafond de
   couverture qui en résulte (verrou V2).
3. **Une évaluation en conditions réelles** d'un modèle de rapprochement sémantique
   spécialisé, comparé à une méthode de référence simple, sur des alertes de production
   (verrou V3).
4. **La fermeture de la boucle** entre chaîne de livraison et chaîne de détection : les
   vulnérabilités détectées lors de la construction sont réordonnées selon les techniques
   d'attaque effectivement observées sur le système (verrou V4).

Le quatrième point constitue l'apport principal. Les trois premiers relèvent de la
transposition rigoureuse d'un état de l'art à un contexte contraint — ce qui, en ingénierie,
a une valeur propre dès lors que les arbitrages sont explicités et les résultats mesurés.

---

## Conclusion du chapitre

Ce chapitre a montré que les réponses aux carences du chapitre 1 existent mais qu'aucune
ne s'applique telle quelle. Le Zero Trust fournit sept principes et une méthode
progressive mais suppose des moyens que le projet n'a pas. Le DevSecOps fournit des
contrôles éprouvés adossés à un référentiel applicatif incluant la chaîne
d'approvisionnement logicielle. La détection comme code fournit un format neutre mais pas
de moteur de conversion vers l'entrepôt retenu. Les modèles sémantiques spécialisés
existent mais n'ont pas été évalués sur le type de texte du projet. Quatre verrous ont été
formulés et la contribution du mémoire a été positionnée par rapport à eux.

Le chapitre suivant applique la méthode d'analyse de risque retenue, détermine les valeurs
à protéger et construit la matrice de traçabilité reliant chaque menace à un contrôle et
à son test de validation.

---

## Références du chapitre

[1] Kindervag, J. *No More Chewy Centers: Introducing the Zero Trust Model of Information
Security.* Forrester Research, 2010.

[2] Rose, S., Borchert, O., Mitchell, S., Connelly, S. *Zero Trust Architecture.* NIST
Special Publication 800-207, National Institute of Standards and Technology, août 2020.

[3] Borchert, O., Howell, G., Kerman, A., Rose, S., Souppaya, M. *et al. Implementing a
Zero Trust Architecture.* NIST Special Publication 1800-35, National Cybersecurity Center
of Excellence, version finale, juin 2025.

[4] *Supply-chain Levels for Software Artifacts (SLSA).* OpenSSF. Spécification disponible
en ligne.

[5] OWASP Foundation. *OWASP Top 10:2025.* Présenté au Global AppSec Conference,
Washington D.C., novembre 2025 ; version définitive publiée en janvier 2026.

[6] Center for Internet Security. *CIS Google Cloud Platform Foundation Benchmark.*
Version 4.0.0, mai 2025 ; version 5.0.0, mai 2026.

[7] SigmaHQ. *Sigma — Generic Signature Format for SIEM Systems.* Spécification, dépôt de
règles et bibliothèque pySigma. Documentation en ligne, consultée en 2026.

[8] MITRE Corporation. *MITRE ATT&CK Enterprise Matrix.* Version 19, publiée le 28 avril
2026.

[9] Devlin, J., Chang, M.-W., Lee, K., Toutanova, K. *BERT: Pre-training of Deep
Bidirectional Transformers for Language Understanding.* arXiv:1810.04805, 2018.

[10] Aghaei, E., Niu, X., Shadid, W., Al-Shaer, E. *SecureBERT: A Domain-Specific Language
Model for Cybersecurity.* SecureComm 2022, Springer, 2023, p. 39-56.

[11] Reimers, N., Gurevych, I. *Sentence-BERT: Sentence Embeddings using Siamese
BERT-Networks.* arXiv:1908.10084, 2019.

[12] Abdeen, B., Al-Shaer, E., Singhal, A., Khan, L., Hamlen, K. *SMET: Semantic Mapping of
CVE to ATT&CK and its Application to Cybersecurity.* IFIP Annual Conference on Data and
Applications Security and Privacy (DBSec), Springer LNCS, 2023, p. 243-260.

[13] Abdeen, B., Al-Shaer, E., Singhal, A., Khan, L., Hamlen, K. *SMET: Semantic Mapping of
CTI Reports and CVE to ATT&CK for Advanced Threat Intelligence.* Journal of Computer
Security, 2024.

[14] Agence nationale de la sécurité des systèmes d'information (ANSSI). *EBIOS Risk
Manager — La méthode.* Édition 2018.

[15] Organisation internationale de normalisation. *ISO/IEC 27005 — Gestion des risques
liés à la sécurité de l'information.*

[16] Shostack, A. *Threat Modeling: Designing for Security.* Wiley, 2014. (Référence pour
la méthode STRIDE.)

> **À compléter avant remise.** Les références [4], [7] et [8] doivent être accompagnées de
> leur adresse de consultation et de la date d'accès. Les références [1] et [15] doivent
> être vérifiées dans leur édition exacte. La bibliographie générale du mémoire regroupera
> ces références avec celles des chapitres suivants, selon un style de citation unique.
