# PROMPT FINAL — Amélioration et restructuration du rapport de PFE « Socle GCP sécurisé — Zero Trust, DevSecOps et détection enrichie par IA » (MENAL)

> À donner tel quel à l'équipe d'agents chargée d'implémenter les corrections. Le document `MENAL_Rapport_PFE_Diagnostic_et_Plan.md` est joint comme référence détaillée ; ce prompt reprend tout ce qui est nécessaire pour agir.

---

## 1. Votre mission

Vous êtes une équipe d'experts (structuration, réflexion critique, cybersécurité, architecture, réseaux, software engineering, data, product ownership, pédagogie, LaTeX, captures d'écran) chargée d'améliorer un rapport de projet de fin d'études d'ingénieur (ESPRIT) sans en modifier le fond. Le rapport existe déjà en LaTeX (main.tex et fichiers de chapitres et d'annexes, compilé en PDF de 128 pages). Vous devez le rendre :

- **juste** : aligné sur l'état réel du système à une date de référence unique ;
- **structuré** : progression contexte → problème → architecture → conception → implémentation → tests → résultats → démonstration ;
- **compréhensible** : français simple et naturel, phrases courtes, définitions ;
- **solide face à un jury** : aucune affirmation non prouvée, limites nommées avant qu'on les trouve ;
- **professionnel** : forme LaTeX propre, conforme aux consignes ESPRIT ;
- **de longueur maîtrisée** : 55 à 60 pages de corps (introduction → conclusion), 65 au maximum.

Vous ne changez pas le projet : ni son architecture, ni ses résultats, ni ses choix. Vous corrigez, réorganisez, condensez, clarifiez et préparez les emplacements de ce qui sera ajouté ensuite.

## 2. Sources et hiérarchie de vérité

| Priorité | Source | Rôle |
|---|---|---|
| 1 | `02_SECURITE_AUDITS_ECARTS.md` (état au 19/08/2026, §1 registre H/M/L, §7 validation live, §8 clôture, §10 scénario de bout en bout) | Fait foi sur l'état réel de chaque contrôle, écart et test |
| 2 | `01_ARCHITECTURE_MENAL.md` (état au 19/08/2026) | Fait foi sur l'architecture réellement déployée, les cadences, les mesures |
| 3 | `guide_reel_preuves_menal.html` (preuves capturées le 23/08/2026, annexe A « journal de validation live ») | Fait foi sur les preuves datées du 23/08 ; **ne modifie pas le rapport**, sert de référence pour §6.7 et pour les captures |
| 4 | `main.pdf` / sources LaTeX (compilé le 16/08/2026) | Texte de départ ; ses statuts sont dépassés quand ils contredisent 1–3 |
| 5 | Note pédagogique ESPRIT (`Rapport_Stage_Pédagogique.pdf`) | Consignes de forme et de contenu obligatoires |
| 6 | `MENAL_Rapport_PFE_Diagnostic_et_Plan.md` | Analyse détaillée, registre C01–C30, plan de captures K01–K24, questions du jury |

En cas de contradiction entre deux sources, la source de priorité la plus haute l'emporte ; si la contradiction subsiste (ex. cadence 5 ou 15 min), vous **ne tranchez pas** : vous écrivez la formulation prudente et vous ajoutez une ligne dans `DECISIONS_AUTEUR.md`.

## 3. Règles absolues

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

## 4. Livrables attendus

1. Sources LaTeX modifiées, compilant sans erreur ni avertissement de référence, avec un `main.pdf` final.
2. `REGISTRE_CORRECTIONS.md` : les corrections C01–C30 avec statut (appliquée / en attente de l'auteur / non applicable et pourquoi).
3. `DECISIONS_AUTEUR.md` : décisions D-01 à D-14 avec, pour chacune, la question, les options et l'endroit du rapport impacté.
4. `A_COMPLETER_AUTEUR.md` : liste exhaustive des `\acompleter{}` restants (section, contenu attendu, taille indicative, source possible).
5. `PLAN_CAPTURES.md` : emplacements K01–K24 avec légende, appel dans le texte, consigne de masquage, existence de la preuve.
6. `QUESTIONS_JURY.md` : les 18 questions probables et, pour chacune, la section qui y répond et la réponse en trois lignes.
7. `CHANGELOG_RAPPORT.md` et `CHECKLIST_ESPRIT.md` (consignes de forme cochées).
8. Un résumé de fin de chaque phase (10 lignes) adressé à l'auteur.

## 5. Organisation en quatre phases

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

## 6. Structure cible

### 6.1 Budget de pages (corps = introduction → conclusion)

Introduction 2 · Ch. 1 : 8 · Ch. 2 : 6–7 · Ch. 3 : 8 · Ch. 4 : 9 · Ch. 5 : 12 · Ch. 6 : 10–11 · Conclusion 2 · **Total 57–60** (max 65). Pages liminaires ≤ 14. Annexes ≤ 28.

### 6.2 Sommaire cible

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

### 6.3 Retraits, fusions et déplacements

- Tab. 8 + tab. 9 → un tableau ; tab. 13 + 14 + 15 → un tableau de synthèse (détail en annexe C) ; tab. 22 → deux phrases + liste des trois exigences partielles.
- §2.2.2 + §2.2.3 → une section ; §2.4.2 et §2.5 raccourcis d'un tiers ; §4.2.2 réduit de moitié.
- Graphique 2 (§5.10.2) supprimé, renvoi au graphique 5 (§6.5.1) — ou l'inverse, une seule occurrence.
- L'incident « état divergent après application partielle » est raconté une fois (§5.10.2) et référencé ailleurs.
- Annexe A.2 complétée avec le détail comparatif du chapitre 2.
- Versos blancs supprimés (`openany`) sauf exigence contraire de l'encadrant.

## 7. Contenus nouveaux à rédiger (à partir des sources uniquement)

### 7.1 §5.9 — Accueil d'un second locataire : preuve vivante et limites (0,7 page)

Faits (01_ARCHITECTURE UC7 ; 02_SECURITE §10, H6, H7, M16, M19) : second locataire accueilli en recette le 07/08/2026 par instanciation du module d'exécution paramétrique ; compte de service dédié (deux rôles : client base de données, écriture de journaux) ; base et utilisateur dédiés ; DNS et certificat gérés ; six alertes et une sonde ; secrets et espace média chiffrés par clé gérée depuis le 08/08 ; contrôle quotidien d'isolation SQL (job + alerte) ; le 19/08, connexion croisée réellement tentée et refusée (6/6 vérifications). Limites à écrire : isolation réalisée par l'identité, les secrets et la base, **pas par le réseau** (VPC, connecteur et instance SQL partagés ; règle interne large) ; clé de locataire partielle dans certaines tables du SIEM ; module base de données non réinstanciable ; « seuil à franchir avant un troisième locataire ». Nommage selon D-02.

### 7.2 §6.7 — Démonstration du fonctionnement global (1 page)

Faits (02_SECURITE §10, 19/08/2026) : 13 requêtes malveillantes (SQLi, XSS, LFI) entre 16:41:xx et 16:41:5x UTC ; 13/13 bloquées en 403 ; requête légitime en 200 ; 13 lignes de journaux avec le service du locataire ; détection R2 à 16:56:08 UTC (≈ 15 min), message « 13 requêtes bloquées … en 15 min », tactique TA0040, technique T1498, attribution au locataire ; contrôle d'isolation relancé en direct (6/6) ; IAM confirmé en direct (deux rôles) ; enrichissement actif (dernier rattachement à 12:16:15 UTC, similarité 0,698, T1556.003). Puis un tableau de correspondance avec les cinq preuves de soutenance (identité, périmètre, RBAC, SOC, CI/CD) et les sections/tests du rapport. Ce que le scénario ne couvre pas : isolation réseau, motif WAF brut, constats SAST.

### 7.3 §4.4 — De l'attaque à l'incident : fonctionnement de bout en bout et budget de latence (1 page + 1 figure)

Figure TikZ : chronologie horizontale, cinq repères. Texte : quatre étapes.

| Étape | Contenu | Délai | Statut |
|---|---|---|---|
| Blocage | Requête refusée au périmètre avant d'atteindre l'application | synchrone ; requête complète ≈ 0,3 s | mesuré 19/08 et 23/08 |
| Visibilité | Blocage journalisé, visible dans le tableau de bord (journaux) | secondes à ~1 min | `\acompleter{mesure horodatage journal → insertion}` |
| Qualification | Requête planifiée sur fenêtre glissante de 15 min → détection R1–R7, tactique/technique ATT&CK, locataire | 5 à 15 min | mesuré : 15 min le 19/08 ; cadence exacte selon D-06 |
| Incident et enrichissement | L'API regroupe par entité et calcule le score à la requête ; l'enrichissement sémantique est ajouté au cycle suivant (15 min ; démarrage à froid 27 s en moyenne, 94 s au pic) | secondes (tableau de bord : 11,5 s au premier accès, 1,1 s puis 0,26 s à chaud) ; + 0–15 min | partiellement mesuré ; segment « détection → incident » selon D-01 |

Phrase de synthèse à utiliser : « Le socle bloque immédiatement, rend le blocage visible en quelques secondes et qualifie l'attaque en incident en un quart d'heure au plus. Ce délai de qualification est un choix de coût (écart É5), pas une limite technique. » Reprise en §6.3.3 avec les valeurs mesurées.

### 7.4 Brouillons (résumé, abstract, introduction, conclusion)

Selon la note ESPRIT : introduction = sujet, problème sans résultat, démarche, objectifs, annonce des chapitres ; conclusion = récapitulation, résultats chiffrés, problèmes rencontrés (renvoi §5.10.2), apports professionnels et personnels, perspectives (segmentation réseau par locataire, digest strict, jointure de l'enrichissement au score, signature des images, tests unitaires par règle). Marquer « brouillon à valider ».

## 8. Registre des corrections de fond (résumé opératoire)

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

## 9. Statuts proposés pour les tests T1–T20 (à reporter dans tab. 30 et annexe E, colonne « preuve datée »)

- **Conforme (état vérifié, rejeu à consigner)** : T2 (11 POST → 10 × 422 puis 429, 19/08 ; règle R1), T5 (deux rôles exacts, usurpation refusée, 23/08 ; `sa-ml-embed` sans rôle BigQuery, 19/08), T11 (droits d'écriture limités à `alert_enrichment`, 19/08).
- **Partiellement conforme** : T1 (403 sur SQLi/XSS/LFI/fichiers sensibles ; 302 sur un motif brut, H13), T3 (balayage tracé et compté exactement le 19/08 ; charge non testée), T7 (inventaire à produire ; refus de création non applicable, É7), T16 (incident CMEK du 08/08 et plan sans différence du 19/08 ; protocole formel à rejouer), T18 (revue de PR et apply manuel ; approbation non outillée).
- **Non exécuté (protocole prêt, une commande ou un commit)** : T4, T6, T8, T9 (critère révisé), T10, T12, T13 (protocole précisé), T14, T15, T17, T19, T20 (trace désormais attendue).

Le bilan de tab. 30 doit compter ces trois catégories à la date de référence, avec la liste nominative des tests restants dans `A_COMPLETER_AUTEUR.md`.

## 10. Guide de style (français)

- 12 à 25 mots par phrase ; une idée par phrase ; sujet-verbe-complément ; peu d'incises.
- Remplacer : « matérialiser » → « montrer / mettre en place » ; « démontrable » → « vérifié » (si fait) ; « rapporté sans détour / honnêtement » → énoncé du fait ; « dissimuler » → supprimer la phrase ; « verrou » réservé à V1–V4 ; « pièce maîtresse », « exemplaire », « le meilleur … de tout le projet » → supprimer.
- Une seule phrase de principe par chapitre, dans l'introduction du chapitre.
- Définir à la première occurrence : locataire, requête planifiée, fenêtre glissante, porte bloquante, empreinte (digest), étiquette (tag), fédération d'identité, démarrage à froid, dérive, plan (Terraform), apply.
- Feuille de route (5–8 lignes) en tête de chapitre ; conclusion (8–10 lignes) en fin de chapitre.
- Le rôle de l'élève-ingénieur doit être visible (§1.1.3, §5.10, conclusion) ; la première personne y est autorisée.
- Exemples en italique, conclusions en gras, avec parcimonie ; citations courtes entre « ».

## 11. Questions du jury à couvrir (vérification en phase 3)

1 Rôle personnel vs application existante (§1.1.3, §1.3.2) · 2 Délai attaque → alerte (§4.4, §6.3.3) · 3 Tests non exécutés (§6.2) · 4 Un seul VPC pour deux locataires (§5.9, §6.8) · 5 Politiques d'organisation sans organisation GCP (§4.6, É7) · 6 Empreinte ou étiquette (§5.3.1) · 7 « Sigma » sans règle Sigma (§2.3.2, §5.5.2) · 8 Utilité d'ATT&CK-BERT si le score l'ignore (§5.6.2, §6.4) · 9 Durée de reconstruction, retour arrière, restauration (§6.5.2) · 10 Coût mensuel (§6.5.3) · 11 Faux positifs (§6.3, §6.8) · 12 Ce qui n'est pas détecté (§6.3.2) · 13 Motif WAF laissé passer (T1, §6.8) · 14 Pourquoi BigQuery (§2.3) · 15 RGPD et données biométriques (§1.5.1, §5.5.1) · 16 Nouveauté du travail (§2.6.2, §5.8) · 17 Planning (§5.10.4) · 18 Deux environnements seulement (§5.1.1).

## 12. Corrections de forme LaTeX (phase 4)

L1 liste des graphiques (déclaration du flottant `graph` et `\listof`) · L2 `cleveref` en français (`\crefname`, `\crefpairconjunction{ et }`), suppression des doublons « tableau table », plus aucun « and » · L3 tableau numéroté 1 absent de la liste (probablement les acronymes) : hors numérotation ou compteur corrigé · L4 tableaux coupés : `[!htbp]`/`\FloatBarrier`, légende « (suite) » sans double entrée · L5 `openany`, suppression des `\clearpage` inutiles, placeholders à 0,25 page · L6 page de garde : « DevSecOps » insécable, titre sur trois lignes si besoin · L7/L8 macros `\acompleter` et `\attente` avec bascule brouillon/final · L9 captures groupées a/b par test (`subcaption`) · L10 `\url{}` propre, `urldate` affiché · L11 entrées `.bib` manquantes · L12 `setspace` 1.15, `geometry` 2,5 cm, Times 12 · L14 un seul graphique de démarrage à froid · L15 police minimale 8 pt dans les figures · L16 entrées « Liste des figures / tableaux / graphiques » dans la table des matières · L17 page de validation en dernière page.

## 13. Conformité ESPRIT (checklist à remplir)

Page de garde selon le modèle · ~40 pages hors annexes (écart justifié, cible 55–60 validée par l'encadrant) · introduction en cinq mouvements · chaque chapitre : introduction, développement, conclusion · description du travail proposé et du travail réalisé · planning sur une page complète en fin de description du travail · difficultés rencontrées et changements aux objectifs initiaux · conclusion en cinq points · bibliographie complète (auteurs, titre, éditeur, date, URL + date de consultation) · Times New Roman 12, marges 2,5 cm, interligne 1.15, justifié · titres numérotés en gras · figures numérotées par type avec légende et appel · citations courtes entre guillemets · alinéa 0,5 cm · pas de code dans le corps · pas de page de trois lignes ni de figure orpheline.

## 14. Captures d'écran (emplacements à préparer)

Macro `\capture{ID}{légende}{consigne de masquage}` ; appel dans le texte pour chaque ID. Emplacements : K01 fig. 7 (secret) · K02 fig. 8 (SAST, 74 constats, 19/08 — existe) · K03 fig. 9 (CVE critique) · K04 fig. 10 (IaC refusé) · K05 §5.7 ligne R2 (existe, 23/08) · K06 indicateurs d'enrichissement · K07 §5.9 contrôle d'isolation 6/6 (existe, 19/08) · K09 Gantt · K10 T4 · K11 T11 · K12 T7 (inventaire vide, sans refus de création) · K13 T16 · K14 T1 quatre `curl` (existe, 23/08) · K15 T2 429 (existe, 19/08) · K16 T5 deux rôles + usurpation refusée (existe, 23/08) · K17 graph. 3 couverture · K18 graph. 4 M0/M1/M2 · K19 fig. 17 reconstruction · K20 retour arrière · K21 §6.7 scénario 19/08 (existe) · K22 `terraform plan` sans différence (existe, 19/08) · K23 run CI vert (existe, 16/08) · K24 annexe B extraits réels. Règles : horodatage visible, aucune valeur secrète, identifiants de projet et courriels masqués, police lisible, cadre fin, légende datée.

## 15. Définition de « terminé »

- [ ] Toutes les corrections C01–C30 sont appliquées ou tracées comme dépendant d'une décision D-xx.
- [ ] Aucune contradiction interne (statuts, numéros de flux, nombre de couches, quantisation, environnements).
- [ ] Aucune affirmation non prouvée ; aucune valeur non datée ; aucun « 45 s » sans mesure.
- [ ] Sommaire conforme à §6.2 ; budget de pages tenu ; moins de 5 pages peu remplies.
- [ ] §4.4, §5.9, §6.7 rédigés à partir des sources ; brouillons du résumé, de l'abstract, de l'introduction et de la conclusion livrés.
- [ ] Style : moyenne ≤ 22 mots par phrase, < 5 % de phrases > 40 mots, < 100 tirets cadratins hors tableaux, zéro terme de la liste interdite.
- [ ] Forme : compilation propre, listes correctes, références en français, bibliographie complète, placeholders invisibles en version de remise.
- [ ] Livrables 1 à 8 fournis ; résumé de chaque phase envoyé à l'auteur.

## 16. Format des comptes rendus

À la fin de chaque phase : 10 lignes maximum — ce qui a été fait, ce qui reste, les décisions attendues de l'auteur, le nombre de pages du corps, les risques restants. En cas de doute sur le fond, ne pas trancher : formuler prudemment, consigner la question dans `DECISIONS_AUTEUR.md` et continuer.
