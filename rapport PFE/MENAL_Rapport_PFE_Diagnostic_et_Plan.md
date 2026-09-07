# Rapport PFE MENAL — Diagnostic, plan d'amélioration et prompt d'implémentation

**Objet :** rapport « Socle GCP sécurisé — Zero Trust, DevSecOps et détection enrichie par IA » (main.pdf, compilé le 16/08/2026, 128 pages physiques, 106 pages numérotées).
**Sources analysées :** main.pdf · 01_ARCHITECTURE_MENAL.md (état au 19/08/2026) · 02_SECURITE_AUDITS_ECARTS.md (registre vivant, état au 19/08/2026) · guide_reel_preuves_menal.html (preuves capturées le 23/08/2026) · Note pédagogique ESPRIT (consignes de forme et de contenu).
**Date de ce document :** 25/08/2026.

---

## 0. Comment lire ce document

Le document est organisé en 13 parties. Les parties 1 et 2 donnent le diagnostic et le point le plus sensible (le message « proche du temps réel »). Les parties 3 et 4 organisent le travail et la structure cible. Les parties 5 à 12 détaillent les corrections, la critique « jury », les recommandations par expertise, la langue, la forme LaTeX, les captures et les éléments à préparer. La partie 13 est le prompt final, prêt à être donné aux agents d'implémentation. Ce prompt est aussi fourni dans un fichier séparé (`PROMPT_FINAL_AGENTS.md`).

Trois règles ont guidé l'analyse :

1. **Le fond du projet n'est pas modifié.** Rien n'est ajouté qui ne soit pas dans les sources ; rien n'est retiré qui soit nécessaire à la compréhension.
2. **Les sources techniques (audits du 19/08, guide du 23/08) font foi sur l'état réel.** Le rapport a été compilé le 16/08 ; plusieurs statuts qu'il contient sont dépassés. Le rapport doit être aligné sur une date de référence unique.
3. **Un chiffre n'entre dans le rapport que s'il est mesuré et daté.** C'est déjà le principe affiché par le rapport (chapitre 6, « principe directeur ») ; il s'applique aussi au délai de 45 secondes.

---

## 1. Synthèse exécutive

### 1.1 Le rapport en chiffres

| Indicateur | Valeur constatée | Commentaire |
|---|---|---|
| Pages physiques / numérotées | 128 / 106 | 14 pages blanches (versos), 22 pages liminaires en chiffres romains |
| Corps du rapport (introduction → conclusion) | 74 pages | Consigne ESPRIT : « environ 40 pages hors annexes ». Cible proposée : 55–60 pages |
| Annexes | 30 pages (A à G) | Acceptable, à condition que chaque annexe soit appelée depuis le corps |
| Pages peu remplies (< 120 mots) | 36 (dont 14 blanches) | Versos blancs, placeholders de figures, tableaux mal coupés |
| Marqueurs « [À COMPLÉTER] » | 67 | Dont introduction, conclusion, résumé, abstract, service d'accueil, mission, planning, 14 captures, mesures du chapitre 6 |
| Encadrés « En attente de document source » | 6 | Dédicace, remerciements, résumé, abstract, extraits annexe B |
| Références « [réf. à ajouter] » dans le texte | 10 | Plus 10 entrées bibliographiques sans date de consultation |
| Tests de la campagne (T1–T20) | 20 « Non exécuté » | Alors que les sources datées du 19/08 et du 23/08 prouvent déjà une dizaine de mécanismes |
| Phrases de plus de 40 mots / de plus de 60 mots | 192 / 84 (sur 1 146) | Moyenne : 26 mots par phrase. Cible : ≤ 22 en moyenne, moins de 5 % au-delà de 40 mots |
| Tirets cadratins « — » | 494 | Marque d'un style trop littéraire ; à ramener sous 100 |

### 1.2 Ce qui est déjà solide

- **La démarche est exemplaire** : audit → carences → problématique → objectifs mesurables (O1–O6) → état de l'art → analyse de risque (EBIOS + STRIDE) → vingt exigences → matrice menace → exigence → contrôle → test → architecture → réalisation → mesures. Peu de rapports de PFE tiennent cette chaîne de bout en bout. Elle doit être conservée telle quelle.
- **La structure en six chapitres est proche de la structure attendue** (contexte, problème, état de l'art, besoins, conception, réalisation, tests/résultats). Il n'y a pas besoin de refonte lourde, mais d'un resserrage, de deux ajouts ciblés (fonctionnement de bout en bout, démonstration) et d'un alignement des statuts.
- **Les figures TikZ sont propres et lisibles** (modèle en couches, vue de déploiement, séquence, chaîne de livraison).
- **Le registre des écarts et le registre des décisions** sont des atouts majeurs devant un jury : ils montrent une maîtrise d'ingénieur, pas seulement une réalisation.
- **Les sources d'appui sont riches** : le rapport n'exploite pas encore plusieurs preuves réelles déjà disponibles (second locataire hébergé, rate-limit MFA vérifié par un 429, porte SAST bloquant 74 constats, retour arrière chronométré, scénario de bout en bout du 19/08, captures du 23/08).

### 1.3 Les huit risques majeurs devant un jury (par ordre de gravité)

| # | Risque | Où | Gravité |
|---|---|---|---|
| R1 | **Le message « détection → incident en moins de 45 s » n'est étayé par aucune mesure** ; les sources mesurent ~15 min entre l'attaque et la détection R2 | Demande de l'auteur, ch. 4 et 6 | Critique (voir partie 2) |
| R2 | **Vingt tests « non exécutés »** alors que le rapport promet une démonstration ; un jury lira « rien n'est validé » | ch. 6, tab. 30, annexe E | Critique |
| R3 | **Contradictions entre le rapport et l'état réel au 19/08** : politiques d'organisation annoncées mais inapplicables (pas d'organisation GCP), déploiement « par empreinte » alors que la CI déploie par étiquette SHA, trois environnements annoncés alors que seuls dev et staging existent, écarts É1/É3 présentés comme ouverts (état au 11/08) alors qu'ils sont corrigés et vérifiés le 19/08 | ch. 4, 5, 6 | Critique |
| R4 | **Le second locataire (preuve vivante du socle réutilisable) n'apparaît pas dans le rapport**, et la limite d'isolation réseau entre locataires (H6, jugée disqualifiante pour un client entreprise par le panel du 19/08) non plus | §5.9 | Élevée |
| R5 | **Statuts internes incohérents** : tab. 20 dit « export quantisé validé » alors que §5.6.1, §6.4.1 et annexe F.5 disent que la quantisation a été rejetée ; conclusion du ch. 4 parle du « septième » flux pour F6 et de « cinq couches » contre « sept couches » en §4.2.1 | ch. 4, 5, 6 | Élevée |
| R6 | **Style trop littéraire et moralisateur** (« n'est pas une architecture d'ingénieur mais une déclaration d'intention », « un système qui avoue ne pas savoir est plus utile qu'un système qui devine »), phrases très longues, 494 tirets cadratins ; le jury peut y voir un texte artificiel | Tous chapitres | Élevée |
| R7 | **Forme LaTeX** : liste des graphiques cassée, références croisées en anglais ou mal accordées (« Le table 2 », « tableau table 4 », « sections 1.4 and 1.5 »), tableaux coupés avec légende répétée, 36 pages peu remplies, titre coupé « Dev-SecOps » sur la page de garde | Tout le document | Moyenne |
| R8 | **Bibliographie incomplète** : 10 références annoncées et absentes, citation [3] (BERT, Devlin 2019) utilisée pour désigner le modèle spécialisé ATT&CK-BERT | ch. 2, 5, annexe F | Moyenne |

### 1.4 Verdict

Le rapport est à environ 70 % d'un très bon rapport de PFE. Les 30 % restants ne sont pas de la rédaction supplémentaire : ce sont un alignement sur l'état réel, une campagne de tests à exécuter, quelques mesures à relever, un resserrage de 15 à 20 pages, et une simplification de la langue. Le travail des agents porte sur la qualité, la structure et la cohérence ; les mesures manquantes et les choix de fond restent à l'auteur (liste en partie 11).

---

## 2. Point critique n°1 — le message « proche du temps réel » et le délai de 45 secondes

### 2.1 Ce que disent les sources

| Source | Extrait (reformulé) | Délai |
|---|---|---|
| 02_SECURITE, §10 « Scénario de bout en bout (19/08) » | 13 requêtes malveillantes envoyées entre 16:41:xx et 16:41:5x UTC ; 13/13 bloquées en 403 ; règle R2 déclenchée à 16:56:08 UTC | **~15 min** attaque → détection |
| guide_reel_preuves, plan P4 « Régie latence (confirmé) » | « R2 remonte 5–15 min après l'attaque (plancher BigQuery 5 min) » ; « blocage < 1 ms, corrélation en min » | **5–15 min** |
| 01_ARCHITECTURE, §5.3 | `enrich-job` toutes les 15 minutes ; démarrage à froid de `ml-embed` ~27 s en moyenne, pic ~94 s | **+0 à 15 min** détection → enrichissement |
| main.pdf, §5.6.2 et §6.3.3 | Cadence d'enrichissement 15 min, « ce qui borne mécaniquement le délai entre un événement et son rattachement sémantique » | idem |
| 01_ARCHITECTURE, §5.4 ; 02_SECURITE H8 | Le score d'incident est recalculé par l'API à la demande (`_score_incident`), à partir des seules détections | secondes (à la requête) |
| main.pdf, §6.5.1 | Tableau de bord : 11,5 s au premier accès, puis 1,1 s et 0,26 s à chaud | secondes |

Conclusion : **aucune source ne mesure un délai global de 45 secondes entre une attaque et un incident.** Le segment qui est effectivement rapide est « détection écrite → incident calculé et affiché » (l'API calcule l'incident à la requête, en quelques secondes, y compris avec un démarrage à froid). Le segment « attaque → détection » est de l'ordre de 5 à 15 minutes, par construction (requêtes planifiées, fenêtre glissante de 15 minutes, arbitrage de coût assumé, écart É5).

### 2.2 Pourquoi il ne faut pas écrire « moins de 45 secondes » sans mesure

- Le rapport pose lui-même la règle : « chaque mesure est soit une valeur réellement relevée et datée, soit une case explicitement ouverte — jamais une estimation présentée comme mesurée » (§6, principe directeur). Un « 45 s » non mesuré contredirait cette règle dans le chapitre qui l'énonce.
- Le jury dispose potentiellement des mêmes documents (audits, guide vidéo) ou verra la démonstration : la vidéo elle-même prévoit un « plan de coupe entre attaque et SOC » parce que la corrélation prend des minutes.
- Une seule question (« vous annoncez 45 secondes ; d'où vient ce chiffre ? ») suffirait à fragiliser tout le chapitre 6.

### 2.3 Formulation recommandée : un « budget de latence » en quatre étapes

Le message « le système fonctionne de manière proche du temps réel » est défendable **s'il est découpé par étape et chiffré**. Proposition de contenu pour une nouvelle section 4.4 (conception) reprise en §6.3.3 (mesure) :

| Étape | Ce qui se passe | Délai | Statut de la valeur |
|---|---|---|---|
| 1. Blocage | La requête malveillante est refusée au périmètre (WAF), avant d'atteindre l'application | Synchrone (< 1 ms de décision ; requête complète ≈ 0,3 s) | Mesuré (19/08, 23/08) |
| 2. Visibilité | Le blocage est journalisé et visible dans l'onglet journaux du tableau de bord | Quelques secondes à ~1 min (collecte en flux) | **À mesurer une fois** (horodatage du journal vs. horodatage d'insertion) |
| 3. Qualification | Une règle de détection agrège les blocages et écrit une détection (R1–R7), rattachée à une tactique/technique ATT&CK et au locataire | 5 à 15 min (requêtes planifiées, fenêtre glissante de 15 min) | Mesuré : 15 min le 19/08 |
| 4. Incident | L'API regroupe les détections par entité, calcule le score et affiche l'incident ; l'enrichissement sémantique est ajouté au cycle suivant | Secondes pour l'incident (à la requête) ; + 0–15 min pour l'enrichissement | Partiellement mesuré (11,5 s / 1,1 s / 0,26 s pour le tableau de bord) ; **segment « détection → incident » à mesurer et dater** |

Le texte du rapport dirait alors, en français simple : *« Le socle bloque immédiatement, rend le blocage visible en quelques secondes, et qualifie l'attaque en incident en un quart d'heure au plus. Ce délai de qualification est un choix de coût (§4.8, écart É5), pas une limite technique : il se réduirait en rapprochant la cadence des requêtes planifiées. »*

### 2.4 Décision à prendre par l'auteur (D-01)

Trois options, à choisir avant la phase 2 :

- **Option A (recommandée)** — Le rapport présente le budget de latence ci-dessus. Le chiffre « 45 s » n'apparaît que pour le segment « détection → incident affiché », **à condition qu'une mesure datée soit relevée** (par exemple : horodatage d'écriture de la détection dans BigQuery vs. première apparition de l'incident dans `/siem/incidents`). Sans cette mesure, le segment est décrit comme « quelques secondes, à la requête ».
- **Option B** — Si l'auteur dispose d'un chemin distinct qui ouvre réellement un incident de supervision en moins de 45 s (par exemple une politique d'alerte Cloud Monitoring « pic de blocages au périmètre » de la couche L7, qui ouvre un incident et notifie), ce chemin doit être décrit comme **une alerte de supervision (L7)**, distincte de la **détection SIEM (L5)**, avec une mesure datée. Les deux chemins figurent alors dans le budget de latence.
- **Option C** — Si aucune mesure n'est possible avant la remise, le rapport garde le budget de latence sans le chiffre 45 s. C'est la formulation la plus sûre.

Dans tous les cas, **les agents n'insèrent pas le chiffre 45 s de leur propre initiative**. Le prompt final contient cette règle.

---

## 3. Organisation du travail — experts et quatre phases

### 3.1 Les experts, leur rôle et leur priorité

| Priorité | Expert | Rôle dans ce projet | Phases |
|---|---|---|---|
| 1 | **Structuration du rapport** (chef d'orchestre) | Tient la structure cible, le budget de pages, le registre des corrections et la date de référence ; arbitre les conflits entre experts | 1, 2, 4 |
| 1 | **Réflexion critique / smart thinking** | Joue le jury : cherche les contradictions, les affirmations non prouvées, les questions piège ; valide chaque reformulation | 1, 3, 4 |
| 2 | **Cybersécurité** | Aligne le rapport sur le registre d'audits (H1–H15, M1–M24, L1–L15) ; corrige les tests T1–T20 ; vérifie qu'aucun contrôle n'est présenté comme acquis s'il ne l'est pas | 1, 2 |
| 2 | **Architecture** | Message « proche du temps réel » (budget de latence), cohérence couches/flux, écarts conception/implémentation, second locataire | 1, 2 |
| 3 | **Réseaux** | Segmentation réelle (identité vs réseau), journaux de refus, sortie contrôlée, isolation multi-locataires, rate-limiting | 2 |
| 3 | **Software engineering** | Chaînes de livraison (CI applicative, chaîne infra), porte SAST, déploiement par étiquette/empreinte, rollback, IaC et dérive | 2 |
| 3 | **Data** | Chaîne de détection (tables, écrivains uniques), règles, enrichissement, évaluation M0/M1/M2, versions ATT&CK, dénominateur de couverture | 2 |
| 4 | **Product ownership** | Objectifs O1–O6 et réponse point par point, preuve vivante du socle réutilisable, cohérence avec la démonstration de soutenance, décisions à faire prendre à l'auteur | 1, 2, 4 |
| 5 | **Pédagogie** | Français simple et naturel, feuilles de route de chapitre, définitions, transitions, exemples ; supprime le ton moralisateur | 3 |
| 6 | **LaTeX / qualité du document** | Références croisées, listes, flottants, pages blanches, budget de pages, bibliographie, page de garde, rendu final | 4 (et veille dès la phase 2) |
| 6 | **Captures d'écran** | Inventaire des emplacements, contenu attendu, existence réelle, légende, masquage | 2, 3 |

### 3.2 Les quatre phases

Le découpage suit les dépendances : on ne reformule pas un texte dont le fond va changer, et on ne met pas en forme un chapitre dont la longueur va bouger.

| Phase | Nom | Objectif | Entrées | Sorties | Experts |
|---|---|---|---|---|---|
| **1** | Cadrage et alignement sur le réel | Fixer la date de référence, valider la structure cible et le budget de pages, constituer le registre des corrections de fond (C01–C30), obtenir les décisions de l'auteur (D-01 à D-12) | main.tex, sources 01/02, ce document | `REGISTRE_CORRECTIONS.md` validé, `DECISIONS_AUTEUR.md`, sommaire cible figé | Structuration, smart thinking, cybersécurité, architecture, product |
| **2** | Restructuration et alignement du contenu | Appliquer les corrections de fond ; réorganiser les chapitres ; condenser (ch. 2, 3) ; ajouter les deux sections nouvelles (§4.4 bout en bout, §6.7 démonstration) et le second locataire ; mettre à jour la table des tests avec les preuves datées ; préparer les emplacements de captures | Phase 1 | Chapitres réécrits sur le fond, tab. 30 à jour, emplacements de captures normalisés | Cybersécurité, architecture, réseaux, software, data, product, captures |
| **3** | Pédagogie et langue | Simplifier le français, raccourcir les phrases, retirer les formules, ajouter feuilles de route et définitions ; passe « jury » question par question ; finaliser le plan de captures | Phase 2 | Texte final en français simple, `QUESTIONS_JURY.md`, `PLAN_CAPTURES.md` | Pédagogie, smart thinking, captures |
| **4** | Qualité du document et contrôle final | Corriger la forme LaTeX, tenir le budget de pages, réparer les listes, la bibliographie, les flottants ; compiler ; contrôle de conformité ESPRIT ; liste finale des éléments restant à fournir par l'auteur | Phase 3 | PDF final, `CHANGELOG_RAPPORT.md`, `A_COMPLETER_AUTEUR.md`, checklist ESPRIT cochée | LaTeX, structuration, product |

Règle de passage entre phases : une phase n'est close que si sa sortie a été relue par l'expert smart thinking et si aucune correction de fond n'est laissée « implicite ».

---

## 4. Structure cible du rapport

### 4.1 Budget de pages

La consigne ESPRIT indique « environ 40 pages hors annexes ». Le rapport actuel en compte 74 (hors pages liminaires et annexes), et il grandira d'environ 5 pages une fois l'introduction, la conclusion et les mesures rédigées. Ramener le corps à 40 pages supprimerait des éléments qui font la valeur du travail (matrice de traçabilité, registre des écarts, campagne de tests). La cible proposée est **55 à 60 pages de corps**, avec un maximum de 65 (décision D-11 pour l'auteur, en accord avec l'encadrant ESPRIT).

| Partie | Actuel | Cible | Levier principal |
|---|---|---|---|
| Pages liminaires | 22 | ≤ 14 | Supprimer les versos blancs (`openany`), réparer la liste des graphiques, listes compactes |
| Introduction générale | 1 (placeholder) | 2 | À rédiger en dernier |
| Ch. 1 Contexte, existant, problématique | 9 | 8 | Condenser §1.3.3 (renvoi annexe A), phrases plus courtes |
| Ch. 2 État de l'art | 8 | 6–7 | Fusionner §2.2.2 et §2.2.3, raccourcir §2.4.2 et §2.5 |
| Ch. 3 Besoins et menaces | 11 | 8 | Fusionner tab. 8 et 9 ; regrouper VM/BS/SR en un tableau de synthèse (détail en annexe C) ; §3.5 en une demi-page |
| Ch. 4 Conception | 10 | 9 | Ajouter §4.4 (bout en bout, 1 page) ; compacter tab. 22 en texte ; retirer les répétitions de §4.2.2 |
| Ch. 5 Réalisation | 15 | 12 | Retirer les blancs autour des placeholders ; condenser §5.2.2 et §5.6.1 ; ajouter §5.9 second locataire (0,7 page) ; planning sur une page pleine |
| Ch. 6 Validation et démonstration | 14 | 10–11 | Supprimer les pages à moitié vides ; tab. 30 mise à jour ; ajouter §6.7 (1 page) |
| Conclusion générale | 1 (placeholder) | 2 | À rédiger en dernier |
| **Corps total** | **74** | **57–60** | |
| Bibliographie | 2 | 2 | Compléter |
| Annexes | 30 | ≤ 28 | Retirer les blancs ; annexe A.2 à compléter (déplacement depuis ch. 2) |

### 4.2 Sommaire cible (avec correspondance ancien → nouveau)

Le sommaire actuel est conservé dans son esprit. Les changements sont : deux sections nouvelles (**4.4** et **6.7**), une section enrichie (**5.9**), des fusions dans les chapitres 2 et 3, et une renumérotation du chapitre 4.

```
Pages liminaires : page de garde · dédicace · remerciements · résumé + mots-clés · abstract + keywords
                   · liste des acronymes · table des matières · liste des figures · liste des tableaux
                   · liste des graphiques (réparée)

Introduction générale (2 p.) — sujet, problème (sans résultat), démarche, objectifs, annonce des chapitres

Chapitre 1 — Contexte du projet, étude de l'existant et problématique (8 p.)
  1.1 Cadre du projet : entreprise, service d'accueil, mission et rôle          [inchangé ; 1.1.2 et 1.1.3 à compléter par l'auteur]
  1.2 Étude de l'existant : application pilote, méthode et résultats de l'audit  [inchangé]
  1.3 Critique de l'existant : cinq carences, application vs socle, positionnement [1.3.3 condensé, renvoi annexe A.1.2]
  1.4 Problématique, questions dérivées, objectifs et critères de succès        [inchangé ; c'est le contrat du rapport]
  1.5 Périmètre, contraintes et démarche                                        [inchangé ; phases P0–P4 datées]
  Conclusion du chapitre

Chapitre 2 — État de l'art et choix technologiques (6–7 p.)
  2.1 L'architecture Zero Trust                                                 [inchangé]
  2.2 L'approche DevSecOps                                                      [2.2.2 + 2.2.3 fusionnés]
  2.3 Supervision et ingénierie de la détection                                 [inchangé ; détail comparatif en annexe A.2 à compléter]
  2.4 Enrichissement sémantique des alertes                                     [2.4.2 raccourci ; références ajoutées]
  2.5 Méthodes d'analyse de risque                                              [raccourci d'un tiers]
  2.6 Verrous identifiés et positionnement de la contribution                   [inchangé]
  Conclusion du chapitre

Chapitre 3 — Analyse des besoins et modélisation des menaces (8 p.)
  3.1 Acteurs et cas d'utilisation                                              [tab. 8 + 9 fusionnés ; fig. 2 conservée]
  3.2 Besoins fonctionnels et non fonctionnels                                  [conservés, mise en page compacte]
  3.3 Analyse de risque : valeurs métier, sources de risque, scénarios          [tab. 13/14/15 → un tableau de synthèse ; détail annexe C]
  3.4 Exigences de sécurité et matrice de traçabilité                           [inchangé : pièce centrale]
  3.5 Rattachement aux référentiels                                             [une demi-page]
  Conclusion du chapitre

Chapitre 4 — Conception de l'architecture (9 p.)
  4.1 Principes directeurs                                                      [inchangé, phrases raccourcies]
  4.2 Architecture générale : modèle en couches, plans transversaux, déploiement [4.2.2 raccourci]
  4.3 Vue dynamique : les sept flux                                             [inchangé]
  4.4 NOUVEAU — De l'attaque à l'incident : fonctionnement de bout en bout et budget de latence (1 p. + 1 figure)
  4.5 Conception par couche                                                     [ex-4.4 ; tab. 20 corrigée (L6)]
  4.6 Le plan d'identité                                                        [ex-4.5 ; C04 sur les politiques d'organisation]
  4.7 Couverture des exigences                                                  [ex-4.6 ; tab. 22 compactée]
  4.8 Décisions d'architecture et composants écartés                            [ex-4.7]
  4.9 Écarts entre conception et implémentation                                 [ex-4.8 ; tab. 25 mise à jour au 19/08 ; nouvel écart É7]
  Conclusion du chapitre                                                        [C17 corrigé]

Chapitre 5 — Réalisation et industrialisation (12 p.)
  5.1 Environnement de travail                                                  [C06 : deux environnements réels, prod cible]
  5.2 Infrastructure as code                                                    [5.2.2 condensé ; lock de versions désormais versionné]
  5.3 Chaîne de livraison applicative                                           [C05, C09 ; figures 7–9 = captures réelles]
  5.4 Chaîne de provisionnement de l'infrastructure                             [C13 : plan/apply manuels]
  5.5 Chaîne de détection                                                       [C02 : encadré É1 mis à jour ; C18]
  5.6 Couche d'enrichissement sémantique                                        [inchangé ; C19]
  5.7 Interface de supervision                                                  [C29 rôles réels ; C14/C15 MFA]
  5.8 Boucle entre livraison et détection                                       [inchangé]
  5.9 Accueil d'un second locataire : preuve vivante et limites                 [C07 : enrichi]
  5.10 Conduite du projet : déroulement, difficultés (4 incidents), changements, planning [C09, C23 ; Gantt pleine page]
  Conclusion du chapitre

Chapitre 6 — Validation, résultats et démonstration (10–11 p.)
  6.1 Stratégie de validation                                                   [inchangé]
  6.2 Campagne des vingt tests                                                  [tab. 30 mise à jour avec les preuves datées ; C24]
  6.3 Évaluation de la détection : couverture, angles morts, délais             [C18 ; 6.3.3 = budget de latence mesuré]
  6.4 Évaluation de l'enrichissement sémantique et de la boucle F6              [inchangé ; mesures à fournir]
  6.5 Performance, résilience et coût                                           [C10, C11 ; coût à fournir]
  6.6 Conformité aux référentiels                                               [inchangé]
  6.7 NOUVEAU — Démonstration du fonctionnement global (1 p.)                    [C28 : scénario mesuré du 19/08 + correspondance avec les cinq preuves de soutenance]
  6.8 Limites et menaces à la validité                                          [ex-6.7]
  6.9 Réponse aux objectifs du projet                                           [ex-6.8]
  Conclusion du chapitre

Conclusion générale (2 p.) — récapitulation, résultats chiffrés, problèmes rencontrés, apports, perspectives
Bibliographie / Netographie
Annexes A–G (inchangées dans leur rôle) + Annexe H (optionnelle) — feuille de démonstration de soutenance
Page de validation du dépôt
```

### 4.3 Pourquoi cette organisation

- Elle respecte la progression demandée : **contexte → problème → architecture → conception → implémentation → tests → résultats → démonstration**. L'état de l'art et l'analyse des besoins restent entre le problème et l'architecture, car ils justifient les choix ; un jury ESPRIT les attend à cet endroit.
- La section **4.4** est l'endroit naturel pour faire comprendre le fonctionnement « proche du temps réel » : elle vient juste après les sept flux (ce qui existe) et raconte ce qui se passe quand une attaque arrive (ce qui se passe, avec des délais). Le chapitre 6 en reprend les valeurs mesurées.
- La section **6.7** donne au jury la « démonstration du fonctionnement global » demandée, avec le scénario réellement chronométré du 19/08 (13 requêtes → 13 blocages → détection R2 à +15 min, technique T1498, locataire attribué). C'est aussi le pont avec la vidéo de soutenance, sans que celle-ci ne change le rapport.
- Le chapitre 3 est le plus dense en tableaux (11 tableaux en 11 pages) ; c'est là que le gain de pages est le plus facile sans perte de fond, en renvoyant le détail en annexe C.

### 4.4 Ce qui est retiré, fusionné ou déplacé

| Élément | Action | Raison |
|---|---|---|
| Tab. 8 (acteurs légitimes) et tab. 9 (acteurs hostiles) | Fusionner en un tableau à deux blocs | Même fonction, une page gagnée |
| Tab. 13 (valeurs métier), 14 (biens supports), 15 (sources de risque) | Remplacer par un tableau de synthèse « valeur → bien support → source de risque → scénario stratégique » ; détail en annexe C | Trois tableaux coupés sur deux pages chacun ; le lecteur perd le fil |
| Tab. 22 (couverture des exigences) | Remplacer par deux phrases + liste des trois exigences partielles | 20 lignes pour dire « 17 complètes, 3 partielles » |
| §2.2.2 provenance et §2.2.3 référentiels | Fusionner en « 2.2.2 Provenance et référentiels » | Deux demi-sections |
| §4.2.2 « justification des deux plans transversaux » | Réduire de moitié | L'argument est déjà dans §4.1 (P2) et dans la conclusion |
| Formules et maximes (voir partie 8) | Garder au plus une par chapitre | Ton |
| Paragraphes « ce que ce chapitre a montré » en fin de chapitre | Garder, mais 8–10 lignes maximum | Actuellement 15–25 lignes, redondants avec le corps |
| Annexe A.2 (état de l'art détaillé) | À compléter depuis le chapitre 2 (comparaison des cinq solutions de supervision, modes d'exécution) | Annoncée, vide |
| Pages blanches de verso | Supprimer (`openany`) sauf si l'encadrant exige recto-verso strict | 14 pages |

---

## 5. Registre des corrections de fond (C01–C30)

Chaque ligne indique la contradiction ou le manque, la source qui fait foi, et la correction. Les corrections marquées **[auteur]** dépendent d'une décision ou d'une donnée que seul l'auteur possède.

| ID | Constat | Source qui fait foi | Correction à appliquer | Gravité |
|---|---|---|---|---|
| C01 | Le rapport mélange des états au 11/08, au 16/08 et parfois postérieurs ; les statuts des écarts ne sont pas cohérents entre tab. 25, tab. 34, §6.2.2 et la conclusion du ch. 5 | Toutes | Fixer **une date de référence unique** (proposée : date de la dernière mesure, au plus tôt le 19/08/2026, ou la date des captures 23/08) ; l'indiquer en §6.1 et en note de bas de page du tab. 25 ; harmoniser tous les statuts | Critique |
| C02 | Écart É1 (journaux de refus pare-feu/NAT non activés) présenté comme « assumé » ; T20 présenté sans trace possible | 02_SECURITE H2 (corrigé en code le 19/08, apply confirmé §8.1 : `log_config` actif sur `deny_all_ingress`, NAT en `ERRORS_ONLY`, flow logs échantillonnés 0,5) | Passer É1 en « Corrigé le 19/08/2026, vérifié par `terraform plan` sans différence » ; mettre à jour l'encadré §5.5.1, tab. 25, tab. 31 (cause « refus réseau non journalisés » retirée ou datée), tab. 34, protocole T20 (la trace est désormais attendue), §6.2.2 | Critique |
| C03 | Écart É3 (identité partagée du service d'encodage) : « à combler, prioritaire » en tab. 25, « corrigé, vérifié » en tab. 34 | 02_SECURITE H1, §8.1 (`sa-ml-embed` créé le 19/08, seul rôle `logging.logWriter`, binding projet retiré, vérifié par `terraform state show`) | Un seul statut : « Corrigé le 19/08/2026, vérifié » ; T5/T11/T14 : préciser que la correction est vérifiée dans l'état d'infrastructure, rejeu formel à consigner | Critique |
| C04 | Le rapport affirme « trois politiques d'organisation qui rendent structurellement impossibles trois classes d'erreurs » (§5.1.1) et « une politique du fournisseur interdisant la création de clés » (§4.5.2, T7) | 02_SECURITE H10 : pas d'organisation GCP (projet personnel), donc `iam.disableServiceAccountKeyCreation` **n'est pas en vigueur** ; le test `test_t6_sa_key_creation_blocked_check` est un `pass` vide | Reformuler : les trois politiques sont **définies dans le code d'infrastructure mais inapplicables sans organisation GCP** ; ajouter l'écart **É7** (tab. 25) ; la garantie « aucune clé » repose sur l'inventaire (vide) et sur la fédération WIF ; réviser le critère de T7 (inventaire vide = conforme ; interdiction de création = non applicable, à reprendre lors du rattachement à une organisation) | Critique |
| C05 | « Déploiement par empreinte cryptographique, jamais par étiquette » (§4.2.3, §4.5 L3, §5.3.1, T9) | 02_SECURITE M10 ; 01_ARCHITECTURE UC4/§4.5 : la CI déploie par **étiquette égale au SHA du commit** ; l'empreinte n'est résolue que par le chemin Terraform (reconstruction/DR) | Reformuler partout : « déploiement par étiquette immuable égale au SHA du commit (traçable au commit), l'empreinte étant résolue lors des reconstructions Terraform » ; réécrire le critère de T9 (déploiement depuis un registre externe → refus ; le second cas « par étiquette au lieu d'empreinte » est retiré) | Critique |
| C06 | « Trois environnements correspondent à trois projets cloud distincts » (§1.5.1, §5.1.1, tab. 26) | 01_ARCHITECTURE §1.6 : seuls `dev` et `staging` existent, `prod` est une cible non provisionnée ; 02_SECURITE M15 : `dev` n'est pas un miroir fidèle de `staging` | Tab. 26 : colonne « Existence » (dev : existe, réduit ; recette/staging : existe, référence ; production : cible non provisionnée) ; §6.1 rappelle que les mesures sont faites sur la recette | Critique |
| C07 | §5.9 dit que la généralisation multi-application « a été réalisée » sans nommer la preuve ni les limites | 01_ARCHITECTURE UC7 ; 02_SECURITE H6, H7, M16, M19, §10 | Réécrire §5.9 : second locataire accueilli le 07/08/2026 (compte de service dédié, base et utilisateur dédiés, secrets et espace média chiffrés par clé gérée, 6 alertes, contrôle quotidien d'isolation SQL, connexion croisée réellement tentée et refusée le 19/08) ; puis les limites : isolation **applicative et par identité, pas réseau** (VPC, connecteur et instance SQL partagés ; règle `allow_internal` trop large), clé de locataire partielle dans les tables SIEM, module base de données non réinstanciable — « seuil à franchir avant un troisième locataire » | Élevée |
| C08 | Confusion possible entre « ELSON » (application pilote, ch. 1) et « Elson » (second locataire, sources) | 01_ARCHITECTURE en-tête et §1.1 | **[auteur, D-02]** : préciser si le second locataire est l'application pilote hébergée sur le socle ou une organisation distincte ; adopter un nommage unique dans tout le rapport (proposition : « application pilote » et « second locataire ») | Élevée |
| C09 | Porte SAST présentée comme bloquante depuis l'origine (§5.3.1, fig. 8) | 02_SECURITE H12/H15, §7.1, §9 : porte Semgrep silencieusement cassée du 02/08 au 19/08 (faux vert), corrigée le 19/08 (`semgrep scan --error`), vérifiée en CI réelle (PR #17 : 74 constats bloquants) | Ajouter un 4e incident en §5.10.2 (« porte de contrôle en faux vert ») avec la leçon (une porte doit être testée en échec) ; fig. 8 = capture réelle du blocage (74 constats, code de retour 1) ; T8/T10 inchangés | Élevée |
| C10 | « Le retour arrière applicatif … n'a jamais été testé ni chronométré » (§6.5.2) | 01_ARCHITECTURE UC8 : bascule vers une révision précédente en 11,6 s, retour en 16,5 s (démarrage à froid observé) | Corriger §6.5.2 et tab. 36 (O6) ; préciser « pas de déploiement progressif automatique » | Élevée |
| C11 | Restauration PITR (tab. 32) sans mention de la configuration | 01_ARCHITECTURE UC6 : mesure du 03/08 sur configuration zonale, avant la bascule HA régionale du 08/08 (D13) ; configuration Terraform confirmée conforme aux mesures (02_SECURITE §4.2) | Ajouter la précision « mesuré sur l'ancienne configuration zonale ; à revalider sur la configuration régionale » | Moyenne |
| C12 | T1 attend « toutes les requêtes rejetées » | 02_SECURITE H13, §7.2 : SQLi/XSS/fichiers sensibles bloqués (403) ; un motif de traversée de répertoire envoyé brut renvoie 302 | T1 → « Partiellement conforme (réserve H13, risque réel jugé faible, non corrigé) » ; ajouter la ligne à tab. 31 et tab. 34 | Élevée |
| C13 | §5.4 décrit une chaîne d'infrastructure à cinq étapes avec approbation obligatoire | 01_ARCHITECTURE UC5 : `plan`/`apply` restent un geste manuel ; scan IaC en CI ; F7 partiel | Reformuler : validation et scan IaC automatisés à chaque demande de fusion ; `plan` publié et revu ; `apply` exécuté manuellement par l'administrateur (approbation humaine par construction, non outillée) ; T18 → « partiellement conforme » ou critère révisé | Élevée |
| C14 | Rate-limiting MFA absent du rapport | 02_SECURITE H3, §8.1 : `/auth/mfa/verify|enable|disable` ajoutés aux chemins protégés ; test réel : 10 réponses 422 puis un **429** | Mentionner en §5.7 (ou annexe D, L1) ; utiliser comme preuve datée pour T2 | Moyenne |
| C15 | Secret MFA stocké en clair, puis chiffré | 02_SECURITE H4 (chiffrement Fernet, migration, vérifié le 19/08) | Une phrase en §5.7 ; optionnel mais utile pour montrer l'exploitation réelle | Faible |
| C16 | Tab. 20, ligne L6 : « export quantisé validé » | main.pdf §5.6.1, §6.4.1, annexe F.5 ; 01_ARCHITECTURE §5.2 : quantisation **rejetée** (0/5 correspondances de premier rang), modèle exact fp32 livré | Corriger la ligne L6 : « modèle figé, quantisation testée et rejetée, service d'encodage sans sortie » | Élevée |
| C17 | Conclusion ch. 4 : « le septième [flux] … relie les vulnérabilités » (c'est F6) ; « cinq couches et deux plans » vs « sept couches numérotées » (§4.2.1) | main.pdf | Écrire « le sixième flux (F6) » ; harmoniser : « sept niveaux numérotés L1–L7, soit cinq couches et deux plans transversaux » partout | Élevée |
| C18 | Tab. 31 (causes de non-couverture) incomplète | 02_SECURITE H9, M8, M5, H11, L10 : aucune détection d'exfiltration, aucune détection d'abus IAM / plan de contrôle, seuils codés en dur, pas de test unitaire par règle | Ajouter ces causes ; le message « 7 règles, uniquement du filtrage HTTP/WAF » doit être explicite | Élevée |
| C19 | Enrichissement non joint au score : le rapport le dit, mais laisse la décision ouverte | 02_SECURITE H8 (décision ADR en attente) | **[auteur, D-03]** : trancher (« informationnel assumé » ou « jointure au score ») et l'écrire comme décision datée | Élevée |
| C20 | Référence [3] (Devlin et al., BERT) citée pour « modèle de représentation de phrases spécialisé en cybersécurité » (§5.6.1, tab. 49) ; 10 références « à ajouter » ; dates de consultation manquantes | Bibliographie | Citer ATT&CK-BERT/SMET (Abdeen et al.) pour le modèle ; ajouter NIST SP 1800-35, OWASP Top 10:2025, CIS GCP Benchmark, Sigma, SecureBERT, Sentence-BERT, SMET 2023 et 2024, Shostack (STRIDE), ANSSI EBIOS RM, ISO/IEC 27005 ; dates de consultation | Moyenne |
| C21 | « Journaux d'audit du fournisseur activés » (L7, T13) | 02_SECURITE M7 : journaux d'accès aux données générés mais non centralisés (rétention par défaut 30 j) | Préciser : journaux d'activité administrateur centralisés ; journaux d'accès aux données non centralisés (écart assumé) ; T13 vise les journaux d'activité administrateur | Moyenne |
| C22 | Angle mort du plan de contrôle | 02_SECURITE M8 | À intégrer à C18 | — |
| C23 | Chronologie serrée et non expliquée (audit 29/07, restauration 03/08, second locataire 07/08, HA 08/08, audits 11/08–19/08, captures 23/08) | Toutes | **[auteur, D-04]** : dates réelles de début et de fin de stage, des phases P0–P4 ; le Gantt doit être cohérent avec toutes les dates citées dans le texte | Élevée |
| C24 | 20 tests « non exécutés » | 02_SECURITE §7, §8, §10 ; guide vidéo annexe A | Appliquer la table de correspondance preuves ↔ tests (partie 7.1) ; **[auteur, D-05]** exécute le reste avec captures | Critique |
| C25 | Coût mensuel non ventilé | — | **[auteur, D-07]** : coût par poste sur un mois de recette ; l'anomalie « 78 Go/j facturés pour 24 Mo » doit avoir un statut à la date de référence | Élevée |
| C26 | La liste des tableaux commence à « 2 » | LaTeX | Un tableau consomme le numéro 1 sans apparaître dans la liste (probablement les acronymes) ; le passer hors numérotation (`\caption*` ou environnement non flottant) | Faible |
| C27 | Le message « proche du temps réel » n'apparaît nulle part sous forme de chaîne chronométrée | Partie 2 | Créer §4.4 (conception) + §6.3.3 (mesure) selon le budget de latence ; règle sur le chiffre 45 s | Critique |
| C28 | Aucune démonstration du fonctionnement global n'est présentée | 02_SECURITE §10 | Créer §6.7 avec le scénario chronométré du 19/08 et la correspondance avec les cinq preuves de soutenance | Élevée |
| C29 | Rôles du tableau de bord : « administrateur, analyste, utilisateur » (§5.7) | 02_SECURITE L1 : rôles réels `admin`, `viewer`, `service` | Harmoniser (« administrateur, lecteur/analyste, service ») ou expliquer la correspondance en une phrase | Faible |
| C30 | Cadence des règles de détection : le rapport dit « 15 min » ; les sources parlent de « cadence scheduler 5 min + latence » et de « fenêtre glissante 15 min » | 01_ARCHITECTURE §4.4 ; 02_SECURITE E14, §10 | **[auteur, D-06]** : confirmer la cadence exacte des requêtes planifiées et la fenêtre ; écrire « requêtes planifiées toutes les X min sur une fenêtre glissante de 15 min ; enrichissement toutes les 15 min » | Élevée |

---

## 6. Analyse critique « jury »

### 6.1 Lecture chapitre par chapitre

Légende des catégories demandées : **D** difficile à comprendre · **L** trop long · **I** inutile · **E** insuffisamment expliqué · **O** mal organisé · **Q** provoque une question en soutenance.

**Pages liminaires**
- **I/O** : le résumé et l'abstract sont vides ; le jury lit ces pages en premier. À rédiger en dernier, mais à prévoir avec les chiffres réels (voir partie 11).
- **O** : la liste des acronymes précède la table des matières et tient sur deux pages (la seconde contient une seule phrase de renvoi au glossaire). Placer le renvoi en note sous le tableau.

**Introduction générale** — vide. **Q** garantie si elle reste un placeholder. Cinq mouvements attendus (note ESPRIT) : sujet, problème sans résultat, démarche, objectifs, annonce des chapitres.

**Chapitre 1**
- **E** : §1.1.2 (service d'accueil) et §1.1.3 (mission, rôle de l'élève-ingénieur) sont vides. La note ESPRIT en fait le « gros du travail » (quelle était la mission, l'a-t-il résolue, par quels moyens). **Q** : « Quel était votre rôle exactement, qu'avez-vous fait vous-même ? »
- **D** : la question centrale (§1.4.1) fait 6 lignes en une phrase. La couper en deux.
- **L** : §1.3.3 (positionnement des trois modèles) est doublé par l'annexe A.1.2 ; garder le tableau à quatre lignes et deux phrases.
- **Q** : « L'audit date du 29 juillet ; la restauration mesurée du 3 août ; où sont les semaines de conception ? » → D-04.

**Chapitre 2**
- **L** : bon chapitre, mais 8 pages pour un état de l'art « sans contribution théorique » (§2.6.2). Ramener à 6–7.
- **E** : §2.3.2 dit que Sigma est utilisé comme format, mais le projet n'a aucun fichier Sigma : les règles sont écrites directement en SQL (02_SECURITE H5). Dire simplement : « les règles sont écrites directement dans le langage de l'entrepôt, selon le gabarit d'une règle Sigma (source, condition, fenêtre, faux positifs, technique) ». **Q** : « Pourquoi parler de Sigma si vous n'avez aucune règle Sigma ? »
- **E** : 10 références annoncées manquent (C20).

**Chapitre 3**
- **L/O** : 11 tableaux en 11 pages, plusieurs coupés sur deux pages avec légende répétée (tab. 10, 12, 13, 15). Le fil se perd entre les acteurs, les valeurs métier et les sources de risque.
- **D** : les sept scénarios stratégiques sont en liste ; les vingt-quatre scénarios opérationnels sont en annexe C ; la cartographie du risque aussi. Le lecteur du corps ne voit jamais un scénario concret. Garder **un** exemple complet dans le corps (SO12, secret versionné, seul scénario critique de vraisemblance forte, qui correspond au point bloquant B2).
- **Bien** : la matrice (tab. 17) est la pièce maîtresse ; ne pas y toucher.

**Chapitre 4**
- **E** : le lecteur ne sait pas ce qui se passe *dans le temps* quand une attaque arrive. C'est l'objet de la nouvelle §4.4.
- **O** : §4.2.2 répète le principe P2 de §4.1 ; la conclusion le répète encore. Une seule fois suffit.
- **E** : tab. 25 (écarts) est datée du 11/08 et dépassée (C02, C03) ; il manque l'écart des politiques d'organisation (C04) et le déploiement par étiquette (C05).
- **Q** : « Vous parlez de Zero Trust et de micro-segmentation par l'identité ; vos deux locataires partagent le VPC, le connecteur et l'instance SQL. Que se passe-t-il si l'un est compromis ? » → C07.
- **Q** : « Vos politiques d'organisation : vous n'avez pas d'organisation GCP. » → C04.

**Chapitre 5**
- **L/O** : 15 pages, dont quatre figures vides (7 à 10) qui laissent des demi-pages blanches, une page de Gantt vide et §5.10.1 vide.
- **E** : §5.4 (chaîne d'infrastructure) décrit une chaîne plus automatisée que la réalité (C13).
- **E** : §5.9 (généralisation) est la meilleure preuve du projet et ne dit rien de concret (C07).
- **I** : §5.2.2 (dérive) redit l'incident du chapitre 4 ; §5.10.2 le redit une troisième fois. Raconter l'incident une fois (ch. 5, difficultés) et y renvoyer.
- **Q** : « Votre porte SAST bloque-t-elle vraiment ? » → C09 (et c'est une bonne histoire à raconter).
- **Q** : « Comment gérez-vous les faux positifs ? Vos seuils sont codés en dur. » → C18, limite assumée.

**Chapitre 6**
- **Critique** : « 0 conforme, 20 non exécutés ». Même si le texte explique honnêtement pourquoi, un jury retiendra l'absence de validation. Voir la table de correspondance (partie 7.1) : une dizaine de tests ont déjà une preuve datée ; le reste doit être exécuté avant la remise.
- **O** : pages 60 et 65 quasi vides ; §6.5 commence en bas de page 66 sans contenu.
- **E** : §6.3.3 (délais) doit devenir la mesure du budget de latence (partie 2).
- **E** : le scénario de bout en bout du 19/08 (13 requêtes → 13 blocages → R2 à +15 min) n'apparaît pas : c'est pourtant la démonstration la plus parlante du projet (C28).
- **Q** : « Combien coûte le socle par mois ? » (tab. 33 incomplet) · « Combien de temps pour reconstruire un environnement ? » (O2 non mesuré) · « Quel est le gain de l'enrichissement ? » (O5 non mesuré, résultat négatif admis par avance : le dire).

**Conclusion générale** — vide. **Q** garantie.

**Annexes**
- A.2 vide (annoncée depuis le chapitre 2).
- B.2 et B.4 demandent des extraits réels (10–15 lignes), non encore fournis.
- C, D, E, F sont bien faites ; E et F sont à compléter avec les résultats.
- G (glossaire) : utile, à garder ; y ajouter « locataire (tenant) », « requête planifiée », « fenêtre glissante », « porte bloquante », « démarrage à froid ».

### 6.2 Dix-huit questions probables du jury et la réponse à préparer dans le rapport

| # | Question | Où le rapport doit répondre | Réponse à préparer |
|---|---|---|---|
| 1 | Qu'avez-vous fait vous-même, par rapport à l'application existante ? | §1.1.3, §1.3.2 | Le code applicatif est hors périmètre ; le socle (infrastructure, chaînes, détection, tableau de bord) est entièrement l'œuvre de l'élève-ingénieur |
| 2 | Quel est le délai entre une attaque et l'alerte ? | §4.4, §6.3.3 | Budget de latence : blocage immédiat, visibilité en secondes, qualification en 5–15 min (choix de coût), incident calculé en secondes, enrichissement au cycle suivant |
| 3 | Vos vingt tests ne sont pas exécutés : qu'avez-vous validé ? | §6.2 | Table mise à jour : tests conformes avec preuve datée, tests partiels avec réserve nommée, tests restants exécutés avant la remise |
| 4 | Zero Trust, mais un seul VPC pour deux locataires ? | §5.9, §6.8 | Isolation par identité, secrets, base et utilisateur dédiés, contrôle quotidien ; isolation réseau non réalisée : seuil avant un troisième locataire |
| 5 | Vous citez des politiques d'organisation : avez-vous une organisation GCP ? | §4.6, §4.9 (É7) | Non ; les politiques sont écrites dans le code, inapplicables tant que le projet n'est pas rattaché à une organisation ; l'absence de clés est vérifiée par inventaire |
| 6 | Déployez-vous par empreinte ou par étiquette ? | §5.3.1 | Par étiquette immuable égale au SHA du commit ; empreinte résolue à la reconstruction ; passage au digest strict en perspective |
| 7 | Pourquoi « Sigma » sans règle Sigma ? | §2.3.2, §5.5.2 | Gabarit Sigma, traduction manuelle en SQL ; le nom a été retiré du produit (H5) |
| 8 | À quoi sert ATT&CK-BERT si le score ne l'utilise pas ? | §5.6.2, §6.4, D-03 | Rattachement informationnel par détection (technique + deux alternatives) ; décision datée sur la jointure ; gain mesuré M0/M1/M2 (ou mesure en attente) |
| 9 | Combien de temps pour reconstruire un environnement depuis le dépôt ? | §6.5.2 | Mesure chronométrée (à faire) ; retour arrière mesuré : 11,6 s / 16,5 s ; restauration : 32 min 45 s, RPO 0 |
| 10 | Combien ça coûte par mois ? | §6.5.3 | Ventilation par poste, anomalies datées, comparaison avec la solution commerciale écartée |
| 11 | Comment traitez-vous les faux positifs ? | §6.3, §6.8 | Seuils codés en dur, pas de trafic réel : limite assumée ; taux d'alertes non rattachées affiché |
| 12 | Que ne détectez-vous pas ? | §6.3.2 | Exfiltration, abus IAM, plan de contrôle, comportements non HTTP : dits explicitement |
| 13 | Le WAF a laissé passer un motif de traversée de répertoire. | §6.2 (T1), §6.8 | Réserve H13 documentée, risque réel faible, correction en perspective |
| 14 | Pourquoi BigQuery plutôt qu'un SIEM ? | §2.3.1, §2.3.4 | Coût aligné au volume, détection en code, recherche vectorielle sans base dédiée ; prix : règles et interface à construire |
| 15 | Données d'identité et biométriques : et le RGPD ? | §1.5.1, §5.5.1 | Hors périmètre juridique ; rétention 90 j des journaux avec adresses IP, chiffrement par clés gérées, région documentée |
| 16 | Qu'est-ce qui est nouveau dans votre travail ? | §2.6.2, §5.8 | Contribution d'ingénierie ; apport propre : boucle livraison ↔ détection (F6), mesure de son effet sur l'ordre des correctifs |
| 17 | Votre planning : tout en trois semaines ? | §5.10.4 | Gantt prévu/réalisé avec dates réelles (D-04) |
| 18 | Deux environnements seulement ? Où est la production ? | §5.1.1 | Production = cible décrite en code, non provisionnée ; mesures sur la recette de topologie identique |

---

## 7. Recommandations par expertise

### 7.1 Cybersécurité — table de correspondance preuves existantes ↔ tests T1–T20

Cette table est le levier principal contre le risque R2. Elle indique, pour chaque test, la preuve déjà datée dans les sources, le statut proposé, et ce qui reste à faire. Les agents remplissent tab. 30 et l'annexe E à partir d'elle ; l'auteur exécute la colonne « Reste à faire ».

| Test | Exigence | Preuve datée existante | Statut proposé | Reste à faire (auteur) |
|---|---|---|---|---|
| T1 | EX1 filtrage | 19/08 et 23/08 : SQLi, XSS, LFI, `.env`, `.git` → 403 (page Cloud Armor, `text/html`) ; contrôle légitime 200 ; traversée brute → 302 (H13) | **Partiellement conforme** (réserve H13) | Capture des quatre `curl` (fig. existante dans le guide) |
| T2 | EX2 anti-force brute | 19/08 : 11 POST `/auth/mfa/verify` → 10 × 422 puis 429 ; règle R1 (force brute) fiable à 100 % sur la clé locataire | **Conforme** sous réserve de la ligne R1 dans l'entrepôt | Vérifier et capturer la détection R1 correspondante |
| T3 | EX3 charge et balayage | 19/08 : balayage de 13 requêtes tracé et compté exactement (R2) ; test de charge non fait | **Partiellement conforme** | Test de charge au-dessus du seuil global (1000 req/min/IP) |
| T4 | EX4 données inaccessibles | Configuration : IP privée uniquement (PSA) | Non exécuté | Une commande : tentative de connexion externe + inventaire des adresses publiques (fig. 13) |
| T5 | EX5 cloisonnement des identités | 23/08 : `sa-elson` = exactement 2 rôles ; usurpation refusée même en admin (`PERMISSION_DENIED`) ; 19/08 : `sa-ml-embed` sans rôle BigQuery | **Conforme** (état vérifié) ; rejeu formel de la lecture refusée à consigner | Tentative de lecture de l'entrepôt avec l'identité applicative |
| T6 | EX6 appels authentifiés | Configuration : `ml-embed` en entrée interne, appels non authentifiés refusés | Non exécuté | Appel sans jeton depuis le réseau privé |
| T7 | EX7 aucune clé longue durée | Inventaire des clés (à produire) ; **pas de politique d'organisation** (H10) | **Partiellement conforme** (critère révisé, écart É7) | Inventaire des clés pour tous les comptes ; ne pas prétendre au refus de création |
| T8 | EX8 artefact vulnérable bloqué | Porte Trivy `CRITICAL` en CI (CI verte confirmée) ; aucun blocage daté | Non exécuté | Construire sur une image de base vulnérable, capturer l'arrêt (fig. 9) |
| T9 | EX9 registre unique | Docker Hub retiré de la chaîne (M11, 19/08) ; déploiement par étiquette SHA (M10) | Critère révisé : déploiement depuis un registre externe → refus | Tentative de déploiement depuis une source externe |
| T10 | EX10 secret versionné bloqué | Porte Gitleaks en CI ; aucun blocage daté | Non exécuté | Commit d'un secret factice, capturer l'arrêt (fig. 7) |
| T11 | EX11 intégrité des preuves | 19/08 : `sa-enrich-job` en écriture uniquement sur `alert_enrichment` ; `sa-ml-embed` sans rôle BigQuery (état vérifié) | **Conforme** (état) ; rejeu à consigner | Écriture/suppression tentées sur `raw_logs` et `detections` (fig. 14) |
| T12 | EX12 interruption de collecte | Politiques d'alerte configurées | Non exécuté | Interruption volontaire au-delà du seuil |
| T13 | EX13 attribution | Journaux d'activité administrateur (M7 : accès aux données non centralisés) | Non exécuté (protocole précisé, C21) | Action privilégiée retrouvée avec auteur et horodatage |
| T14 | EX14 sortie nulle du composant d'inférence | Configuration : sortie via VPC sans route Internet, `sa-ml-embed` dédié | Non exécuté ; réserve É3 levée | Connexion sortante tentée depuis `ml-embed` |
| T15 | EX15 charge sur l'enrichissement | Démarrage à froid mesuré (27 s / 94 s) | Non exécuté | Injection d'un volume anormal, durée et coût mesurés |
| T16 | EX16 dérive | Incident CMEK (08/08) ; 19/08 : `terraform plan` = « No changes » (référence saine) | **Partiellement conforme** (corroboré) | Création manuelle d'une ressource puis `plan` (fig. 16) |
| T17 | EX17 état protégé | Configuration (accès limité) | Non exécuté | Lecture de l'état avec une identité non autorisée |
| T18 | EX18 revue avant droits | Revue de PR + `apply` manuel (C13) | **Partiellement conforme** (approbation humaine non outillée) | Aucun, sauf si une porte d'approbation est ajoutée |
| T19 | EX19 consommation anormale | — | Non exécuté | Alerte de budget ou de ressources déclenchée |
| T20 | EX20 sorties limitées et tracées | É1 corrigé le 19/08 : la trace est désormais attendue | Non exécuté (protocole mis à jour) | Connexion sortante vers une destination non autorisée, refus + trace |

Bilan possible après exécution par l'auteur : 3 à 4 conformes immédiats (T2, T5, T11, T16), 4 partiels documentés (T1, T3, T7, T18), 12 à exécuter (chacun tient en une commande ou un commit). C'est un objectif réaliste avant la remise, et le tableau final ne sera plus « 20 non exécutés ».

### 7.2 Cybersécurité — autres points

- **Nommer les trois réserves du panel du 19/08** dans §6.8 (limites) : segmentation réseau multi-locataires (H6), motif WAF (H13), porte SAST vérifiée seulement en CI de branche (H12/H15, 74 constats). Un jury respecte un candidat qui nomme ses limites avant qu'on les lui trouve.
- **Ne jamais écrire « impossible » pour un contrôle qui repose sur une configuration** (ex. « contourner le périmètre est impossible, et non simplement interdit », annexe D L3). Écrire « refusé par la configuration d'entrée du service ».
- **Journaux d'accès aux données** : préciser ce qui est centralisé (C21).
- **MFA** : une phrase sur ce qui existe (TOTP) et ce qui manque (codes de secours, notification), sans développer.

### 7.3 Architecture

- **§4.4 « De l'attaque à l'incident »** : une figure de chronologie horizontale à cinq repères (attaque, blocage, journal visible, détection, incident/enrichissement) avec les délais du budget de latence, en réutilisant les couleurs des figures existantes. Le texte fait 15 à 20 lignes. C'est la seule figure nouvelle du rapport.
- **Cohérence couches/flux** : « sept niveaux L1–L7 = cinq couches + deux plans » (C17) ; F6 = sixième flux.
- **Écart É7** (politiques d'organisation inapplicables) et **É8** (déploiement par étiquette SHA) ajoutés à tab. 25 avec dates.
- **Second locataire** (C07) : la vue de déploiement (fig. 4) peut mentionner « application hébergée (par locataire) » sans redessiner.
- **Composants écartés** : le tableau 24 est complet (la passerelle d'authentification devant le tableau de bord correspond à l'IAP) ; ajouter seulement le « déploiement progressif » (bloc de trafic préparé mais inutilisé, L8) comme perspective, pas comme composant écarté.

### 7.4 Réseaux

- Dire clairement que la **segmentation est réalisée par l'identité** (comptes de service, droits par table, entrée interne) et **pas par le réseau** (un VPC, deux sous-réseaux, règle interne large). Le rapport le suggère (P2) mais ne l'assume pas comme limite.
- **Journaux réseau** (C02) : flow logs échantillonnés, NAT en erreurs seulement, refus journalisés sur la règle de refus global ; coût d'ingestion maîtrisé par le filtre.
- **Rate-limiting** : deux niveaux, chemins d'authentification protégés y compris MFA (C14) ; limite de la clé par adresse IP (adresses partagées en Mauritanie) déjà bien expliquée en annexe D L1.
- **Sous-réseau public inutilisé** (É2/L9) : décision de l'auteur (D-10) ; ne pas laisser « non tranché » dans un rapport final.
- **Point de défaillance unique** : le connecteur VPC serverless (M17) mérite une ligne dans les limites.

### 7.5 Software engineering

- **Chaîne applicative** : huit étapes, trois portes ; préciser la vérification en échec de chaque porte (Gitleaks, Semgrep — après correction —, Trivy) ; le dernier run complet vert sur `main` date du 16/08, avant le durcissement SAST : le dire si la capture date de là.
- **Chaîne d'infrastructure** : réalité manuelle (C13). Le lock de versions de fournisseurs est désormais versionné (M13 résolu le 19/08) : mettre à jour l'encadré §5.2.2.
- **Actions GitHub épinglées** (M22) : si corrigé, une phrase ; sinon, perspective.
- **Retour arrière** mesuré (C10).
- **Images de base épinglées par empreinte** (L7 résolu le 19/08) : une phrase en §5.3.
- **Tests** : dire honnêtement que les tests unitaires de l'API mockent la base (M14) et que les tests de bout en bout du tableau de bord ne couvrent pas la MFA (M6), si ces points sont cités.

### 7.6 Data

- **Chaîne de tables** : `raw_logs → detections → alert_enrichment → score` ; `alert_enrichment` sans colonne d'entité (raison technique de la non-jointure) : une phrase suffit.
- **Règles** : 7 règles, filtrage HTTP/WAF, seuils codés en dur ; R1 fiable sur la clé locataire, R2/R3/R6 partiellement (H7). La clé locataire partielle doit être dite avec la preuve du 19/08 (attribution correcte de R2).
- **Version ATT&CK** : indiquer la version (19) partout où un taux est cité ; annexe E.1 à remplir (D-12).
- **Dénominateur de couverture** : bien expliqué en §6.3.1 ; le graphique 3 reste à produire.
- **Évaluation M0/M1/M2** : protocole prêt (annexe F) ; l'effort estimé (2,5 à 3,5 jours) doit être arbitré par l'auteur ; si non réalisé, écrire « non mesuré » et non « en cours ».
- **Rétention** : 90 jours sur `raw_logs` et `access_logs` (résolu le 19/08) ; tables de preuve sans expiration : à dire en §5.5.1.

### 7.7 Product ownership

- **Le contrat O1–O6 est excellent** ; tab. 36 doit être remplie avec des valeurs, pas des « partiellement » non chiffrés.
- **La preuve vivante** (second locataire) est l'argument commercial de MENAL : elle doit apparaître dans le résumé, en §5.9, en §6.7 et dans la conclusion.
- **Objectif O6 de l'architecture (« soutenance capable de dérouler 6 preuves en 15 minutes »)** : le rapport n'a pas à le reprendre tel quel, mais §6.7 doit permettre au jury de suivre la démonstration.
- **Décisions à faire prendre à l'auteur** : liste D-01 à D-12 (partie 11).

### 7.8 Réflexion critique

- **Chasser les affirmations absolues** : « aucune », « jamais », « impossible », « intégralement », « sans exception ». Chaque occurrence doit être soit prouvée, soit adoucie (« aucune ressource durable créée depuis l'interface » est vérifiable par `terraform plan` ; « impossible » ne l'est pas).
- **Chasser les auto-évaluations** : « le meilleur rapport effort/résultat de tout le projet », « pièce maîtresse », « exemplaire ». Le jury juge ; le rapport décrit.
- **Une contradiction interne coûte plus qu'une limite avouée** : C16 et C17 sont typiquement les erreurs qu'un rapporteur attentif relève en premier.
- **Les « [À COMPLÉTER] » restants** doivent être invisibles dans le PDF final (macro désactivée) ou listés dans `A_COMPLETER_AUTEUR.md`, jamais imprimés.

---

## 8. Pédagogie et niveau de français

### 8.1 Diagnostic

Le texte est correct, précis et sans faute notable. Son défaut est d'être **trop écrit** : phrases longues (26 mots en moyenne, 84 phrases de plus de 60 mots), tirets cadratins partout (494), formules à effet, jugements moraux sur la méthode (« dissimuler », « faute méthodologique », « argumentaire commercial »), auto-commentaires (« c'est ici que la précision est la plus nécessaire »). Un jury peut trouver le ton donneur de leçons, ou soupçonner un texte non écrit par l'étudiant.

### 8.2 Règles d'écriture à appliquer (phase 3)

1. **Une idée par phrase.** Phrase de 12 à 25 mots en moyenne ; aucune phrase de plus de 40 mots sans raison.
2. **Sujet, verbe, complément.** Éviter les incises et les parenthèses en cascade.
3. **Tirets cadratins** : réservés aux tableaux et aux listes ; dans le texte, les remplacer par une virgule, deux points ou un point.
4. **Pas de maximes.** Au plus une phrase « de principe » par chapitre, dans l'introduction du chapitre.
5. **Pas de jugement sur l'honnêteté.** Remplacer « rapporté sans détour », « honnêtement », « plutôt que dissimulé » par un simple énoncé du fait et de son statut.
6. **Vocabulaire courant** : « montrer » plutôt que « matérialiser », « limite » plutôt que « verrou » (garder « verrou » uniquement pour V1–V4 déjà nommés), « vérifié » plutôt que « démontrable » quand c'est un fait.
7. **Définir à la première occurrence** : locataire, requête planifiée, fenêtre glissante, porte bloquante, empreinte, fédération d'identité, démarrage à froid, dérive. Renvoyer au glossaire (annexe G).
8. **Chaque chapitre commence par une feuille de route de 5 à 8 lignes** (ce que le chapitre fait, ce qu'on saura à la fin) et finit par une conclusion de 8 à 10 lignes (résultats + transition). C'est ce que demande la note ESPRIT.
9. **Les exemples en italique, les conclusions en gras**, avec parcimonie (note ESPRIT : « mise en valeur du contenu »).
10. **Voix active et « le projet », « le socle », « nous »** selon la convention choisie ; le rapport utilise le passif impersonnel, acceptable, mais la note ESPRIT attend que le rôle de l'élève-ingénieur soit visible : autoriser « j'ai / nous avons » dans §1.1.3, §5.10 et la conclusion.

### 8.3 Exemples de réécriture (avant → après)

| Avant (rapport) | Après (français simple) |
|---|---|
| « La question comporte aussi explicitement un coût : une architecture qui ne mesure pas ce qu'elle coûte n'est pas une architecture d'ingénieur mais une déclaration d'intention. » | « La question inclut le coût : le rapport mesure ce que le socle coûte en faux positifs, en délai de détection et en complexité. » |
| « Documenter les écarts est une pratique d'ingénierie ; les dissimuler serait une faute méthodologique. » | « Les écarts entre la conception et la réalisation sont documentés avec leur date et leur justification. » |
| « Un travail présenté sans limites signale qu'aucune mesure sérieuse n'a été conduite (tableau 35). » | « Le tableau 35 liste les limites de la mesure et leur effet sur l'interprétation des résultats. » |
| « Le choix inverse a été fait : afficher le taux d'alertes non rattachées comme un indicateur de qualité. Un système qui avoue ne pas savoir est plus utile qu'un système qui devine. » | « Le tableau de bord affiche le taux d'alertes non rattachées. Une alerte sans rattachement est visible et sans danger ; un rattachement faux avec un score élevé oriente l'analyste vers la mauvaise procédure. » |
| « Contourner le périmètre est impossible, et non simplement interdit : la configuration d'entrée des services rejette tout trafic ne provenant pas du répartiteur. » | « La configuration d'entrée de chaque service refuse tout trafic qui ne vient pas du répartiteur. Le contournement du périmètre est donc refusé par la configuration, pas seulement par une règle. » |
| « Ces deux dernières sections sont aussi importantes que les précédentes : une architecture qui ne documente que ce qu'elle contient laisse penser que tout ce qui n'y figure pas a été oublié. » | « Les sections 4.8 et 4.9 présentent aussi les composants écartés et les écarts constatés, pour montrer que leur absence est une décision. » |
| « Trois écarts significatifs ont été rapportés sans détour : … » | « Trois écarts importants restent ouverts à la date de référence : … » |

### 8.4 Ce qu'il ne faut pas simplifier

- Les identifiants (C1–C5, B1–B6, Q1–Q6, O1–O6, EX1–EX20, SO1–SO24, T1–T20, D01–D13, É1–É8, F1–F7, L1–L7) : ils font la traçabilité du rapport.
- Les termes techniques normalisés (Zero Trust, DevSecOps, SIEM, ATT&CK, IaC) : définis une fois, puis utilisés.
- La matrice de traçabilité et les protocoles de test : leur formulation doit rester précise.

---

## 9. Qualité du document LaTeX

### 9.1 Défauts constatés et corrections

| # | Défaut | Preuve | Correction |
|---|---|---|---|
| L1 | Liste des graphiques cassée (numéros et titres tronqués, sur une ligne) | page xxi | Le flottant « graph » est déclaré sans macro de liste correcte ; utiliser `\newfloat{graph}{tbp}{lograph}` + `\listof{graph}{Liste des graphiques}` (package `float`) ou `newfloat` avec `\listofgraphs`, et vérifier `\floatname` |
| L2 | Références croisées en anglais ou mal accordées : « sections 1.4 and 1.5 », « Le table 2 », « Le fig. 3 », « tableau table 4 » (4 fois), « Le fig. 5 » | pp. 3, 7, 13, 34, 36, 77 | Charger `cleveref` avec l'option `french` et définir `\crefname{table}{tableau}{tableaux}`, `\crefname{figure}{figure}{figures}`, `\crefname{section}{section}{sections}`, `\crefpairconjunction{ et }` ; ne pas écrire « tableau \cref{} » (doublon) ; utiliser « la figure~\ref{} » si `cleveref` est retiré |
| L3 | Numérotation des tableaux commençant à 2 | liste des tableaux | Un tableau numéroté 1 n'apparaît pas dans la liste (probablement le tableau des acronymes, en flottant sans entrée de liste) ; le sortir de la numérotation ou corriger le compteur |
| L4 | Tableaux coupés avec légende répétée (tab. 10, 12, 13, 15) | liste des tableaux, pp. 22–27 | Éviter `longtable` pour des tableaux d'une page ; forcer `[H]` ou `[!htbp]` avec `\FloatBarrier` ; sinon légende « (suite) » via `\caption[]{... (suite)}` sans double entrée dans la liste |
| L5 | 14 pages blanches de verso, 36 pages peu remplies | inventaire des pages | Passer en `openany` (ou garder `openright` seulement si l'impression recto-verso est exigée) ; retirer les `\clearpage` avant les placeholders ; réduire la hauteur des cadres de placeholder (0,25 page) |
| L6 | Titre de la page de garde coupé « Dev-SecOps » | page 1 | `\mbox{DevSecOps}` ou `\-` interdit ; réduire la taille du titre ou passer sur trois lignes |
| L7 | Placeholders « [À COMPLÉTER — …] » imprimés en rouge dans le corps | 67 occurrences | Une macro `\acompleter{...}` avec un booléen global : visible en version de travail, invisible (ou remplacée par un blanc calibré) en version de remise ; export de la liste dans `A_COMPLETER_AUTEUR.md` |
| L8 | Encadrés « En attente de document source » | 6 | Même mécanisme que L7 |
| L9 | Demi-pages blanches sous les figures de placeholder (pp. 47, 48, 62, 63, 68) | ch. 5 et 6 | Grouper deux captures par figure (a/b) avec `subcaption` quand elles illustrent le même test ; hauteur fixée |
| L10 | Bibliographie : liens avec espaces (« https : / / docs . cloud … »), traits d'union non standards, dates de consultation absentes | pp. 75–76 | `\usepackage{url}` ou `\urlstyle{same}` avec `\url{}` ; champ `urldate` dans le `.bib` ; style `biblatex` `french` avec `urldate` affiché |
| L11 | Références « [réf. à ajouter — …] » dans le texte | 10 | Entrées `.bib` à créer (C20) |
| L12 | Interligne, police, marges | à vérifier | Times New Roman 12 : présent ; interligne 1.15 (`\setstretch{1.15}` avec `setspace`) ; marges 2,5 cm (`geometry`) ; titres numérotés 1, 1.1 : présents ; numéros de page bas droite « n / total » : présents |
| L13 | Chapitres commençant par un sous-titre en italique centré puis un paragraphe d'intention | tous | Garder, mais raccourcir ; le sous-titre en italique est un choix acceptable |
| L14 | Le graphique 2 et le graphique 5 sont le même graphique (démarrage à froid 27 s / 94 s) | pp. 55, 67 | Garder une seule occurrence (ch. 6) et y renvoyer depuis §5.10.2 |
| L15 | Figures TikZ larges (fig. 4) avec texte à 6 pt | p. 35 | Augmenter la taille de police minimale à 8 pt ou passer la figure en pleine largeur avec `\resizebox` limité |
| L16 | Table des matières : « Liste des graphiques » apparaît mais pas « Liste des figures » ni « Liste des tableaux » | p. xi | Ajouter les entrées avec `\addcontentsline` |
| L17 | Annexe H (optionnelle) et page de validation | fin | La page de validation existe ; la conserver en dernière page |

### 9.2 Règles de forme pour la version finale

- Aucune ligne de code dans le corps (note ESPRIT) ; les extraits vont en annexe B, 10 à 15 lignes maximum chacun, copiés tels quels du dépôt.
- Chaque figure, tableau et graphique : légende + au moins un appel dans le texte (« figure 3 », « tableau 17 »).
- Planning sur une page complète, à la fin de la description du travail (§5.10.4) : Gantt prévu contre réalisé, semaines en abscisse, phases P0–P4 en ordonnée, jalons datés.
- Pas de chapitre qui se termine sur une page de trois lignes ; pas de figure orpheline.
- Titres de sections courts (moins de 60 caractères) pour une table des matières lisible.
- Citations courtes entre guillemets français « ».
- Version imprimable : recto-verso recommandé par ESPRIT ; si `openright` est conservé, les versos blancs sont acceptés mais ne comptent pas dans le budget.

---

## 10. Captures d'écran — plan des emplacements

Rôle de l'agent captures : préparer les emplacements (cadre, légende, appel dans le texte, consigne de masquage) ; les captures elles-mêmes sont ajoutées ensuite par l'auteur. Colonne « Existe ? » : ce qui est déjà capturé ou immédiatement reproductible d'après les sources.

| ID | Emplacement | Ce que la capture doit montrer | Existe ? | Légende proposée | Masquage |
|---|---|---|---|---|---|
| K01 | §5.3.3, fig. 7 | Chaîne arrêtée à l'étape 2 : nom de l'étape, code de retour ≠ 0, type de règle Gitleaks | À produire (un commit factice) | « Refus n°1 : secret factice détecté à l'étape 2 (date) » | Aucune valeur de secret, même factice |
| K02 | §5.3.3, fig. 8 | Journal Semgrep : « 74 findings (74 blocking) », `exit code 1` | **Oui** (PR #17, 19/08) | « Refus n°2 : la porte d'analyse statique arrête une branche sur 74 constats (19/08/2026) » | Noms de fichiers sensibles éventuels |
| K03 | §5.3.3, fig. 9 | Trivy arrêtant la chaîne sur une CVE critique : identifiant, sévérité, code de retour | À produire | « Refus n°3 : vulnérabilité critique détectée à l'étape 5 (date) » | — |
| K04 | §5.4, fig. 10 | Scan IaC refusant un espace de stockage public : politique violée, code de retour | À produire | « Refus n°4 : configuration dangereuse bloquée avant création (date) » | Identifiant de projet |
| K05 | §5.7 (nouvelle figure) | Tableau de bord, page des détections avec une ligne R2 (règle, entité, service, technique) | **Oui** (23/08, 19:06) | « Une détection R2 attribuée au second locataire et rattachée à T1498 (23/08/2026) » | Adresse IP partielle, courriels |
| K06 | §5.7 ou annexe D L7 | Page des indicateurs d'enrichissement (taux d'alertes non rattachées, version du modèle) | Probable (endpoint `/siem/enrichment-quality`) | « Indicateurs de qualité de l'enrichissement » | — |
| K07 | §5.9 | Résultat du contrôle quotidien d'isolation SQL : 6/6 ok, `isolated: true`, connexion croisée refusée | **Oui** (19/08) | « Contrôle d'isolation entre locataires : connexion croisée tentée et refusée (19/08/2026) » | Noms de bases si sensibles |
| K08 | §5.10.2 | Graphique démarrage à froid (existant, graph. 2/5) | Oui | Garder une seule occurrence | — |
| K09 | §5.10.4, fig. 12 | Gantt prévu/réalisé pleine page | À produire (données D-04) | « Planning de travail : prévu contre réalisé » | — |
| K10 | §6.2, fig. 13 (T4) | Connexion directe externe en échec + inventaire des adresses publiques vide | À produire (une commande) | « Test T4 : base de données injoignable depuis Internet (date) » | Identifiant de projet |
| K11 | §6.2, fig. 14 (T11) | Écriture/suppression refusées sur `raw_logs` et `detections` sous l'identité d'enrichissement | À produire ; état déjà vérifié | « Test T11 : refus d'écriture sur les tables de preuve (date) » | Compte de service, projet |
| K12 | §6.2, fig. 15 (T7) | Inventaire des clés vide pour tous les comptes de service | À produire | « Test T7 : aucune clé de compte de service (date) » — sans prétendre au refus de création | Projet |
| K13 | §6.2, fig. 16 (T16) | Ressource créée à la main, `plan` non vide, journal d'audit avec auteur | À produire ; référence saine du 19/08 disponible | « Test T16 : dérive détectée et attribuée (date) » | Courriels, projet |
| K14 | §6.2 (T1, nouvelle figure ou a/b avec fig. 13) | Quatre `curl` : SQLi/XSS/LFI → 403 (`text/html`), contrôle → 200 | **Oui** (23/08) | « Test T1 : trois attaques refusées au périmètre, requête légitime acceptée (23/08/2026) » | — |
| K15 | §6.2 (T2) | 11 POST sur `/auth/mfa/verify` : 10 × 422 puis 429 | **Oui** (19/08) | « Test T2 : limitation de débit appliquée sur la vérification MFA (19/08/2026) » | — |
| K16 | §6.2 (T5) | Rôles exacts de l'identité applicative (2 lignes) + usurpation refusée | **Oui** (23/08) | « Test T5 : droits minimaux et usurpation refusée (23/08/2026) » | Projet |
| K17 | §6.3.1, graph. 3 | Histogramme couverture par tactique (version ATT&CK en légende) | À produire (calcul) | « Couverture de détection par tactique, matrice v19 » | — |
| K18 | §6.4.1, graph. 4 | Histogramme M0/M1/M2 | À produire si l'évaluation est faite | « Comparaison des trois méthodes de rattachement » | — |
| K19 | §6.5.2, fig. 17 | Reconstruction complète chronométrée, phase par phase | À produire | « Reconstruction d'un environnement depuis le dépôt (date, durée) » | Projet |
| K20 | §6.5.2 (nouvelle, petite) | Retour arrière : liste des révisions et bascule (11,6 s / 16,5 s) | Probable (UC8) | « Retour arrière applicatif chronométré » | — |
| K21 | §6.7 | Scénario du 19/08 : requêtes bloquées (403 × 13), puis ligne R2 avec `13 requêtes bloquées … en 15 min` | **Oui** (19/08, 16:41 → 16:56:08) | « De l'attaque à la détection : 13 requêtes bloquées, détection R2 quinze minutes plus tard (19/08/2026) » | Adresse IP partielle |
| K22 | §6.7 ou §5.2 | `terraform plan` : « No changes. Your infrastructure matches the configuration. » | **Oui** (19/08) | « Le code et l'infrastructure réelle coïncident (19/08/2026) » | Projet |
| K23 | §5.3 (CI) | Dernier run vert sur `main` (six jobs) | **Oui** (16/08) | « Chaîne de livraison : scans, tests, construction, déploiement (16/08/2026) » | — |
| K24 | Annexe B.2 / B.4 | 3–4 extraits réels de 10–15 lignes (compte de service à rôle minimal, politique d'organisation, variable par environnement, une règle et sa traduction) | À produire depuis le dépôt | Légendes « Extrait n : … » | Aucune valeur de secret |

Règles communes : image nette, police ≥ 10 pt lisible à l'impression, horodatage visible, cadre gris fin, légende avec date, appel dans le texte, aucune donnée secrète (jetons, mots de passe, identifiants de projet complets, courriels).

---

## 11. Emplacements à préparer et informations à fournir par l'auteur

### 11.1 Emplacements à préparer par les agents (sans contenu de l'auteur)

| Emplacement | Contenu à laisser prêt |
|---|---|
| Dédicace, remerciements | Page avec structure ; placeholder invisible en version de remise |
| Résumé / Abstract | Brouillon rédigé par les agents (15–20 lignes) à partir des résultats connus, marqué « à valider par l'auteur » ; mots-clés proposés : Zero Trust, DevSecOps, Google Cloud Platform, Infrastructure as Code, SIEM, MITRE ATT&CK, multi-locataire |
| Introduction générale | Brouillon de 2 pages selon les cinq mouvements ESPRIT, sans résultat chiffré |
| §1.1.2, §1.1.3 | Cadres de 0,3–0,5 page avec questions guides (effectif, rattachement, mission initiale, interlocuteurs) |
| §4.4 | Section complète (texte + figure de chronologie) avec valeurs mesurées et cases « à mesurer » |
| §5.9 | Section complète à partir des sources |
| §5.10.1 | Cadre avec questions guides (rythme, points d'encadrement, outils) |
| §5.10.4 | Page Gantt avec gabarit (phases, semaines, jalons connus) |
| §6.2, tab. 30 et annexe E | Statuts proposés (partie 7.1) et colonnes de preuve |
| §6.3.3 | Budget de latence avec valeurs connues et cases ouvertes |
| §6.5.3 | Tableau de coût par poste, vide |
| §6.7 | Section complète à partir du scénario du 19/08 |
| Conclusion générale | Brouillon de 2 pages selon les cinq points ESPRIT, résultats en attente signalés |
| Annexe A.2 | Contenu déplacé depuis le chapitre 2 |
| Annexe H (optionnelle) | Feuille de démonstration : cinq preuves, commande, résultat attendu, section du rapport |

### 11.2 Décisions et données que seul l'auteur peut fournir

| ID | Décision / donnée | Impact |
|---|---|---|
| D-01 | Le délai « 45 s » : segment concerné, mesure datée ou renoncement (options A/B/C, partie 2.4) | §4.4, §6.3.3, résumé |
| D-02 | Nommage ELSON / Elson : même entité ou non ; convention unique | Tout le rapport |
| D-03 | Enrichissement : « informationnel assumé » ou jointure au score (ADR à dater) | §5.6.2, §6.4, conclusion |
| D-04 | Dates réelles : début et fin du stage, phases P0–P4, jalons (29/07, 03/08, 07/08, 08/08, 11/08, 18–19/08, 23/08) | §1.5.3, §5.10.4, tab. 32 |
| D-05 | Exécution des tests restants (partie 7.1) et captures K01, K03, K04, K10–K13, K19 | ch. 6, annexe E |
| D-06 | Cadence exacte des requêtes planifiées et fenêtre (5 ou 15 min) | §4.4, §5.5, §6.3.3 |
| D-07 | Coût mensuel par poste ; statut de l'anomalie « 78 Go/j » ; estimation de la solution commerciale écartée | §6.5.3, O6 |
| D-08 | Service d'accueil, mission, rôle, tâches quotidiennes | §1.1.2, §1.1.3, §5.10.1 |
| D-09 | Validation des brouillons (résumé, abstract, introduction, conclusion) | Pages liminaires, intro, conclusion |
| D-10 | Sous-réseau public : suppression ou justification | É2, §4.9, annexe D L4 |
| D-11 | Cible de pages (55 ou 60) validée avec l'encadrant ESPRIT | Budget |
| D-12 | Version ATT&CK (19) et version du référentiel CIS employées ; annotateur de l'annexe F | Annexe E.1, F.1 |
| D-13 | Évaluation M0/M1/M2 : réalisée avant la remise ou déclarée « non mesurée » | §6.4, O5 |
| D-14 | Reconstruction complète chronométrée : réalisée avant la remise ou reportée à la soutenance | §6.5.2, O2 |

---

## 12. Guide de démonstration vidéo — usage comme référence

La vidéo (« La preuve, pas la promesse », ~2 min 45, cinq preuves) ne modifie pas le rapport. Elle sert de référence pour vérifier que le rapport permet au jury de suivre la démonstration. Correspondance :

| Plan de la vidéo | Preuve montrée | Section du rapport qui doit la rendre compréhensible | Test |
|---|---|---|---|
| 0 — La cible est vivante | `/api/health` → 200 en 0,33 s | §6.7 (témoin) | — |
| P1 — Zero Trust par l'identité | Deux rôles exacts ; usurpation refusée même en admin | §4.6 (plan d'identité), §5.9 (second locataire) | T5, T7 |
| P2 — Le périmètre bloque (plan phare) | SQLi/XSS/LFI → 403 ; en-têtes durcis | §4.4 (étape 1), annexe D L1, §6.2 | T1 |
| P3 — RBAC | 401 sur l'API, 307 vers `/login`, message générique | §5.7 | T6 (esprit) |
| P4 — Le SOC voit, classe, attribue | Ligne R2, T1498/TA0040, service du locataire ; « 5–15 min après l'attaque » | §4.4 (étape 3), §6.3.3, §6.7 | T3 (trace) |
| P5 — La livraison est testée | Run vert (16/08) ; porte SAST bloquant 74 constats | §5.3, §5.10.2 (incident) | T8, T10 |

Deux points de vigilance issus de la vidéo :
- Le guide dit explicitement que la corrélation prend des minutes et prévoit un plan de coupe : le rapport doit dire la même chose (partie 2).
- Le guide distingue le 403 du pare-feu (`text/html`) du 403 applicatif (`application/json`) : cette distinction est une bonne précision à reprendre dans le protocole T1.

---

## 13. Prompt final pour les agents d'implémentation

Le prompt ci-dessous est reproduit intégralement dans le fichier séparé `PROMPT_FINAL_AGENTS.md`, prêt à être donné aux agents.

---

### PROMPT FINAL — Amélioration et restructuration du rapport de PFE « Socle GCP sécurisé — Zero Trust, DevSecOps et détection enrichie par IA » (MENAL)

> À donner tel quel à l'équipe d'agents chargée d'implémenter les corrections. Le document `MENAL_Rapport_PFE_Diagnostic_et_Plan.md` est joint comme référence détaillée ; ce prompt reprend tout ce qui est nécessaire pour agir.

---

### 1. Votre mission

Vous êtes une équipe d'experts (structuration, réflexion critique, cybersécurité, architecture, réseaux, software engineering, data, product ownership, pédagogie, LaTeX, captures d'écran) chargée d'améliorer un rapport de projet de fin d'études d'ingénieur (ESPRIT) sans en modifier le fond. Le rapport existe déjà en LaTeX (main.tex et fichiers de chapitres et d'annexes, compilé en PDF de 128 pages). Vous devez le rendre :

- **juste** : aligné sur l'état réel du système à une date de référence unique ;
- **structuré** : progression contexte → problème → architecture → conception → implémentation → tests → résultats → démonstration ;
- **compréhensible** : français simple et naturel, phrases courtes, définitions ;
- **solide face à un jury** : aucune affirmation non prouvée, limites nommées avant qu'on les trouve ;
- **professionnel** : forme LaTeX propre, conforme aux consignes ESPRIT ;
- **de longueur maîtrisée** : 55 à 60 pages de corps (introduction → conclusion), 65 au maximum.

Vous ne changez pas le projet : ni son architecture, ni ses résultats, ni ses choix. Vous corrigez, réorganisez, condensez, clarifiez et préparez les emplacements de ce qui sera ajouté ensuite.

### 2. Sources et hiérarchie de vérité

| Priorité | Source | Rôle |
|---|---|---|
| 1 | `02_SECURITE_AUDITS_ECARTS.md` (état au 19/08/2026, §1 registre H/M/L, §7 validation live, §8 clôture, §10 scénario de bout en bout) | Fait foi sur l'état réel de chaque contrôle, écart et test |
| 2 | `01_ARCHITECTURE_MENAL.md` (état au 19/08/2026) | Fait foi sur l'architecture réellement déployée, les cadences, les mesures |
| 3 | `guide_reel_preuves_menal.html` (preuves capturées le 23/08/2026, annexe A « journal de validation live ») | Fait foi sur les preuves datées du 23/08 ; **ne modifie pas le rapport**, sert de référence pour §6.7 et pour les captures |
| 4 | `main.pdf` / sources LaTeX (compilé le 16/08/2026) | Texte de départ ; ses statuts sont dépassés quand ils contredisent 1–3 |
| 5 | Note pédagogique ESPRIT (`Rapport_Stage_Pédagogique.pdf`) | Consignes de forme et de contenu obligatoires |
| 6 | `MENAL_Rapport_PFE_Diagnostic_et_Plan.md` | Analyse détaillée, registre C01–C30, plan de captures K01–K24, questions du jury |

En cas de contradiction entre deux sources, la source de priorité la plus haute l'emporte ; si la contradiction subsiste (ex. cadence 5 ou 15 min), vous **ne tranchez pas** : vous écrivez la formulation prudente et vous ajoutez une ligne dans `DECISIONS_AUTEUR.md`.

### 3. Règles absolues

1. **Aucun chiffre inventé.** Une valeur n'entre dans le rapport que si elle est présente dans une source avec sa date. Sinon : case ouverte marquée par la macro `\acompleter{...}` et ligne dans `A_COMPLETER_AUTEUR.md`.
2. **Le chiffre « 45 secondes » n'est jamais inséré de votre initiative.** Le message « proche du temps réel » est présenté sous forme de budget de latence par étape (voir §7.3). Si l'auteur fournit une mesure datée du segment « détection écrite → incident affiché », vous l'insérez avec sa date ; sinon le segment est décrit comme « quelques secondes, calculé à la requête ».
3. **Aucune ligne de code dans le corps du rapport** ; les extraits vont en annexe B, 10 à 15 lignes maximum, copiés tels quels du dépôt, jamais composés.
4. **Fond inchangé** : pas de nouveau composant, pas de nouveau résultat, pas de conclusion nouvelle. Vous reformulez et réorganisez ce qui existe dans les sources.
5. **Une date de référence unique** pour tout le rapport (`\dateref`, proposée : 23/08/2026 ; à confirmer par l'auteur). Tous les statuts (écarts, tests, décisions) sont exprimés « à la date de référence ».
6. **Français simple** : 12 à 25 mots par phrase en moyenne, aucune phrase de plus de 40 mots sans nécessité, pas de maxime, pas de jugement sur l'honnêteté, tirets cadratins réservés aux tableaux, vocabulaire courant, définition à la première occurrence.
7. **Rien d'absolu sans preuve** : « impossible », « jamais », « aucune », « intégralement » sont remplacés par la formulation vérifiable (« refusé par la configuration », « aucune ressource durable créée hors du code, vérifié par un plan sans différence le 19/08 »).
8. **Traçabilité** : chaque modification de fond est consignée dans `CHANGELOG_RAPPORT.md` (fichier, section, avant/après en une ligne, identifiant C-xx).
9. **Les identifiants du rapport sont conservés** : C1–C5, B1–B6, Q1–Q6, O1–O6, BF/BNF, VM/BS/SR/SS, EX1–EX20, SO1–SO24, T1–T20, D01–D13, É1–É8, F1–F7, L1–L7, V1–V4, P1–P4.
10. **Les placeholders ne sont jamais imprimés dans la version de remise** : la macro `\acompleter{}` est visible en mode brouillon, invisible en mode final.

### 4. Livrables attendus

1. Sources LaTeX modifiées, compilant sans erreur ni avertissement de référence, avec un `main.pdf` final.
2. `REGISTRE_CORRECTIONS.md` : les corrections C01–C30 avec statut (appliquée / en attente de l'auteur / non applicable et pourquoi).
3. `DECISIONS_AUTEUR.md` : décisions D-01 à D-14 avec, pour chacune, la question, les options et l'endroit du rapport impacté.
4. `A_COMPLETER_AUTEUR.md` : liste exhaustive des `\acompleter{}` restants (section, contenu attendu, taille indicative, source possible).
5. `PLAN_CAPTURES.md` : emplacements K01–K24 avec légende, appel dans le texte, consigne de masquage, existence de la preuve.
6. `QUESTIONS_JURY.md` : les 18 questions probables et, pour chacune, la section qui y répond et la réponse en trois lignes.
7. `CHANGELOG_RAPPORT.md` et `CHECKLIST_ESPRIT.md` (consignes de forme cochées).
8. Un résumé de fin de chaque phase (10 lignes) adressé à l'auteur.

### 5. Organisation en quatre phases

### Phase 1 — Cadrage et alignement sur le réel (structuration, smart thinking, cybersécurité, architecture, product)

1. Lire intégralement les sources 1 à 5. Établir la chronologie datée du projet (29/07 audit, 01/08 test de quantisation, 03/08 restauration, 05–07/08 mesures démarrage à froid, 07/08 second locataire et audit E2E, 08/08 HA régionale et incident CMEK, 11/08 audit des écarts, 16/08 dernier run CI vert, 18/08 audit experts, 19/08 correctifs + apply + scénario de bout en bout, 23/08 captures).
2. Fixer `\dateref` et le mode brouillon/final (macros `\acompleter`, `\attente`).
3. Reprendre le registre C01–C30 (ci-dessous, §8) : pour chaque ligne, localiser dans les sources LaTeX les passages concernés (chercher le texte), noter le statut d'application.
4. Rédiger `DECISIONS_AUTEUR.md` (D-01 à D-14) et l'envoyer à l'auteur en priorité ; ne pas attendre les réponses pour commencer la phase 2 sur les corrections qui n'en dépendent pas.
5. Figer le sommaire cible (§6) et le budget de pages (§6.1).
6. Sortie : registre validé par l'expert smart thinking ; résumé de phase.

### Phase 2 — Restructuration et alignement du contenu (cybersécurité, architecture, réseaux, software, data, product, captures)

1. Appliquer les corrections de fond C01–C30 qui ne dépendent pas de l'auteur ; pour les autres, préparer les deux formulations possibles en commentaire LaTeX.
2. Réorganiser selon le sommaire cible : renumérotation du chapitre 4 (nouvelle §4.4), nouvelles §5.9 et §6.7, fusions du chapitre 3, fusion §2.2.2/2.2.3, compactage de tab. 22, déplacement du détail vers les annexes A.2 et C.
3. Mettre à jour tab. 25 (écarts, avec É7 et É8), tab. 30 et annexe E (statuts proposés §9), tab. 31, tab. 34, tab. 36.
4. Rédiger §4.4 « De l'attaque à l'incident » (texte + figure TikZ de chronologie) selon le budget de latence (§7.3).
5. Rédiger §5.9 « Accueil d'un second locataire : preuve vivante et limites » et §6.7 « Démonstration du fonctionnement global » à partir de 01_ARCHITECTURE UC7 et de 02_SECURITE §10.
6. Ajouter le 4e incident (porte SAST en faux vert) à §5.10.2 ; corriger le retour arrière (§6.5.2) ; préciser la restauration (tab. 32).
7. Normaliser tous les emplacements de captures (macro `\capture{K01}{légende}{consigne}`), avec appel dans le texte.
8. Vérifier le budget de pages chapitre par chapitre ; si un chapitre dépasse, condenser avant de passer à la phase 3.
9. Sortie : chapitres justes sur le fond ; `REGISTRE_CORRECTIONS.md` à jour ; résumé de phase.

### Phase 3 — Pédagogie et langue (pédagogie, smart thinking, captures)

1. Réécrire chaque chapitre selon les règles de style (§3.6 et §10) : phrases courtes, une idée par phrase, pas de maxime, pas de jugement, définitions, transitions.
2. Feuille de route en tête de chaque chapitre (5–8 lignes) et conclusion de chapitre (8–10 lignes, résultats + transition).
3. Rédiger les brouillons du résumé, de l'abstract, de l'introduction générale et de la conclusion générale selon la note ESPRIT, avec les cases ouvertes signalées ; marquer « brouillon à valider par l'auteur ».
4. Passe « jury » : pour chacune des 18 questions (§11), vérifier que le rapport y répond à l'endroit prévu ; sinon ajouter une à trois phrases.
5. Finaliser `PLAN_CAPTURES.md` et `QUESTIONS_JURY.md`.
6. Contrôle chiffré : moyenne de mots par phrase ≤ 22 ; moins de 5 % de phrases > 40 mots ; moins de 100 tirets cadratins hors tableaux ; zéro occurrence de « honnête », « dissimul », « sans détour », « faute méthodologique », « argumentaire commercial », « déclaration d'intention ».
7. Sortie : texte final ; résumé de phase.

### Phase 4 — Qualité du document et contrôle final (LaTeX, structuration, product)

1. Corriger les défauts de forme L1–L17 (§12) : liste des graphiques, références croisées en français, numérotation des tableaux, tableaux coupés, pages blanches, page de garde, placeholders, bibliographie, entrées de la table des matières.
2. Compiler ; zéro erreur, zéro référence non résolue, zéro `??`.
3. Vérifier la conformité ESPRIT (§13) et remplir `CHECKLIST_ESPRIT.md`.
4. Vérifier le budget de pages final et l'absence de pages peu remplies (moins de 5 pages sous 120 mots hors pages de titre).
5. Produire `A_COMPLETER_AUTEUR.md` définitif et `CHANGELOG_RAPPORT.md`.
6. Sortie : PDF final en deux versions (brouillon avec placeholders visibles ; remise avec placeholders invisibles) ; résumé de phase.

### 6. Structure cible

#### 6.1 Budget de pages (corps = introduction → conclusion)

Introduction 2 · Ch. 1 : 8 · Ch. 2 : 6–7 · Ch. 3 : 8 · Ch. 4 : 9 · Ch. 5 : 12 · Ch. 6 : 10–11 · Conclusion 2 · **Total 57–60** (max 65). Pages liminaires ≤ 14. Annexes ≤ 28.

#### 6.2 Sommaire cible

```
Introduction générale
1  Contexte du projet, étude de l'existant et problématique
   1.1 Cadre du projet (entreprise, service, mission et rôle)         1.2 Étude de l'existant
   1.3 Critique de l'existant                                          1.4 Problématique, questions, objectifs
   1.5 Périmètre, contraintes et démarche                              Conclusion
2  État de l'art et choix technologiques
   2.1 Zero Trust   2.2 DevSecOps (provenance et référentiels fusionnés)   2.3 Supervision et détection
   2.4 Enrichissement sémantique   2.5 Méthodes d'analyse de risque   2.6 Verrous et positionnement   Conclusion
3  Analyse des besoins et modélisation des menaces
   3.1 Acteurs et cas d'utilisation (un tableau)   3.2 Besoins   3.3 Analyse de risque (un tableau de synthèse)
   3.4 Exigences et matrice de traçabilité   3.5 Rattachement aux référentiels   Conclusion
4  Conception de l'architecture
   4.1 Principes   4.2 Architecture générale   4.3 Les sept flux
   4.4 NOUVEAU — De l'attaque à l'incident : fonctionnement de bout en bout et budget de latence
   4.5 Conception par couche   4.6 Plan d'identité   4.7 Couverture des exigences
   4.8 Décisions d'architecture et composants écartés   4.9 Écarts conception / implémentation   Conclusion
5  Réalisation et industrialisation
   5.1 Environnement de travail   5.2 Infrastructure as code   5.3 Chaîne de livraison applicative
   5.4 Chaîne de provisionnement   5.5 Chaîne de détection   5.6 Enrichissement sémantique
   5.7 Interface de supervision   5.8 Boucle livraison ↔ détection
   5.9 ENRICHI — Accueil d'un second locataire : preuve vivante et limites
   5.10 Conduite du projet (déroulement, difficultés, changements, planning pleine page)   Conclusion
6  Validation, résultats et démonstration
   6.1 Stratégie   6.2 Campagne des vingt tests   6.3 Détection (couverture, angles morts, délais)
   6.4 Enrichissement et boucle F6   6.5 Performance, résilience, coût   6.6 Conformité
   6.7 NOUVEAU — Démonstration du fonctionnement global   6.8 Limites   6.9 Réponse aux objectifs   Conclusion
Conclusion générale · Bibliographie / Netographie · Annexes A–G (+ H optionnelle : feuille de démonstration) · Page de validation
```

#### 6.3 Retraits, fusions et déplacements

- Tab. 8 + tab. 9 → un tableau ; tab. 13 + 14 + 15 → un tableau de synthèse (détail en annexe C) ; tab. 22 → deux phrases + liste des trois exigences partielles.
- §2.2.2 + §2.2.3 → une section ; §2.4.2 et §2.5 raccourcis d'un tiers ; §4.2.2 réduit de moitié.
- Graphique 2 (§5.10.2) supprimé, renvoi au graphique 5 (§6.5.1) — ou l'inverse, une seule occurrence.
- L'incident « état divergent après application partielle » est raconté une fois (§5.10.2) et référencé ailleurs.
- Annexe A.2 complétée avec le détail comparatif du chapitre 2.
- Versos blancs supprimés (`openany`) sauf exigence contraire de l'encadrant.

### 7. Contenus nouveaux à rédiger (à partir des sources uniquement)

#### 7.1 §5.9 — Accueil d'un second locataire : preuve vivante et limites (0,7 page)

Faits (01_ARCHITECTURE UC7 ; 02_SECURITE §10, H6, H7, M16, M19) : second locataire accueilli en recette le 07/08/2026 par instanciation du module d'exécution paramétrique ; compte de service dédié (deux rôles : client base de données, écriture de journaux) ; base et utilisateur dédiés ; DNS et certificat gérés ; six alertes et une sonde ; secrets et espace média chiffrés par clé gérée depuis le 08/08 ; contrôle quotidien d'isolation SQL (job + alerte) ; le 19/08, connexion croisée réellement tentée et refusée (6/6 vérifications). Limites à écrire : isolation réalisée par l'identité, les secrets et la base, **pas par le réseau** (VPC, connecteur et instance SQL partagés ; règle interne large) ; clé de locataire partielle dans certaines tables du SIEM ; module base de données non réinstanciable ; « seuil à franchir avant un troisième locataire ». Nommage selon D-02.

#### 7.2 §6.7 — Démonstration du fonctionnement global (1 page)

Faits (02_SECURITE §10, 19/08/2026) : 13 requêtes malveillantes (SQLi, XSS, LFI) entre 16:41:xx et 16:41:5x UTC ; 13/13 bloquées en 403 ; requête légitime en 200 ; 13 lignes de journaux avec le service du locataire ; détection R2 à 16:56:08 UTC (≈ 15 min), message « 13 requêtes bloquées … en 15 min », tactique TA0040, technique T1498, attribution au locataire ; contrôle d'isolation relancé en direct (6/6) ; IAM confirmé en direct (deux rôles) ; enrichissement actif (dernier rattachement à 12:16:15 UTC, similarité 0,698, T1556.003). Puis un tableau de correspondance avec les cinq preuves de soutenance (identité, périmètre, RBAC, SOC, CI/CD) et les sections/tests du rapport. Ce que le scénario ne couvre pas : isolation réseau, motif WAF brut, constats SAST.

#### 7.3 §4.4 — De l'attaque à l'incident : fonctionnement de bout en bout et budget de latence (1 page + 1 figure)

Figure TikZ : chronologie horizontale, cinq repères. Texte : quatre étapes.

| Étape | Contenu | Délai | Statut |
|---|---|---|---|
| Blocage | Requête refusée au périmètre avant d'atteindre l'application | synchrone ; requête complète ≈ 0,3 s | mesuré 19/08 et 23/08 |
| Visibilité | Blocage journalisé, visible dans le tableau de bord (journaux) | secondes à ~1 min | `\acompleter{mesure horodatage journal → insertion}` |
| Qualification | Requête planifiée sur fenêtre glissante de 15 min → détection R1–R7, tactique/technique ATT&CK, locataire | 5 à 15 min | mesuré : 15 min le 19/08 ; cadence exacte selon D-06 |
| Incident et enrichissement | L'API regroupe par entité et calcule le score à la requête ; l'enrichissement sémantique est ajouté au cycle suivant (15 min ; démarrage à froid 27 s en moyenne, 94 s au pic) | secondes (tableau de bord : 11,5 s au premier accès, 1,1 s puis 0,26 s à chaud) ; + 0–15 min | partiellement mesuré ; segment « détection → incident » selon D-01 |

Phrase de synthèse à utiliser : « Le socle bloque immédiatement, rend le blocage visible en quelques secondes et qualifie l'attaque en incident en un quart d'heure au plus. Ce délai de qualification est un choix de coût (écart É5), pas une limite technique. » Reprise en §6.3.3 avec les valeurs mesurées.

#### 7.4 Brouillons (résumé, abstract, introduction, conclusion)

Selon la note ESPRIT : introduction = sujet, problème sans résultat, démarche, objectifs, annonce des chapitres ; conclusion = récapitulation, résultats chiffrés, problèmes rencontrés (renvoi §5.10.2), apports professionnels et personnels, perspectives (segmentation réseau par locataire, digest strict, jointure de l'enrichissement au score, signature des images, tests unitaires par règle). Marquer « brouillon à valider ».

### 8. Registre des corrections de fond (résumé opératoire)

| ID | Correction | Dépend de l'auteur ? |
|---|---|---|
| C01 | Date de référence unique ; harmoniser tous les statuts (tab. 25, 34, §6.2.2, conclusions ch. 5 et 6) | Non (date proposée 23/08) |
| C02 | É1 (journaux de refus réseau) → corrigé le 19/08, vérifié ; mettre à jour §5.5.1, tab. 25, 31, 34, T20, §6.2.2 | Non |
| C03 | É3 (identité partagée du service d'encodage) → un seul statut « corrigé le 19/08, vérifié » ; T5/T11/T14 : correction vérifiée dans l'état, rejeu à consigner | Non |
| C04 | Politiques d'organisation : « définies dans le code, inapplicables sans organisation GCP » ; nouvel écart É7 ; critère de T7 révisé (inventaire vide oui ; refus de création non applicable) | Non |
| C05 | Déploiement « par empreinte » → « par étiquette immuable égale au SHA du commit ; empreinte résolue à la reconstruction » ; nouvel écart É8 ; critère de T9 révisé | Non |
| C06 | Environnements : dev et recette existent ; production = cible non provisionnée ; dev non miroir fidèle | Non |
| C07 | §5.9 réécrit (§7.1 ci-dessus) | Nommage : D-02 |
| C08 | Convention de nommage unique application pilote / second locataire | D-02 |
| C09 | Incident « porte SAST en faux vert » (02/08 → 19/08, corrigé, vérifié en CI de branche, 74 constats) en §5.10.2 ; fig. 8 = capture réelle | Non |
| C10 | Retour arrière : testé, 11,6 s / 16,5 s ; corriger §6.5.2 et tab. 36 | Non |
| C11 | Restauration : mesurée sur configuration zonale avant HA (08/08), à revalider | Non |
| C12 | T1 partiellement conforme (motif de traversée brut → 302, H13) ; tab. 31 et 34 | Non |
| C13 | Chaîne d'infrastructure : validation et scan IaC automatisés ; plan revu ; apply manuel par l'administrateur ; T18 révisé | Non |
| C14 | Rate-limiting MFA (`/auth/mfa/*`, 429 vérifié le 19/08) en §5.7 ; preuve pour T2 | Non |
| C15 | Secret MFA chiffré (Fernet) : une phrase en §5.7 | Non |
| C16 | Tab. 20 ligne L6 : quantisation testée et rejetée, modèle fp32 livré | Non |
| C17 | « le sixième flux (F6) » ; « sept niveaux L1–L7 : cinq couches et deux plans » | Non |
| C18 | Tab. 31 : ajouter exfiltration, abus IAM / plan de contrôle, seuils codés en dur, absence de tests par règle | Non |
| C19 | Enrichissement non joint au score : écrire la décision datée | D-03 |
| C20 | Bibliographie : citer ATT&CK-BERT/SMET pour le modèle (pas [3] BERT) ; ajouter les 10 références ; dates de consultation | Non |
| C21 | Journaux d'audit : activité administrateur centralisée ; accès aux données non centralisé (écart assumé) ; protocole T13 | Non |
| C22 | Fusionné à C18 | — |
| C23 | Chronologie cohérente texte / Gantt | D-04 |
| C24 | Tab. 30 et annexe E : statuts proposés (§9) | D-05 pour le reste |
| C25 | Coût par poste | D-07 |
| C26 | Numérotation des tableaux (le tableau des acronymes hors numérotation) | Non |
| C27 | §4.4 et §6.3.3 : budget de latence ; règle sur 45 s | D-01 pour le chiffre |
| C28 | §6.7 démonstration | Non |
| C29 | Rôles réels du tableau de bord (admin, lecteur/analyste, service) | Non |
| C30 | Cadence des requêtes planifiées et fenêtre | D-06 |

### 9. Statuts proposés pour les tests T1–T20 (à reporter dans tab. 30 et annexe E, colonne « preuve datée »)

- **Conforme (état vérifié, rejeu à consigner)** : T2 (11 POST → 10 × 422 puis 429, 19/08 ; règle R1), T5 (deux rôles exacts, usurpation refusée, 23/08 ; `sa-ml-embed` sans rôle BigQuery, 19/08), T11 (droits d'écriture limités à `alert_enrichment`, 19/08).
- **Partiellement conforme** : T1 (403 sur SQLi/XSS/LFI/fichiers sensibles ; 302 sur un motif brut, H13), T3 (balayage tracé et compté exactement le 19/08 ; charge non testée), T7 (inventaire à produire ; refus de création non applicable, É7), T16 (incident CMEK du 08/08 et plan sans différence du 19/08 ; protocole formel à rejouer), T18 (revue de PR et apply manuel ; approbation non outillée).
- **Non exécuté (protocole prêt, une commande ou un commit)** : T4, T6, T8, T9 (critère révisé), T10, T12, T13 (protocole précisé), T14, T15, T17, T19, T20 (trace désormais attendue).

Le bilan de tab. 30 doit compter ces trois catégories à la date de référence, avec la liste nominative des tests restants dans `A_COMPLETER_AUTEUR.md`.

### 10. Guide de style (français)

- 12 à 25 mots par phrase ; une idée par phrase ; sujet-verbe-complément ; peu d'incises.
- Remplacer : « matérialiser » → « montrer / mettre en place » ; « démontrable » → « vérifié » (si fait) ; « rapporté sans détour / honnêtement » → énoncé du fait ; « dissimuler » → supprimer la phrase ; « verrou » réservé à V1–V4 ; « pièce maîtresse », « exemplaire », « le meilleur … de tout le projet » → supprimer.
- Une seule phrase de principe par chapitre, dans l'introduction du chapitre.
- Définir à la première occurrence : locataire, requête planifiée, fenêtre glissante, porte bloquante, empreinte (digest), étiquette (tag), fédération d'identité, démarrage à froid, dérive, plan (Terraform), apply.
- Feuille de route (5–8 lignes) en tête de chapitre ; conclusion (8–10 lignes) en fin de chapitre.
- Le rôle de l'élève-ingénieur doit être visible (§1.1.3, §5.10, conclusion) ; la première personne y est autorisée.
- Exemples en italique, conclusions en gras, avec parcimonie ; citations courtes entre « ».

### 11. Questions du jury à couvrir (vérification en phase 3)

1 Rôle personnel vs application existante (§1.1.3, §1.3.2) · 2 Délai attaque → alerte (§4.4, §6.3.3) · 3 Tests non exécutés (§6.2) · 4 Un seul VPC pour deux locataires (§5.9, §6.8) · 5 Politiques d'organisation sans organisation GCP (§4.6, É7) · 6 Empreinte ou étiquette (§5.3.1) · 7 « Sigma » sans règle Sigma (§2.3.2, §5.5.2) · 8 Utilité d'ATT&CK-BERT si le score l'ignore (§5.6.2, §6.4) · 9 Durée de reconstruction, retour arrière, restauration (§6.5.2) · 10 Coût mensuel (§6.5.3) · 11 Faux positifs (§6.3, §6.8) · 12 Ce qui n'est pas détecté (§6.3.2) · 13 Motif WAF laissé passer (T1, §6.8) · 14 Pourquoi BigQuery (§2.3) · 15 RGPD et données biométriques (§1.5.1, §5.5.1) · 16 Nouveauté du travail (§2.6.2, §5.8) · 17 Planning (§5.10.4) · 18 Deux environnements seulement (§5.1.1).

### 12. Corrections de forme LaTeX (phase 4)

L1 liste des graphiques (déclaration du flottant `graph` et `\listof`) · L2 `cleveref` en français (`\crefname`, `\crefpairconjunction{ et }`), suppression des doublons « tableau table », plus aucun « and » · L3 tableau des acronymes hors numérotation · L4 tableaux coupés : `[!htbp]`/`\FloatBarrier`, légende « (suite) » sans double entrée · L5 `openany`, suppression des `\clearpage` inutiles, placeholders à 0,25 page · L6 page de garde : « DevSecOps » insécable, titre sur trois lignes si besoin · L7/L8 macros `\acompleter` et `\attente` avec bascule brouillon/final · L9 captures groupées a/b par test (`subcaption`) · L10 `\url{}` propre, `urldate` affiché · L11 entrées `.bib` manquantes · L12 `setspace` 1.15, `geometry` 2,5 cm, Times 12 · L14 un seul graphique de démarrage à froid · L15 police minimale 8 pt dans les figures · L16 entrées « Liste des figures / tableaux / graphiques » dans la table des matières · L17 page de validation en dernière page.

### 13. Conformité ESPRIT (checklist à remplir)

Page de garde selon le modèle · ~40 pages hors annexes (écart justifié, cible 55–60 validée par l'encadrant) · introduction en cinq mouvements · chaque chapitre : introduction, développement, conclusion · description du travail proposé et du travail réalisé · planning sur une page complète en fin de description du travail · difficultés rencontrées et changements aux objectifs initiaux · conclusion en cinq points · bibliographie complète (auteurs, titre, éditeur, date, URL + date de consultation) · Times New Roman 12, marges 2,5 cm, interligne 1.15, justifié · titres numérotés en gras · figures numérotées par type avec légende et appel · citations courtes entre guillemets · alinéa 0,5 cm · pas de code dans le corps · pas de page de trois lignes ni de figure orpheline.

### 14. Captures d'écran (emplacements à préparer)

Macro `\capture{ID}{légende}{consigne de masquage}` ; appel dans le texte pour chaque ID. Emplacements : K01 fig. 7 (secret) · K02 fig. 8 (SAST, 74 constats, 19/08 — existe) · K03 fig. 9 (CVE critique) · K04 fig. 10 (IaC refusé) · K05 §5.7 ligne R2 (existe, 23/08) · K06 indicateurs d'enrichissement · K07 §5.9 contrôle d'isolation 6/6 (existe, 19/08) · K09 Gantt · K10 T4 · K11 T11 · K12 T7 (inventaire vide, sans refus de création) · K13 T16 · K14 T1 quatre `curl` (existe, 23/08) · K15 T2 429 (existe, 19/08) · K16 T5 deux rôles + usurpation refusée (existe, 23/08) · K17 graph. 3 couverture · K18 graph. 4 M0/M1/M2 · K19 fig. 17 reconstruction · K20 retour arrière · K21 §6.7 scénario 19/08 (existe) · K22 `terraform plan` sans différence (existe, 19/08) · K23 run CI vert (existe, 16/08) · K24 annexe B extraits réels. Règles : horodatage visible, aucune valeur secrète, identifiants de projet et courriels masqués, police lisible, cadre fin, légende datée.

### 15. Définition de « terminé »

- [ ] Toutes les corrections C01–C30 sont appliquées ou tracées comme dépendant d'une décision D-xx.
- [ ] Aucune contradiction interne (statuts, numéros de flux, nombre de couches, quantisation, environnements).
- [ ] Aucune affirmation non prouvée ; aucune valeur non datée ; aucun « 45 s » sans mesure.
- [ ] Sommaire conforme à §6.2 ; budget de pages tenu ; moins de 5 pages peu remplies.
- [ ] §4.4, §5.9, §6.7 rédigés à partir des sources ; brouillons du résumé, de l'abstract, de l'introduction et de la conclusion livrés.
- [ ] Style : moyenne ≤ 22 mots par phrase, < 5 % de phrases > 40 mots, < 100 tirets cadratins hors tableaux, zéro terme de la liste interdite.
- [ ] Forme : compilation propre, listes correctes, références en français, bibliographie complète, placeholders invisibles en version de remise.
- [ ] Livrables 1 à 8 fournis ; résumé de chaque phase envoyé à l'auteur.

### 16. Format des comptes rendus

À la fin de chaque phase : 10 lignes maximum — ce qui a été fait, ce qui reste, les décisions attendues de l'auteur, le nombre de pages du corps, les risques restants. En cas de doute sur le fond, ne pas trancher : formuler prudemment, consigner la question dans `DECISIONS_AUTEUR.md` et continuer.
