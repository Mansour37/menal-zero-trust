# BRIEF COMMUN — Équipes de refonte du mémoire PFE MENAL

**À lire intégralement avant toute écriture.** Ce brief s'applique à toutes les équipes.
Il complète `PLAN_REFONTE_PFE.md`, qui reste la spécification de référence.

---

## 0. LIGNE ROUGE ABSOLUE

**Ne jamais inventer une valeur mesurée, une date d'exécution, un horodatage, un résultat de
test, un pourcentage ou une capture.** Un mémoire d'ingénieur qui fabrique un résultat
expérimental est disqualifié. Le risque n'est jamais proportionné au gain.

Corollaire : si vous avez besoin d'un chiffre que vous ne trouvez ni dans le mémoire actuel,
ni dans `DOSSIER_TECHNIQUE_MENAL.md`, **n'écrivez pas la phrase**. Écrivez plutôt la propriété
qualitative, ou signalez le manque dans votre rapport de fin de tâche.

**État de la vague 1 (exécution des tests réels et session de captures) : NON RÉALISÉE.**
Elle exige un accès à l'infrastructure vivante et relève de l'auteur, pas des équipes de
rédaction. Conséquence directe et impérative :

- Les protocoles **T12, T15, T17, T19, T20** n'ont pas de résultat. Ils ne peuvent **pas**
  être requalifiés en « conforme ». Ils sont traités par la **question Q3** de la doctrine
  ci-dessous : rattachés à un plan de validation continue daté, jamais écrits comme un aveu.
- La **reconstruction chronométrée** n'a pas eu lieu. L'objectif O2 reste « capacité établie,
  mesure planifiée » — formulé comme un plan, pas comme un manque.
- **Aucune capture d'écran nouvelle n'existe.** N'appelez aucune image qui n'est pas dans
  `latex/figures/`.

---

## 1. DOCTRINE DE REGISTRE (le cœur du travail)

Un **audit** exhibe des manques ; sa valeur croît avec le nombre d'écarts trouvés.
Un **mémoire d'ingénieur** expose des décisions ; sa valeur croît avec la qualité des
justifications. **Le même fait technique s'écrit différemment dans les deux registres, sans
que la vérité change d'un mot.**

Avant d'écrire toute phrase négative, poser **trois questions dans cet ordre** :

### Q1 — Le fait est-il une DÉCISION ?
→ Écrire : la décision + sa justification + sa condition de réévaluation.

> ❌ « Aucune signature d'artefact n'est mise en œuvre. »
> ✅ « La signature d'artefact et la nomenclature logicielle ont été évaluées puis écartées
> (décision D07). Le socle atteint la traçabilité recherchée par un chemin moins coûteux —
> étiquette liée à l'empreinte du commit et registre unique — et le mémoire énonce ce que ce
> chemin ne couvre pas : il ne prouve pas que l'artefact déployé provient de la chaîne
> attendue. La condition de réévaluation est l'ouverture du socle à un éditeur tiers. »

### Q2 — Le fait est-il une CONTRAINTE DU PÉRIMÈTRE ?
→ Écrire : la contrainte + le contrôle compensatoire + le seuil de bascule.

> ❌ « Les politiques d'organisation sont inapplicables. »
> ✅ « L'interdiction structurelle de créer une clé d'identité relève d'une politique
> d'organisation, dont la pose exige un périmètre administratif dont le projet ne dispose pas.
> Le contrôle est donc porté par la fédération d'identité, qui rend la clé inutile, et vérifié
> par inventaire. La distinction entre garantie préventive et garantie vérifiée est explicite :
> c'est une propriété du périmètre, non un oubli de conception. »

### Q3 — Le fait est-il un TRAVAIL NON FAIT ?
→ Le porter dans un **plan daté**, jamais dans un aveu.

> ❌ « T15 non exécuté, faute de temps de campagne. »
> ✅ « Le protocole T15 relève du plan de validation continue, dont la fréquence est
> trimestrielle et dont le premier passage est planifié au T4 2026. »

**Si aucune des trois ne s'applique, la phrase n'a rien à faire dans le mémoire.**

### Termes interdits — zéro occurrence tolérée
```
« non exécuté »        « reste à produire »     « faute de temps »
« à rejouer »          « il faudrait »          « on pourrait »
« reste à »            « ce qui manque »        « NON TROUVÉ »
« emplacement réservé » « capture attendue »    « à confirmer »
« prévu mais non réalisé »   « aucun jeu de résultats »
```
`« n'a pas été »` est toléré uniquement dans une phrase de méthode assumée
(ex. « la quantification n'a pas été retenue, sur la base de la mesure suivante… »).

### Exception unique et volontaire
La section « limites » du chapitre 6 **conserve ses limites**, reformulées en **conditions de
validité du résultat**. Un chapitre de validation sans section « menaces à la validité » est
méthodologiquement faux.

> ❌ « Auto-évaluation : auteur du système et des tests confondus, aucun regard extérieur —
> limite la plus structurelle, non levable. »
> ✅ « Le dispositif de mesure est mono-opérateur. La reproductibilité est donc assurée par
> publication : chaque protocole est écrit avec son critère d'acceptation et sa commande, de
> sorte qu'un tiers puisse le rejouer et contredire le résultat. C'est la garantie de méthode
> retenue à la place d'une revue croisée indisponible dans une structure de cette taille. »

### Ne pas basculer dans l'excès inverse
Le mémoire ne doit pas devenir promotionnel. Registre visé : **neutre, factuel, assuré**.
La précision technique reste le premier critère de qualité — ne jamais devenir vague pour
éviter un aveu.

---

## 2. NOMENCLATURE — DÉJÀ APPLIQUÉE, À RESPECTER

Le patch de nomenclature (P14) est **déjà passé sur les sources**. Ne le défaites pas.

| Famille | Notation imposée | Interdit |
|---|---|---|
| Phases du projet | `PH0` à `PH7` (huit phases, découpage du planning §5.10) | `P0`–`P4`, tout autre découpage |
| Principes d'architecture | « le principe de justification (PR1) », « le principe d'identité (PR2) », « le principe d'intégrité de la preuve (PR3) », « le principe de description en code (PR4) » ; code seul en renvoi | `P1`–`P4` |
| Logiciel web, 12 vues, 7 routes serveur | **le tableau de bord** | « interface de supervision », « interface de l'analyste » |
| Logiciel exposant les points d'entrée | **l'API de supervision** (abrégé « l'API ») | « interface de programmation » répétée |
| Les deux ensemble | **les deux logiciels écrits** | — |
| Objet du mémoire | **le socle** | « le système » (trop vague) |
| Unité d'hébergement | **le locataire** ; **l'application hébergée** pour le logiciel concret | « tenant », « client » |
| Environnement | **la recette** | « staging » en prose française |
| Détection | **règle de détection**, `R1` à `R7` | « règle Sigma » (sauf au ch. 2 où le format est discuté et explicitement non implémenté) |
| Chaînes — exactement quatre | **chaîne de livraison applicative** (F3) · **chaîne de provisionnement de l'infrastructure** (F7) · **chaîne de détection** (F4+F5) · **chaîne d'approvisionnement logicielle** (concept de risque) | « pipeline », « chaîne d'intégration » comme sujet, « CI-SEC-CD » |
| Identité de la chaîne | **l'identité de déploiement** | « l'identité de la chaîne d'intégration » |
| Filtrage au bord | **le filtrage applicatif** | « WAF », « pare-feu applicatif », « moteur de filtrage » |

**Convention de désignation** (déclarée en page « Conventions de notation ») : les composants
sont désignés par leur **capacité**, le produit entre parenthèses **à la première occurrence
d'un chapitre au maximum**, puis désignation courte fixe.

Une page `frontmatter/conventions.tex` récapitule les 17 familles d'identifiants conservées
(C, O, Q, PH, V, A, BF, BNF, TB, SO, EX, PR, F, D, É, R, T). Si vous introduisez une famille,
elle doit y figurer — signalez-le dans votre rapport.

---

## 3. RÈGLE DU CHIFFRE DATÉ

**Tout chiffre décrivant un système vivant porte sa date de relevé.** Le mémoire dispose de la
macro `\dateref` (= 25/08/2026). Un chiffre daté est juste ; un chiffre non daté devient faux
dès que le code évolue. Généraliser à tous les tableaux quantifiés.

---

## 4. CORRECTIONS FACTUELLES OBLIGATOIRES (à appliquer par le propriétaire du fichier)

| # | Où | Le mémoire dit | La réalité du code | Action |
|---|---|---|---|---|
| F1 | Fig. modèle en couches (ch4) et annexe D.1 couche L1 | « Cloud DNS » en couche périmètre | aucune ressource de zone DNS déclarée ; enregistrements créés chez le bureau d'enregistrement | **Retirer** de la couche L1 ; représenter en dépendance externe dans la vue de contexte. Conserver l'écart É10, qui devient cohérent. |
| F2 | Annexe D.1 couche L2 | « six secrets » | neuf secrets, dont huit chiffrés par clé gérée | Corriger + une phrase : le neuvième est un vestige d'une interface antérieure, dont le retrait est planifié. |
| F3 | Annexe D.1 couche L3 | « quatre services » | cinq services d'exécution et trois tâches | Corriger et les nommer. |
| F4 | §6.5.1 | « dix règles d'alerte » | dix-sept politiques d'alerte, deux sondes, quatre objectifs de service | Corriger : « dix-sept politiques d'alerte réparties en onze familles, deux sondes de disponibilité et quatre objectifs de service ». |
| F5 | §6.5.1 | « deux objectifs sur trente jours » | quatre objectifs (disponibilité et latence × 2 services) | Corriger. |
| F6 | Tab. caractérisation du tableau de bord (ch5) | « 2,99 % des lignes » | 3,00 % — 11 lignes couvertes sur 367, 22 fichiers instrumentés | Corriger avec le détail : la précision renforce la crédibilité. |
| F7 | Tab. caractérisation (ch5) | « 11 pages et 7 routes serveur » | douze vues (dix rendues au serveur, deux clientes) et sept routes serveur | Corriger. |
| F8 | ch5 et partout | rôles « administrateur / analyste / service » | identifiants réels `admin` / `viewer` / `service` | **Conserver les libellés français**, ajouter une note de correspondance à la première occurrence : « les identifiants techniques correspondants sont `admin`, `viewer` et `service` ; le troisième est prévu pour l'authentification machine-à-machine et n'est référencé par aucun contrôle à ce jour ». |
| F9 | §1.2 (application pilote) | « 225 points d'entrée », « 74 fichiers SQL dont 72 migrations » | ~245 points d'entrée, 85 migrations au 28/08/2026 | **Dater plutôt que corriger** : « à la date de l'audit du 29/07/2026, environ 225 points d'entrée et 72 migrations ». |

---

## 5. RÈGLES DE PRODUCTION GRAPHIQUE

Les figures sont **en TikZ natif** dans ce mémoire (17 figures existantes, aucune image
matricielle pour les schémas). Si votre tâche demande une figure :

1. **Ne produisez pas le code TikZ** — produisez une **spécification complète** dans votre
   rapport de fin de tâche : titre, légende (qui énonce ce que la figure *démontre*, jamais ce
   qu'elle contient), notation employée, liste exhaustive des éléments et de leurs libellés,
   liste des arcs avec sens/étiquette/style, annotations obligatoires, emplacement, et ce qu'un
   lecteur doit pouvoir conclure en dix secondes. **L'équipe graphique compile.**
2. Dans le texte, laissez un appel `\cref{fig:...}` avec le label convenu, et le paragraphe
   d'appel qui dit **ce qu'il faut y regarder**. Insérez un commentaire LaTeX
   `% FIGURE-A-PRODUIRE: <label> — <une ligne>` à l'emplacement exact.
3. Contraintes : vectoriel, portrait, largeur ≤ zone de texte, corps ≥ 8 pt après mise à
   l'échelle, **cinq teintes maximum dans tout le mémoire**, lisible en niveaux de gris
   (la couleur double toujours une forme ou une étiquette).

---

## 6. CONTRAINTES D'ÉCRITURE

- **Français soutenu, phrases complètes.** Le mémoire est déjà bien écrit : maintenir le niveau.
- Chaque chapitre s'ouvre par un **chapeau de 4 à 6 lignes** annonçant le fil directeur et se
  ferme par une **conclusion de 8 à 12 lignes** qui récapitule et annonce le suivant. Ce
  standard existe déjà — le maintenir sur les sections nouvelles.
- **Profondeur maximale : `\subsection`.** Aucun `\subsubsection` (il n'y en a aucun aujourd'hui).
- **Plafond de huit `\section` par chapitre.** Les regroupements sont indiqués par tâche.
- Aucune section du corps ne dépasse 4 pages sans sous-sections.
- **Ne jamais supprimer** : la matrice de traçabilité (ch3), le registre des décisions D00–D14,
  le registre des écarts É1–É11, les quatre incidents d'ingénierie (§5.10.2), la section
  « ce que le système ne détecte pas » (§6.3).
- Toute affirmation technique nouvelle est **ancrée sur `DOSSIER_TECHNIQUE_MENAL.md`**
  (274 Ko, à la racine de `rapport PFE/`). C'est la seule source d'enrichissement autorisée.
- Les tableaux longs utilisent `longtable` avec le type de colonne `P{...}` défini dans
  `config/commands.tex` (colonne en drapeau — évite les débordements).
- Encadrés disponibles : `keybox` (principe clé), `alertbox` (point de vigilance),
  `extraitconf` (extrait de configuration).

---

## 7. LIVRABLE DE FIN DE TÂCHE (format imposé)

Votre rapport final doit tenir en une page et contenir, dans cet ordre :

1. **Tableau des conversions de registre** : localisation / texte avant (extrait) / texte après
   (extrait) / question appliquée (Q1, Q2, Q3).
2. **Liste des ajouts** : section, budget de pages consommé, ancrage dans le dossier technique.
3. **Spécifications de figures** produites (le cas échéant).
4. **Liste des chiffres corrigés** avec l'avant / après.
5. **Blocages** : ce que vous n'avez pas pu écrire faute de source, et pourquoi.
6. **Vérification** : `git status --porcelain` sur vos fichiers uniquement, pour prouver
   qu'aucun fichier hors périmètre n'a été touché.

**Vous ne modifiez QUE les fichiers de votre périmètre.** Toute modification hors périmètre
sera annulée. Vous ne compilez pas — l'équipe qualité compile et arbitre.
