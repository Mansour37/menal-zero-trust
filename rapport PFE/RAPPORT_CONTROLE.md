# RAPPORT DE CONTRÔLE — passe qualité du 27/08/2026

**Cible :** `latex/main.pdf`, « Socle GCP sécurisé — Zero Trust, DevSecOps et détection enrichie par IA ».
**Périmètre :** application des passes P1-A, P1-B, P2-A, P2-B, P2-C, P3-A, P3-B, P4 du document
`MENAL_CONTROLE_QUALITE_PROMPTS.md`, puis contrôle P5.
**Date de référence du rapport :** 25/08/2026 (`\dateref`, inchangée).

## Verdict : PASS

Aucun écart bloquant. Le rapport compile sans erreur dans ses deux versions, aucun fait n'a été
modifié, aucune preuve n'a été fabriquée.

## 1. Compilation

| Sortie | Pages | Erreurs LaTeX | Références non résolues | Citations non résolues | Overfull hbox |
|---|---|---|---|---|---|
| `main.pdf` (remise) | 123 (numérotées 107) | 0 | 0 | 0 | 0 |
| `main_brouillon.pdf` (travail) | 127 | 0 | 0 | 0 | 0 |

Chaîne exécutée : XeLaTeX → Biber → XeLaTeX → XeLaTeX. Aucun `??` dans le document.
Les messages « Infinite glue shrinkage found in box being split » sont des avertissements ignorés
de `longtable`, présents sur des pages antérieures à cette passe (p. 8, 19, 24…) : comportement
préexistant, sans effet sur le rendu, vérifié page par page sur les tableaux modifiés.

## 2. Pagination

| Partie | Pages numérotées |
|---|---|
| Corps (introduction générale → conclusion générale) | 1 – 68 |
| Bibliographie | 69 |
| Annexes A à H | 72 – 106 |
| Formulaire de dépôt | 107 |

Le corps compte 68 pages, contre une quarantaine indiquée comme repère. L'écart est assumé et
**justifié explicitement en fin d'introduction générale**, chiffre à l'appui.

## 3. Contrôle des preuves — aucune fabrication

- Les **12 protocoles non exécutés** restent tous « non exécuté ». Aucun résultat, aucune valeur,
  aucun statut favorable ne leur est porté.
- Chacun des 12 dispose désormais d'un **attendu** formulé avant exécution (annexe E) et d'un
  **emplacement de capture réservé** (annexe H), avec critère de recevabilité et consigne de
  masquage : K01, K03, K10, K24, K25, K26, K27, K28, K29, K30, K31, K32.
- Le tableau des captures à produire (annexe H, tab. 47) compte 17 emplacements : les 12
  ci-dessus, plus K04 (chaîne d'infrastructure), K11 (T11), K12 (T7), K13 (T16) et K19
  (reconstruction chronométrée). *(K11, K12 et K13 se rattachent à des tests conformes ou
  partiels dont la trace n'est pas archivée.)*
- Aucune image n'a été produite ni insérée. Tous les cadres restent des emplacements.
- Les dix règles de production et de masquage de l'annexe H sont inchangées et s'appliquent aux
  nouveaux emplacements.

## 4. Contrôle de cohérence

| Point vérifié | Résultat |
|---|---|
| Aucun fait, chiffre ou date modifié par la passe | Conforme |
| Écarts É1 à É11 : statut identique partout | Conforme — É9 et É11 bien distincts, É2 tranché |
| Couches L1–L7 = 5 couches + 2 plans | Conforme (ch. 4 et conclusion générale) |
| Enrichissement toujours présenté « hors score » | Conforme (§5.6.2, §6.4.1, conclusion) |
| Bilan de campagne 3 / 5 / 0 / 12 | Inchangé |
| Nommage ELSON | Uniforme, 9 occurrences |
| Référentiel ATT&CK versionné | Conforme — identifié par empreinte, absence d'épinglage déclarée |
| Références croisées en français | Conforme (`\crefname` francisés, aucun « table »/« and » résiduel) |
| Listes figures / tableaux / graphiques dans la TdM | Conforme (p. xi, xiii, xv) |
| Numérotation « n / total » en bas à droite | Conforme |
| Pas de code dans le corps | Conforme (extraits en annexe B) |
| Maximes | ≤ 1 par chapitre |
| Schémas : collisions de libellés | Corrigées (fig. 5 et fig. 8), vérifiées au rendu |
| Schémas : moteur unique | Conforme — 17 figures TikZ, aucun rendu externe injecté |

## 5. Ce qui a été vérifié dans le code avant d'être écrit

Toute affirmation technique nouvelle a été confrontée aux sources du projet, non déduite :

| Affirmation | Source vérifiée |
|---|---|
| Passerelle de traduction d'adresses, journalisation restreinte aux erreurs | `terraform/modules/vpc/main.tf` |
| Sortie limitée aux plages privées, sauf tâche d'enrichissement | `terraform/modules/{cloud-run,dashboard,app-service,ml-pipeline}/main.tf` |
| Journalisation des refus du pare-feu collectée vers l'entrepôt | `terraform/modules/logging/main.tf` |
| Dix règles d'alerte, sonde sur `/health`, deux objectifs de service | `terraform/modules/monitoring/main.tf` |
| **Aucune** alerte de budget de facturation déclarée | Absence vérifiée sur l'ensemble de `terraform/` |
| Score = poids par gravité + prime si ≥ 2 tactiques | `api/app/routers/siem.py` |
| Neuf points d'entrée, même composant d'autorisation, un seul réservé à l'administrateur | `api/app/routers/siem.py` |
| Empreinte ATT&CK : 15 tactiques dont TA0005 « Stealth » et TA0112 « Defense Impairment » | `api/app/bigquery.py`, `scripts/load_attack_catalogue.py` |
| Catalogue non épinglé (branche courante du dépôt MITRE) | `scripts/load_attack_catalogue.py` |

## 6. Écarts restants

**Bloquants :** aucun.

**Majeurs :** aucun.

**Mineurs / à la main de l'auteur :**

1. **Les captures réelles restent à produire** (17 emplacements). Le texte se défend sans elles ;
   les insérer sous le nom `latex/figures/<IDENTIFIANT>.png` suffit, la macro les charge
   automatiquement.
2. **Épinglage de la version ATT&CK** : le script charge la branche courante. Le rapport le dit,
   mais la correction n'est pas faite dans le code.
3. **Retrait du sous-réseau public (É2) et de la table `pending_embeddings`** : décidés, non
   appliqués. Le rapport le dit ; l'application reste à faire côté infrastructure.
4. **Alerte de budget de facturation** : à déclarer avant de pouvoir rejouer T19.
5. **Test d'inventaire des routes de l'API** : le contrôle d'autorisation est partagé mais déclaré
   route par route ; le test qui garantirait qu'aucune route n'en soit dépourvue n'existe pas.

## 6 bis. Note sur le rendu des schémas

Le choix a été fait de **rester en TikZ** pour les 17 figures, contre l'option d'un rendu externe
(D2, Graphviz, PlantUML/C4, Structurizr — tous joignables depuis cette machine, via l'API Kroki ou
via Docker en local). Motif : ces moteurs donnent un meilleur routage automatique, mais embarquent
leurs propres polices et graisses. Or les figures actuelles héritent du Times, des gris et des
épaisseurs du document, et sont vectorielles à l'échelle du texte. Mélanger les deux rendus
produit un document visiblement fait en deux fois — la cohérence visuelle est un critère de
notation, et elle pesait ici plus lourd que le gain de routage.

Les deux défauts réels étaient des collisions de libellés, corrigées à la source. Si un besoin
d'auto-layout réapparaît (ajout de composants rendant le placement manuel intenable), la voie la
plus propre reste **Graphviz → PDF vectoriel via Kroki en local sous Docker** : c'est le seul
couple testé qui produise directement du PDF (D2 ne sort que du SVG via Kroki, et aucun
convertisseur SVG→PDF n'est installé — ni Inkscape, ni `rsvg-convert`, ni `cairosvg`, ni le
paquet `svg.sty`).

## 7. Estimation

Les angles d'attaque évitables ont été fermés : les six objectifs ne sont plus lus comme « six
partiels » alors que six dispositifs sont construits ; les douze protocoles ne se lisent plus
comme des travaux non faits ; le volet réseau, l'observabilité d'exploitation et le réflexe FinOps
sont désormais traités au lieu d'être absents ; la version du référentiel de détection est
identifiable ; les pages liminaires sont complètes.

Ce qui reste opposable au rapport relève de ce qui n'a pas été mesuré, et cela y est écrit,
nommé et daté à chaque fois. C'est une position défendable en soutenance, à condition d'assumer la
réponse : *le dispositif existe et fonctionne, la mesure reste à produire, et voici le protocole
qui la produira.*
