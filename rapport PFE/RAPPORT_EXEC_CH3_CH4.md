# RAPPORT_EXEC_CH3_CH4.md — refonte finale des chapitres 3 et 4

**Équipe** : ch3 + ch4. **Périmètre d'écriture** : `latex/chapters/final/ch3_besoins_menaces.tex`,
`latex/chapters/final/ch4_conception.tex`, et ce rapport — **aucun autre fichier n'a été ouvert en
écriture, aucun fichier n'a été supprimé** (vérification §8). **Date** : 29/08/2026.
**Nom de travail de compilation** : `buildA`. Tous les patchs ont été appliqués par script Python
(`io.open(..., encoding='utf-8', newline='\n')`), jamais par heredoc, `sed`, `perl` ou `echo`.

---

## 1. Pages avant / après — mesurées, non estimées

Chaîne : `xelatex -interaction=nonstopmode -jobname=buildA main.tex`, `biber buildA`, deux passes.
Pages relevées sur `buildA.toc`, en prenant la première page du chapitre suivant comme borne.

| | Avant (buildA du départ) | **Après** | Gain | Cible du brief | Écart à la cible |
|---|---:|---:|---:|---:|---:|
| Ch. 3 — Besoins et menaces | 11 p (p. 33–43) | **10 p** (p. 31–40) | **−1** | 8 | +2 |
| Ch. 4 — Conception | 28 p (p. 44–71) | **27 p** (p. 41–67) | **−1** | 19 | +8 |
| Document entier | 167 p | 157 p | −10 | ≤ 120 | — |

*(Le total du document est une cible mouvante : les trois autres équipes écrivent en parallèle et
il est passé de 167 à 164, 161, 160 puis 157 pages au fil de mes compilations. Seules les deux
premières lignes sont imputables à cette équipe ; les pages de début de ch3 et de ch4 se déplacent
avec le travail amont, la **différence** entre deux bornes de chapitre est en revanche stable.)*

Contrôles de sortie, sur l'état final :

```
grep -c '^!' buildA.log        → 0
grep -ac undefined buildA.log  → 0
Output written on buildA.pdf (157 pages)
```

Lignes source : ch3 716 → **699** ; ch4 2 398 → **2 323**. Soit **−92 lignes**, dont ≈ 78 lignes de
prose (≈ 1,9 page au ratio de 42 l./p.) et le reste en légendes de figures. **Le gain composé
mesuré est inférieur au gain de prose calculé** : les pages libérées ont été immédiatement
reprises par le repositionnement des flottants, qui sont ce qui gouverne réellement la pagination
de ces deux chapitres (§6).

> **Le rapport de redondances mesurait ch3 à 717 l. et ch4 à 2 399 l. : toutes ses localisations
> `fichier:ligne` sont décalées de +1 par rapport aux fichiers réels.** Cela a été pris en compte
> partout ; à signaler aux autres équipes qui s'en servent.

---

## 2. Mission 1 — l'erreur factuelle bloquante (C-2)

### 2.1 Ce que j'ai vérifié, et dans quel ordre

| # | Source consultée | Ce qu'elle établit |
|---|---|---|
| 1 | `ch4:1566–1576` (avant patch), ligne **L4** de `tab:conception-couches` | « douze règles de filtrage dont six autorisations », « refus par défaut **en entrée et en sortie**, l'un et l'autre journalisés », « refus croisés entre locataires journalisés, qui alimentent la chaîne de détection sans modification de celle-ci » |
| 2 | `ch4:391–544` (§4.2.5) et `tab:regles-cibles` | Les douze règles E1–E9 / I1–I3 sont **en service depuis le 23/08/2026** ; les trois règles d'entrée antérieures ont été supprimées le 24/08/2026 « sans successeur » |
| 3 | `ch4:466–469` (`tab:adressage-cible`, cellule « Supprimés ») | Sous-réseaux `10.0.1.0/24` et `10.0.2.0/24` supprimés le **24/08/2026** — donc la règle interne de priorité 900 qui les reliait n'a plus d'objet |
| 4 | `ch4` `tab:registre-decisions`, ligne **D15** | Statut : « **Appliquée** du 11 au 25/08/2026 » |
| 5 | `ch4` `tab:registre-decisions`, ligne **D11** | « Sortie réseau : route par défaut, aucune règle de sortie déclarée — Réserve, **levée par D15** » |
| 6 | `BRIEF_REFONTE_APPLIQUEE.md` §1 (chronologie) | 11/08 sous-réseaux · 12–14/08 bascule en sortie directe · 15/08 suppression du connecteur · 15–22/08 fenêtre d'observation · 22/08 six autorisations · 23/08 refus nommés puis refus par défaut · 24/08 passerelle, routeur, deux sous-réseaux vides et trois règles d'entrée · 25/08 régime permanent |
| 7 | `ch6:158–160` (`tab:resultats`, T20) | **Conforme.** Le 24/08/2026, trois sorties refusées — externe, croisée entre locataires, vers la base — les trois lignes de refus retrouvées dans l'entrepôt, horodatages recoupés à 10,3 s |
| 8 | `annexe_e:280–307` (protocole T20) | Détail horodaté, contrôle positif inclus ; la journalisation des refus était acquise depuis le **19/08/2026**, ce qui **clôt É1** et conditionnait la recevabilité de T20 |
| 9 | `ch6:139–142` et `ch6:214–228` (T14) | **Non conforme.** Le 25/08/2026, deux sondes : celle qui emprunte le sous-réseau est refusée deux fois par le refus par défaut ; celle qui porte la configuration réseau de la révision déployée reçoit **un code 204 en 412 ms**. Le correctif est identifié, non appliqué ; il vaut identiquement pour l'interface web de l'application hébergée |

**Verdict.** La description du parent est exacte sur les faits, et le paragraphe L4 était bien le
seul endroit du chapitre 4 à décrire un réseau qui n'existe plus. Il affirmait quatre choses
fausses au 25/08/2026 : (a) aucune règle de sortie ni liste d'autorisation ; (b) la règle interne
de priorité 900 active ; (c) les sous-réseaux vides ; (d) le canal de détection des refus réseau
« structurellement muet ». Il se terminait sur « la conception qui lève ces trois réserves est
**arrêtée** en \cref{subsec:reseau-cible} » — verbe juste avant l'application, faux depuis.

### 2.2 Ce que j'ai écrit à la place

Le paragraphe dit désormais l'état réel avec ses dates, **et conserve intégralement la seule
réserve qui reste vraie** — la non-conformité T14, qui n'est plus une note perdue en L6 mais le
cœur du point de vigilance de la couche réseau :

> **L4** ne porte plus la réserve qu'enregistrait la décision D11 : depuis la refonte appliquée du
> 11 au 25/08/2026 (§4.2.5), la sortie est gouvernée par le pare-feu et non par un paramètre de
> plateforme, la règle interne de priorité 900 a été supprimée le 24/08/2026 avec les deux
> sous-réseaux vides qu'elle reliait (É2), et le canal de détection des refus réseau n'est plus
> muet — la journalisation des refus, acquise le 19/08/2026 (É1), a porté le 24/08/2026 trois
> refus de sortie réellement opposés et retrouvés dans l'entrepôt (T20). **La confiance résiduelle
> de la couche a changé de nature, et elle est mesurée** : deux charges de travail — le service
> d'encodage et l'interface web de l'application hébergée — ont été détachées du sous-réseau au
> motif, exact, qu'elles n'ont aucune dépendance privée, de sorte que leur **sortie managée
> échappe au pare-feu**. Le 25/08/2026, une sonde portant la configuration réseau de la révision
> déployée du service d'encodage a atteint une destination externe en 412 ms : c'est la
> non-conformité T14, qui reste ouverte, le motif du détachement valant pour la sortie
> *nécessaire* et non pour la sortie *possible*.

**Note de méthode : je n'ai pas appliqué la coupe A-1 telle que le rapport de redondances la
formule.** A-1 propose de *supprimer* le paragraphe L4 (« Rien, et il est faux »), ce qui
corrigerait la contradiction en effaçant la ligne au lieu de la redresser — et emporterait avec
elle la seule mention, dans le chapitre de conception, de la non-conformité T14. La consigne de
mission est explicite en sens contraire, et elle a raison : le paragraphe est réécrit, pas
supprimé. Coût : 12 lignes deviennent 13 au lieu de 0. Le gain de page annoncé par A-1 pour L4
n'est donc pas réalisé, et je l'ai compensé sur L1 et L7, dont A-1 dit à juste titre qu'ils ne
font que réciter leur propre cellule du tableau.

### 2.3 Effet de bord corrigé dans la foulée

`ch4` L6 affirmait : « L6 tient l'absence de sortie du service d'encodage de la plateforme
d'exécution et non d'une règle du réseau, **ce qu'établit le protocole T14** ». **T14 établit
exactement l'inverse** : il est non conforme parce que la sortie n'est *pas* absente (204 en
412 ms). La phrase est remplacée par un renvoi à L4, où le fait est désormais énoncé avec sa date
et son verdict.

---

## 3. Coupes appliquées — nature, localisation, gain

### 3.1 Chapitre 3

| # | Localisation (fichier de départ) | Nature | Contenu | Lignes |
|---|---|---|---|---:|
| C3-01 | `ch3:15–24` chapeau « Pourquoi deux méthodes » | reformulation | Condensé sans perte d'argument | −3 |
| C3-02 | `ch3:236–241` chapeau §3.3 | redondance intra-chapitre | Redisait la définition de STRIDE déjà donnée au chapeau du chapitre | −1 |
| C3-03 | `ch3:396` titre §3.3.2 | titre (B-4) | « TB5 : la frontière qu'aucun contrôle réseau ne garde » → « **TB5, frontière sans contrôle réseau** » | 0 |
| C3-04 | `ch3:406–410` | **redondance inter-chapitres G1(i)** | Exposé de D15 avant son établissement au ch. 4 → `\cref{subsec:reseau-cible}` | −1 |
| C3-05 | `ch3:412–422` « Deux conséquences » | redondance intra-section | La clôture répétait l'annonce et la keybox qui suit | −2 |
| C3-06 | `ch3:431` + `ch3:451` | structure (B-3) | Fusion §3.4.1 + §3.4.2 → « Valeurs métier, sources de risque et scénarios stratégiques » | −2 |
| C3-07 | `ch3:582–617` §3.5.1 | **redondance inter-chapitres G1(h) + G3(c) + G4(d)** | 36 lignes exposant D15, la réserve d'opposabilité et l'exfiltration fournisseur avant le ch. 4 → texte du rapport de redondances, avec `\cref` | −9 |
| C3-08 | `ch3:619` titre §3.5.2 | titre | 142 signes → « **Matrice de traçabilité** » (22 signes) | 0 |
| C3-09 | `ch3:673–681` « Vingt exigences, vingt tests » | redondance intra-section | −1 |
| C3-10 | `ch3:694` `tab:rattachement-referentiels` | **correction factuelle (C-16)** | `\cite{owasp2021}` → `\cite{owasp2025}` | 0 |
| C3-11 | conclusion du chapitre | reformulation | 16 l → 12 l (standard 8–12) | −4 |
| C3-12 | §3.3.1 | redondance | La notation STRIDE était décrite en prose *et* lisible sur la figure | −2 |
| C3-13 | §3.4.2 « Lecture » + « Deux scénarios » | reformulation | Fusion des deux paragraphes, mêmes faits | −4 |
| C3-14 | §3.4.3 1ᵉʳ § | redondance intra-chapitre | « le risque dominant ne provient pas de l'application exposée mais des chemins d'administration… TB5 » est dit **trois fois** dans ch3 (§3.3.2, §3.4.3, conclusion) — conservé aux deux endroits où il porte un argument | −5 |
| C3-15 | §3.1.2 | reformulation | Rattachement UC → F mis en forme compacte | −2 |
| C3-16 | en-tête et pied du fichier | **typographie, sans perte** | Resserrement local des espacements de flottants, identique à celui déjà en vigueur au ch. 4, restauré en fin de chapitre | +13 |

### 3.2 Chapitre 4

| # | Localisation (fichier de départ) | Nature | Contenu | Lignes |
|---|---|---|---|---:|
| C4-01 | `ch4:1648–1659` | **correction d'une erreur de fait (C-2)** | Voir §2 | +1 |
| C4-02 | `ch4:1670–1671` L6 | **correction d'une erreur de fait** | T14 présenté comme établissant l'absence de sortie | −1 |
| C4-03 | `ch4:1628–1631` L1 · `ch4:1676–1681` L7 | redondance intra-section (A-1) | Récitaient leur propre cellule de `tab:conception-couches` | −5 |
| C4-04 | `ch4:1624–1626` | **correction factuelle (C-5)** | « T4, T14, T20 relèvent du plan de validation continue » : **T4 n'y figure pas** (`tab:plan-validation` = T12, T14, T15, T17, T19, T20). T4 retiré de la phrase ; renvoi `\cref{sec:plan-validation}` ajouté | −1 |
| C4-05 | `ch4:701–739` | **redondance inter-chapitres G1(d) + G1(e)** | Les 12 étapes, la fenêtre de 7 j et l'étape dangereuse sont établies en `subsec:migration-reseau` (ch. 5) → textes de remplacement du rapport de redondances | −24 |
| C4-06 | `ch4:750–770` « Ce que la refonte ne ferme pas » | **redondance interne + correction de compte** | Voir §5, constat F-2 | −7 |
| C4-07 | `ch4:668–676` | redondance inter-chapitres (G8) | « la passerelle est devenue *sans objet* » : l'argument PR1 est établi au ch. 2 → `\cref{sec:trente-trois-briques}` | −4 |
| C4-08 | `ch4:678–689` coût | reformulation | −3 |
| C4-09 | `ch4:1495–1505` | redondance (A-4) | Glossaire de quatre termes au milieu du chapitre → deux définitions utiles + renvoi ; *locataire* relève de la nomenclature, *démarrage à froid* du ch. 5 | −4 |
| C4-10 | `ch4:49–51` | **correction factuelle (C-15)** | « Quatre vues statiques » pour cinq figures → « Cinq vues statiques », le réseau étant donné dans ses deux états | +1 |
| C4-11 | `ch4:391` et `ch4:772` | titres (B-4) | « La refonte réseau appliquée : conception, migration et état obtenu » → « **Refonte du plan réseau appliquée (D15)** » ; « Isolation des données entre locataires : ce qui tient, et la conception qui la referme » → « **Isolation des données entre locataires (D16)** » | 0 |
| C4-12 | `ch4:404` et `ch4:427` | **précision (C-23)** | « sept charges de travail » alors que le socle en compte huit → « les sept charges **qu'il desservait** », « six des sept charges **desservies par le connecteur** » | 0 |
| C4-13 | `tab:ecarts-implementation`, ligne **É2** | **correction factuelle (C-3)** | Le registre disait « 25/08/2026 — Retrait conçu (D15), **non appliqué** » quand `tab:adressage-cible`, 300 lignes plus haut, dit « supprimés le 24/08/2026 — ce qui **ferme** l'écart É2 » → **24/08/2026, corrigé, appliqué et vérifié** | 0 |
| C4-14 | `tab:ecarts-implementation`, ligne **É4** | **correction factuelle** | É4 (« mécanisme de connexion au réseau privé différent de celui prévu, confort d'un composant managé ») portait « en cours / Assumé » : le composant managé est le connecteur, supprimé le 15/08/2026. Clos, conformément au §3 de `BRIEF_REFONTE_APPLIQUEE.md` (« É2 et É4 se ferment ») | +1 |
| C4-15 | `tab:ecarts-implementation`, ligne **É11** | **correction factuelle (C-12)** | La cause était écrite au passé (« les services d'exécution ne routent que les plages privées **par le connecteur** ») et présentée au présent. Reformulée sur l'état en service : les appels sortent par l'interface de la charge, admis par la règle E4 dont la destination est la plage des interfaces du fournisseur — l'écart subsiste, sa cause est juste | 0 |
| C4-16 | conclusion du chapitre | **corrections de comptes** | (a) « Neuf vues » → « neuf vues d'architecture et trois diagrammes de comportement » (C-21, le lecteur en compte douze) ; (b) « deux écarts corrigés et vérifiés le 19/08/2026 » → **quatre clos**, deux le 19/08 et deux par la refonte réseau les 15 et 24/08 | +2 |
| C4-17 | 7 figures : `fig:topologie-reseau`, `fig:topologie-cible`, `fig:cycle-donnee`, `fig:modele-donnees`, `fig:seq-refus`, `fig:delegation-identite`, `fig:seq-mfa` | **A-7, mécanique et sans perte** | Chacune portait un cartouche interne « Ce que la figure démontre » **et** une légende longue disant la même phrase. Cartouche conservé (standard §2.4 du brief), légende ramenée au texte court | −29 |
| C4-18 | légende de `fig:deploiement` | **correction factuelle (C-12)** | « trait épais : chemin réseau privé, **par le connecteur** » → « par l'interface de sortie directe de la charge ». La dernière phrase, qui renvoyait F6/F7 au ch. 5, est supprimée (redite du corps) | −1 |
| C4-19 | `ch4:263–278` §4.2.4 | redondance intra-section | Le 2ᵉ § redisait **mot pour mot** le cartouche interne de la figure qui le suit (« la passerelle ne desservait que le sous-réseau privé… la plage du connecteur ne lui était pas rattachée ») | −5 |
| C4-20 | `ch4:1211–1224` chapeau §4.4 | reformulation | −3 |
| C4-21 | §4.2.6 chapeau, argument, coût | reformulation | −8 |
| C4-22 | §4.6.2 | reformulation | « La lecture en dix secondes est la suivante » : l'annonce répétait la phrase précédente | −3 |
| C4-23 | 19 libellés de figures | typographie | Espaces insécables : `15~min`, `5~min`, `10~s`, `60~s`, `300~s`, `16~h~56~min~08~s`, `6~min~15~s`… (voir §7, réserve) | 0 |

---

## 4. Une coupe du rapport de redondances que je n'ai **pas** appliquée, et pourquoi

**B-1 — sortir §4.2.5 et §4.2.6 de « Vues d'architecture » pour en faire un §4.3
« Segmentation réseau et isolation des données ».** Le diagnostic est juste : une section
intitulée « Vues d'architecture » abrite deux dossiers de décision qui pèsent 10 de ses 13 pages,
et §4.2.6 ne porte aucune figure. Je ne l'ai pas appliqué, pour deux raisons vérifiées :

1. **Le gain annoncé (−3,3 p) n'est pas atteignable dans mon mandat.** Le rapport le fait venir
   pour l'essentiel de la lecture *côte à côte* de `fig:topologie-reseau` et `fig:topologie-cible`,
   donc du **déplacement d'une figure de 100 lignes de TikZ** — que la consigne de mission
   m'interdit explicitement de toucher, une équipe dédiée reprenant les 30 figures juste après.
   Sans ce déplacement, la promotion des deux sous-sections en section **ajoute** un titre de
   niveau `\section` et ne rend aucune page.
2. **Elle casserait quatre renvois écrits à la main dans des fichiers que d'autres équipes sont en
   train d'écrire** : `ch6:706` (« §4.4 »), `ch6:707` (« §4.6 »), `frontmatter/conventions.tex:40`
   (« F1–F7 §4.3 ») et `:42` (« É §4.9 »). Le décalage §4.3→§4.4, §4.4→§4.5, §4.5→§4.6,
   §4.6→§4.7, §4.7→§4.8 arriverait au milieu de leur travail.

**Recommandation** : faire B-1 **après** la passe figures, en un seul geste qui déplace aussi
`fig:topologie-cible` ; l'équipe qualité corrigera alors les quatre renvois manuels, déjà inscrits
à sa liste au titre de C-6 et C-7.

---

## 5. Ce que j'ai trouvé de faux — constats nouveaux, non couverts par `RAPPORT_REDONDANCES.md`

### F-1 (IMPORTANT, hors périmètre d'écriture) — « six autorisations » : le mémoire en publie cinq

Le mémoire écrit **dix fois** « douze règles dont **six** autorisations ». Or son propre
`tab:regles-cibles` (`ch4`) en liste **cinq**, et l'arithmétique ne ferme qu'à cinq :

| Réf. | Action | | Réf. | Action |
|---|---|---|---|---|
| **E1** | Autoriser | | **E7** | Refuser |
| **E2** | Autoriser | | **E8** | Refuser |
| E3 | Refuser | | **E9** | Refuser par défaut |
| **E4** | Autoriser | | I1 | Refuser |
| **E5** | Autoriser | | I2 | Refuser |
| **E6** | Autoriser | | I3 | Refuser par défaut |

**5 autorisations + 7 refus = 12 règles.** Avec six autorisations, le total serait treize.

La source du chiffre a été remontée : `rapport PFE/CONCEPTION_RESEAU_CIBLE.md`, tableau §d.4,
liste les mêmes neuf règles de sortie et trois d'entrée, puis conclut ligne 320 : « **Total :
12 règles, dont 6 autorisations** ». **L'erreur est dans le document de conception source**, et
elle a été recopiée telle quelle dans `BRIEF_REFONTE_APPLIQUEE.md` §1 (« Pose des six règles
d'autorisation ») puis dans le mémoire. Elle est également repérable dans le même document :
l'étape 7 du plan de migration dit « poser les règles d'autorisation **E1 à E6** », intervalle qui
contient E3, laquelle est un refus.

**Je ne l'ai pas corrigée**, et c'est un choix délibéré : la corriger dans mes deux fichiers
seulement créerait une contradiction chiffrée entre le ch. 4 et les ch. 5 et 6, c'est-à-dire
exactement le défaut que cette vague vient réparer. **C'est une correction à passer en un seul
geste, sur les dix occurrences**, après arbitrage de l'auteur :

| Fichier | Ligne | Formulation |
|---|---|---|
| `ch3_besoins_menaces.tex` | 566 | « six autorisations nommées par identité et par port » |
| `ch3_besoins_menaces.tex` | 629 | `tab:matrice-tracabilite`, ligne SO24 |
| `ch4_conception.tex` | 1501 | `tab:conception-couches`, cellule L4, « douze règles de filtrage dont six autorisations » |
| `ch4_conception.tex` | 1502 | `tab:conception-couches`, cellule L4, « six autorisations ciblées par identité » |
| `ch5_realisation.tex` | 649, 802, 1416 | trois occurrences |
| `ch6_validation.tex` | 724, 929 | deux occurrences |
| *(hors LaTeX)* | `CONCEPTION_RESEAU_CIBLE.md:320`, `BRIEF_REFONTE_APPLIQUEE.md` §1 et §3 | la source de l'erreur |

*(Vérifié : `annexe_a_etudes_comparatives.tex:248`, `ch2_etat_art.tex:560` et
`annexe_d_conception_detaillee.tex:103` écrivent « douze règles » sans avancer de compte
d'autorisations — ils n'ont rien à corriger dans l'hypothèse (a).)*

Deux issues possibles, à trancher par l'auteur sur l'état déployé :
**(a)** écrire « **cinq** autorisations » partout — c'est ce que dit le tableau publié, et le seul
compte qui ferme à douze ; **(b)** si la règle E4 est en réalité **deux** règles chez le
fournisseur (la plage `private.googleapis.com` et la plage `restricted`), alors le total est
**treize** règles dont six autorisations, et c'est « douze » qu'il faut corriger, à dix endroits
également. Dans les deux cas, le chiffre qui apparaît aujourd'hui est faux : **un membre du jury
qui compte les lignes du tableau trouve cinq.**

### F-2 — La même limite énoncée deux fois dans le même paragraphe, d'où « six limites » pour cinq

`ch4:750–770`, « Ce que la refonte ne ferme pas », annonçait « **Six limites** sont assumées » et
en énumérait six, dont deux sont la même : « L'exfiltration vers un entrepôt tiers du même
fournisseur n'est pas couverte : elle emprunterait une interface légitime et exigerait un
périmètre de service » (l. 758–760), puis quinze lignes plus bas « **il ne supprime pas
l'exfiltration par les interfaces du fournisseur lui-même**, puisque l'autorisation qui rend
l'entrepôt joignable rend joignable tout entrepôt du même fournisseur — fermer ce chemin exigerait
un périmètre de service » (l. 764–767). **Corrigé** : les deux énoncés sont fondus, le paragraphe
annonce « Cinq limites », et les cinq réserves sont conservées telles quelles, T14 comprise.

### F-3 — `ch4` L6 attribuait à T14 la démonstration de son contraire

Voir §2.3. **Corrigé.**

### F-4 (hors périmètre, à traiter par l'équipe figures) — trois libellés TikZ décrivent des composants supprimés

Ce sont les seuls endroits de `ch4` où l'état antérieur du réseau est encore présenté comme
courant. Je ne les ai pas touchés, la consigne interdisant toute modification du code
`tikzpicture` ; la légende correspondante, elle, a été corrigée (C4-18). **Texte de remplacement
prêt à appliquer :**

| Ligne | Actuel | À écrire |
|---|---|---|
| `ch4:136` (`fig:modele-couches`, nœud L4) | `VPC · Serverless VPC Access · Cloud NAT` | `VPC · sortie réseau directe · Private Service Access` |
| `ch4:205` (`fig:deploiement`, nœud L4) | `Réseau privé (L4) --- refus par défaut, accès privé, sortie par le connecteur` puis `VPC · Serverless VPC Access · Cloud NAT` | `Réseau privé (L4) --- refus par défaut en entrée et en sortie, accès privé, sortie par l'interface directe` puis `VPC · sortie réseau directe · Private Service Access` |
| `ch4:250` (`fig:deploiement`, étiquette d'arc) | `par le connecteur` | `par l'interface de sortie` |

*(Le connecteur d'accès sans serveur a été supprimé le 15/08/2026 et la passerelle de traduction
d'adresses le 24/08/2026 — `ch4:466–469`, `ch4:620–621`, `ch5:647–648`.)*

### F-5 — l'entrée `owasp2021` de la bibliographie devient orpheline

`ch3:694` était le **seul** appel de `\cite{owasp2021}` du mémoire ; le ch. 2 argumente deux fois
depuis `owasp2025` (`ch2:141`, `ch2:948`). J'ai remplacé la clé au ch. 3, conformément à C-16. Les
deux entrées existent bien dans `references.bib` (l. 38 et l. 59) : **`owasp2021` n'est désormais
citée nulle part.** Avec `biblatex`, une entrée non citée ne s'imprime pas — la bibliographie n'a
donc pas grossi et la compilation est propre (`grep -ac undefined` = 0). **Je n'ai pas modifié
`references.bib`, qui est en lecture seule pour moi et détenu par une autre équipe** ; à cette
équipe de décider si l'entrée reste (elle documente la comparaison 2021/2025 que fait `ch2:141`)
ou si elle est retirée. **Ma recommandation : la conserver**, précisément parce que `ch2:141` parle
de « la cinquième position en 2021 » et gagnerait à citer les deux éditions.

### F-6 — le module réseau versionné dans le dépôt décrit encore l'état *avant* refonte

Observation faite en vérifiant le compte des règles, **hors périmètre et sans action de ma part** :
`terraform/modules/vpc/main.tf` de l'arbre de travail contient encore le connecteur
(`google_vpc_access_connector`), la passerelle de traduction et son routeur, les deux sous-réseaux
`public`/`private`, la règle `allow-internal` en priorité 900, et **aucune règle en direction
`EGRESS`**. Le mémoire n'est pas en cause — il écrit correctement que la vue antérieure « reste
recoupable avec le code de cette période » — mais si un membre du jury demande le dépôt, il faut
pouvoir lui montrer l'état d'après refonte. **À vérifier par l'auteur** : branche, environnement ou
état Terraform où vit la configuration du 25/08/2026.

### F-7 — un `\label` de tableau posé sur une sous-section

`ch4:2303` : `\subsection{Composants évalués puis écartés}` porte `\label{tab:composants-ecartes}`,
appelé depuis `ch4:28` par `\cref{tab:composants-ecartes}`. `cleveref` rend donc « section 4.7.2 »
sous un nom de label qui annonce un tableau. Sans conséquence de compilation ; **non corrigé**
parce que renommer le label suppose de toucher tous les appels, y compris hors de mon périmètre.

---

## 6. Plancher atteint — et ce qu'il faudrait pour aller plus loin

**Je n'atteins ni 8 pages sur ch3, ni 19 sur ch4, et la raison est mesurable : ces deux chapitres
ne sont pas faits de prose.**

Décomposition de la hauteur composée, relevée sur `buildA.lof`, `buildA.lot` et `buildA.pdf` :

| | Figures | Tableaux | **Prose** | Total |
|---|---:|---:|---:|---:|
| Ch. 3 | ≈ 2,0 p (2 figures pleine largeur) | ≈ 4,5 p (8 tableaux, dont EX1–EX20 et la matrice de traçabilité) | **≈ 3,5 p** | 10 p |
| Ch. 4 | ≈ 11,5 p (**12 figures**, une par page p. 41–64) | ≈ 8,0 p (dont `tab:conception-couches` ≈ 2,5 p et les deux registres D et É ≈ 2 p) | **≈ 7,5 p** | 27 p |

**Sur le ch. 4, la cible de 19 pages suppose de supprimer 8 pages sur 7,5 pages de prose : elle est
arithmétiquement hors d'atteinte par le seul travail de rédaction.** Le levier réel est le
**levier 4 du brief** — la réduction d'échelle des figures — que la consigne de mission m'interdit
et qui revient à l'équipe figures. Le rapport de redondances arrive indépendamment à la même
conclusion (§B-5 : « la seule action utile est donc la réduction d'échelle des douze figures du
ch. 4 »).

### Liste ordonnée des coupes suivantes, avec leur coût pour la démonstration

| Rang | Coupe | Gain estimé | Coût pour la démonstration | Recommandation |
|---|---|---:|---|---|
| 1 | **Réduction d'échelle des 12 figures du ch. 4 et des 2 du ch. 3** (`scale`, `node distance`, `text width`) | **−2,5 à −3,5 p** | **Nul** tant que le corps reste ≥ 8 pt | **À faire.** Équipe figures |
| 2 | **B-1 avec déplacement de `fig:topologie-cible`** (§4) | **−1,5 à −3,3 p** | Nul, et corrige une erreur de catégorie | **À faire après la passe figures** |
| 3 | Fusionner `fig:seq-refus` (séquence) et `fig:chronologie-incident` (chronologie), qui montrent le même incident sous deux angles | −1,0 p | Faible : la chronologie porte les deux seules mesures datées (6 min 15 s le 10/08, ≈ 15 min le 19/08), à conserver dans la figure fusionnée | À étudier |
| 4 | Verser `tab:adversaires-donnees` (§4.2.6, ≈ 0,9 p) en annexe D | −0,8 p | **Réel** : c'est le seul endroit du mémoire qui confronte la frontière d'isolation à chaque adversaire, et son argument (« trois circonstances d'exploitation, pas des attaques ») est ce qui justifie D16 | Déconseillé |
| 5 | Verser `tab:matrice-tracabilite` (ch. 3, ≈ 1,3 p) en annexe | −1,2 p | **Rédhibitoire.** Le brief la protège nommément ; c'est la pièce qui rend le mémoire défendable | **Refusé** |
| 6 | Supprimer les paragraphes L2, L3, L5 des « Points de vigilance » (§4.5) | −0,5 p | **Rédhibitoire.** Ce sont trois réserves nommées — clé sans version, droit d'invocation anonyme, chiffrement non rétroactif — protégées par le brief | **Refusé** |
| 7 | Ramener `tab:exigences` (EX1–EX20) à des libellés courts | −0,7 p | **Rédhibitoire.** La formulation *complète* de chaque exigence est ce qui rend le test écrivable ; le chapitre le dit explicitement | **Refusé** |

**Plancher atteint sans casser de chaîne de preuve : ch3 = 10 p, ch4 = 27 p.**
**Avec les rangs 1 et 2, sans aucune perte : ch3 ≈ 9 p, ch4 ≈ 21–23 p.**
Descendre au-delà exige de renoncer à un registre, à une réserve ou à une figure de preuve — et
c'est un arbitrage d'auteur, pas une décision de rédaction.

---

## 7. Deux consignes en conflit, et l'arbitrage retenu

La mission 4 demande de poser les espaces insécables « autour des lignes 1001-1045 et 1386-1393 »
de `ch4`. **Les dix-neuf occurrences concernées sont, sans exception, à l'intérieur de blocs
`tikzpicture`** — libellés de nœuds et d'arcs de `fig:cycle-donnee`, `fig:modele-donnees`,
`fig:chronologie-incident` et `fig:seq-mfa` — alors que la même mission interdit de toucher au code
TikZ. J'ai tranché ainsi : **appliqué**, parce que la consigne les désigne par leur numéro de ligne
et qu'un `~` dans le texte d'un libellé ne peut modifier ni un style, ni une coordonnée, ni un
tracé. Aucune option de style, aucune position, aucune commande `\draw` n'a été modifiée.

**Avertissement à l'équipe figures** : si vous réécrivez ces libellés, conservez les insécables.
Liste exacte, **en numérotation du fichier après intervention** : `ch4` l. 949, 952, 976, 977, 979,
993 (`15~min`, `5~min`, `10~s`) ; l. 1326, 1327, 1333, 1345 (idem) ; l. 1370–1372 (`16~h~41`,
`16~h~56~min~08~s`, `15~min`, `6~min~15~s`) ; l. 2016, 2024, 2085–2086, 2097, 2107 (`5~min`,
`60~min`, `60~s`, `300~s`, `30~s`). Commande de contrôle :
`grep -n "~min\|~s}\|~h~" chapters/final/ch4_conception.tex`.

Le même arbitrage explique pourquoi la **légende** de `fig:deploiement` a été corrigée (C4-18)
mais pas les trois **libellés TikZ** qui portent la même erreur (F-4) : la légende est du texte,
les nœuds sont de la figure.

---

## 8. Vérification — aucun fichier hors périmètre n'a été touché

`git status --porcelain` sur `latex/chapters/final/`, à la fin de l'intervention :

```
 M rapport PFE/latex/chapters/final/ch1_cadre_existant.tex      <- autre équipe
 M rapport PFE/latex/chapters/final/ch2_etat_art.tex            <- autre équipe
 M rapport PFE/latex/chapters/final/ch3_besoins_menaces.tex     <- MOI
 M rapport PFE/latex/chapters/final/ch4_conception.tex          <- MOI
 M rapport PFE/latex/chapters/final/ch5_realisation.tex         <- autre équipe
 M rapport PFE/latex/chapters/final/ch6_validation.tex          <- autre équipe
 M rapport PFE/latex/chapters/final/conclusion_generale.tex     <- autre équipe
 M rapport PFE/latex/chapters/final/intro_generale.tex          <- autre équipe
?? rapport PFE/RAPPORT_EXEC_CH3_CH4.md                          <- MOI
```

Les six autres fichiers `chapters/final/` étaient déjà en état ` M` à l'ouverture de la session
(cf. `git status` initial) et sont modifiés par les équipes qui travaillent en parallèle. Les
seules écritures de cette équipe sont `ch3_besoins_menaces.tex`, `ch4_conception.tex` et le présent
rapport. **`references.bib` n'a pas été ouvert en écriture** (F-5). **Aucun fichier n'a été
supprimé. Aucun `\label` n'a été supprimé** — les deux titres retitrés (§4.2.5, §4.2.6, §3.3.2,
§3.5.2) conservent `subsec:reseau-cible`, `subsec:isolation-donnees` et leurs ancres.

**Labels cibles vérifiés avant emploi** (`grep -rn "\\label{...}"`) :
`subsec:reseau-cible` (`ch4:392`), `subsec:migration-reseau` (`ch5:631`), `sec:plan-validation`
(`ch6:279`), `subsec:isolation-donnees` (`ch4:773`), `subsec:delegation` (`ch4:1795`),
`sec:trente-trois-briques` (`ch2:488`), `subsec:incidents`, `ch:validation`, `ch:realisation`,
`ch:cadre-existant` — **tous existants**, `grep -ac undefined buildA.log` = 0.

**Quatre `Overfull \hbox` subsistent dans mon périmètre, tous antérieurs à mon intervention** et
tous dans des flottants : `ch3:363–368` (18,99 pt — c'est le `tikzpicture` de
`fig:dfd-frontieres` qui déborde, pas la légende), `ch3:477` et `ch3:482` (0,84 pt, en-tête de
`tab:frontieres-scenarios`, négligeable), `ch4:1521` (10,91 pt) et `ch4:1535` (4,69 pt) — les mots
« Enrichissement sémantique » et « Observabilité » dans la colonne `P{1.35cm}` de
`tab:conception-couches`. Les deux premiers relèvent de l'équipe figures ; les deux derniers se
règlent en portant la première colonne de 1,35 cm à 1,55 cm, au prix de 0,2 cm pris sur la colonne
« Contrôles apportés ». **Je ne l'ai pas fait** : toucher la largeur des colonnes de ce
`longtable` de 2,5 pages recompose deux pages entières, et il vaut mieux que ce soit fait après la
passe figures, quand la pagination du chapitre sera stabilisée.

**Contrôles de nomenclature** : aucun des quatorze termes interdits du registre d'audit
(« non exécuté », « reste à », « faute de temps », « à rejouer », « il faudrait », « on pourrait »,
« ce qui manque », « à confirmer »…) n'apparaît dans les deux fichiers après intervention ; aucun
paragraphe de prose de 15 lignes ou plus ne subsiste (le plus long, « Ce que la refonte ne ferme
pas », est ramené de 20 à 14 lignes) ; aucun titre ne porte de verbe conjugué ni de point final ;
aucun `\subsubsection` n'a été introduit ; les deux chapitres restent à six et sept `\section`.

---

## 9. Points de coordination avec les autres équipes

1. **Équipe ch. 6** — la correction C4-13 (É2 clos le 24/08/2026) est désormais **cohérente** avec
   `ch6:694`, que votre équipe a corrigé pendant cette session (« retirés le 24/08/2026 »). Rien à
   faire. La correction C4-14 (É4 clos le 15/08/2026) est nouvelle et n'est contredite nulle part :
   `É4` n'apparaît dans aucun autre fichier.
2. **Équipe figures** — trois livrables vous attendent : les trois libellés TikZ de F-4, les
   dix-neuf espaces insécables de §7 à préserver, et le débordement de 18,99 pt de
   `fig:dfd-frontieres` (§8). Les sept légendes ramenées au texte court (C4-17) sont volontaires :
   le cartouche interne « Ce que la figure démontre » est la version qui reste.
3. **Équipe bibliographie** — F-5 : `owasp2021` n'est plus citée nulle part depuis la correction
   de `ch3:694`. Décision à prendre sur son maintien ; recommandation : la conserver.
4. **Équipe qualité / passe finale** — F-1 (« six autorisations ») est la correction la plus
   importante qui reste, et elle est inter-chapitres : dix occurrences dans quatre fichiers, plus
   les deux documents sources. Elle demande d'abord un arbitrage de l'auteur sur l'état déployé.
5. **Coordinateur de vague** — les cibles de pages du brief ne sont pas atteignables sur ch3 et
   ch4 par le seul travail de rédaction (§6). Le chemin réaliste, dans l'ordre : passe figures
   (rang 1), puis restructuration B-1 avec déplacement de `fig:topologie-cible` (rang 2). Sans ces
   deux gestes, le plancher est de 10 p et 27 p.
