# PROPOSITION — nomenclature technologique, choix GCP et alternatives, qualité des schémas

> **Aucune modification n'a été apportée au rapport.** Ce document est une proposition.
> Établi le 27/08/2026 par trois experts en lecture seule (architecte cloud GCP, directeur
> artistique technique, architecte d'entreprise), plus une recherche documentaire sur sources
> officielles Google, C4 et Azure Well-Architected.
>
> État du rapport à cet instant : 112 pages, corps de 63 pages, compilation sans erreur.

---

# PARTIE 1 — Votre question : pourquoi aucun nom de produit dans les schémas ?

## 1.1 Le constat est exact, et plus large que vous ne le pensiez

Ce ne sont pas seulement les schémas. C'est **tout le rapport**. Comptage exact sur les six
chapitres et les huit annexes :

| Terme | Corps | Annexes |
|---|---|---|
| Cloud Armor, Cloud Run, Cloud SQL, Secret Manager, Cloud KMS, Artifact Registry, Cloud Logging, Cloud Storage, Cloud Scheduler | **0** | **0** |
| Cloud Load Balancing / « load balancer » | **0** | **0** |
| Workload Identity | **0** | **0** |
| BigQuery | **1** | 2 |
| Google Cloud | **1** (dans le CV du service d'accueil) | 0 |
| Terraform | **0** | 5 |

Sur les onze schémas qui décrivent le socle construit, **aucun ne porte un seul nom de produit
Google**. Le seul schéma nommé est celui de l'architecture **avant** le projet : il cite Caddy,
PgBouncer, PostgreSQL 17, Next.js, Express. C'est ce contraste qui est dangereux.

## 1.2 Ce n'est pas un choix HLD/LLD : c'est un effacement éditorial

Trois traces le prouvent :

1. **La liste des acronymes déclare huit sigles jamais employés** : ALB, BQ, KMS, PSA, WIF, GKE,
   VPC-SC, ONNX — zéro occurrence dans le texte. Le fichier porte pourtant en tête la consigne
   « ne pas ajouter un sigle non utilisé ailleurs dans le rapport ». Ce sont des résidus.
2. **Le document d'architecture du projet contient le même schéma en couches, avec les noms** :
   `01_ARCHITECTURE_MENAL.md` dessine « L1 — EDGE : Cloud DNS · ALB HTTPS · Cloud Armor »,
   « L3 — WORKLOADS (Cloud Run) », « L5 — Cloud SQL / BigQuery ». La figure du rapport en est la
   transposition **moins les noms**.
3. **Même les tableaux comparatifs sont anonymisés.** L'annexe A compare cinq options de
   supervision nommées « SIEM comm. / SIEM cloud / Pile libre / … ». Un tableau de comparaison
   dont les colonnes n'ont pas de nom n'est pas un travail d'ingénierie évaluable.

## 1.3 La doctrine, sourcée, vous donne tort sur le fond

| Source | Ce qu'elle dit |
|---|---|
| Guide de style de la documentation Google, `developers.google.com/style/images` | **« Use full trademarked product names »** dans les figures. Légendes au format « Figure N. Description. ». Renvois numérotés ①②③ explicités sous la figure. |
| Modèle C4, `c4model.com/diagrams/container` | Le diagramme de conteneurs est **« a simple, high-level technology focussed diagram »** : la technologie se nomme **dès le niveau 2**, qui est encore un niveau *high-level*. « Technology choices are missing » figure parmi les défauts classiques listés par le modèle. |
| C4, abstractions | Les services managés cloud **sont des conteneurs**, pas des systèmes externes : Cloud SQL, BigQuery, Secret Manager doivent y apparaître nommés. |
| Azure Well-Architected, guide de conception des diagrammes | Typologie explicite : le *block diagram* est agnostique (« an order queue »), le *component diagram* le remplace par les technologies réelles et devient **« a visual bill of materials for the architecture »**. Et : « Use official icons and service names. » |
| arc42 §7 | La *Deployment View* est le lieu où régions, zones, réseaux et produits managés se nomment. Votre chapitre 4 en relève. |

**Autrement dit : le niveau auquel vos schémas se situent est précisément celui où la doctrine
impose de nommer.**

## 1.4 La parade élégante, et c'est Google qui la donne

Le guide officiel *Applying Zero Trust on Google Cloud* publie **la même architecture en deux
figures** :

- **Figure 5.2** — architecture Zero Trust abstraite : plan de contrôle et plan de données,
  *Policy Engine*, *Policy Administrator*, pastilles PEP sur chaque flux. Aucun produit.
- **Figure 5.3** — **la même figure, produits nommés** : Cloud Load Balancing, VPC, Compute
  Engine, Cloud Run, Cloud SQL, Cloud Storage, BigQuery, BeyondCorp, plus trois bandeaux
  transverses *Visibility and analysis*, *Automation and orchestration*, *Governance*.

La doctrine Google n'est pas « l'un ou l'autre » : c'est **les deux niveaux**. Votre rapport n'a
aujourd'hui que le premier. C'est exactement l'argument à opposer à un jury qui vous reprocherait
de « faire du catalogue de produits ».

## 1.5 Ce qu'un jury pense, concrètement

1. **« A-t-il vraiment déployé ceci ? »** Un rapport qui écrit « répartiteur HTTPS » là où le code
   écrit `google_compute_target_https_proxy` a l'air d'avoir été rédigé **à côté** du système,
   pas **depuis** le système.
2. **« Où est la compétence cloud ? »** « Entrepôt de supervision » ne prouve rien. « BigQuery
   avec `VECTOR_SEARCH` sur une table d'empreintes 768 dimensions, requêtes planifiées toutes les
   5 minutes » prouve quelque chose. Vous vous privez de la moitié de votre preuve de compétence.
3. **Questions de soutenance quasi certaines** : *quel service assure le pare-feu applicatif ?
   pourquoi des conteneurs sans serveur plutôt qu'un orchestrateur managé ?* Vous savez y
   répondre — vous vous exposez gratuitement à les recevoir sur le mode du doute.

## 1.6 Deux pièges si vous ajoutez des icônes officielles

- **Le jeu d'icônes a été refondu début 2025** : de plus de 250 icônes à environ 40. Il ne reste
  que **19 icônes produit** — dont BigQuery, Cloud Run, Cloud SQL, Cloud Storage. **Cloud Armor,
  Secret Manager, Cloud KMS et Artifact Registry n'ont plus d'icône propre** : la règle officielle
  est d'employer l'icône de **catégorie** (Networking, Security and Identity, DevOps,
  Observability) **plus le nom complet en texte**.
- **Les anciennes icônes hexagonales bleues portent la mention « should not be used as of 2026 »**
  dans le PDF officiel. Les utiliser en 2026 serait un contresens.
- Si vous utilisez les icônes : ligne d'attribution de marque obligatoire, interdiction de les
  mettre en couverture, interdiction de les déformer ou recolorer.
- **L'outil officiel de diagrammes Google n'existe plus** (URL redirigée depuis 2024). On ne peut
  donc pas vous reprocher de ne pas l'avoir utilisé.

---

# PARTIE 2 — Proposition d'emplacement : la nomenclature

**Contrainte décisive : le corps est à 63 pages** pour un plafond de travail de 65, et la norme
ESPRIT vise 40. **Toute option coûtant des pages de corps est disqualifiée.**

## 2.1 Comparaison des trois options

| | (a) Sous-libellés produit dans les schémas | (b) Tableau de correspondance | (c) Schéma nommé en annexe |
|---|---|---|---|
| Coût en pages de corps | **0** — le texte s'insère dans les nœuds existants | 0,6 à 0,8 p. si dans le corps ; **0** si en annexe | 0 (annexe) |
| Gain pour le jury | **Maximal** : le produit est vu au moment où la capacité est regardée | Bon mais différé | Faible : le corps reste anonyme |
| Risque de dénaturer la logique « capacités » | **Faible** : la capacité reste le libellé principal en gras, le produit devient une mention secondaire en petit gris | Nul | Nul |

## 2.2 Recommandation : (a) + (b) en annexe. Pas (c).

**(a) — Sous-libellés produit sur six schémas seulement**, avec la convention observée dans les
figures officielles Google : **ligne 1 = rôle fonctionnel en gras, ligne 2 = produit en petit
gris**. Exemples relevés tels quels chez Google : « **Workload 1** / Compute Engine »,
« **Private zone** / Cloud DNS ».

Schémas concernés : modèle en couches, vue de déploiement, séquence du flux nominal, plan
d'identité, chaîne de détection, chaîne de livraison.
**Ne pas toucher** : le diagramme de cas d'utilisation (c'est de l'UML — y mettre un produit
serait une faute de méthode), le Gantt, le graphique des 41 critères, et la figure de
l'architecture avant projet, déjà nommée.

**Coût : zéro page.**

**(b) — Tableau de correspondance en annexe D §D.1**, juste après le paragraphe de gabarit et
avant la sous-section L1. Chaque sous-section L1 à L7 possède déjà une ligne « **Composants.** »
en formulation générique : il suffit d'ajouter sous chacune une ligne « **Produits employés.** ».
Renvoi depuis le corps en **une seule phrase** en tête de la vue de déploiement.

**Coût : zéro page de corps, environ 0,7 page d'annexe.**

## 2.3 Le tableau de correspondance, vérifié dans le code Terraform

| Libellé actuel du rapport | Produit réel | Preuve dans le code |
|---|---|---|
| Périmètre L1 — répartiteur HTTPS | Cloud Load Balancing (ALB externe global) + certificats gérés | `modules/load-balancer/main.tf` : `global_forwarding_rule`, `target_https_proxy`, `managed_ssl_certificate`, NEG serverless |
| Périmètre L1 — filtrage applicatif, limitation de débit | **Cloud Armor** | `modules/load-balancer/main.tf` : `google_compute_security_policy`, géo-blocage prio 410, règles OWASP 1000-1400, limitation prio 1500 |
| Périmètre L1 — DNS | Cloud DNS | **aucune ressource dans le code** — voir partie 4, écart à déclarer |
| L3 — Application hébergée, API, Tableau de bord | **Cloud Run** | `modules/cloud-run/main.tf`, `modules/dashboard/main.tf`, `environments/staging/elson.tf` ; ingress `INTERNAL_LOAD_BALANCER` |
| L4 — Réseau | VPC personnalisé, 2 sous-réseaux, Serverless VPC Access, Private Service Access, Cloud NAT, Cloud Router | `modules/vpc/main.tf` |
| L5 — Base de données applicative | **Cloud SQL for PostgreSQL 15**, HA régionale, IP privée seule, restauration à un instant donné 7 j | `modules/cloud-sql/main.tf` |
| L5 — Entrepôt de supervision | **BigQuery**, dataset et 10 tables | `modules/bigquery/main.tf` |
| L6 — Service d'encodage | Cloud Run, ingress interne seul, modèle embarqué hors ligne | `modules/ml-pipeline/main.tf` |
| L7 — Observabilité | **Cloud Logging** (4 exports) + **Cloud Monitoring** (11 alertes, 2 objectifs de service, 1 sonde) | `modules/logging/main.tf`, `modules/monitoring/main.tf` |
| L2 — Identité et sécurité | Cloud IAM (7 comptes de service) + **Secret Manager** (6 secrets) + **Cloud KMS** (2 clés, rotation 90 j) + **Workload Identity Federation** | `modules/iam/main.tf`, `modules/kms/main.tf` |
| Registre d'images | **Artifact Registry** | `modules/artifact-registry/main.tf` |
| Tâche planifiée d'enrichissement | Cloud Scheduler → Cloud Run Job | `modules/ml-pipeline/main.tf` |
| Recherche vectorielle | `VECTOR_SEARCH` de BigQuery, `top_k = 3`, empreintes 768 dimensions | `modules/ml-pipeline/main.tf`, `modules/bigquery/main.tf` |
| Chaîne d'intégration, portes | GitHub Actions ; **Gitleaks**, **Semgrep**, **Trivy** | `.github/workflows/ci.yml` |

---

# PARTIE 3 — Proposition d'emplacement : le choix de GCP et les alternatives

## 3.1 La lacune

**Le choix de Google Cloud n'est argumenté nulle part.** « AWS » n'apparaît qu'une fois, comme
compétence de l'entreprise d'accueil. « Azure », « OVH », « Scaleway », « Hetzner »,
« souveraineté » : zéro occurrence. Or :

- le chapitre 2 s'intitule « État de l'art et **choix technologiques** » et ne traite aucun choix
  de plateforme ;
- le chapitre 1 établit que l'existant tournait **chez un hébergeur européen** : le rapport fait
  migrer une application vers GCP sans une phrase de justification ;
- le registre des décisions D01–D13 **ne contient pas la décision la plus structurante de
  toutes** ;
- la contrainte réglementaire du chapitre 1 impose « une région d'hébergement documentée », et
  rien ne la rattache ensuite au choix de fournisseur ni au choix de la région retenue.

## 3.2 Emplacement recommandé

**Dans le corps — nouvelle section 2.5, entre l'actuelle §2.4 et l'actuelle §2.5.**

```
2.5  Choix de la plateforme d'hébergement            ← NOUVELLE, 1 page
     2.5.1  Critères d'évaluation et options écartées
     2.5.2  Critère décisif et prix du choix
2.6  Méthodes d'analyse de risque                    ← ex-2.5, inchangée
2.7  Synthèse : verrous et positionnement            ← ex-2.6, inchangée
```

Le chapitre 2 passe de 6 à 7 pages, sa cible d'origine. Le corps passe de 63 à 64.

**Dans l'annexe A — nouvelle section A.3**, trois pages : tableau des dix critères sur six
options, tableau des douze briques et de leurs alternatives, sources et dates de consultation.

**Dans le chapitre 4 — une ligne ajoutée au registre**, coût nul :
`D00 | Google Cloud comme fournisseur unique du socle | Validée`, avec sa justification en
annexe D.

## 3.3 L'argumentaire, et pourquoi il est solide

Le raisonnement se tient en trois temps, et **le fournisseur est en aval de la décision SIEM**,
pas en amont — c'est ce qui rend l'argument non générique :

1. **La contrainte humaine élimine l'auto-hébergement.** Une personne seule ne peut pas exploiter
   simultanément un pare-feu applicatif, un gestionnaire de clés, un annuaire d'identités par
   charge de travail et un entrepôt de journaux. Ces briques conditionnent la faisabilité des
   vingt exigences.
2. **La contrainte économique élimine le paiement au repos.** Le socle doit pouvoir ne rien
   coûter quand il ne sert pas.
3. **Le critère décisif entre les trois grands fournisseurs restants** est que l'entrepôt doit
   porter le stockage, le langage de détection **et** la recherche vectorielle sans composant
   supplémentaire — ce que le principe P1 exige. Un seul le permet.

**Et surtout : le choix perd sur trois critères, et il faut l'écrire.**

- **Coût direct et réversibilité** : un serveur à forfait chez un hébergeur européen reste moins
  cher et parfaitement portable. C'était le modèle de l'existant. Le socle retenu dégrade
  durablement ces deux critères.
- **Proximité géographique** : vérifié le 27/08/2026 — la seule région Google en Afrique est
  Johannesburg, la seule région AWS est Le Cap, Hetzner et Scaleway n'ont aucune implantation
  africaine. **Aucun fournisseur examiné n'a de région en Afrique de l'Ouest.** Le socle est à
  Saint-Ghislain, loin de ses utilisateurs. Un hébergeur mauritanien serait le seul à gagner ce
  critère, et le seul à ne gagner aucun des six autres.

Le contrefactuel doit être nommé : rester chez l'hébergeur européen aurait coûté moins cher et
imposé de construire et d'exploiter à la main le pare-feu applicatif, les clés, les identités et
l'entrepôt.

## 3.4 Effet net

| | Avant | Après |
|---|---|---|
| Corps | 63 p. | **64 p.** (plafond 65) |
| Chapitre 2 | 6 p. | 7 p. (cible d'origine 6–7) |
| Annexes | 30 p. | 33 p. |
| Registre des décisions | D01–D13 | **D00**–D13 |
| Lacune « pourquoi GCP ? » | ouverte | fermée dans le corps, détaillée en annexe |

---

# PARTIE 4 — Ce que les experts ont trouvé en plus, et qui est plus grave

Ces points n'étaient pas dans votre demande. Ils sont, du point de vue d'un jury, **plus graves
que l'absence de noms de produits**.

## 4.1 Le rapport affirme une interdiction que son propre code contredit

La figure du plan d'identité trace une **interdiction structurante barrée** entre le tableau de
bord et l'entrepôt de supervision. Le tableau des identités écrit « aucun accès direct à
l'entrepôt ni à la base ». Le §5.7 se félicite d'éviter « l'erreur fréquente donnant à une
interface web les droits de lecture d'un entrepôt de données ».

**Le code fait exactement cela.** `modules/dashboard/main.tf` accorde au compte de service du
tableau de bord `roles/bigquery.dataViewer` sur le dataset **et** `roles/bigquery.jobUser` — la
paire exacte qui permet d'interroger le SIEM directement. Le module est instancié tel quel en
recette.

Deux issues, à trancher : retirer les deux rôles et redéployer (« le rapport devient vrai »), ou
corriger figure, tableau et texte en « séparation applicative, non appliquée au niveau des
autorisations » et l'inscrire comme écart. **Ne pas laisser en l'état.**

## 4.2 Trois autres inexactitudes

- **Le DNS est dessiné dans le socle mais absent du code** : zéro ressource DNS dans tout le
  Terraform, alors que le principe P4 pose que « rien n'existe dans l'infrastructure qui n'existe
  d'abord dans le code ». L'écart n'est pas dans la liste É1–É8.
- **Le flux vers l'entrepôt ne traverse pas le réseau privé dessiné** : les services sont en
  sortie « plages privées seulement », donc les appels à l'entrepôt sortent par le chemin managé
  et sont autorisés **par l'identité seule**. Le schéma fait croire que la couche réseau protège
  cet accès. C'est cohérent avec votre discours Zero Trust, mais contredit votre dessin.
- **Le magasin de données biométriques n'apparaît sur aucun schéma** : le bucket média chiffré
  qui stocke les enregistrements vocaux existe bien dans le code, avec `storage.objectAdmin` pour
  l'application. Ni lui, ni Secret Manager, ni le service de clés ne figurent sur une figure.
  Pour un socle Zero Trust, c'est une lacune de fond.
- **Doublon** : le tableau de la matrice des identités contient deux fois la ligne « Identité du
  tableau de bord », à l'identique.

---

# PARTIE 5 — Qualité visuelle : six défauts bloquants

## 5.1 RÉGRESSION à traiter en premier

**La figure du plan d'identité est cassée dans la version actuelle.** La cinquième paire ajoutée
lors de la dernière vague de corrections est posée à `y = 4,9` alors que les en-têtes de colonnes
sont à `y = 4,6` : les deux nouvelles boîtes **recouvrent les mots « Identités » et
« Ressources »**. Correctif : remonter les en-têtes à `y = 6,3` et redescendre les cinq paires
sur une grille régulière de 1,35 d'écart.

## 5.2 Les cinq autres

| # | Où | Défaut | Correctif |
|---|---|---|---|
| B2 | Page de garde | « Cycle ingénieur » est imprimé **par-dessus** « SPÉCIALITÉ : » du gabarit ESPRIT, recouvrement sur environ 27 mm. C'est la première chose que voit le jury | Décaler le nœud à `xshift=110mm, yshift=-119.9mm` |
| B3 | 5 encadrés du corps | Les bandeaux de titre sont **vides** : `coltitle` est réglé sur la même couleur que `colframe`, donc le titre est écrit orange sur orange. Cela se lit comme un bug d'impression | Ajouter `colbacktitle=` et `coltitle=white` aux trois environnements |
| B4 | Diagramme de Gantt | Les traits de jalon sont tracés **après** les barres et **barrent quatre libellés de dates** | Tracer les lignes avant les barres, remplacer les étiquettes M1–M7 par des repères non textuels |
| B5 | 3 schémas | Étiquettes à **6 pt**, sous le minimum de 8 pt imposé | `\tiny` → `\scriptsize` |
| B1 | 11 emplacements | Cadres de captures **vides** dans la version de remise. L'annexe H est la pire : deux grands cadres vides sous un paragraphe affirmant qu'aucune preuve manquante n'est remplacée par un emplacement vide | Produire les images, ou remplacer par un renvoi textuel daté |

## 5.3 Le défaut de charte le plus grave

**Le trait tireté a huit sens différents dans le document** : plan transversal, périmètre,
interdiction, arrêt de chaîne, jointure non réalisée, étiquette de déploiement, association
automatisée, jalon. Un même signe pour huit choses, c'est un signe qui ne veut rien dire.

Charte cible proposée, en dix règles : aucun texte sous 8 pt ; trois gris pour trois rôles ; deux
épaisseurs de trait, l'emphase toujours doublée d'un fond ; un seul rayon d'angle ; une seule
pointe de flèche ; **un style de trait = un sens** ; le noir et blanc comme rendu de référence ;
une seule position de légende interne ; étiquettes d'arête jamais posées sur le trait ; sommets
de boîtes alignés dans une même rangée.

## 5.4 Les trois pages les plus faibles pour un jury

1. **Page 52 imprimée** — s'ouvre sur trois cadres vides empilés, dans le chapitre qui promet des
   preuves.
2. **Page 49 imprimée** — le Gantt : quatre libellés barrés, quatre losanges en cascade hors de
   l'aire de tracé, un en-tête qui déborde, un tiers de page blanc. La seule page qui a l'air
   improvisée.
3. **Page 94 imprimée** — annexe H : deux cadres vides sous la phrase qui promet le contraire.

Et les trois plus fortes, à connaître pour la soutenance : la synthèse des vingt tests, la vue de
déploiement accompagnée de la table des sept flux, et le couple séquence + budget de latence.

---

# PARTIE 6 — Ordre d'exécution recommandé

| Priorité | Action | Coût | Gain |
|---|---|---|---|
| 1 | Corriger la régression de la figure du plan d'identité | 10 min | Supprime une figure cassée |
| 2 | Corriger la page de garde et les bandeaux d'encadrés | 20 min | Les deux défauts que le jury voit en premier |
| 3 | Trancher l'affirmation sur les droits du tableau de bord | décision | Supprime la contradiction la plus attaquable |
| 4 | Ajouter les sous-libellés produit sur six schémas | 1 h | **0 page**, répond à votre question |
| 5 | Ajouter §2.5 et annexe A.3 sur le choix de la plateforme | 2 h | +1 page, ferme la lacune « pourquoi GCP ? » |
| 6 | Ajouter la ligne D00 au registre des décisions | 10 min | 0 page |
| 7 | Reprendre le Gantt, les 6 pt, et la charte des traits | 2 h | Qualité visuelle |
| 8 | Déclarer les écarts DNS, flux réseau, magasin média | 30 min | Cohérence code/rapport |

**Rien de tout cela n'a été appliqué.** Dites-moi ce que vous validez et dans quel ordre.
