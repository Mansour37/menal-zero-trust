# RAPPORT_CAPTURES — où et pourquoi le mémoire porte des captures

Date : 29/08/2026. Équipe « preuves visuelles », vague finale « ≤ 120 pages ».
Périmètre : `latex/chapters/final/ch5_realisation.tex`, `latex/chapters/final/ch6_validation.tex`,
`latex/appendices/annexe_e_protocoles_tests.tex`, `latex/appendices/annexe_h_captures.tex`,
`latex/config/commands.tex`, `PLAN_CAPTURES.md`.

**Statut d'écriture : LECTURE SEULE sur le LaTeX du mémoire.** Aucun `.tex` du mémoire n'a été
modifié, aucun fichier supprimé. Deux fichiers ont été **créés** et sont mes seuls artefacts :
ce rapport, et `latex/test_cadres_captures.tex` (banc d'essai de compilation, hors `main.tex`,
décrit au §6). Aucun code LaTeX de ce rapport n'a été écrit par `echo`, `sed` ou heredoc :
tout est passé par l'outil Write, puis compilé.

---

## 0. Réponse en une page

| | |
|---|---|
| Cadres retenus | **4**, sur les 6 autorisés |
| Répartition | 2 au chapitre 5, 2 au chapitre 6 |
| Coût en pages | **≈ 1,5 page** (mesuré par compilation, détail §3.6) |
| Identifiants | **K05**, **K23** (repris de `PLAN_CAPTURES.md`), **K33**, **K34** (nouveaux) |
| Écartés | 9 identifiants posés + 20 preuves de la campagne T1–T20 |
| Annexe H | **reste dehors**, définitivement (§5) |
| Code proposé | compilé : 0 erreur, 0 `undefined`, 0 `Overfull`/`Underfull` |

**Les deux slots restants sont laissés vides volontairement.** Le plafond est de six ; je n'en
utilise que quatre parce que je n'ai trouvé que quatre preuves de ce mémoire dont **l'objet est
l'affichage lui-même**. Remplir les deux derniers reviendrait à photographier des chiffres, ce
que le mémoire fait déjà mieux en tableau — et à dépenser une page qu'il n'a pas.

---

## 1. La règle appliquée, et pourquoi ce mémoire y résiste particulièrement bien

La règle du brief (§4) :

> Une capture n'est justifiée que lorsque **l'objet de la preuve est l'affichage lui-même**.
> Si la preuve est un enchaînement de faits, un horodatage ou un code de retour, le tableau ou
> l'extrait de journal est supérieur.

Ce mémoire n'a pas besoin qu'on lui impose cette règle : **il l'a déjà écrite lui-même, deux
fois, et de façon plus dure.**

1. `ch6_validation.tex:61–63` — la hiérarchie de preuves à quatre rangs se termine par cette
   phrase : *« La capture d'écran ne figure pas dans cette échelle : elle restitue une preuve
   d'un des quatre rangs, elle n'en est jamais une par elle-même. »*
2. `annexe_e_protocoles_tests.tex:328–330` — *« la sortie brute est conservée à côté de chaque
   preuve visuelle […] : c'est cette sortie, et non l'image, qui constitue la preuve, dont
   l'image n'est que la restitution. »*
3. `ch6_validation.tex:1152` — la conclusion du chapitre 6 ouvre sur : *« Les deux preuves les
   plus fortes ne sont pas des captures d'écran mais un test automatisé […] et un refus non
   provoqué. »*

**Conséquence directe sur la sélection, et c'est le point central de ce rapport :** une capture
posée sur une preuve de rang 1 à 4 est *au mieux redondante et au pire contradictoire* avec la
méthode que le mémoire revendique. Un jury qui lit la phrase de la page 61 puis trouve six
captures de codes HTTP conclut que l'auteur ne s'applique pas sa propre règle. Le nombre de
cadres n'est donc pas un arbitrage de place : **c'est une condition de cohérence interne.**

Il reste une catégorie que cette hiérarchie ne couvre pas, et c'est exactement celle des cadres
retenus : **les propriétés qui n'existent que rendues à l'écran.** Trois familles :

- **l'existence et l'ergonomie d'une interface** — « l'interface a été servie à un compte
  analyste » n'est pas un code de retour ; c'est un fait visuel ;
- **une apparence trompeuse** — « la porte échouait en interne tandis que l'étape apparaissait
  verte » : le vert *est* l'objet de la preuve, aucun journal ne le porte ;
- **une absence dans un affichage** — « la chaîne se termine par un écran » : ce qui manque à
  l'écran (une file, un accusé, une notification) ne peut pas être prouvé par un extrait de
  journal, puisqu'il n'y a précisément rien à extraire.

Tout le reste des preuves du mémoire — et c'est l'écrasante majorité — tombe sous la règle
inverse. Le §4 en fait la liste explicite.

---

## 2. Inventaire des preuves des chapitres 5, 6 et de l'annexe E, et tri

Vingt protocoles, plus les mesures hors campagne. Colonne « Verdict » : `CAPTURE` /
`TABLEAU` (déjà en place ou à privilégier) / `JOURNAL` (extrait verbatim).

### 2.1 Les vingt protocoles T1–T20

| Test | Nature réelle de la preuve | Verdict | Raison |
|---|---|---|---|
| T1 | 3 refus 403 + 1 redirection 302, 23/08 | **TABLEAU** | Codes HTTP. Déjà dans `tab:synthese-campagne` et en annexe E. Une capture n'ajoute rien et coûte une demi-page à une **non-conformité** qui se lit en deux lignes. |
| T2 | 10× 422 puis 1× 429, 19/08 | **TABLEAU** | Idem. Onze codes de retour : trois lignes de tableau battent toute image. |
| T3 | Balayage tracé, journaux collectés | **TABLEAU** | Fait d'inventaire, réserve incluse. |
| T4 | Inventaire : aucune adresse publique | **TABLEAU** | Inventaire = tableau par nature. |
| T5 | Deux rôles exacts, usurpation refusée, 23/08 | **JOURNAL** | Sortie de commande de 4 lignes ; citable, comparable, rejouable. |
| T6 | Test automatisé d'appel sans jeton | **TABLEAU** | Preuve de rang 1 : c'est le test qui prouve, pas son affichage. |
| T7 | Inventaire vide | **TABLEAU** | Prouver un **vide** par une image est le pire cas : un cadrage suffit à tricher. Un inventaire écrit est vérifiable. |
| T8 | Refus réel sur `node-tar` 6.2.1 | **JOURNAL** | La ligne d'analyse portant le CVE et le code de sortie. Voir §4.2 pour la nuance. |
| T9 | Registre unique, résolution par empreinte | **TABLEAU** | Fait de configuration. |
| T10 | Porte bloquante, aucun refus observé | **TABLEAU** | Rien à montrer : le mémoire déclare l'absence de refus. |
| T11 | Test de bout en bout automatisé | **TABLEAU** | Le mémoire dit lui-même que ce test « porte plus loin qu'une capture d'écran » (`ch6:234`). Le capturer le rabaisserait. |
| T12 | Arrêt 10:35:00 → notification 11:11:19, 36 min 19 s | **TABLEAU** | Trois horodatages et une soustraction. Cas d'école de la règle. |
| T13 | Journalisation d'audit activée sur 4 services | **TABLEAU** | Inventaire de configuration. |
| T14 | Sonde A refusée ×2 ; sonde B code 204 en 412 ms | **TABLEAU** | Non-conformité entièrement portée par 5 horodatages, 2 adresses et 2 codes. Déjà écrite au mot près en annexe E. |
| T15 | 500 injectées, 350 traitées, 96 s max, 150 perdues | **TABLEAU** | Sept nombres. Un tableau les compare, une image ne le permet pas. |
| T16 | Planification sans différence, 19/08 | **JOURNAL** | `No changes. Your infrastructure matches the configuration.` — **trois lignes**. C'était K22 : voir §4.1. |
| T17 | 4 refus 403 nommant `storage.objects.get`, 20/08 | **JOURNAL** | Quatre lignes de refus + un contrôle positif. Extrait verbatim supérieur : le nom du droit manquant doit être **citable**, pas photographié. |
| T18 | Revue de fusion, application manuelle | **TABLEAU** | Fait de procédure. |
| T19 | 2 notifications, seuils 90 % et 100 %, 21/08 | **JOURNAL** | Le corps de la notification, 4 lignes. Il prouve en outre **par son contenu** que le poste de consommation n'y figure pas — un extrait le montre mieux qu'une image, parce qu'on peut le lire en entier. |
| T20 | 3 refus horodatés + 1 contrôle positif, 24/08 | **TABLEAU** | Le plus riche en horodatages de toute la campagne, et donc le plus mauvais candidat à l'image. |

**Résultat du tri : 0 capture sur 20 protocoles.** Ce n'est pas un raffinement, c'est le
constat central. La campagne T1–T20 est intégralement faite d'horodatages, de codes de retour
et d'inventaires — les trois choses que le brief nomme comme relevant du tableau.

### 2.2 Les preuves hors campagne

| Preuve | Nature | Verdict |
|---|---|---|
| Restauration base, 32 min 45 s, 314/314, 03/08 | Six grandeurs mesurées | **TABLEAU** — déjà `tab:restore-db`, exemplaire |
| Retour arrière 11,6 s / 16,5 s, 07/08 | Deux durées | **TABLEAU** — déjà en annexe E (c'était K20) |
| Démarrage à froid 27 s / 94 s | Deux valeurs | **TABLEAU/GRAPHIQUE** — déjà `graph:coldstart` en TikZ, meilleur qu'une capture d'outil |
| Enrichissement : 12:16:15, T1556.003, 0,698 | Trois valeurs | **TABLEAU** — déjà en annexe E (c'était K06) |
| Haute disponibilité appliquée en 11 min 2 s | Une durée | **TABLEAU** |
| Scénario de bout en bout du 19/08 | Chaîne de 4 jalons horodatés | **FIGURE TikZ** — déjà `fig:scenario-19-08`, et **supérieure** à une capture : elle porte l'échelle non linéaire et la réserve de qualification, qu'aucune capture ne pourrait porter |
| Isolation entre bases : 6 vérifications sur 6, 19/08 | Sortie de job | **JOURNAL** — c'était K07 |
| Couverture ATT&CK | Le mémoire **refuse** de publier un taux | **RIEN** — capturer la vue « Couverture » contredirait `ch6:355–357` |
| Interface servie à un compte analyste, 23/08 | **Fait visuel** | **CAPTURE → K05** |
| Enrichissement rendu à l'analyste | **Fait visuel** | **CAPTURE → K33** |
| Porte SAST « apparaissait verte », 16/08 | **Apparence trompeuse** | **CAPTURE → K23** |
| « La chaîne se termine par un écran » | **Absence dans un affichage** | **CAPTURE → K34** |

---

## 3. Les quatre cadres retenus

Chaque cadre porte : identifiant, emplacement `fichier:ligne`, ce que le lecteur doit y voir,
la légende rédigée, la taille cible et le coût, le protocole ou le résultat de rattachement, et
la manière de produire réellement la capture.

Le code LaTeX de chacun est donné au §3.5, dans sa forme exacte, **compilée** (§6).

---

### 3.1 K05 — le tableau de bord servi à un compte analyste

| | |
|---|---|
| **Identifiant** | **K05** (repris de `PLAN_CAPTURES.md` §1, même objet, même date) |
| **Emplacement** | `latex/chapters/final/ch5_realisation.tex:1117` — chapitre 5, §5.6 « Tableau de bord et API de supervision », sous-section « Authentification, second facteur et contrôle d'accès » (`subsec:authent-dashboard`) |
| **Après quel paragraphe** | Après la phrase qui se termine ligne 1117 : *« L'interface a été servie à un compte analyste le 23/08/2026 sur des détections réelles de la recette, une alerte de la règle R2 y apparaissant rattachée à la technique T1498 et attribuée au locataire concerné. »* Le cadre est la restitution exacte de cette phrase, et de rien d'autre. |
| **Rattachement** | T5 (deux rôles exacts, 23/08/2026) et §5.6 ; le tableau `tab:vues-dashboard` en donne la cartographie |
| **Taille cible** | `width=0.82\textwidth` |
| **Coût** | ≈ **0,47 page** (13,1 cm de large, recadrage ~16:10 → 8,2 cm de haut, + 5 lignes de légende) |

**Ce que le lecteur doit y voir — précisément :**

1. **La bande d'identité de session, en haut à droite** : le rôle `analyste` affiché. C'est le
   cœur de la preuve — sans le rôle visible, la capture ne prouve pas que l'interface a été
   servie *à un analyste*, seulement qu'elle existe.
2. **Au moins une ligne de la table des détections** portant simultanément : la règle **R2**,
   la technique **T1498**, et le **locataire** renseigné dans la colonne de service.
   C'est la conjonction des trois sur une même ligne qui prouve l'attribution — que le
   mémoire qualifie lui-même d'« exception plutôt que la règle » (`ch6:689`).
3. **L'horodatage de la détection**, dans sa colonne, lisible : la date doit être *dans le
   cadre*, jamais seulement en légende (règle d'annexe E, `annexe_e:326`).
4. **L'indicateur de fraîcheur des données** de l'enveloppe de mise en page.
5. **Le sélecteur de locataire**, qui « documente lui-même » la portée partielle de son filtre
   (`ch5:1089`). Cette mention n'est vérifiable que là : c'est la seule preuve possible d'une
   affirmation d'honnêteté que le mémoire fait sur son propre écran.

**Légende rédigée :**

```
\caption[Tableau de bord servi à un compte analyste, 23/08/2026]{Tableau de bord de
supervision servi à un compte de rôle analyste le 23/08/2026, page des détections. À y
lire : une détection de la règle R2 rattachée à la technique T1498 et attribuée au
locataire, l'horodatage de la détection, et le sélecteur de locataire qui énonce lui-même
la portée partielle de son filtre.}
```

**Comment la produire :**

- **Vue** : tableau de bord, page *Détections* (200 détections R1–R7 sur 24 h, filtrable par
  locataire d'après `tab:vues-dashboard`).
- **Action** : ouvrir une session avec un compte portant le rôle `analyste` — **pas**
  `administrateur` : c'est le rôle qui est l'objet de la preuve. Passer le second facteur.
  Sélectionner le locataire concerné. Trier ou filtrer pour faire remonter une ligne R2/T1498
  renseignée.
- **État du système** : révision de recette en service, API joignable (le bandeau de repli sur
  jeu de démonstration **ne doit pas** être visible — une capture prise en mode démonstration
  montrerait un catalogue de règles *fictif*, `ch5:1239`).
- **Cadrage** : bandeau supérieur + les six à huit premières lignes de la table. Pas d'écran
  entier, pas de barre des tâches.
- **Masquage** (rectangle opaque, jamais de flou) : identifiant complet du projet cloud,
  courriel du compte connecté, adresses réelles.
- **Sortie brute à conserver à côté** : l'export de la requête sur la table des détections,
  filtrée sur R2, en `.txt`.

> **Avertissement de faisabilité, à traiter avant de planifier la prise.** La table des
> détections **a réellement été vidée par une suppression administrateur les 24 et 25/08/2026**
> (`ch6_validation.tex:1018–1021`). La donnée du 23/08 n'est donc plus dans la table vive.
> `PLAN_CAPTURES.md` classe K05 « Preuve disponible : Oui, 23/08/2026 » — cette ligne est
> **antérieure à la suppression** et n'est plus fiable. Deux issues, dans cet ordre :
> **(a)** repeupler la vue depuis la table d'archive de récupération, et la capture porte alors
> les horodatages d'origine du 23/08, ce qui préserve la légende telle qu'elle est écrite ;
> **(b)** à défaut, rejouer le scénario, capturer, et **corriger la date dans la légende** —
> le mémoire interdit de conserver une date que la capture ne porte pas.

---

### 3.2 K23 — le faux vert de la porte d'analyse statique

| | |
|---|---|
| **Identifiant** | **K23** (repris de `PLAN_CAPTURES.md` §1 ; **absorbe K02**, voir plus bas) |
| **Emplacement** | `latex/chapters/final/ch5_realisation.tex:1591` — chapitre 5, §5.8 « Conduite du projet », sous-section « Difficultés rencontrées » (`subsec:incidents`) |
| **Après quel paragraphe** | Après le paragraphe **« Porte SAST en faux vert »**, qui se termine ligne 1591 : *« …elle ne prouve pas la remédiation des 74 constats, dont le triage reste nécessaire. »* |
| **Rattachement** | Incident § « Difficultés rencontrées » ; T8 et T10 en dépendent (`annexe_e:137` : c'est la raison pour laquelle T10 n'est pas prononcé conforme) ; `ch6:65–72`, l'`alertbox` de la stratégie de validation, en fait son exemple fondateur |
| **Taille cible** | `width=0.86\textwidth` |
| **Coût** | ≈ **0,27 page** (13,8 cm de large, recadrage très allongé sur deux lignes de liste → ~3,5 cm de haut, + légende) |

**Pourquoi c'est une capture et pas un tableau — le raisonnement compte ici plus qu'ailleurs.**
Le chapitre 6 fait de cet incident le **fondement de sa convention de notation** : une preuve de
rang 4 ne suffit jamais, parce qu'une porte peut être « déclarée bloquante, correctement écrite,
et n'évaluer plus aucune règle » (`ch6:66–71`). Or ce que ce raisonnement établit ne s'écrit pas :
*une porte inerte a l'air de fonctionner*. Le vert est l'artefact du mensonge. Un tableau qui
énonce « l'étape apparaissait verte » est une affirmation de l'auteur ; la ligne verte à côté de
la ligne rouge est une propriété de la console. C'est le seul endroit du mémoire où l'affichage
est **littéralement** ce qui a trompé l'ingénieur.

**Décision de fusion : un cadre au lieu de deux.** `PLAN_CAPTURES.md` prévoyait une figure
double K23 + K02 (exécution verte du 16/08 *contre* exécution du 19/08). Je la refuse et la
remplace par **une seule capture d'une seule vue** : la liste d'historique des exécutions,
cadrée sur deux lignes voisines. Trois raisons. **(1)** Le contraste est plus fort dans un
seul champ de vision que dans deux vignettes de 0,48 largeur. **(2)** Le second panneau (612
règles, 439 fichiers, 74 constats, code 1) est **du chiffre pur** : il est déjà écrit
ligne 1589 et tomberait sous la règle du tableau. **(3)** Une figure double coûte deux fois
plus cher pour une moitié qui n'aurait pas dû exister. **K02 est donc écarté et son objet
absorbé par K23.**

**Ce que le lecteur doit y voir — précisément :**

1. **Deux lignes voisines de l'historique**, avec leur **pastille de statut** : vert pour
   l'exécution du **16/08/2026**, rouge pour celle du **19/08/2026**.
2. **Les deux dates**, dans la colonne de date de la liste — dans le cadre, pas en légende.
3. **Le numéro d'exécution 32264602112** sur la ligne du 19/08, qui rend la preuve
   retrouvable par un tiers.
4. Idéalement, le **nom du flux** identique sur les deux lignes : c'est ce qui établit que
   c'est *la même chaîne*, avant et après remise en service.

**Légende rédigée :**

```
\caption[Porte d'analyse statique : le faux vert du 16/08 et l'échec du 19/08]{Historique des
exécutions de la chaîne de livraison applicative. À y lire, sur deux lignes voisines : le
16/08/2026, toutes les tâches en succès alors que la porte d'analyse statique n'évaluait
aucune règle ; le 19/08/2026, la même chaîne en échec après remise en service. Le vert de la
première ligne est l'objet de la preuve : c'est lui, et non un journal, qui montre qu'un
contrôle inerte est indiscernable d'un contrôle qui passe.}
```

**Comment la produire :**

- **Vue** : historique des exécutions de la chaîne de livraison applicative, filtré sur le flux
  qui porte la porte d'analyse statique.
- **Action** : filtrer par flux, régler la plage de dates pour que le 16/08 et le 19/08
  apparaissent **adjacents** dans la liste. Aucune exécution à relancer : les deux existent.
- **État du système** : aucun — c'est une preuve d'archive, immédiatement disponible, et c'est
  le seul des quatre cadres qui **ne demande aucun rejeu**.
- **Cadrage** : les deux lignes et l'en-tête de colonnes, rien d'autre. Un recadrage très
  allongé (rapport ~4:1) : c'est ce qui rend ce cadre le moins cher des quatre.
- **Masquage** : nom du dépôt et de l'organisation, courriels des auteurs de *commit*.
- **Sortie brute à conserver** : le journal complet de l'exécution du 16/08 (celui qui montre
  zéro règle évaluée) et celui du 19/08, en `.txt`.

---

### 3.3 K33 — la fiche d'incident : ce que l'enrichissement rend réellement à l'analyste

| | |
|---|---|
| **Identifiant** | **K33** — *nouveau*. `PLAN_CAPTURES.md` n'a aucun identifiant pour la fiche d'incident. K08 est « réservé, retiré de la nomenclature » et **ne doit pas être réemployé** : réattribuer un identifiant retiré crée exactement le genre d'ambiguïté qu'un jury relève. La nomenclature s'arrête à K32 (§3 bis) ; K33 est le suivant libre. |
| **Emplacement** | `latex/chapters/final/ch6_validation.tex:437` — chapitre 6, §6.3 « Évaluation de la chaîne de détection et de l'enrichissement », sous-section « Qualité du signal, délai, et enrichissement sémantique » (`sec:eval-enrichissement`) |
| **Après quel paragraphe** | Après le paragraphe qui se termine ligne 437 : *« …il ne démontre ni la qualité générale du modèle retenu ni sa supériorité sur M0, M1 ou M2. »* |
| **Rattachement** | Objectif **O5** (`tab:objectifs-ch6`, « Réalisé en partie ») et verrou V3 du chapitre 2 |
| **Taille cible** | `width=0.78\textwidth` |
| **Coût** | ≈ **0,51 page** (12,5 cm de large, recadrage ~4:3 → 9,4 cm, + légende) — le plus cher des quatre |

**Pourquoi c'est une capture.** Cette sous-section porte une affirmation d'un type unique dans
tout le mémoire : l'enrichissement « fournit à l'analyste, depuis chaque alerte, une technique
candidate et la procédure d'incident associée, **ce qui raccourcit la qualification manuelle** »
(`ch6:427–429`). C'est une **affirmation d'ergonomie**, pas une mesure. Le mémoire s'interdit
justement de la chiffrer, faute de seconde annotation et de taux d'accord (`tab:limites`). Une
affirmation d'ergonomie non chiffrable ne se soutient que d'une seule façon : en montrant
l'écran. C'est le seul endroit du mémoire où l'objectif O5 devient visible plutôt qu'énoncé.

Le cadre a un second effet, et c'est ce qui le rend recevable devant un jury sévère : il rend
visible **la borne** énoncée trois lignes plus haut — « l'enrichissement n'alimente pas le score
d'incident » (`ch6:421–422`). La jauge de score et le candidat sémantique sont côte à côte à
l'écran alors qu'ils ne communiquent pas. Le cadre montre donc l'acquis *et* l'écart, ce qui est
exactement la discipline que le chapitre s'impose partout ailleurs.

**Ce que le lecteur doit y voir — précisément :**

1. **La technique candidate** (identifiant ATT&CK) et **son score de similarité**, affichés au
   niveau de l'alerte.
2. **La jauge de score d'incident**, dans le même champ de vision — pour que le lecteur
   constate la juxtaposition sans jointure.
3. **Les tactiques rattachées** et **la chronologie** de l'entité, qui sont l'apport de la vue
   d'après `tab:vues-dashboard`.
4. **L'horodatage** de l'entité ou de la dernière détection, dans le cadre.

**Légende rédigée :**

```
\caption[Fiche d'incident : le candidat sémantique rendu à l'analyste]{Fiche d'incident du
tableau de bord. À y lire : la technique candidate et sa similarité affichées à côté de
l'alerte --- c'est la seule forme sous laquelle l'enrichissement atteint l'analyste --- et
la jauge de score, calculée sans ce candidat, qui rend visible l'écart d'architecture
énoncé au même endroit.}
```

*La date de prise sera insérée dans la légende au moment de la production* : elle n'est pas
écrite ici parce que ce cadre exige un rejeu (voir ci-dessous) et que le mémoire interdit
d'annoncer une date avant de l'avoir relevée.

**Comment la produire :**

- **Vue** : page *Incidents*, puis ouverture d'une entité → *Fiche d'incident*.
- **Action** : sélectionner une entité dont au moins une détection porte un rattachement
  sémantique produit par la tâche d'enrichissement (sans quoi la zone à prouver est vide).
- **État du système** : la tâche d'enrichissement doit avoir tourné sur la fenêtre courante.
  Compte tenu du plafond mesuré — 200 détections par heure, fenêtre glissante de deux heures
  (T15, 22/08/2026) — **produire un petit lot de détections et attendre au plus deux cycles de
  quinze minutes** ; injecter un gros volume ferait sortir les lignes de la fenêtre avant
  lecture, ce que T15 a mesuré. API joignable, pas de bandeau de repli.
- **Cadrage** : la moitié supérieure de la fiche : jauge + tactiques + première ligne de la
  chronologie portant le candidat sémantique.
- **Masquage** : identifiant de projet, adresses réelles.
- **Sortie brute à conserver** : la ligne correspondante de la table d'enrichissement
  (technique, similarité, horodatage), en `.txt`.

---

### 3.4 K34 — la vue d'ensemble, ou la preuve d'une absence

| | |
|---|---|
| **Identifiant** | **K34** — *nouveau*, suivant de K33 |
| **Emplacement** | `latex/chapters/final/ch6_validation.tex:1010` — chapitre 6, §6.7 « Du socle au service », sous-section « Trois seuils avant engagement contractuel » (`sec:socle-service`) |
| **Après quel paragraphe** | Après le paragraphe **« Premier seuil : alerter réellement sur les détections de sécurité »**, qui se termine ligne 1010 : *« …c'est la lacune la plus lourde du dispositif et sa remédiation est la plus légère des trois. »* |
| **Rattachement** | Premier des trois seuils (§6.7) ; borne de l'objectif **O4** (`tab:objectifs-ch6` : « la chaîne se termine par un écran ») ; `ch6:414–417` |
| **Taille cible** | `width=0.72\textwidth` |
| **Coût** | ≈ **0,25 page** (11,5 cm de large, recadrage bandeau + bande d'indicateurs ~3:1 → 3,8 cm, + légende) |

**Pourquoi c'est une capture — et c'est le cadre le plus discutable des quatre, donc celui dont
le raisonnement doit être le plus explicite.** Le premier seuil du chapitre 6 énonce que « la
chaîne se termine par un écran, elle doit se terminer par une notification ». C'est une preuve
d'**absence**. Elle échappe par construction au tableau et à l'extrait de journal : il n'y a rien
à extraire, puisque rien ne part. Le seul support qui puisse porter une absence est l'affichage
lui-même — l'écran où l'analyste devrait trouver une file d'incidents à traiter, un accusé de
prise en charge, un départ de notification, et où il ne trouve que des compteurs.

Ce cadre est aussi le premier candidat à la coupe si le plafond de 120 pages est atteint : voir
le §3.6.

**Ce que le lecteur doit y voir — précisément :**

1. **Le bandeau supérieur** : aucune zone de notification, aucun compteur de « à traiter ».
2. **La bande des cinq indicateurs** et la répartition par gravité : la présence de détections
   **de sévérité critique** dans le décompte, sans aucun élément d'interface signalant qu'une
   action est attendue. C'est la conjonction — *du critique affiché, et rien qui alerte* — qui
   fait la preuve.
3. **L'indicateur de fraîcheur**, qui montre que la vue est vive : sans lui, le lecteur peut
   croire à un écran figé.

**Légende rédigée :**

```
\caption[Vue d'ensemble : la chaîne de sécurité se termine par un écran]{Vue d'ensemble du
tableau de bord. À y lire ce qui \emph{n'y est pas} : ni file d'incidents à traiter, ni
accusé de prise en charge, ni départ de notification. La chaîne de détection se termine par
cet écran, et le délai perçu par un analyste dépend donc de sa présence devant lui.}
```

**Comment la produire :**

- **Vue** : page *Vue d'ensemble*, un locataire sélectionné.
- **Action** : aucune ; l'écran au repos est l'objet. S'assurer qu'au moins une détection de
  gravité élevée figure dans la répartition, faute de quoi l'absence de signal ne prouve rien.
- **État du système** : révision de recette en service, API joignable, pas de bandeau de repli.
- **Cadrage** : bandeau supérieur + bande d'indicateurs uniquement — un recadrage très allongé,
  qui est ce qui rend ce cadre bon marché.
- **Réserve à ne pas masquer** : les compteurs de cette vue incluent le trafic
  d'**auto-consultation** du tableau de bord (`tab:limites`). Ne pas mettre en avant les
  valeurs absolues ; la preuve porte sur ce qui manque autour d'elles, pas sur leur niveau.
- **Masquage** : identifiant de projet, courriel du compte connecté.

---

### 3.5 Le code LaTeX exact des cadres en attente

#### 3.5.1 Environnement réutilisé, et pourquoi la macro `\capture` existante ne convient pas

`latex/config/commands.tex:119–143` définit déjà `\capture{ID}{légende}{consigne}`. **Je ne la
réutilise pas**, et c'est une décision, pas un oubli. En version de remise (`\brouillonfalse`,
c'est-à-dire `main.tex`), son cadre vide n'imprime que :

```latex
\scriptsize\color{black!45}\textsf{Capture #2}
```

soit un rectangle gris de 6 cm portant la mention « Capture K05 » — **exactement le défaut
bloquant que le brief interdit** : un cadre vide sans légende explicative. C'est d'ailleurs le
motif écrit noir sur blanc dans l'en-tête de l'annexe H démontée
(`annexe_h_captures.tex:14–16`) : *« la macro `\capture` imprime en mode final un cadre gris
portant "Capture Kxx", qui est le signal visuel d'un travail inachevé. »* La macro est donc
saine pour le mode brouillon et fautive pour la remise. Elle ne doit pas être supprimée — elle
est encore correcte pour son usage de travail — mais elle ne doit pas porter ces quatre cadres.

**Environnement réutilisé à la place : `extraitconf`** (`commands.tex:60–65`), le `tcolorbox`
gris destiné aux extraits encadrés. Trois raisons : il existe déjà, sa teinte grise dit
« zone réservée » sans crier, et il accepte un `title` — ce qui permet au cadre de se nommer
lui-même. Deux clés sont surchargées à l'appel, ce que `tcolorbox` autorise puisque les options
de l'appel sont appliquées après celles de la définition :

- `breakable=false` — `extraitconf` est `breakable` par défaut, ce qui est incorrect à
  l'intérieur d'un flottant ;
- `fontupper=\footnotesize` — annule le `\ttfamily\scriptsize` par défaut, inadapté à un
  paragraphe de consigne.

Le `\IfFileExists` fait le reste : **le jour où `latex/figures/K05.png` est déposé, le cadre
devient l'image, sans toucher au chapitre.** C'est la propriété qui rendait `\capture`
intéressante, conservée sans son défaut.

**Le cadre est auto-portant même vide** : il porte son identifiant, la vue, la date de prise,
ce qu'il prouvera, et la consigne de masquage. Un jury qui tomberait dessus avant production
lirait une spécification datée, pas un trou.

#### 3.5.2 Cadre K05 — à insérer après `ch5_realisation.tex:1117`

```latex
\begin{figure}[!htbp]
\centering
\IfFileExists{figures/K05.png}{%
  \setlength{\fboxrule}{0.4pt}\setlength{\fboxsep}{0pt}%
  \fcolorbox{black!30}{white}{\includegraphics[width=0.82\textwidth]{figures/K05.png}}%
}{%
  \begin{minipage}{0.82\textwidth}
  \begin{extraitconf}[breakable=false, fontupper=\footnotesize,
      title={Emplacement réservé --- capture K05, à produire}]
  \textbf{Vue :} tableau de bord de supervision, page \emph{Détections}, session ouverte
  sous un compte portant le rôle analyste. \textbf{Date de prise :} 23/08/2026.\par\smallskip
  \textbf{Ce que le cadre prouvera :} que l'interface décrite est servie à un rôle analyste
  sur des détections réelles de la recette --- au moins une ligne de la règle R2 rattachée à la
  technique T1498 et portant le locataire dans sa colonne de service, l'horodatage de la
  détection et l'indicateur de fraîcheur visibles dans le cadre, et le sélecteur de locataire
  affichant lui-même la portée partielle de son filtre.\par\smallskip
  \textbf{Masquage :} identifiant de projet, domaines de comptes, adresses réelles.
  \end{extraitconf}
  \end{minipage}%
}
\caption[Tableau de bord servi à un compte analyste, 23/08/2026]{Tableau de bord de
supervision servi à un compte de rôle analyste le 23/08/2026, page des détections. À y
lire : une détection de la règle R2 rattachée à la technique T1498 et attribuée au
locataire, l'horodatage de la détection, et le sélecteur de locataire qui énonce lui-même
la portée partielle de son filtre.}
\label{fig:capture-K05}
\end{figure}
```

#### 3.5.3 Cadre K23 — à insérer après `ch5_realisation.tex:1591`

```latex
\begin{figure}[!htbp]
\centering
\IfFileExists{figures/K23.png}{%
  \setlength{\fboxrule}{0.4pt}\setlength{\fboxsep}{0pt}%
  \fcolorbox{black!30}{white}{\includegraphics[width=0.86\textwidth]{figures/K23.png}}%
}{%
  \begin{minipage}{0.86\textwidth}
  \begin{extraitconf}[breakable=false, fontupper=\footnotesize,
      title={Emplacement réservé --- capture K23, à produire}]
  \textbf{Vue :} historique des exécutions de la chaîne de livraison applicative, filtré sur
  le flux qui porte la porte d'analyse statique, cadré sur deux lignes voisines.
  \textbf{Dates portées par la capture :} 16/08/2026 et 19/08/2026.\par\smallskip
  \textbf{Ce que le cadre prouvera :} la seule chose que ce chapitre ne peut pas écrire ---
  qu'une porte inerte \emph{a l'air} de fonctionner. Ligne du 16/08 : toutes les tâches en
  succès, alors qu'aucune règle n'a été évaluée. Ligne du 19/08 : la même chaîne en échec
  après remise en service, exécution 32264602112.\par\smallskip
  \textbf{Masquage :} nom du dépôt et de l'organisation, courriels des auteurs de
  \emph{commit}.
  \end{extraitconf}
  \end{minipage}%
}
\caption[Porte d'analyse statique : le faux vert du 16/08 et l'échec du 19/08]{Historique des
exécutions de la chaîne de livraison applicative. À y lire, sur deux lignes voisines : le
16/08/2026, toutes les tâches en succès alors que la porte d'analyse statique n'évaluait
aucune règle ; le 19/08/2026, la même chaîne en échec après remise en service. Le vert de la
première ligne est l'objet de la preuve : c'est lui, et non un journal, qui montre qu'un
contrôle inerte est indiscernable d'un contrôle qui passe.}
\label{fig:capture-K23}
\end{figure}
```

#### 3.5.4 Cadre K33 — à insérer après `ch6_validation.tex:437`

```latex
\begin{figure}[!htbp]
\centering
\IfFileExists{figures/K33.png}{%
  \setlength{\fboxrule}{0.4pt}\setlength{\fboxsep}{0pt}%
  \fcolorbox{black!30}{white}{\includegraphics[width=0.78\textwidth]{figures/K33.png}}%
}{%
  \begin{minipage}{0.78\textwidth}
  \begin{extraitconf}[breakable=false, fontupper=\footnotesize,
      title={Emplacement réservé --- capture K33, à produire}]
  \textbf{Vue :} fiche d'incident du tableau de bord, une entité agrégée sélectionnée depuis
  la page \emph{Incidents}. \textbf{Date de prise :} à relever au rejeu, la date effective
  remplaçant celle de la légende.\par\smallskip
  \textbf{Ce que le cadre prouvera :} ce que l'enrichissement rend réellement à l'analyste ---
  la technique candidate et son score de similarité affichés à côté de l'alerte, la jauge de
  score d'incident et la chronologie. Il montrera aussi, sans le dire, la borne rapportée au
  même endroit : le score de la jauge ne dépend pas du candidat sémantique affiché.
  \par\smallskip
  \textbf{Masquage :} identifiant de projet, adresses réelles.
  \end{extraitconf}
  \end{minipage}%
}
\caption[Fiche d'incident : le candidat sémantique rendu à l'analyste]{Fiche d'incident du
tableau de bord. À y lire : la technique candidate et sa similarité affichées à côté de
l'alerte --- c'est la seule forme sous laquelle l'enrichissement atteint l'analyste --- et
la jauge de score, calculée sans ce candidat, qui rend visible l'écart d'architecture
énoncé au même endroit.}
\label{fig:capture-K33}
\end{figure}
```

#### 3.5.5 Cadre K34 — à insérer après `ch6_validation.tex:1010`

```latex
\begin{figure}[!htbp]
\centering
\IfFileExists{figures/K34.png}{%
  \setlength{\fboxrule}{0.4pt}\setlength{\fboxsep}{0pt}%
  \fcolorbox{black!30}{white}{\includegraphics[width=0.72\textwidth]{figures/K34.png}}%
}{%
  \begin{minipage}{0.72\textwidth}
  \begin{extraitconf}[breakable=false, fontupper=\footnotesize,
      title={Emplacement réservé --- capture K34, à produire}]
  \textbf{Vue :} page \emph{Vue d'ensemble} du tableau de bord, cadrée sur le bandeau
  supérieur et la bande des cinq indicateurs, un locataire sélectionné dans le sélecteur.
  \textbf{Date de prise :} à relever, sur la révision de recette en service.\par\smallskip
  \textbf{Ce que le cadre prouvera :} le premier des trois seuils qui séparent un socle d'un
  service --- la chaîne de sécurité se termine par un écran. Aucune file d'incidents à
  traiter, aucun accusé de prise en charge, aucun canal de notification : ce qui manque est
  ce que le cadre doit rendre visible, et c'est la raison pour laquelle il est ici plutôt
  qu'une phrase.\par\smallskip
  \textbf{Masquage :} identifiant de projet, courriel du compte connecté.
  \end{extraitconf}
  \end{minipage}%
}
\caption[Vue d'ensemble : la chaîne de sécurité se termine par un écran]{Vue d'ensemble du
tableau de bord. À y lire ce qui \emph{n'y est pas} : ni file d'incidents à traiter, ni
accusé de prise en charge, ni départ de notification. La chaîne de détection se termine par
cet écran, et le délai perçu par un analyste dépend donc de sa présence devant lui.}
\label{fig:capture-K34}
\end{figure}
```

### 3.6 Coût en pages, et ordre de coupe si le plafond est atteint

Mesure : `latex/test_cadres_captures.tex` compilé avec le préambule réel du mémoire produit
**2 pages** pour les quatre cadres en état d'attente plus un chapitre d'amorce, soit **≈ 1,5 page
de flottants**. La largeur de texte utile étant de 16 cm (A4, marges 2,5 cm), l'estimation avec
images réelles est du même ordre :

| Cadre | Largeur | Recadrage visé | Hauteur estimée + légende | Coût |
|---|---|---|---|---|
| K05 | 0,82 | ~16:10 | 8,2 cm + 2,2 cm | **0,47 p.** |
| K33 | 0,78 | ~4:3 | 9,4 cm + 1,8 cm | **0,51 p.** |
| K23 | 0,86 | ~4:1 | 3,5 cm + 2,5 cm | **0,27 p.** |
| K34 | 0,72 | ~3:1 | 3,8 cm + 1,8 cm | **0,25 p.** |
| | | | **Total** | **≈ 1,50 p.** |

Le brief réserve **une page** de marge pour les cadres (§1). **Je dépasse cette réserve de
0,5 page et je le dis plutôt que de rogner les cadres jusqu'à l'illisibilité** : une capture
d'interface sous 0,70 largeur devient illisible à l'impression en niveaux de gris, et un cadre
illisible ne prouve rien tout en coûtant sa place. Deux leviers, dans cet ordre :

1. **Réduire avant de couper.** K05 à `0.78` et K33 à `0.72` ramène le total à **≈ 1,35 page**
   sans perte de lisibilité. C'est le premier geste, et il suffit probablement.
2. **Ordre de coupe, si et seulement si le plafond de 120 pages est franchi :**
   1. **K34** en premier (−0,25 p.). C'est le plus faible des quatre : la preuve d'absence est
      forte, mais la phrase du §6.7 la porte déjà honorablement, et un lecteur qui ne voit pas
      de bouton « notifier » ne sait pas toujours qu'il devrait en voir un.
   2. **K33** ensuite (−0,51 p.), le plus cher. Sa perte est réelle : l'objectif O5 redevient
      une affirmation. À couper seulement si K34 n'a pas suffi.
   3. **K05 et K23 ne se coupent pas.** K05 est la seule preuve que l'interface décrite sur
      douze vues et 3 408 lignes existe et sert un analyste. K23 est la seule preuve visuelle
      de l'incident qui **fonde la convention de notation de tout le chapitre 6** ; le couper
      laisse l'`alertbox` de `ch6:65–72` sans son artefact.

---

## 4. Ce qui est écarté, et pourquoi

Cette liste vaut la précédente. Elle montre que la sélection est raisonnée et non subie.

### 4.1 Les identifiants de `PLAN_CAPTURES.md` §1 et §2 qui avaient un cadre posé

| ID | Objet | Décision | Motif |
|---|---|---|---|
| **K22** | Planification d'infrastructure sans différence, 19/08 | **Écarté → extrait de journal** | La preuve tient en une ligne : `No changes. Your infrastructure matches the configuration.` Photographier une phrase que l'on peut citer est le cas le plus net de la règle. Une capture coûterait 0,3 page pour trois mots, et un extrait `verbatim` est en outre **rejouable** — un tiers relance la planification et compare la chaîne. |
| **K02** | Exécution du 19/08 : 612 règles, 439 fichiers, 74 constats, code 1 | **Écarté → absorbé par K23** | Quatre nombres et un code de sortie, déjà écrits `ch5:1588–1590`. La figure double prévue coûtait le double pour une moitié faite de chiffres. |
| **K07** | Contrôle d'isolation : six vérifications sur six, 19/08 | **Écarté → extrait de journal** | Sortie de job : six lignes, chacune nommant la vérification et son résultat. L'extrait est **supérieur** ici, parce que le lecteur doit pouvoir lire *quelles* six vérifications ; une capture réduit six assertions à six coches. |
| **K14** | T1 : trois charges refusées en 403, contrôle légitime en 200 | **Écarté → tableau** | Quatre codes HTTP. `tab:synthese-campagne` les porte déjà. Pire : T1 est **non conforme** — une capture montrant trois 403 réussis mettrait visuellement en avant la partie qui marche d'un test qui échoue, ce qui est un défaut de probité, pas une économie. |
| **K15** | T2 : dix 422 puis un 429 | **Écarté → tableau** | Onze codes de retour. Trois lignes suffisent. |
| **K16** | Deux rôles exactement, usurpation refusée, 23/08 | **Écarté → extrait de journal** | Le contenu de la preuve est le **nom des deux rôles** et le message de refus. Ces chaînes doivent être citables et comparables à la matrice d'identités du chapitre 4 ; une image les rend inutilisables pour cette comparaison. |
| **K21** | Alerte R2 du 19/08 à 16:56:08, treize requêtes comptées | **Écarté → redondant** | Deux raisons cumulées. **(1)** `fig:scenario-19-08` (TikZ) porte déjà cette chaîne, et **mieux** : elle affiche l'échelle non linéaire et la réserve de qualification (« une qualification par T1190 serait plus plausible »), qu'aucune capture ne peut porter. **(2)** Ce qu'une capture ajouterait — voir l'alerte à l'écran — est déjà l'objet de **K05**, sur une donnée dont la disponibilité est meilleure. |
| **K06** | Indicateurs d'enrichissement : 12:16:15, T1556.003, 0,698 | **Écarté → déjà en toutes lettres** | Trois valeurs, écrites `annexe_e:312–315`. C'est précisément le mouvement déjà fait le 29/08 en démontant l'annexe H, et il était bon. |
| **K20** | Retour arrière : 11,6 s puis 16,5 s, 07/08 | **Écarté → déjà en toutes lettres** | Deux durées, `annexe_e:315–318`. Idem. |

### 4.2 Deux écarts qui méritent leur justification développée

**K22 (planification sans différence) est le meilleur contre-exemple du mémoire.** Il est
tentant parce qu'il est spectaculaire — une console verte qui dit « aucun changement ». Mais le
chapitre 6 vient d'expliquer, à propos de la porte SAST, qu'un affichage vert peut être
mensonger. Poser une capture de console verte comme preuve, dans un mémoire qui consacre un
encadré entier à démontrer qu'un vert ne prouve rien, serait une contradiction que le jury
verrait immédiatement. **La bonne restitution de K22 est l'extrait de trois lignes, accompagné
de la commande qui le produit.**

**T8 (`node-tar` 6.2.1) n'a pas de cadre, alors que c'est « la meilleure preuve de la
campagne ».** C'est délibéré et c'est le mémoire qui le dicte : `ch6:1152` écrit que les deux
preuves les plus fortes « ne sont pas des captures d'écran ». Un refus non provoqué se prouve
par la ligne de journal portant le CVE et le code de sortie, conservée à côté. Lui poser une
capture affaiblirait la thèse méthodologique du chapitre au moment exact où elle culmine.

### 4.3 Les identifiants sans cadre posé — inchangés

`PLAN_CAPTURES.md` §3 et §3 bis (K01, K03, K04, K10, K11, K12, K13, K17, K18, K19, K24–K32)
correspondent à des protocoles que le mémoire déclare non exécutés ou à des chiffres qu'il
refuse de publier. **Aucun ne reçoit de cadre, et la raison n'a pas changé** : poser un cadre
sur un test non rejoué crée une contradiction interne. Deux méritent un mot :

- **K17 (couverture ATT&CK par tactique)** : le mémoire refuse explicitement de publier un taux
  faute de dénominateur versionné (`ch6:355–357`). La vue « Couverture ATT&CK » **existe**
  pourtant dans le tableau de bord (`tab:vues-dashboard`) — c'est un piège : la capturer
  publierait visuellement le taux que le texte refuse de publier. **Interdit.**
- **K13 (dérive détectée)** : protocole T16 corrigé non rejoué ; rien à capturer.

**Note de nomenclature :** la spécification de K24–K32 vivait dans l'annexe H §H.2, supprimée.
Ces identifiants n'ont donc **plus de définition écrite nulle part dans le mémoire**, ce qui est
cohérent (rien ne les appelle) mais laisse `PLAN_CAPTURES.md` §3 bis pointer vers une section
disparue. À corriger dans `PLAN_CAPTURES.md`, pas dans le LaTeX. Détail au §7.

---

## 5. Le sort de l'annexe H — elle reste dehors

**Décision : ne pas la remettre dans `main.tex`. Définitivement.**

`latex/appendices/annexe_h_captures.tex` est aujourd'hui **un fichier de 36 lignes entièrement
commentées** : pas une seule ligne de LaTeX actif. C'est un procès-verbal de démontage, daté du
29/08/2026. Il n'est plus appelé par `main.tex` (vérifié : `main.tex:75–80` n'inclut que les
annexes A à F).

**Pourquoi le démontage était justifié — j'ai vérifié la raison avant de me prononcer, comme
demandé.** Le fichier l'écrit lui-même et les sources le confirment :

1. **H.1 contenait des cadres vides.** Elle appelait `\capture{K06}` et `\capture{K20}` alors
   qu'aucune image n'existe dans `latex/figures/` — vérifié : le répertoire ne contient que des
   `.mmd`, le logo, les fonds de page de garde et de formulaire, **aucun `Kxx.png`**. En version
   de remise, ces deux appels imprimaient deux rectangles gris portant « Capture K06 » et
   « Capture K20 ». **C'est le défaut bloquant du brief, et il était présent.**
2. **H.2 était pire encore** : un tableau de **dix-sept captures annoncées et inexistantes**,
   sur trois pages. Un registre de ce qui n'a pas été fait, présenté comme un plan de preuves.
   Devant un jury, ce tableau ne se lit pas comme de la rigueur, il se lit comme un aveu
   d'inachèvement étalé sur trois pages.
3. **Le contenu réellement porteur a été conservé, pas perdu** : les deux mesures datées de H.1
   sont en toutes lettres en annexe E (`annexe_e:311–318`), et les règles de production de H.3
   y sont resserrées de dix à trois (`annexe_e:320–330`). **Rien de vérifiable n'a disparu.**

**Pourquoi ne pas la remettre, même corrigée :**

- **Budget.** Les annexes A–F occupent 30 pages et visent 19, soit **−11 pages**. Réintroduire
  une annexe, fût-elle d'une page, aggrave un déficit qui est déjà le deuxième plus lourd du
  document après le chapitre 4. Il n'existe aucune version de cette annexe dont le rapport
  bénéfice/pages soit positif.
- **Règle de sélection.** Une annexe de captures est, par construction, l'album que le brief
  interdit. Le plafond est de six cadres, **tous dans les chapitres 5 et 6** : une annexe H
  conforme au brief serait donc une annexe vide de cadres — c'est-à-dire du texte, qui a déjà
  trouvé sa place en annexe E.
- **Cohérence.** Les quatre cadres retenus sont chacun collés au paragraphe qu'ils restituent.
  Une preuve visuelle reléguée en annexe perd son lien de démonstration et devient décorative.

**Deux points de suite, à traiter par les propriétaires des fichiers concernés — je ne les
applique pas, étant en lecture seule :**

1. `annexe_h_captures.tex:33–35` signale que `\label{ann:captures}` a disparu et demande de
   retirer les `\ref{ann:captures}` subsistants. **Vérifié : il n'en reste aucun** dans les
   `.tex`. Le point est clos, la note peut rester telle quelle.
2. **Ne pas supprimer le fichier.** Il ne coûte rien (il n'est pas inclus) et son en-tête est la
   seule trace écrite de *pourquoi* l'annexe a été démontée. Cette trace a une valeur : si un
   relecteur demande « où sont les captures annoncées ? », la réponse est dans ce fichier.

---

## 6. Contrôle de sortie — le code proposé a été compilé

Conformément à la règle du brief (« un extrait non compilé n'a aucune valeur »), les quatre
cadres ont été écrits dans un fichier de test isolé, avec le **préambule réel du mémoire**
(`config/packages`, `formatting`, `commands`, `metadata`), puis compilés en deux passes.

Fichier : `latex/test_cadres_captures.tex` — **créé par moi, hors `main.tex`, à ne rien inclure
dans le document.** Il peut être supprimé par le propriétaire du répertoire une fois les cadres
insérés ; je ne le supprime pas moi-même, conformément à la règle 4 du brief.

```
xelatex -interaction=nonstopmode -jobname=testcadres test_cadres_captures.tex   (×2)
```

| Contrôle | Attendu | Obtenu |
|---|---|---|
| `grep -c '^!' testcadres.log` | 0 | **0** |
| `grep -c undefined testcadres.log` | 0 | **0** |
| `grep -c 'Overfull\|Underfull' testcadres.log` | 0 | **0** |
| Sortie | — | `Output written on testcadres.pdf (2 pages)` |

Points vérifiés par cette compilation, et non seulement supposés :

- `extraitconf` accepte bien la surcharge `breakable=false` et `fontupper` à l'appel ;
- un `tcolorbox` dans une `minipage` dans un `figure` ne casse pas le placement du flottant ;
- `\IfFileExists` bascule correctement (branche « absente » exercée, les `Kxx.png` n'existant
  pas) ;
- les `\caption[court]{long}` passent en liste des figures sans débordement ;
- les quatre `\label{fig:capture-Kxx}` se résolvent par `\cref` — testé dans le fichier.

---

## 7. Ce que j'ai trouvé de faux dans le mémoire

C'est, d'après le brief §6, le livrable le plus utile. Cinq constats, par ordre de gravité.
**Aucun n'est corrigé par moi** (lecture seule) ; chacun nomme son propriétaire probable.

### 7.1 Cinq renvois de section numérotés en dur, dont quatre sont faux — chapitre 6

Le chapitre 6 renvoie au chapitre 5 par des numéros écrits à la main plutôt que par `\cref`.
Le chapitre 5 compte aujourd'hui **huit sections** (5.1 Environnement, 5.2 Chaîne de livraison
applicative, 5.3 Chaîne de provisionnement, 5.4 Chaîne de détection, 5.5 Couche
d'enrichissement, 5.6 Tableau de bord, 5.7 Accueil d'un locataire, 5.8 Conduite du projet).
Les renvois n'ont pas suivi les refontes :

| Fichier:ligne | Renvoi écrit | Cible visée | Section réelle | Verdict |
|---|---|---|---|---|
| `ch6_validation.tex:69` | `§5.10.2` | Incident de la porte SAST inerte | **§5.8.1** | **Faux** — §5.10 n'existe pas |
| `ch6_validation.tex:707` | `§5.9, test T11` | Six vérifications d'isolation | **§5.7.1** (`ch5:1387`) | **Faux** — §5.9 n'existe pas |
| `ch6_validation.tex:708` | `§5.5` | Supervision / tableau de bord | **§5.6** | **Faux** — §5.5 est la couche d'enrichissement |
| `ch6_validation.tex:710` | `§5.3, incident de la porte inerte` | Incident SAST | **§5.8.1** | **Faux** — §5.3 est la chaîne de provisionnement |
| `ch5_realisation.tex:440` | `§6.4.2` | Priorisation F6 non validée | **§6.3.3** | **Faux** — §6.4 est « Performance, résilience et coût » |

**Gravité : élevée.** Ces cinq renvois sont concentrés dans la sous-section « Correspondance
avec les preuves de soutenance » (`ch6:701–714`), c'est-à-dire **exactement le passage qu'un
jury suit pendant la démonstration**. Quatre renvois sur cinq y envoient le lecteur dans la
mauvaise section. `ch6:705` (`§4.4`) et `ch6:706` (`§4.6`) sont en revanche **corrects** au
regard du découpage actuel du chapitre 4.

**Correctif recommandé :** remplacer par des `\cref{...}` vers les labels existants —
`subsec:incidents`, `sec:locataire`, `sec:supervision`, `sec:eval-enrichissement` — pour que le
problème ne se reproduise pas à la prochaine refonte. Propriétaires : équipes ch5 et ch6.

### 7.2 `PLAN_CAPTURES.md` est périmé sur trois points, et l'un d'eux est trompeur

1. **Tous ses emplacements pointent vers une structure disparue** : §5.2.2, §5.7, §5.9.1,
   §5.10.2, §6.2, §6.7. Aucun ne correspond au découpage actuel. Le document se présente comme
   « vérifié dans les sources LaTeX » au 27/08 ; il ne l'est plus au 29/08.
2. **Il annonce « neuf cadres effectivement posés » (§3 ter).** C'est faux depuis le 29/08 :
   **il n'y a plus aucun appel `\capture` dans tout le mémoire** — vérifié par recherche sur
   l'ensemble des `.tex`. Zéro cadre posé, pas neuf.
3. **Point trompeur, et le plus important : K05 est marqué « Preuve disponible : Oui,
   23/08/2026 ».** Or la table des détections **a été vidée par une suppression administrateur
   les 24 et 25/08/2026** — fait publié par le mémoire lui-même (`ch6:1018–1021`). La donnée du
   23/08 n'est plus dans la table vive. Quiconque planifie la production des captures sur la foi
   de cette ligne découvrira le problème le jour de la prise. **C'est le seul constat de ce
   rapport qui bloque une action concrète**, d'où l'avertissement au §3.1.

`PLAN_CAPTURES.md` §3 bis renvoie en outre à « l'annexe H, section H.2 » pour la spécification
de K24–K32 : cette section a été supprimée le 29/08. Le renvoi est mort.

### 7.3 La macro `\capture` est un piège dormant dans `commands.tex`

`commands.tex:119–143` est toujours définie et toujours dangereuse en version de remise :
tout appel produit un rectangle gris « Capture Kxx ». Aucun appel ne subsiste aujourd'hui, donc
aucun dégât actuel — mais la macro invite à en poser un. **Recommandation, à l'attention du
propriétaire de `config/` :** ne pas la supprimer (elle reste juste en mode brouillon), mais
ajouter en commentaire au-dessus l'avertissement qui figure déjà dans
`annexe_h_captures.tex:14–16`, pour que personne ne la réemploie en croyant bien faire.
Variante plus sûre si l'équipe préfère : faire échouer la compilation en mode final quand
l'image manque, plutôt que d'imprimer un cadre gris — un `\PackageError` vaut mieux qu'un
rectangle silencieux dans un document remis à un jury.

### 7.4 `annexe_e:26` renvoie au « chapitre 5, §5.1.1 » pour la topologie de la recette

§5.1.1 est « Frontière entre le code et l'exploitation » ; la description de l'environnement de
recette relève de l'introduction de §5.1. Renvoi **imprécis** plutôt que faux. Gravité faible.

### 7.5 Écart de vocabulaire, sans conséquence de fond

`ch5_realisation.tex:1584` emploie « **Porte SAST en faux vert** » comme titre de paragraphe.
C'est la **seule occurrence du sigle dans les chapitres 4 à 6** : partout ailleurs le mémoire
écrit « porte d'analyse statique » (`ch6_validation.tex:67`) ou « l'analyse statique »
(`ch6_validation.tex:709`). Le sigle est certes déclaré dans la liste des acronymes
(`frontmatter/acronyms.tex:45`) et introduit au chapitre 2 (`ch2_etat_art.tex:119`), donc ce
n'est pas une erreur — c'est une **rupture de registre** dans le titre d'un paragraphe qui est
par ailleurs cité trois fois depuis le chapitre 6 sous son nom français. Un mot à changer dans
`subsec:incidents`. Gravité faible. Propriétaire : équipe ch5.

*Effet de bord à noter :* le cadre **K23** que je propose est ancré sur ce paragraphe. Sa
légende emploie déjà « porte d'analyse statique » ; si l'équipe ch5 renomme le paragraphe, les
deux seront alignés sans retouche du cadre.

---

## 8. Synthèse pour l'équipe qui appliquera

1. Insérer les quatre blocs du §3.5 aux quatre lignes indiquées — **par script Python écrit
   avec Write**, jamais par `sed` ni heredoc. Les blocs sont donnés dans leur forme compilée.
2. Ne rien changer d'autre dans le LaTeX au titre des captures : aucun appel `\capture` à
   rétablir, aucune annexe à réintégrer.
3. Traiter en priorité l'avertissement du §7.2.3 (données du 23/08 supprimées) **avant** de
   planifier la production de K05, puis produire les quatre images selon les protocoles du §3.
4. Faire corriger les cinq renvois du §7.1 par les équipes ch5 et ch6 — c'est le constat le plus
   visible pour un jury, et il est indépendant des captures.
5. Mettre `PLAN_CAPTURES.md` en cohérence (§7.2) ou le marquer comme archive du 27/08.

**Bilan de mon périmètre :** 0 page consommée aujourd'hui (aucun cadre inséré), **≈ 1,5 page**
à prévoir quand les quatre cadres seront posés, réductible à ≈ 1,35 sans perte, et à 1,25 ou
0,74 si le plafond de 120 pages l'exige (ordre de coupe au §3.6).
