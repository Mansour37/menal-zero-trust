# Revue critique du mémoire au regard des référentiels PFE

Document de travail — **à supprimer avant remise.**

---

## 1. Référentiel de comparaison

La critique qui suit confronte le mémoire aux conventions des rapports de projet de fin
d'études d'écoles d'ingénieurs, telles qu'établies par les modèles de rédaction diffusés par
ces établissements. Les points structurants de ces modèles sont les suivants :

| Convention | Exigence du modèle |
|---|---|
| Volume par chapitre | 20 à 25 pages, **chapitres équilibrés entre eux** |
| Introduction générale | Contexte, problématique, objectifs, **se termine obligatoirement par l'annonce du plan** |
| Chaque chapitre | Texte d'introduction annonçant l'objectif, **et transition finale** vers le chapitre suivant |
| État de l'art | Synthèse de la technologie ou du marché, **jamais une recopie** de documents existants |
| Captures d'écran | Si elles sont trop nombreuses, les reporter en annexe |
| Annexes | Ne dépassant pas le tiers du document ; **aucune annexe orpheline** non appelée dans le corps |
| Conclusion générale | Rappel de la problématique et de la démarche, conclusions **correspondant aux objectifs de l'introduction**, limites, recommandations, ouverture |
| Pièces liminaires | Dédicaces, remerciements, table des matières, liste des figures, liste des tableaux, glossaire des acronymes, résumé |
| Mise en forme | Police unique, styles de titres hiérarchisés, numérotation continue |

À ces conventions rédactionnelles s'ajoutent les attentes techniques usuelles d'un jury de
génie logiciel : modélisation UML, méthodologie de conduite de projet, planification.

---

## 2. Conformité du mémoire actuel

| Convention | État | Commentaire |
|---|:-:|---|
| Introduction de chapitre | ✅ | Présente dans les six chapitres |
| Transition finale de chapitre | ✅ | Chaque conclusion annonce le chapitre suivant |
| État de l'art comme synthèse | ✅ | Aucune recopie ; comparaisons argumentées et positionnement |
| Captures en annexe si nombreuses | ✅ | 16 des 20 preuves de test renvoyées en annexe C |
| Annexes appelées dans le corps | ✅ | Les renvois existent |
| **Volume par chapitre** | ⚠️ | 13 à 15 pages contre 20 à 25 attendues |
| **Équilibre entre chapitres** | ✅ | Écart maximal de 15 % — c'est le point le mieux tenu |
| **Introduction générale** | ❌ | **Absente** |
| **Conclusion générale** | ❌ | **Absente** |
| **Pièces liminaires** | ❌ | **Toutes absentes** |
| **Glossaire des acronymes** | ❌ | **Absent** |
| **Bibliographie consolidée** | ⚠️ | 16 références, toutes concentrées dans le chapitre 2 |
| **Modélisation UML** | ❌ | **Totalement absente des six chapitres** |
| **Méthodologie de conduite de projet** | ❌ | Phasage présent, mais ni méthode nommée, ni planning |
| **Résultats de validation** | ❌ | Chapitre 6 sans mesures |

---

## 3. Les écarts, par ordre de gravité

### 3.1 — Écart critique : l'absence totale de modélisation UML

**C'est le reproche le plus probable et le plus légitime qu'un jury formulera.**

Un mémoire de fin d'études en informatique comporte conventionnellement un diagramme de cas
d'utilisation, des diagrammes de séquence pour les scénarios principaux, et un diagramme de
déploiement ou de classes. Le mémoire actuel n'en comporte aucun.

Ce que le mémoire propose à la place n'est pas mauvais — il est même plus adapté au sujet :

- les cas d'utilisation UC1 à UC8 sont formalisés en tableau ;
- les flux F1 à F7 constituent une vue dynamique cohérente et référencée partout ;
- le modèle en couches tient lieu de vue statique.

**Mais l'absence de la notation attendue sera lue comme une lacune de formation, et non comme
un choix.** C'est une bataille qu'il est inutile de livrer : le coût d'ajout est faible et le
bénéfice est immédiat.

**Correction recommandée — quatre diagrammes, environ une journée de travail :**

| Diagramme | Contenu | Emplacement |
|---|---|---|
| Cas d'utilisation | Les acteurs A1 à A6 et les cas UC1 à UC8 | Chapitre 3, section 3.1.2 |
| Séquence — flux nominal | Utilisateur → périmètre → charge de travail → données (F1 puis F2), avec les points de vérification d'identité | Chapitre 4, section 4.3 |
| Séquence — chaîne de livraison | Les huit étapes de F3 avec les trois portes bloquantes matérialisées | Chapitre 5, section 5.3 |
| Séquence — détection et enrichissement | F4 puis F5 : collecte, règle, encodage, recherche vectorielle, affichage | Chapitre 5, section 5.6 |
| Déploiement | Les composants réels et leurs liens réseau | Chapitre 4, section 4.2.3 |

Le diagramme de séquence de la chaîne de livraison est le plus rentable : il rend visible, en
une image, que les portes sont bloquantes et non informatives.

### 3.2 — Écart majeur : aucune méthodologie de conduite de projet

Le mémoire décrit un phasage P0 à P4 avec critères de sortie, ce qui est méthodologiquement
correct. Mais il ne nomme aucune méthode, ne présente aucun planning, et ne comporte aucun
élément de suivi.

Un jury attend au minimum :

- une **méthode nommée** et justifiée — le phasage actuel s'apparente à un cycle en V par
  incréments, ce qui se défend parfaitement pour un projet d'infrastructure et se dit ;
- un **diagramme de Gantt** situant les phases dans la durée réelle du projet ;
- une indication du **suivi** avec l'encadrant entreprise.

**Point à ne pas manquer** : le projet est en réalité conduit de manière très proche d'une
démarche agile — les registres de décisions et d'écarts sont datés au fil de l'eau, les
corrections sont apportées par itérations successives (5 août, 7 août, 8 août, 11 août). Cette
matière existe ; elle n'est simplement pas présentée comme une méthode. Une section d'une page
et demie suffit à corriger l'écart, et elle valorisera un travail déjà fait.

### 3.3 — Écart majeur : les pièces liminaires et finales

Neuf pièces manquent, pour un total d'environ douze pages.

| Pièce | Volume | Difficulté |
|---|---|---|
| Page de garde | 1 p. | Modèle de l'établissement |
| Dédicaces et remerciements | 1 p. | Personnel |
| Résumé français | 0,5 p. | À rédiger en dernier |
| Résumé anglais (*abstract*) | 0,5 p. | À rédiger en dernier |
| Table des matières | 2 p. | Automatique |
| Liste des figures | 1 p. | Automatique — **27 figures déjà répertoriées** |
| Liste des tableaux | 1 p. | Automatique — le mémoire en compte plus de 50 |
| Glossaire des acronymes | 1 p. | À constituer |
| **Introduction générale** | 2 p. | **À rédiger** |
| **Conclusion générale** | 3 p. | **À rédiger après le chapitre 6** |

Deux exigences précises du modèle méritent attention :

- **L'introduction générale doit se terminer par l'annonce du plan.** C'est une convention
  formelle, et son absence se remarque immédiatement.
- **La conclusion générale doit reprendre les objectifs de l'introduction et y répondre.** Le
  mémoire est ici en position favorable : les six objectifs O1 à O6 sont chiffrés et la
  section 6.10 leur répond point par point. La conclusion générale n'aura qu'à consolider.

### 3.4 — Écart notable : le volume des chapitres

Le modèle attend 20 à 25 pages par chapitre. Le mémoire en compte 13 à 15.

**Ce n'est pas un problème de contenu mais de format.** Deux voies s'offrent :

**Voie A — conserver six chapitres et laisser le volume croître naturellement.** L'insertion
des 27 figures, des cinq diagrammes UML, de la section de méthodologie et des résultats de
mesure du chapitre 6 portera mécaniquement chaque chapitre à 18-22 pages. C'est la voie
recommandée : aucune restructuration, le volume vient du contenu manquant.

**Voie B — regrouper en quatre ou cinq chapitres** pour se rapprocher du modèle le plus
classique, en fusionnant par exemple les chapitres 1 et 2. Cette voie est déconseillée : elle
affaiblirait le positionnement bibliographique, qui est un point fort actuel.

**Action préalable indispensable** : vérifier auprès de l'encadrant académique la règle
exacte appliquée par l'établissement cette année. Les modèles évoluent, et une contrainte de
nombre de chapitres, si elle existe, prime sur toute considération de cohérence.

### 3.5 — Écart notable : la bibliographie

Seize références, toutes situées dans le chapitre 2. Les cinq autres chapitres n'en citent
aucune.

| Problème | Correction |
|---|---|
| Concentration dans un seul chapitre | Citer les référentiels là où ils sont appliqués — chapitres 3, 4 et 6 |
| Volume un peu juste | Viser 25 à 30 références |
| Trois références incomplètes | Ajouter adresse de consultation et date d'accès |
| Absence de netographie séparée | Distinguer les sources en ligne si le modèle l'exige |
| Style de citation non uniformisé | Choisir un style unique et l'appliquer partout |

### 3.6 — Écart mineur mais visible : les marques de document de travail

Quatre passages s'adressent directement au jury ou à la soutenance. **Ils doivent
impérativement disparaître du rapport remis.** Un mémoire ne commente pas sa propre
évaluation.

| Fichier | Passage | Correction |
|---|---|---|
| Chapitre 1 | « déjà produit pour la soutenance » | Supprimer la mention |
| Chapitre 1 | « Version destinée à la soutenance : conserver les lignes… » | Déplacer dans le document de travail |
| Chapitre 3, §3.6 | « un jury, un auditeur ou un client finit toujours par demander… » | Reformuler : « un auditeur ou un client finit toujours par demander… » |
| Chapitre 6, §6.6.1 | « Recommandation forte pour la soutenance. Cette démonstration doit être filmée… » | Supprimer entièrement du rapport |

S'y ajoutent les notes de rédaction en tête du chapitre 6 et l'annexe « liste de travail des
mesures à produire », toutes deux explicitement marquées comme à supprimer.

### 3.7 — Écart de style : le commentaire méta

Le mémoire commente fréquemment ses propres choix de rédaction : « cette section est
importante parce que… », « il aurait été plus confortable de… », « publier ce tableau est une
décision assumée ».

**Ce registre a une vraie valeur** — il rend la démarche explicite et il est ce qui distingue
le mémoire d'une documentation technique. Mais il est employé trop souvent. Au-delà d'une
certaine densité, il donne l'impression que l'auteur explique son travail au lieu de le
présenter.

**Correction recommandée** : conserver ce registre aux quatre ou cinq endroits où il porte un
argument méthodologique réel — la matrice de traçabilité, la publication des lacunes de
détection, la révision de décision D13, l'écart É3, les limites du chapitre 6 — et l'alléger
partout ailleurs. Objectif : réduire d'environ un tiers.

---

## 4. Ce que ce mémoire fait mieux que le rapport de fin d'études courant

Cette section n'est pas une consolation. Elle identifie ce qu'il ne faut **pas** sacrifier en
corrigeant les écarts ci-dessus.

| # | Point fort | Pourquoi il est rare |
|---|---|---|
| **1** | **Une problématique mesurable** | Le PFE courant pose une question en « comment faire ». Ici, six objectifs chiffrés servent de contrat d'évaluation, et le chapitre 6 y répond point par point |
| **2** | **Une matrice de traçabilité menace → exigence → contrôle → test** | C'est la pièce qui relie les chapitres 3, 4, 5 et 6 en une démonstration. La plupart des mémoires juxtaposent ces chapitres sans lien formel |
| **3** | **Un programme de test antérieur à l'implémentation** | Les vingt tests dérivent de l'analyse de risque, pas des fonctionnalités réussies. Cette antériorité interdit de sélectionner les épreuves favorables |
| **4** | **Un registre de décisions comportant une révision** | La décision D13 contredit D03 et le dit. Un registre où rien n'est jamais révisé est une reconstruction *a posteriori* |
| **5** | **Des écarts datés et rattachés aux exigences affectées** | Six écarts documentés, dont un — le partage d'identité É3 — qui contredit un principe affiché du projet |
| **6** | **Une comparaison où l'auteur perd** | Le tableau de positionnement du chapitre 1 concède trois critères sur quinze. C'est ce qui rend les douze autres crédibles |
| **7** | **La mesure retenue contre l'estimation** | Le démarrage à froid mesuré contredit d'un ordre de grandeur l'estimation initiale, et l'estimation est conservée avec sa réfutation |
| **8** | **Une section de limites et de biais** | Y compris le biais central : l'auteur des tests est l'auteur du système |

**Le risque à surveiller.** Cette densité d'écarts assumés peut, si elle est mal cadrée, être
lue comme l'aveu d'un projet inachevé. Le cadrage doit être posé deux fois, explicitement :
dans l'introduction générale et dans la conclusion générale. La formulation doit établir que
la documentation des écarts est une **méthode**, non un constat de faiblesse.

---

## 5. Plan de correction

| Priorité | Action | Effort | Effet |
|:-:|---|---|---|
| **1** | Produire les mesures du chapitre 6 | 10-13 j | **Sans elles, le mémoire décrit un système sans démontrer qu'il fonctionne** |
| **1** | Ajouter les cinq diagrammes UML | 1 j | Supprime le reproche le plus probable |
| **1** | Supprimer les quatre marques de document de travail | 1 h | Élimine une faute de forme visible |
| **2** | Rédiger l'introduction et la conclusion générales | 1 j | Pièces obligatoires ; la conclusion ne se rédige qu'après le chapitre 6 |
| **2** | Ajouter la section de méthodologie et le diagramme de Gantt | 0,5 j | Valorise un travail déjà fait mais non présenté |
| **2** | Produire les 27 captures et figures | 3,5 j | Recouvre en partie l'exécution des tests |
| **3** | Consolider la bibliographie à 25-30 références | 0,5 j | Renforce le chapitre 2 |
| **3** | Constituer les pièces liminaires | 0,5 j | Largement automatisable |
| **3** | Alléger le commentaire méta d'environ un tiers | 0,5 j | Améliore le rythme de lecture |

**Effort total : environ 18 à 21 jours**, dont 10 à 13 pour les seules mesures.

**Si le temps manque**, l'ordre de sacrifice est : d'abord la priorité 3, puis les captures
non critiques. Les mesures du chapitre 6 et les diagrammes UML ne doivent pas être
abandonnés : les premières parce qu'elles sont l'objet même de la démonstration, les seconds
parce que leur absence sera interprétée comme une lacune de formation.

---

## 6. Note prévisionnelle

| Critère d'évaluation | Poids indicatif | Note actuelle | Note après corrections |
|---|:-:|:-:|:-:|
| Problématique et cadrage | 15 % | 17 | 17 |
| État de l'art et positionnement | 15 % | 17 | 17,5 |
| Analyse et conception | 20 % | 17,5 | **18** avec les diagrammes UML |
| Réalisation | 20 % | 17 | 17,5 |
| **Validation et résultats** | 20 % | **6** — non mesurés | **17** si les mesures sont produites |
| Qualité rédactionnelle et forme | 10 % | 12 — pièces manquantes | 16,5 |
| **Moyenne pondérée** | | **≈ 14,4** | **≈ 17,4** |

L'écart de trois points tient presque entièrement à un seul poste : les résultats du
chapitre 6. Tout le reste est du travail de finition.
