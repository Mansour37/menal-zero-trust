# Chapitre 6 — Validation, mesures et évaluation

---

## Introduction du chapitre

Ce chapitre valide et mesure ce qui a été construit. Une architecture Zero Trust ne se déclare pas, elle se démontre : chaque contrôle doit être associé à un test, et chaque test doit avoir été exécuté.

Le programme de validation n'a pas été choisi après coup : les vingt tests de la section 6.2 sont exactement ceux dérivés de l'analyse de risque du chapitre 3, avant la conception de l'architecture. Cette antériorité interdit de sélectionner *a posteriori* les tests qui réussissent.

Les sections couvrent la stratégie de validation (6.1), les tests adverses (6.2), l'évaluation de la détection (6.3), de l'enrichissement sémantique (6.4), les mesures de performance (6.5), de résilience (6.6) et de coût (6.7), la conformité aux référentiels (6.8), les limites (6.9), et la réponse aux six objectifs du chapitre 1 (6.10).

---

## 6.1 Stratégie de validation

### 6.1.1 Quatre axes

| Axe | Question posée | Section |
|---|---|---|
| **Sécurité** | Les contrôles bloquent-ils réellement ce qu'ils sont censés bloquer ? | 6.2 |
| **Détection** | Que voit le système, que ne voit-il pas, et en combien de temps ? | 6.3, 6.4 |
| **Performance** | Le système tient-il ses objectifs de service, et à quel coût ? | 6.5, 6.7 |
| **Résilience** | Le système se reconstruit-il et se restaure-t-il réellement ? | 6.6 |

### 6.1.2 Convention de résultat

Chaque test produit l'un des quatre résultats suivants. La convention est appliquée sans
exception, y compris lorsqu'elle est défavorable.

| Résultat | Signification |
|---|---|
| **Conforme** | Le comportement observé correspond au comportement attendu |
| **Partiellement conforme** | Le contrôle fonctionne mais avec une réserve documentée |
| **Non conforme** | Le comportement attendu n'est pas obtenu. L'exigence correspondante redevient ouverte |
| **Non exécuté** | Le test n'a pas pu être réalisé. La raison est indiquée |

**Un test non conforme n'est pas masqué.** La matrice de traçabilité du chapitre 3 permet
alors d'identifier immédiatement quelle exigence n'est pas satisfaite et quel scénario de
menace redevient ouvert. C'est la propriété recherchée : transformer un échec en information
exploitable.

### 6.1.3 Environnement de mesure

Toutes les mesures sont réalisées sur l'environnement de recette, dont la topologie est
identique à celle de la cible (chapitre 5, section 5.1.1). Cette identité de topologie donne
aux résultats une validité qu'ils n'auraient pas sur un environnement simplifié.

**Limite à déclarer** : cet environnement ne reçoit pas de trafic d'utilisateurs réels. Les
conséquences sur l'interprétation des mesures sont traitées en section 6.9.

| Paramètre de la campagne | Valeur |
|---|---|
| **Date de référence** | **25/08/2026** |
| Environnement | Recette (staging) |
| Période d'observation | `⟨à relever : dates de début et de fin⟩` |
| Durée d'observation continue | `⟨à relever : nombre de jours⟩` |
| Version de la matrice de techniques d'attaque | `⟨à relever : version employée pour la mesure de couverture⟩` |
| Version du référentiel d'infrastructure | `⟨à relever⟩` |

---

## 6.2 Campagne de tests adverses

Les vingt tests dérivés du chapitre 3 sont exécutés ici. Chaque test est présenté avec son
objectif, son protocole, le critère de réussite, et le résultat observé.

### 6.2.1 Protocoles

**T1 — Filtrage des attaques applicatives** *(exigence EX1, menace SO1)*
Envoyer, depuis l'extérieur, des charges d'attaque applicatives correspondant aux cinq
familles de règles activées. Vérifier le rejet au périmètre et la présence du verdict
correspondant dans les journaux.
*Critère* : les attaques connues (SQLi, XSS, LFI, fichiers sensibles) sont rejetées en 403.
*Résultat* : `⟨à exécuter⟩` — résultat attendu : partiellement conforme (réserve H13 — un
motif brut de traversée de répertoire renvoie 302 au lieu de 403 ; risque réel jugé faible,
non corrigé à la date de référence).

**T2 — Limitation des tentatives d'authentification** *(EX2, SO2/SO3)*
Générer des échecs d'authentification répétés depuis une adresse unique jusqu'au
franchissement du seuil.
*Critère* : blocage temporaire déclenché ; réponse 429 observable ; alerte correspondante
présente dans l'entrepôt.
*Résultat* : `⟨à exécuter⟩` — résultat attendu : 10 réponses 422 (formattage invalide) puis
**429** (rate-limit déclenché) ; la réponse 429 confirme que le rate-limiting est actif sur
les endpoints MFA (`/auth/mfa/verify`, `/auth/mfa/enable`, `/auth/mfa/disable`).

**T3 — Comportement sous charge et traçabilité du balayage** *(EX3, SO4/SO5)*
Générer une charge supérieure au seuil global, puis un balayage de la surface exposée.
*Critère* : le service reste disponible ; les deux activités apparaissent dans les journaux.
*Résultat* : `⟨à exécuter⟩`.

**T4 — Inaccessibilité des données depuis Internet** *(EX4, SO6)*
Depuis un hôte externe, tenter une connexion directe à la base de données. Vérifier également
par inventaire qu'aucune adresse publique n'est attribuée.
*Critère* : aucune adresse publique n'existe ; la connexion échoue.
*Résultat* : `⟨à exécuter⟩`.

**T5 — Cloisonnement des identités applicatives** *(EX5, SO7)*
Avec l'identité d'une application hébergée, tenter une lecture de l'entrepôt de supervision.
*Critère* : refus d'autorisation.
*Résultat* : `⟨à exécuter⟩`.
> **Réserve connue.** L'écart É3 (chapitre 4) signale qu'un composant partage son identité
> avec la tâche de détection et dispose donc de droits de données non prévus. Ce test doit
> être exécuté **également** avec cette identité, et le résultat rapporté tel quel.

**T6 — Authentification des appels entre services** *(EX6, SO8)*
Appeler le service d'encodage sans jeton d'identité, depuis l'intérieur du réseau privé.
*Critère* : refus. *Être « à côté » ne doit rien accorder.*
*Résultat* : `⟨à exécuter⟩`.

**T7 — Absence de clés de longue durée** *(EX7, SO9)*
Inventorier les clés existantes pour toutes les identités de service. Tenter d'en créer une.
*Critère* : inventaire vide ; création refusée par la politique d'organisation.
*Résultat* : `⟨à exécuter⟩` — identités inventoriées : `⟨…⟩` ; clés trouvées : `⟨…⟩`.

**T8 — Blocage d'un artefact vulnérable** *(EX8, SO10)*
Soumettre à la chaîne une image contenant une vulnérabilité critique connue.
*Critère* : arrêt de la chaîne à l'étape d'analyse de vulnérabilité.
*Résultat* : `⟨à exécuter⟩` — étape d'arrêt : `⟨…⟩`.

**T9 — Registre de confiance unique** *(EX9, SO11)*
Tenter un déploiement depuis une source d'images externe au registre autorisé.
*Critère* : le déploiement est refusé.
*Résultat* : `⟨à exécuter⟩`.

**T10 — Blocage d'un secret versionné** *(EX10, SO12)*
Soumettre un secret factice de format reconnaissable. Vérifier séparément, par inspection,
qu'aucun secret du système n'est dérivé d'un autre.
*Critère* : arrêt à la première étape ; inventaire des secrets confirmant l'indépendance.
*Résultat* : `⟨à exécuter⟩` — nombre de secrets inventoriés : `⟨…⟩` ; secrets dérivés : `⟨…⟩`.

**T11 — Intégrité de la chaîne de preuve** *(EX11, SO13/SO16)* — **test le plus discriminant**
Avec l'identité de la tâche d'enrichissement, tenter une écriture puis une suppression dans
les tables de journaux bruts et de détections.
*Critère* : refus sur les deux tables ; l'écriture reste possible sur la seule table
d'enrichissement.
*Résultat* : `⟨à exécuter⟩`.

**T12 — Détection d'une interruption de collecte** *(EX12, SO14)*
Interrompre volontairement la collecte pendant une durée supérieure au seuil d'alerte.
*Critère* : une alerte est émise.
*Résultat* : `⟨à exécuter⟩` — délai d'émission : `⟨…⟩`.

**T13 — Attribution des actions privilégiées** *(EX13, SO15)*
Exécuter une action privilégiée identifiable, puis la retrouver dans les journaux d'audit
avec son auteur.
*Critère* : action retrouvée, auteur identifié, horodatage cohérent.
*Résultat* : `⟨à exécuter⟩`.

**T14 — Absence de sortie du composant d'inférence** *(EX14, SO17)*
Depuis le composant d'encodage, tenter une connexion sortante vers une destination externe.
*Critère* : échec de la connexion.
*Résultat* : `⟨à exécuter⟩`.

**T15 — Comportement de la chaîne d'enrichissement sous charge** *(EX15, SO18)*
Injecter un volume de détections nettement supérieur au volume nominal.
*Critère* : la tâche se termine sans perte ; le coût et la durée sont mesurés.
*Résultat* : `⟨à exécuter⟩` — volume injecté : `⟨…⟩` ; durée : `⟨…⟩` ; coût : `⟨…⟩`.

**T16 — Détection de dérive** *(EX16, SO20)*
Créer manuellement une ressource depuis l'interface du fournisseur, puis exécuter une
planification.
*Critère* : la planification signale la différence ; les journaux d'audit permettent
d'identifier l'auteur.
*Résultat* : `⟨à exécuter⟩` — délai de détection : `⟨…⟩`.

**T17 — Protection de l'état de l'infrastructure** *(EX17, SO21)*
Tenter un accès en lecture à l'état avec une identité non autorisée.
*Critère* : refus.
*Résultat* : `⟨à exécuter⟩`.

**T18 — Revue avant modification de droits** *(EX18, SO22)*
Soumettre une modification élargissant les droits d'une identité.
*Critère* : blocage en attente d'approbation ; aucune application sans validation humaine.
*Résultat* : `⟨à exécuter⟩`.

**T19 — Détection d'une consommation anormale** *(EX19, SO23)*
Provoquer une consommation de ressources nettement supérieure au profil habituel.
*Critère* : alerte émise.
*Résultat* : `⟨à exécuter⟩`.

**T20 — Restriction des sorties réseau** *(EX20, SO24)*
Depuis une charge de travail applicative, tenter une connexion sortante vers une destination
non autorisée.
*Critère* : échec de la connexion.
*Résultat* : `⟨à exécuter⟩`.
> **Note.** L'écart É1 (chapitre 4) a été corrigé le 19/08/2026 : la journalisation des
> refus est désormais active. Le test doit distinguer deux aspects : le blocage a-t-il lieu
> (attendu : oui) et le refus produit-il une trace exploitable (attendu : oui, depuis le
> 19/08/2026).

### 6.2.2 Synthèse de la campagne

| Test | Exigence | Résultat | Commentaire |
|---|---|---|---|
| T1 | EX1 | Partiellement conforme | SQLi/XSS/LFI → 403 ; motif brut → 302 (H13) |
| T2 | EX2 | `⟨à exécuter⟩` | Rate-limit 429 vérifié le 19/08 |
| T3 | EX3 | `⟨à exécuter⟩` | |
| T4 | EX4 | `⟨à exécuter⟩` | |
| T5 | EX5 | Conforme | É3 corrigé le 19/08, deux rôles vérifiés |
| T6 | EX6 | `⟨à exécuter⟩` | |
| T7 | EX7 | Partiellement conforme | Inventaire vide ; refus de création non applicable (É7) |
| T8 | EX8 | `⟨à exécuter⟩` | |
| T9 | EX9 | `⟨à exécuter⟩` | Critère révisé : déploiement depuis source externe refusé |
| T10 | EX10 | `⟨à exécuter⟩` | |
| T11 | EX11 | Conforme | É3 corrigé le 19/08, droits vérifiés |
| T12 | EX12 | `⟨à exécuter⟩` | |
| T13 | EX13 | `⟨à exécuter⟩` | |
| T14 | EX14 | Conforme | É3 corrigé le 19/08 |
| T15 | EX15 | `⟨à exécuter⟩` | |
| T16 | EX16 | Partiellement conforme | Incident CMEK 08/08, plan sans différence 19/08 |
| T17 | EX17 | `⟨à exécuter⟩` | |
| T18 | EX18 | Partiellement conforme | Revue de PR et apply manuel ; approbation non outillée |
| T19 | EX19 | `⟨à exécuter⟩` | |
| T20 | EX20 | `⟨à exécuter⟩` | É1 corrigé le 19/08, trace désormais attendue |

**Bilan** : conformes 3 (T5, T11, T14) / partiellement conformes 4 (T1, T7, T16, T18) /
non conformes 0 / non exécutés 13.

**Exigences redevenues ouvertes** à l'issue de la campagne : `⟨à compléter⟩`.

---

## 6.3 Évaluation de la détection

### 6.3.1 Méthode de calcul de la couverture

La mesure de couverture est celle qui prête le plus aux erreurs d'interprétation. Deux
précautions méthodologiques sont donc appliquées.

**Première précaution : le dénominateur.** Rapporter le nombre de techniques couvertes au
nombre total de techniques de la matrice produirait un chiffre dépourvu de sens. La matrice
couvre des systèmes d'exploitation, des environnements industriels et des terminaux mobiles
qui n'existent pas dans ce système. Le dénominateur retenu est donc restreint aux **techniques
applicables à la plateforme considérée** : environnements d'exécution de conteneurs managés,
services d'infrastructure en tant que service, et identités cloud.

Le dénominateur est déclaré explicitement :

| Élément | Valeur |
|---|---|
| Version de la matrice employée | `⟨à relever⟩` |
| Techniques applicables retenues (dénominateur) | `⟨à relever⟩` |
| Critère de sélection du dénominateur | Techniques dont les plateformes déclarées incluent la plateforme du projet |
| Techniques couvertes par au moins une règle | `⟨à relever⟩` |
| **Taux de couverture** | `⟨à calculer⟩` |

**Seconde précaution : la version.** Comme établi au chapitre 2, une évolution majeure de la
matrice est survenue pendant le projet, redistribuant une tactique entière. **Un taux de
couverture publié sans mention de version n'est pas comparable.** La version employée est donc
indiquée dans le tableau ci-dessus et rappelée dans toute présentation du résultat.

### 6.3.2 Inventaire des règles

| Élément | Valeur |
|---|---|
| Nombre de règles de détection écrites | `⟨à relever⟩` |
| Sources de journaux couvertes | `⟨à relever⟩` |
| Tactiques représentées | `⟨à relever⟩` |
| Tactiques **non** représentées | `⟨à relever — cette ligne est obligatoire⟩` |

### 6.3.3 Ce que le système ne détecte pas

Cette sous-section est obligatoire et doit être rédigée avec autant de soin que la précédente.

Trois causes de non-couverture sont déjà identifiées par les chapitres précédents, et doivent
être reprises ici avec leur portée mesurée :

| Cause | Origine | Conséquence sur la détection |
|---|---|---|
| **Absence de journalisation des refus réseau** | Écart É1, chapitre 4 | Les tentatives de mouvement latéral et les sorties bloquées ne produisent aucun signal. Familles de techniques concernées : `⟨à relever⟩` |
| **Plafond de règles lié à la traduction manuelle** | Verrou V2, chapitre 2 | Le volume de règles maintenables par une personne borne la couverture atteignable. Écart entre les règles disponibles publiquement et les règles traduites : `⟨à relever⟩` |
| **Absence de trafic d'utilisateurs réels** | Environnement de mesure | Les règles fondées sur des seuils comportementaux ne peuvent pas être calibrées |

### 6.3.4 Qualité de la détection

| Indicateur | Méthode de mesure | Valeur |
|---|---|---|
| Volume d'alertes sur la période | Comptage sur la table des détections | `⟨à relever⟩` |
| Alertes qualifiées de faux positifs | Revue manuelle de l'ensemble des alertes de la période | `⟨à relever⟩` |
| **Taux de faux positifs** | Rapport des deux lignes précédentes | `⟨à calculer⟩` |
| **Délai de détection** | Écart entre l'horodatage de l'événement source et l'apparition de l'alerte, sur les scénarios de la campagne 6.2 | `⟨à relever : médiane et maximum⟩` |
| Taux d'alertes non rattachées à une technique | Indicateur affiché par le tableau de bord | `⟨à relever⟩` |

Le délai de détection est structurellement contraint par deux paramètres de conception : la
fenêtre d'exécution des règles et la cadence de la tâche d'enrichissement. **Ce délai est donc
une conséquence assumée d'un arbitrage de coût, et non une défaillance.** Il doit être présenté
comme tel, avec le rappel de l'arbitrage correspondant.

---

## 6.4 Évaluation de l'enrichissement sémantique

C'est la mesure la plus exigeante du chapitre, et celle qui répond au verrou V3 identifié au
chapitre 2 : *les modèles de rapprochement sémantique sont évalués sur des textes bien formés,
non sur des alertes courtes et bruitées.*

### 6.4.1 Portée de l'évaluation

Une limite doit être rappelée avant toute mesure. Le chapitre 5, section 5.6.4, a établi que
**l'enrichissement n'alimente pas le score d'incident.** Il n'est donc pas possible d'évaluer
l'effet de l'enrichissement sur la priorisation des incidents.

Ce qui est évalué ici, et qui peut l'être rigoureusement, est la **qualité du rattachement
automatique d'une alerte à une technique d'attaque**, comparée à des méthodes de référence
plus simples.

### 6.4.2 Protocole

**Constitution du jeu d'évaluation**

| Élément | Spécification |
|---|---|
| Source | Alertes réelles produites par le système sur la période d'observation |
| Taille visée | 100 alertes, minimum 50 |
| Échantillonnage | Aléatoire parmi les alertes distinctes, afin d'éviter la sur-représentation des règles bruyantes |
| Annotation | Rattachement manuel de chaque alerte à la technique attendue, ou à l'étiquette « aucune technique applicable » |
| Annotateur | `⟨à préciser⟩` |

> **Menace à la validité, à déclarer.** Une annotation réalisée par une seule personne, qui
> est également l'auteur du système évalué, introduit un biais. Deux mesures d'atténuation
> sont possibles et doivent être indiquées : annoter **avant** de consulter les sorties du
> modèle, et faire réannoter un sous-ensemble par une seconde personne pour estimer le taux
> d'accord. Voir section 6.9.

**Méthodes comparées**

| Méthode | Description | Rôle |
|---|---|---|
| **M0 — Correspondance par mots-clés** | Table de correspondance écrite à la main entre termes fréquents et techniques | Référence basse : que donne la solution la plus simple ? |
| **M1 — Pondération de termes et similarité** | Représentation statistique du texte, similarité cosinus contre les descriptions de techniques | Référence intermédiaire : que donne une méthode sans apprentissage de domaine ? |
| **M2 — Modèle de représentation spécialisé** | La méthode retenue par le projet | Méthode évaluée |

**Métriques**

| Métrique | Définition |
|---|---|
| Exactitude au premier rang | Part des alertes dont la technique attendue est proposée en première position |
| Exactitude aux trois premiers rangs | Part des alertes dont la technique attendue figure parmi les trois propositions |
| Taux d'abstention | Part des alertes laissées sans rattachement en raison du seuil |
| **Taux d'erreur silencieuse** | Part des alertes rattachées à une technique **incorrecte** avec un score supérieur au seuil |

La dernière métrique est la plus importante et la moins souvent rapportée. Une abstention est
visible et sans danger : l'analyste sait que le système ne sait pas. Un rattachement erroné
présenté avec un score élevé est trompeur : il oriente l'analyste vers la mauvaise procédure.
**Un système qui s'abstient souvent mais se trompe rarement est préférable à l'inverse**, et
cette préférence doit être visible dans la mesure.

### 6.4.3 Résultats

| Méthode | Exactitude rang 1 | Exactitude rang 3 | Abstention | Erreur silencieuse | Latence moyenne | Coût pour 1 000 alertes |
|---|---|---|---|---|---|---|
| M0 — mots-clés | `⟨…⟩` | — | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` |
| M1 — pondération de termes | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` |
| **M2 — modèle spécialisé** | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` |

### 6.4.4 Interprétation

L'interprétation devra répondre à trois questions, quelle que soit la direction du résultat :

1. **Le gain existe-t-il ?** Si M2 n'améliore pas significativement M1, le résultat doit être
   énoncé tel quel. Le chapitre 2 a annoncé par avance que l'évaluation admettait un résultat
   négatif (objectif O5) : cet engagement doit être tenu.
2. **Le gain justifie-t-il le coût ?** Un gain de quelques points d'exactitude au prix d'un
   composant supplémentaire à exploiter n'est pas nécessairement un bon arbitrage. Les colonnes
   de latence et de coût existent pour permettre cette lecture.
3. **Sur quel type d'alerte le gain se concentre-t-il ?** Une analyse par type d'alerte est
   plus informative qu'un chiffre global : elle indique dans quels cas la méthode apporte, et
   dans quels cas la solution simple suffit.

### 6.4.5 Évaluation de la boucle livraison ↔ détection

La boucle F6 se mesure par une question unique : **l'ordre de priorité qu'elle produit
diffère-t-il de l'ordre par gravité théorique ?**

| Indicateur | Méthode | Valeur |
|---|---|---|
| Vulnérabilités traitées | Comptage sur la table dédiée | `⟨à relever⟩` |
| Vulnérabilités rattachées à une technique observée | Jointure avec les techniques de la période | `⟨à relever⟩` |
| Vulnérabilités dont le rang change | Comparaison des deux ordres | `⟨à relever⟩` |
| Amplitude maximale du changement de rang | Écart maximal observé | `⟨à relever⟩` |

**Si aucun rang ne change, la boucle n'apporte rien, et il faut l'écrire.** C'est un test qui
peut échouer, ce qui est précisément ce qui lui donne sa valeur démonstrative.

---

## 6.5 Performance et objectifs de service

### 6.5.1 Objectifs de service

| Indicateur | Cible | Valeur mesurée | Statut |
|---|---|---|---|
| Disponibilité sur 30 jours | 99 % | `⟨à relever⟩` | `⟨…⟩` |
| Latence au 95ᵉ centile | < 1 s | `⟨à relever⟩` | `⟨…⟩` |
| Taux d'erreurs serveur | `⟨seuil à préciser⟩` | `⟨à relever⟩` | `⟨…⟩` |

La cible de latence a été relâchée de 800 millisecondes à 1 seconde en cours de projet, en
conséquence directe du choix de réduire à zéro le nombre d'instances actives hors trafic.
**C'est un arbitrage coût contre latence, déclaré comme tel** et non une cible ajustée après
coup pour être atteinte.

### 6.5.2 Démarrage à froid du composant d'encodage — mesure disponible

Cette mesure a été réalisée et documentée pendant le projet. Elle est reprise ici telle
quelle.

| Élément | Valeur |
|---|---|
| Durée moyenne de démarrage à froid | **≈ 27 secondes** (mesure sur 7 jours) |
| Pic observé | **≈ 94 secondes** |
| Estimation initiale figurant dans la conception | Deux ordres de grandeur inférieurs |
| Incident provoqué | Erreurs de service, 5 août 2026 |
| Correction appliquée | Budget de la sonde porté au-delà du pic, 7 août 2026 |

**Cette ligne est l'une des plus importantes du chapitre.** L'écart entre l'estimation issue
de la documentation et la mesure réelle dépasse deux ordres de grandeur. L'estimation initiale
n'a pas été corrigée discrètement : elle est conservée dans la documentation, accompagnée de
la mesure qui la contredit et de sa date.

**La règle appliquée dans tout ce chapitre en découle : la mesure fait foi.**

---

## 6.6 Résilience

### 6.6.1 Reconstruction complète d'un environnement

C'est la démonstration la plus directe de la réponse au point bloquant B5 de l'audit initial —
l'environnement non reproductible.

**Protocole** : détruire intégralement un environnement, puis le reconstruire à partir du seul
dépôt. Chronométrer chaque phase. Vérifier ensuite la conformité fonctionnelle.

| Phase | Durée | Observations |
|---|---|---|
| Destruction | `⟨à relever⟩` | |
| Reconstruction de l'infrastructure | `⟨à relever⟩` | |
| Redéploiement des applications | `⟨à relever⟩` | |
| Réinjection des valeurs de secrets | `⟨à relever⟩` | Hors chaîne d'infrastructure, par conception |
| Vérification de conformité | `⟨à relever⟩` | |
| **Durée totale de reconstruction** | `⟨à calculer⟩` | |

| Vérification post-reconstruction | Résultat |
|---|---|
| Nombre d'interventions manuelles nécessaires | `⟨à relever⟩` |
| Écarts constatés par rapport à l'environnement d'origine | `⟨à relever⟩` |
| Planification post-reconstruction vide | `⟨à relever⟩` |

> **Recommandation forte pour la soutenance.** Cette démonstration doit être filmée ou
> exécutée en direct. C'est l'élément le plus spectaculaire du projet, et celui qui répond le
> plus directement à la dette technique identifiée au chapitre 1.

### 6.6.2 Restauration de la base de données

| Élément | Valeur |
|---|---|
| Restauration effectivement exécutée | **Oui** (03/08/2026) |
| Point de restauration visé | Instant T, perte de données nulle (RPO 0) |
| Durée de la restauration | **32 minutes 45 secondes** |
| Intégrité vérifiée après restauration | Oui |
| Configuration | **Mesuré sur l'ancienne configuration zonale** (avant la bascule HA régionale du 08/08) ; à revalider sur la configuration régionale |

**La restauration a été exécutée le 03/08/2026.** La mesure porte sur l'ancienne
configuration zonale ; la configuration régionale (haute disponibilité) installée le 08/08
doit être revalidée.

### 6.6.3 Retour arrière applicatif

| Élément | Valeur |
|---|---|
| Retour à une révision antérieure exécuté | **Oui** (mesuré le 19/08/2026) |
| Durée (bascule vers révision précédente) | **11,6 secondes** |
| Durée (retour à la révision d'origine) | **16,5 secondes** (démarrage à froid observé) |
| Interruption de service constatée | Interruption durant la bascule ; pas de déploiement progressif automatique |

---

## 6.7 Coût réel

| Poste | Coût mensuel observé | Part |
|---|---|---|
| Ingestion et stockage des journaux | `⟨à relever⟩` | `⟨…⟩` |
| Base de données | `⟨à relever⟩` | `⟨…⟩` |
| Services d'exécution | `⟨à relever⟩` | `⟨…⟩` |
| Connecteur réseau (coût fixe) | `⟨à relever⟩` | `⟨…⟩` |
| Périmètre d'entrée et filtrage | `⟨à relever⟩` | `⟨…⟩` |
| Requêtes de l'entrepôt de supervision | `⟨à relever⟩` | `⟨…⟩` |
| **Total** | `⟨à relever⟩` | 100 % |

Trois points doivent être analysés à partir de ce tableau.

**Le poste dominant est-il celui qui était prévu ?** La conception postulait que l'ingestion
des journaux serait le premier poste, ce qui a motivé le filtrage à la source (chapitre 5,
section 5.5.1). La mesure confirme ou infirme cette hypothèse — les deux résultats sont
informatifs.

**Effet du filtrage à la source.** Comparer le volume ingéré au volume qui l'aurait été sans
filtres permet de chiffrer l'économie réalisée : `⟨à relever⟩`.

**Coût du choix de la haute disponibilité.** La décision D13 a doublé le coût de la base de
données. Ce surcoût doit être isolé : `⟨à relever⟩`.

**Comparaison avec l'alternative écartée.** Le chapitre 2 a écarté les solutions de
supervision commerciales pour raison de coût. Une estimation du coût qu'aurait représenté le
même volume de journaux sur une solution commerciale donne à cette décision une base chiffrée
plutôt qu'une affirmation : `⟨à estimer, avec la source de la grille tarifaire⟩`.

---

## 6.8 Conformité aux référentiels

| Référentiel | Contrôles applicables | Satisfaits | Écarts | Méthode de vérification |
|---|---|---|---|---|
| Principes Zero Trust | 7 | `⟨…⟩` | `⟨…⟩` | Grille du chapitre 4, section 4.6 |
| Référentiel d'infrastructure | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` | `⟨outil ou méthode employée — à préciser⟩` |
| Référentiel applicatif | `⟨…⟩` | `⟨…⟩` | `⟨…⟩` | Portée limitée au socle |

**Écarts identifiés et assumés**, à reprendre depuis le chapitre 4 avec leur statut à la date
de la mesure :

| Écart | Contrôle concerné | Justification | Statut à la date de mesure |
|---|---|---|---|
| Journalisation des refus réseau désactivée | `⟨référence du contrôle⟩` | Coût d'ingestion | Assumé |
| Sous-réseau inutilisé | `⟨référence du contrôle⟩` | Reliquat de conception | Suppression recommandée |
| Identité partagée du composant d'encodage | Principe de moindre privilège | Simplification non revue | **À corriger** |

---

## 6.9 Limites, biais et menaces à la validité

Cette section est indispensable. Un travail présenté sans limites signale qu'aucune mesure
sérieuse n'a été conduite.

### 6.9.1 Limites du dispositif de mesure

| # | Limite | Conséquence sur l'interprétation |
|---|---|---|
| **L1** | Absence de trafic d'utilisateurs réels | Les taux de faux positifs et les seuils comportementaux ne sont pas représentatifs d'une exploitation réelle |
| **L2** | Attaques simulées, non issues d'un adversaire réel | Les tests valident les contrôles contre les scénarios **prévus**. Un adversaire réel explore l'espace des scénarios non prévus |
| **L3** | Période d'observation courte | Les phénomènes lents — dérive, saturation, croissance du coût — ne sont pas observables |
| **L4** | Environnement de recette | La topologie est identique, le dimensionnement ne l'est pas |
| **L5** | Auto-évaluation | L'auteur du système est également l'auteur des tests. Aucun regard extérieur n'a été sollicité |

La limite **L5** est la plus structurelle et ne peut pas être levée dans le cadre du projet.
Elle doit être énoncée sans atténuation. Une atténuation partielle consiste à publier les
protocoles de test en détail — ce que fait la section 6.2 — de sorte qu'un tiers puisse les
reproduire et contredire les résultats.

### 6.9.2 Biais de l'évaluation sémantique

| # | Biais | Atténuation appliquée |
|---|---|---|
| **B1** | Annotation par une seule personne, qui est l'auteur du système | `⟨à préciser : annotation en aveugle, ou accord inter-annotateurs⟩` |
| **B2** | Jeu d'évaluation issu du même système que celui évalué | Les alertes proviennent des règles écrites par l'auteur, ce qui peut favoriser des formulations proches des descriptions de référence |
| **B3** | Taille réduite du jeu d'évaluation | Un écart de quelques points sur 100 alertes n'est pas nécessairement significatif. `⟨envisager un intervalle de confiance⟩` |
| **B4** | Choix du seuil de similarité | Le seuil influence directement l'arbitrage entre abstention et erreur silencieuse. `⟨rapporter les résultats pour plusieurs seuils⟩` |

Le biais **B4** suggère une mesure supplémentaire, peu coûteuse et très valorisante : présenter
l'évolution des métriques en fonction du seuil. Cette courbe montre que le seuil retenu résulte
d'un arbitrage étudié et non d'une valeur choisie arbitrairement.

### 6.9.3 Limites du système lui-même

Reprises des chapitres précédents, elles doivent figurer ici pour être confrontées aux mesures.

| Limite | Origine | Mesure associée |
|---|---|---|
| Mise à l'échelle horizontale non traitée | Objectif écarté (BNF7) | Limites mesurées : `⟨à relever⟩` |
| Angle mort sur les mouvements latéraux | Écart É1 | Familles de techniques non couvertes : `⟨à relever⟩` |
| Enrichissement non intégré au score | Écart de réalisation | L'effet sur la priorisation n'est pas évaluable |
| Plafond de couverture lié à la traduction manuelle | Verrou V2 | Écart mesuré : `⟨à relever⟩` |
| Environnement mono-région | Choix assumé | Aucune mesure de reprise inter-région |

---

## 6.10 Réponse aux objectifs du projet

Cette section confronte chacun des six objectifs mesurables du chapitre 1 aux résultats
obtenus. C'est la conclusion opérationnelle du mémoire.

| # | Objectif | Indicateur | Résultat | Atteint ? |
|---|---|---|---|---|
| **O1** | Supprimer la confiance implicite du réseau | Part des scénarios de contournement bloqués | `⟨…⟩` | `⟨…⟩` |
| **O2** | Rendre l'infrastructure reproductible | Part du socle en code ; durée de reconstruction | `⟨…⟩` | `⟨…⟩` |
| **O3** | Contrôler la chaîne de livraison | Nombre de portes bloquantes ; nombre de clés exportées | `⟨…⟩` | `⟨…⟩` |
| **O4** | Détecter les événements de sécurité | Couverture, taux de faux positifs, délai de détection | `⟨…⟩` | `⟨…⟩` |
| **O5** | Enrichir les alertes de façon déterministe | Gain mesuré face à une méthode de référence | `⟨…⟩` | `⟨…⟩` |
| **O6** | Rester exploitable et soutenable | Coût mensuel ; objectifs de service ; procédures exécutées | `⟨…⟩` | `⟨…⟩` |

**Rappel de deux engagements pris au chapitre 1**, qui doivent être tenus ici :

- L'objectif **O4** exige de publier ce que le système **ne détecte pas**. La section 6.3.3 y
  répond.
- L'objectif **O5** admettait par avance un résultat négatif. Si le gain n'est pas au
  rendez-vous, il doit être rapporté tel quel.

---

## Conclusion du chapitre

Ce chapitre a confronté l'architecture à l'épreuve de la mesure, en appliquant le programme
de validation défini avant la conception — aucun test n'a été sélectionné après coup.

Sur les vingt tests prévus, **trois sont conformes** (T5, T11, T14), **quatre sont
partiellement conformes** (T1 avec réserve H13, T7 avec l'écart É7, T16 et T18 avec des
réserves documentées), et **treize restent à exécuter**. Les mesures réalisées donnent :
restauration en 32 minutes 45 secondes (RPO 0), retour arrière en 11,6 et 16,5 secondes,
rate-limit MFA vérifié (429), journaux de refus activés le 19/08/2026. Le budget de latence
attaque → incident est de l'ordre de quelques minutes pour le blocage, 5 à 15 minutes pour
la qualification, et des secondes pour le calcul de l'incident.

Le résultat le plus fragile est la **couverture de détection** : sept règles, uniquement du
filtrage HTTP/WAF, aucun test unitaire par règle. La question ouverte reste le gain de
l'enrichissement sémantique par rapport à une méthode plus simple.

Les limites identifiées (angles morts sur l'exfiltration et l'abus IAM, seuils codés en dur,
isolation réseau non réalisée entre locataires) sont autant de perspectives pour la phase
post-PFE. La conclusion générale reprend ces résultats dans le bilan global du mémoire.
