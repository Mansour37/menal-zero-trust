# RAPPORT_EXEC_CH5_CH6.md — exécution de la refonte finale des chapitres 5 et 6

**Périmètre d'écriture** : `latex/chapters/final/ch5_realisation.tex` et
`latex/chapters/final/ch6_validation.tex`. **Aucun autre fichier `.tex` touché.**
**Date** : 29/08/2026. **Nom de travail de compilation** : `buildB`.

## 0. Mesure d'entrée (compilée, non estimée)

`buildB.pdf` du 29/08, 0 erreur (`grep -c '^!' buildB.log` = 0), **167 pages**.
Relevé sur `buildB.toc` :

| | Début | Fin | Pages |
|---|---:|---:|---:|
| Ch. 5 — Réalisation | 72 | 98 | **27** |
| Ch. 6 — Validation | 99 | 119 | **21** |

Cible : 18 et 15.

---

## 1. Mission 1 — l'erreur factuelle bloquante (§6.7, `tab:ztmm`, `tab:limites`)

### 1.1 Ce que j'ai vérifié avant d'écrire

Sources lues **en lecture seule** : `ch4_conception.tex` §4.2.5 (`subsec:reseau-cible`,
l. 391–780), `ch4` §4.2.6 (`subsec:isolation-donnees`), `BRIEF_REFONTE_APPLIQUEE.md` §1 et §3,
`RAPPORT_REDONDANCES.md` §C-1, et les passages du chapitre 6 lui-même qui contredisaient
`tab:ztmm`.

**Les trois faits qui justifiaient la note 1/10 sont tous faux à la date de référence
(25/08/2026), et le chapitre 4 les date un par un :**

| Affirmation de `tab:maturite-multitenant` / `tab:ztmm` | Réalité datée | Source |
|---|---|---|
| « un connecteur [partagé] » | **Supprimé le 15/08/2026**, avec sa plage `10.0.3.0/28` | `ch4` `tab:adressage-cible`, cellule « Supprimés au cours de la migration » ; `ch5:647–648` ; et `ch6:1058–1059` du **même chapitre** |
| « une règle interne autorise tout protocole entre sous-réseaux sur la seule adresse source » | **Supprimée le 24/08/2026** avec les deux sous-réseaux `10.0.1.0/24` et `10.0.2.0/24` et les trois règles d'entrée | `ch4` « les trois règles antérieures ont été supprimées le 24/08/2026 sans successeur » ; `ch5:667–668` |
| « le connecteur unique est un point de défaillance commun à sept charges de travail » | L'objet n'existe plus ; chaque instance porte sa propre interface de sortie | `ch4` « supprimé au passage le connecteur […] donc son coût plancher permanent et le point de défaillance unique » ; `ch5:1399–1401` |

**Le chapitre 4 est cohérent sur ce sujet** : je n'y ai relevé aucune contradiction interne
dans `subsec:reseau-cible` telle qu'elle est écrite au moment de ma lecture. (Le constat C-2 du
`RAPPORT_REDONDANCES` porte sur `ch4:1648–1659`, hors de ma lecture et hors de mon périmètre ;
je ne l'ai pas touché.)

**Ce qui est acquis, et daté :**
- un sous-réseau par locataire depuis le 11/08/2026 (`10.0.8.0/26`, `10.0.8.64/26`,
  `10.0.8.128/26` créé vide et réservé) ;
- sortie réseau directe : les interfaces de sortie sont *dans* le sous-réseau, donc le pare-feu
  leur est applicable (bascules du 12 au 14/08) ;
- six autorisations posées le 22/08/2026, **chacune ciblée par une identité de service et par un
  port**, aucune plage source ; refus nommés puis **refus par défaut en sortie le 23/08/2026** ;
- **refus croisé entre locataires réellement opposé et journalisé le 24/08/2026** — protocole
  **T20, conforme** ; les trois lignes de refus retrouvées dans l'entrepôt, horodatages du refus
  et de l'échec client se recoupant à 10,3 s près. Les deux horodatages (suppression de la règle
  permissive le 24/08, refus croisé opposé le 24/08) se recoupent bien.

**Ce qui ne l'est pas, et qui borne la note :**
- **deux charges de travail détachées du sous-réseau** — service d'encodage et interface web de
  l'application hébergée — dont la **sortie managée échappe au pare-feu** : non-conformité
  **T14 du 25/08/2026**, sonde atteignant une destination externe en 412 ms ;
- le sélecteur disponible est l'**étiquette réseau** et non le compte de service : frontière
  opposable à une charge compromise, **non à un opérateur capable de déployer** ;
- **l'instance de base de données reste unique** et jointe par les deux locataires (D16 conçue
  le 29/08/2026, **non appliquée**) ;
- **aucune des sept règles de détection ne lit les refus journalisés** (`tab:lacunes`) : un
  mouvement latéral refusé est *tracé*, il n'est pas *détecté*.

### 1.2 Les notes prononcées

| Objet | Avant | Après | Motif |
|---|---|---|---|
| `tab:maturite-multitenant`, axe **Ségrégation réseau** | 1/10 | **6/10** | Propriété réelle, datée et éprouvée par un refus survenu (T20) — mais **deux exceptions démontrées** (T14) plus la réserve d'opposabilité et la base commune. Une propriété qui souffre deux exceptions démontrées n'est pas une propriété générale : la réserve est écrite *dans la justification*, pas en note de bas de page. |
| `tab:ztmm`, pilier **Réseaux** | Initial | **Initial à avancé** | Même raisonnement. Le niveau « Avancé » supposerait que le pare-feu voie *tout* le trafic sortant et que les refus soient analysés ; ni l'un ni l'autre n'est vrai. Le libellé composite est déjà employé deux fois dans le même tableau (Données, Automatisation). |
| **Note d'ensemble** multi-locataire | 4/10 | **5/10** | Un seul axe a bougé. Le stockage (4/10) et le cloisonnement de la supervision (2/10) restent les axes bornants, et ils sont inchangés : la note ne monte que d'un point, et la phrase le dit explicitement. |

**Aucune note n'a été baissée.** J'ai examiné les six autres axes ; aucun ne porte de fait
nouveau défavorable depuis son écriture. Les deux axes que j'ai reconsidérés :
- *Isolation des données applicatives* (4/10) : la refonte réseau **ne l'améliore pas** — les
  deux règles qui autorisent l'accès à la base visent la même adresse. Inchangé, à raison.
- *Attribution d'un incident à un locataire* (5/10) : le dénominateur était faux (voir §1.4),
  mais la correction ne change pas le fond de la note.

### 1.3 Les cinq passages contradictoires corrigés

| # | Passage | Avant | Après |
|---|---|---|---|
| a | `tab:maturite-multitenant`, ligne réseau | « un connecteur, une instance de base partagés ; une règle interne autorise tout protocole… ; point de défaillance commun à sept charges » | Justification datée en trois temps : ce qui est acquis (dates), la preuve (T20), les trois bornes démontrées |
| b | `tab:ztmm`, pilier Réseaux | « sortie limitée aux plages privées. Est-ouest quasi inexistant » | Est-ouest refondu, dates, T20, borne T14 |
| c | §6.7.6, troisième seuil | « segmenter le réseau entre locataires […] un connecteur par locataire » | **« cloisonner la donnée entre locataires »** : clé de locataire à l'ingestion, cloisonnement au stockage, instance dédiée (D16), plus le résidu réseau du correctif T14 |
| d | §6.7.2 | « La ségrégation réseau […] appartient à l'hébergeur, et **n'est pas couverte** » | Couverte au plan réseau depuis la migration ; ce qui reste à l'hébergeur est le cloisonnement de la donnée — aligné sur `tab:frontiere-resp` du ch. 5 |
| e | `tab:limites` | « Isolation portée par l'identité, non par le réseau […] la conclusion ne s'étend pas au plan réseau » | « Isolation portée par les droits **au plan du stockage** » : la conclusion s'étend au réseau depuis T20, elle ne s'étend pas au stockage |

Deux passages dépendants ont été alignés : le chapeau de §6.7.4 (qui présentait le réseau comme
« ouvert en exploitation ») et la phrase de synthèse du profil ZTMM (« base est-ouest restée
périmétrique »).

### 1.4 Corrections factuelles connexes, dans le périmètre

- **Écart É2** — `ch6` le déclarait « décidé mais non appliqué ». Le chapitre 4
  (`tab:adressage-cible`) et le chapitre 5 (`ch5:667–668`) établissent le retrait des deux
  sous-réseaux le **24/08/2026**. Corrigé en « les trois écarts sont clos ». *Réserve de
  coordination : `ch4` `tab:ecarts-implementation` porte encore « non appliqué » pour É2 — c'est
  au propriétaire de ce fichier de trancher (constat C-3).*
- **Dénominateur des tables** — « une table sur huit » / « sept tables sur huit » n'existe nulle
  part ailleurs : `tab:modele-donnees` (ch. 5) montre **dix tables**, dont trois portent une clé
  d'application et trois sont « sans objet ». Réécrit en « sur les dix tables de l'entrepôt,
  trois portent une clé d'application et une seule la porte renseignée sur la totalité de ses
  lignes », avec renvoi `\cref{tab:modele-donnees}`.
- **Résumé de T20 non sélectif** — le tableau de synthèse ne retenait que « 10,3 s », qui est
  l'écart refus/échec client, alors que l'annexe E donne 2 min 55 s à 4 min 12 s pour la
  disponibilité de la preuve. Les deux figurent désormais.
- **Ordres SQL** — « Sept ordres de base de données » sans périmètre, contre « dix ordres dont
  six révocations » ailleurs. Le périmètre est explicité (sept pour un locataire supplémentaire,
  dix pour l'accueil du second).
- **Renvoi faux** — `ch6` « (§5.5) » désignait l'enrichissement au lieu de la chaîne de
  détection ; converti en `\cref{sec:chaine-detection}`.

---

## 2. Mission 2 — statuts de tests contredits (ch. 5 aligné sur ch. 6)

Le tableau de synthèse du chapitre 6 fait foi ; les passages du chapitre 5 qui le contredisaient
sont corrigés. **Aucune modification n'a été faite au chapitre 6 sur ces verdicts** : le bilan
reste **7 conformes, 11 partiellement conformes, 2 non conformes, 0 planifié = 20**, et les deux
non-conformités restent **T1** et **T14**.

| Où (ch. 5) | Avant | Après |
|---|---|---|
| `subsec:refus` | T8 et T10 « ne seront comptabilisés comme conformes qu'à l'archivage de leur trace […] au titre du plan de validation continue » | **T8 conforme**, sur un refus qui n'a pas été provoqué ; **T10 partiellement conforme**, porte bloquante à chaque livraison, aucun refus opposé |
| Note de `fig:sequence-livraison` | « deux d'entre eux disposent d'un protocole numéroté, rattaché au plan de validation continue » | « T8 et T10, dont le chapitre 6 donne le verdict daté ». Le `\ref` fautif (« décrits **au** section ») est passé en `\cref` — constat C-22 |
| §5.3.2, quatrième scénario de refus | « son exécution relève du plan de validation continue […] au même titre que T8 et T10 » | Ce cas ne porte pas de protocole numéroté ; T8 et T10, eux, ont leur verdict. Son premier passage est porté par le plan de correction |
| Alertbox §5.4 | « le protocole T20 relève du plan de validation continue » | **T20 conforme** : trois sorties refusées le 24/08/2026, lignes retrouvées dans l'entrepôt en 2 min 55 s à 4 min 12 s ; cadence de rejeu trimestrielle |
| §5.5, clôture de la posture réseau | « l'absence de chemin public direct […] est [mesurée] par le protocole T14 » | **T14 non conforme** : sonde à 412 ms le 25/08/2026 ; correctif identifié et chiffré |
| **`tab:avancement-enrichissement`** — le plus grave | « Chemin public direct absent dans la configuration — Oui — Réalisé ; **T14 planifié** » | « Oui --- **mais la sortie *managée* de la révision déployée reste hors du pare-feu** » ; statut : **T14 non conforme (25/08/2026)** |
| §5.1.2, protocole T17 | « rattaché au plan de validation continue » (donc présenté comme non mesuré) | **T17 conforme** le 20/08/2026, quatre refus opposés à trois identités de service |

**Le point décisif est la ligne du tableau.** Elle publiait comme « réalisé » une propriété que la
campagne a réfutée. La correction ne se contente pas de changer le statut : elle réécrit la cellule
pour dire *ce que la sonde a effectivement montré* — la propriété est vraie de la configuration
déclarée et fausse du chemin réellement emprunté. Conserver un résultat favorable démenti est
exactement ce que le brief interdit.

---

## 3. Mission 3 — la valeur fausse dans `fig:composants-logiciel`

**C'est la figure qui avait tort**, et c'est vérifié sur trois sources indépendantes.

| Source | Valeur |
|---|---|
| `tab:vues-dashboard`, comptage des lignes du `longtable` | **12 lignes**, dont deux marquées *(cliente)* → **10 rendues au serveur** |
| `tab:logiciel-ecrit` (ch. 5) | « douze vues, dont dix rendues au serveur et deux clientes, et sept routes serveur » |
| `BRIEF_EQUIPES_REFONTE.md`, correction **F7** | « douze vues (dix rendues au serveur, deux clientes) et sept routes serveur » |

Le nœud portait « 11 pages rendues au serveur » : la correction F7 avait atteint les deux tableaux
et pas la figure. **Corrigé en « 12 vues, dont 10 rendues au serveur ».** C'est la seule
modification de code TikZ que j'ai faite ; les 30 figures restent intactes pour l'équipe design.

---

## 4. Mission 5 — corrections ponctuelles

| Item | État |
|---|---|
| Paragraphes ≥ 16 lignes (`ch5:815`, `1226`, `1382` ; `ch6:236`, `419`, `468`, `981`) | **Les sept traités.** Contrôle automatique final : **plus aucun paragraphe de 15 lignes ou plus** dans les deux chapitres |
| Titres à verbe conjugué (`ch6:796`, `ch6:851`) | « Une faille de logique métier est invisible au socle » → **« Invisibilité d'une faille de logique métier »** ; « Ce qui est apporté sans modifier l'application hébergée » → **« Apport du socle et charge de l'éditeur »** (fusionné avec §6.7.2, cf. §5.2). J'ai aussi corrigé « La limitation de débit au bord voit une adresse, pas un compte » → **« Portée de la limitation de débit au bord »**, même défaut |
| Titres **protégés**, non retitrés | §6.3.2 « Ce que le système ne détecte pas » et §6.6 « Ce que le filtrage applicatif ne protège pas » : ce sont des clauses, mais le brief les protège nommément et leur formulation *est* l'argument |
| Mot répété `ch5:1032` « en en » | « le transforment **en en**-tête d'autorisation » → « **en font un** en-tête d'autorisation ». Contrôle : zéro occurrence restante |
| Légendes longues sans forme courte (`ch5:288`, `1049`, `1460`) | Les trois passées en `\caption[court]{long}`. J'ai en outre ramené au texte court **cinq légendes de figures qui redisaient mot pour mot leur cartouche interne** (recommandation A-7 : `fig:graphe-taches-livraison`, `fig:chaine-infrastructure`, `fig:chaine-donnees-vue`, `fig:accueil-locataire`, `fig:composants-logiciel`). **La liste des figures et la liste des tableaux ont perdu une page à elles deux.** |
| Espaces insécables | **18 posées** : `5~min`, `15~min`, `90~jours`, `7~jours`, `en~403`, `en~302`, `réponses~422`, `une~429`, `code~204`, `314~lignes`, `120~lignes`, `296~lignes`, `375~lignes`, `11~lignes`, volumes de code |
| Terme du registre d'audit | Une occurrence de « reste à » introduite par ma propre réécriture a été reformulée en « incombe encore à ». Contrôle final : **zéro occurrence des quatorze termes interdits** dans les deux chapitres |

---

## 5. Mission 4 — budget de pages : mesure, et plancher atteint

### 5.1 Mesure compilée (lue sur `buildB.toc`, pas estimée)

| | Avant | Après | Delta | **Cible** | Écart |
|---|---:|---:|---:|---:|---:|
| Ch. 5 | 27 (p. 72–98) | **25** (p. 68–92) | **−2** | 18 | +7 |
| Ch. 6 | 21 (p. 99–119) | **20** (p. 93–112) | **−1** | 15 | +5 |
| Listes des figures et des tableaux | 3 | **2** | **−1** | — | — |
| Document entier | 167 | 157 | −10 | ≤ 120 | — |

*(Le total de 157 inclut le travail concurrent des trois autres équipes, qui ont écrit dans
`ch1`–`ch4`, l'introduction, la conclusion et les annexes entre 18 h 58 et 19 h 09. Les lignes
« ch. 5 » et « ch. 6 » ne dépendent que de mes deux fichiers.)*

Mesure de source, à l'entrée et à la sortie :

| | Lignes totales | dont flottant | prose |
|---|---:|---:|---:|
| ch5, avant → après | 1 724 → **1 656** | 742 → 734 | 835 → **773** |
| ch6, avant → après | 1 170 → **1 141** | 434 → **453** | 610 → **562** |

**110 lignes de prose supprimées sans qu'un seul fait, une seule date, un seul critère
d'acceptation, une seule réserve ni une seule commande de reproduction disparaisse.** Le chapitre 6
*gagne* 19 lignes de flottant : ce sont les justifications datées que la mission 1 exige dans
`tab:ztmm` et `tab:maturite-multitenant` — une note refaite doit porter sa preuve. C'est un coût
assumé, et il explique qu'un chapitre dont j'ai retiré 48 lignes de prose ne perde qu'une page.

### 5.2 Liste des coupes, par nature

**Redondance inter-chapitres** — le mécanisme est établi une fois, ailleurs on le nomme et on
renvoie. Application de `RAPPORT_REDONDANCES` :

| Réf. | Objet | Avant → après |
|---|---|---|
| G1(g) | Posture de sortie réseau, `ch5` §5.5 | 32 → 16 l. Le seul fait propre au ch. 5 — *aucune modification de la chaîne de détection n'a été nécessaire* — est conservé et mis en valeur |
| G1(l) | Incident 5, « une règle de sortie qui n'aurait rien gouverné » | 13 → 9 l., la leçon transférable intacte |
| G2(c) | Alertbox « dix ordres SQL » | 15 → 8 l. + `\cref{subsec:isolation-donnees}` |
| G2(d) | « Le plan qui reste partagé » | 10 → 7 l. |
| G2(f) | §6.7 « Modèle cible d'isolation » | 20 → 11 l. |
| G3(b) | Alertbox d'opposabilité de la frontière | 13 → 7 l. + `\cref{subsec:reseau-cible}` |
| G5(d) | Keybox « le jeton ne quitte jamais le serveur » | 9 → 5 l. |
| G6(e) | Anti-force-brute, 3ᵉ occurrence du même raisonnement | renvoi `\cref{subsec:authent-dashboard}` |
| G9 | Jointure enrichissement → score d'incident | renvoi `\cref{subsec:avancement-enrichissement}` |
| G10 | Plafond de traduction manuelle (verrou V2) | 6 → 3 l. + `\cref{sec:detection-code}` |
| G11 | Dénominateur ATT&CK | 7 → 4 l. + `\cref{sec:attck-matrice}` ; l'empreinte 872 / 697 / 15 reste |
| — | Réserve d'ordonnancement de T8 (image publiée avant analyse), redite au ch. 6 | renvoi `\cref{sec:chaine-livraison}` |

**Redondance intra-chapitre** : A-2 (le même verdict trois fois — `ch5` renvoie désormais à
`\cref{sec:socle-service}` et §6.7 ouvre directement sur les trois seuils) ; A-5 (la lecture qui
répète la convention de §6.1) ; A-6 (les deux paragraphes qui récitent `tab:logiciel-ecrit` et
`tab:cout-onboarding`) ; A-7 (cinq légendes qui redisaient leur cartouche interne) ; A-8
(conclusion du ch. 6 ramenée de 18 à 12 lignes, conclusion du ch. 5 de 14 à 12).

**Reformulation sans perte** : 32 blocs de prose resserrés — annonces qui répètent le titre,
clôtures qui répètent l'annonce, `tableau~\ref` passés en `\cref`, énumérations allégées de leurs
redites. Chaque bloc a été relu fait par fait avant réécriture.

**Structure** (B-3) : fusion de §6.7.1 + §6.7.2 en « Apport du socle et charge de l'éditeur », et
de §6.7.5 + §6.7.6 en « Modèle cible et seuils d'engagement ». §6.7 passe de six à quatre
sous-sections. J'ai en outre ajouté, en tête des notes de maturité, le renvoi aux conditions de
validité (`\cref{tab:limites}`) : un lecteur ne peut plus prendre la note 5/10 pour un résultat
avant d'apprendre, deux pages plus loin, qu'elle est mono-opérateur et sans trafic réel. C'est
l'effet visé par la proposition B-6 d'interversion de §6.7 et §6.8, obtenu **sans déplacer de
section** — je recommande de ne pas faire l'interversion, qui ferait perdre au chapitre sa clôture
sur la réponse aux objectifs.

**Coupe réelle de contenu : aucune.** Rien de ce que le brief protège n'a été retiré.

### 5.3 Le plancher, et pourquoi il est là

**Je n'atteins pas 18 et 15 pages, et je l'écris plutôt que de le maquiller.** La raison est
mesurable.

- **Ch. 5, 25 pages** : **9 figures et 6 tableaux**, plus 773 lignes de prose. Flottants :
  `fig:graphe-taches-livraison`, `fig:sequence-livraison`, `fig:boucle-f6`,
  `fig:chaine-infrastructure`, `fig:pipeline-detection`, `fig:composants-logiciel`,
  `fig:chaine-donnees-vue`, `fig:accueil-locataire`, `fig:gantt` ; `tab:familles-controles` (8
  familles), `tab:modele-donnees` (10 tables), `tab:avancement-enrichissement`,
  `tab:vues-dashboard` (12 vues), `tab:logiciel-ecrit`, `tab:frontiere-resp` (14 domaines).
- **Ch. 6, 20 pages** : **2 figures et 10 tableaux**, plus 562 lignes de prose. Sept de ces dix
  tableaux sont soit un **registre au complet** (`tab:synthese-campagne`, les vingt protocoles),
  soit une **publication de ce qui ne marche pas** (`tab:lacunes`, `tab:limites`,
  `tab:cout-anomalies`), soit une **mesure datée** (`tab:restore-db`, `tab:cout-onboarding`,
  `tab:plan-validation`). Tous protégés par le §1 du brief.

Autrement dit : **ramener le chapitre 6 à 15 pages suppose de retirer environ cinq pages de
tableaux, et les seuls candidats sont les registres, les non-conformités et les mesures datées.**
C'est précisément la coupe que le brief interdit, et c'est la chaîne de preuve que le jury suivra
pendant la soutenance.

### 5.4 Les coupes suivantes, par coût croissant

À trancher par l'auteur. Les deux premières ne me sont pas permises par mon mandat (« ne touche à
aucun code `tikzpicture` ») et reviennent à l'équipe design qui passe juste après moi.

| # | Coupe | Gain estimé | Coût pour la démonstration |
|---|---|---:|---|
| 1 | **Réduction d'échelle des 9 figures du ch. 5 et des 2 du ch. 6** (`scale`, `node distance`, `text width`). `fig:accueil-locataire`, `fig:chaine-infrastructure` et `fig:graphe-taches-livraison` dépassent chacune 9 cm de haut. | **2 à 3 p.** | **Nul.** Levier 4 du brief, explicitement autorisé et nommé sans perte. **C'est la première chose à faire, et elle est déjà dans le périmètre de l'équipe design.** |
| 2 | **Fusion de `fig:graphe-taches-livraison` et `fig:sequence-livraison`** : la même chaîne, par tâches puis par étapes, sur deux pages voisines | 0,8 p. | Faible : la vue par graphe porte le parallélisme des deux chemins, la vue par étapes porte l'ordre des portes. Une figure combinée est possible, c'est un travail de conception graphique |
| 3 | **`tab:frontiere-resp` (14 domaines, ~2 p.)** : réduire la colonne « éditeur » à un mot-clé, détail en annexe | 0,8 p. | Réel : ce tableau est ce qu'un client lira en premier, et la colonne « éditeur » est la moitié qui rend la frontière opposable |
| 4 | **`tab:vues-dashboard` (12 vues, ~1 p.)** : ne garder que les vues filtrables | 0,7 p. | Réel : la colonne « filtre locataire » est la preuve que la portée du filtre est une **propriété du modèle de données** et non un défaut d'interface. La couper affaiblit §6.7 |
| 5 | **`tab:objectifs-ch6` (O1–O6, ~1,5 p.)** → une phrase par objectif | 0,7 p. | **Élevé** : c'est la réponse formelle aux six objectifs du chapitre 1, attendue par le format ESPRIT |
| 6 | **`tab:limites` (10 conditions, ~1,5 p.)** → ne garder que les quatre bornantes | 0,8 p. | **Très élevé** : un chapitre de validation sans « menaces à la validité » est méthodologiquement faux — le brief le dit lui-même, et c'est son exception explicite |
| 7 | **`tab:synthese-campagne` (20 protocoles, ~2,5 p.)** → ne publier que les 9 lignes non conformes ou partielles | 1,5 p. | **Rédhibitoire.** Publier la campagne entière est ce qui interdit de sélectionner les tests après coup : c'est l'argument central du chapitre |

**Recommandation :** exécuter 1 et 2 — 3 à 4 pages pour un coût nul ou faible — et **rouvrir la
contrainte de 18/15 pages avec l'auteur** plutôt que d'entamer 3 à 7. Un chapitre 6 de 17 pages qui
publie ses vingt protocoles vaut mieux qu'un chapitre 6 de 15 pages qui n'en publie que neuf.

---

## 6. Ce que j'ai trouvé de faux dans le mémoire

Au-delà des missions commandées. Les points 1 à 5 sont dans mon périmètre et **corrigés** ; les
points 6 à 9 sont hors périmètre et **signalés, non touchés**.

### Corrigés (ch. 5 / ch. 6)

1. **Tout le §6.7 notait un réseau supprimé le 15/08/2026** — mission 1. Le chapitre se
   contredisait lui-même à cent lignes d'écart : `tab:maturite-multitenant` affirmait un connecteur
   partagé que `tab:limites`, dans le même chapitre, déclarait supprimé le 15/08/2026.
2. **`ch5` publiait comme « réalisé » une propriété réfutée par T14** — mission 2.
3. **`fig:composants-logiciel` : « 11 pages » contre « douze vues » partout ailleurs** — mission 3.
4. **Le dénominateur des tables de l'entrepôt** : « une table sur huit », « sept tables sur huit »,
   alors que `tab:modele-donnees` en montre **dix**, dont trois portent une clé d'application et
   trois sont « sans objet ». Le compte de 8 ne tombe juste sur aucune lecture du tableau. Réécrit
   avec le dénominateur explicite et un renvoi vers le tableau qui l'établit.
5. **Le résumé de T20 retenait l'intervalle le plus flatteur.** « Les horodatages se recoupant à
   10,3 s près » laissait croire que la preuve est disponible en dix secondes, alors que l'annexe E
   donne **2 min 55 s à 4 min 12 s** pour la disponibilité dans l'entrepôt. Les deux chiffres
   figurent désormais. Ce n'était pas faux, c'était sélectif — et le mémoire s'interdit ailleurs
   explicitement cette pratique.

### Signalés, hors périmètre — à traiter par le propriétaire du fichier

6. **`ch4`, `tab:ecarts-implementation`, ligne É2** porte encore « 25/08/2026 — Retrait conçu
   (D15), non appliqué », alors que `tab:adressage-cible` du **même fichier** écrit « le
   24/08/2026 — ce qui ferme l'écart É2 » et que `ch5:667` rapporte le retrait effectif. J'ai
   aligné le chapitre 6 sur le fait daté (É2 clos). **Si `ch4` n'est pas corrigé, la contradiction
   se déplace du ch. 6 vers le ch. 4 au lieu de disparaître** — c'est le seul endroit où ma
   correction crée une dépendance envers une autre équipe.
7. **La conclusion générale** présente D15 comme restant à appliquer (« ce qui reste est
   l'application, non l'instruction ») alors qu'elle a été appliquée du 11 au 25/08/2026, et
   annonce **quatre** incidents là où `ch5` en rapporte **cinq** — le cinquième étant celui qui
   porte la meilleure leçon transférable du mémoire.
8. **`ch4:1648–1659`** (« Points de vigilance », niveau L4) décrit le réseau d'avant la refonte —
   « aucune règle de sortie, aucune liste d'autorisation », « la règle interne de priorité 900 » —
   à 80 lignes d'un tableau du même fichier qui décrit douze règles et un refus par défaut en
   entrée et en sortie. La coupe A-1 du `RAPPORT_REDONDANCES` résout la contradiction en
   supprimant le paragraphe.
9. **`frontmatter/conventions.tex`** annonce « SO1–SO18 » (il y en a 24), « D00–D14 » (il y en a
   17) et six numéros de section faux. C'est la première page technique que le jury lit.

### Vérifications qui n'ont rien donné — à ne pas rouvrir

- Le **bilan de campagne** est cohérent partout : 7 + 11 + 2 = 20, et aucun protocole ne porte
  « Planifié ».
- Le **plan de validation continue** contient bien T12, T14, T15, T17, T19, T20 — six protocoles,
  tous avec un premier relevé daté. (T4, cité au ch. 4 comme y figurant, n'y est pas : constat C-5,
  hors de mon périmètre.)
- **`fig:composants-logiciel`, « treize points d'entrée de données »** contre « neuf points
  d'entrée de supervision » n'est **pas** une contradiction : 9 + 4 = 13, et les deux périmètres
  sont nommés dans la figure comme dans `tab:logiciel-ecrit`.
- **Le chapitre 4 §4.2.5 est cohérent** sur la refonte réseau : dates, plan d'adressage, douze
  règles, six autorisations, réserve d'opposabilité, deux charges détachées — tout y est, et c'est
  sur cette base que j'ai re-noté le chapitre 6.

---

## 7. Contrôles de sortie

```
xelatex -interaction=nonstopmode -jobname=buildB main.tex ; biber buildB ; xelatex x2
grep -c '^!' buildB.log             -> 0
grep -a "LaTeX Warning" buildB.log  -> aucune (ni reference indefinie, ni « rerun »)
grep -a "Output written"            -> buildB.pdf, 157 pages
```

Contrôles de qualité passés sur les deux fichiers :

- **0 paragraphe de 15 lignes ou plus** (contre 7 à l'entrée) ;
- **0 occurrence** des quatorze termes interdits du registre d'audit ;
- **0 légende de plus de deux lignes composées** sans forme courte `\caption[...]` ;
- **0 titre à verbe conjugué**, hors les deux clauses que le brief protège nommément.

**Périmètre d'écriture — vérification.** Deux fichiers `.tex` seulement ont été écrits par cette
équipe : `ch5_realisation.tex` et `ch6_validation.tex`, plus le présent rapport. **Aucun fichier
n'a été supprimé** (`git status --porcelain | grep '^ D'` : vide). Les autres `.tex` en état
modifié dans `git status` l'étaient avant cette session, ou l'ont été par les trois équipes
concurrentes — dates d'écriture de 18 h 58 à 19 h 09 sur `ch1`–`ch4`, `intro`, `conclusion` et les
annexes.

**Contrainte d'outillage respectée.** Aucun LaTeX n'a été écrit par heredoc bash, `sed`, `perl` ou
`echo`. Les neuf patchs sont des scripts Python en `io.open(..., encoding='utf-8', newline='\n')`,
chacun refusant de s'exécuter si la chaîne cible est absente ou trouvée plusieurs fois — ce garde-fou
a intercepté plusieurs collisions avant écriture.
