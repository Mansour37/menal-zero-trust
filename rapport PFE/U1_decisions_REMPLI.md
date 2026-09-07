# U1 — Décisions (rempli) — MENAL, rapport PFE

> Décisions prises à votre demande (« je vous laisse à vous »), justifiées et alignées sur les sources
> (01_ARCHITECTURE, 02_SECURITE, guide vidéo) et sur vos trois captures du 25/08/2026.
> Ce qui reste à vous : une seule ligne (spécialité ESPRIT). Tout le reste est décidé.

## Identité (page de garde)
- **Étudiant :** Mansour HABIBOULLAH
- **Encadrant académique (ESPRIT) :** Rihem Matoussi
- **Encadrant entreprise (MENAL-SARL) :** Houssein Ezzedine
- **Entreprise :** MENAL-SARL — Avenue Cheikh Bouddah Ould El Bousseiry 741, Nouakchott, Mauritanie
- **Année universitaire :** 2025–2026
- **Titre retenu :** « Socle GCP sécurisé — Zero Trust, DevSecOps et détection enrichie par IA » (sous-titre : hébergement et sécurisation des applications MENAL). Le titre du Plan Travail (« Conception d'une architecture cloud sécurisée Zero Trust avec approche DevSecOps ») reste utilisable ; le titre retenu est plus précis et couvre la partie détection/IA qui est votre apport.
- **À COMPLÉTER (vous, 5 s) :** spécialité / filière ESPRIT (ex. : GLSI, Sécurité, Cloud…). Seul champ manquant.

## D-01 — Message « proche du temps réel » (délai)
**Décision : Option A avec budget de latence, sans le chiffre « 45 s » tant qu'une mesure datée n'est pas relevée.** Le rapport présente quatre étapes : blocage immédiat (< 1 ms de décision, requête complète ≈ 0,3 s, mesuré 23–25/08) → visibilité en quelques secondes → qualification en 5 min (cadence des règles, voir D-06) → incident calculé à la requête, en secondes (l'écran Incidents du 25/08 se recalcule à l'affichage). Phrase à utiliser : « Le socle bloque immédiatement, rend le blocage visible en quelques secondes, et qualifie l'attaque en incident en quelques minutes. » Le chiffre « 45 s » ne sera écrit que pour le segment « détection écrite → incident affiché » **si** vous relevez la mesure (kit U4) ; sinon « quelques secondes, à la requête ».

## D-02 — Nommage (application pilote / locataires)
**Décision : deux locataires nommés MENAL et ELSON.** Le socle héberge (1) **MENAL** — les services de la plateforme elle-même (API, tableau de bord) — et (2) **ELSON** — une application cliente (plateforme de collecte vocale participative), utilisée comme premier cas réel et comme preuve du multi-locataire. On écrit partout « l'application pilote **ELSON** » et « le second locataire **ELSON** » sans distinguer une « organisation Elson » d'une « application ELSON » : cette double graphie des sources est une source de confusion pour le jury, on la supprime. Cohérent avec les back-ends réels (`menal-api-backend-staging`, `menal-elson-api-backend-staging`) visibles sur vos captures.
**À confirmer par vous en 10 s :** vérifier qu'il n'existe pas une troisième entité portant un nom différent. Si ELSON (pilote) et le second locataire sont deux choses distinctes chez vous, dites-le en une ligne et j'ajoute une phrase de distinction ; sinon la convention ci-dessus tient.

## D-03 — Enrichissement sémantique et score d'incident
**Décision : « informationnel assumé », décision datée, jointure au score en perspective.** Vos captures le confirment : l'écran Incidents indique « Score = somme pondérée par sévérité + bonus +15 si 2 tactiques MITRE distinctes » — le score vient des **règles de détection** (tactiques MITRE), pas du modèle. L'écran Vue d'ensemble montre le modèle `attack-bert-onnx-fp32@v1.0` et « 76 alertes enrichies, 34,2 % non mappé » : l'enrichissement **tourne et s'affiche** comme indicateur, mais n'alimente pas le score. Le rapport écrit donc : « Le rattachement sémantique fonctionne et est affiché par détection (technique + alternatives) ; il n'est pas encore joint au score d'incident. Décision du 25/08/2026 : positionnement informationnel assumé ; la jointure au score (ajout d'une colonne d'entité à la table d'enrichissement) est une perspective. »
**Précision technique à corriger dans le rapport (C16) :** le modèle livré est **ONNX en précision fp32** (`attack-bert-onnx-fp32@v1.0`), la quantisation **int8** ayant été testée puis rejetée (0/5 correspondances de premier rang). Écrire « modèle ONNX fp32, quantisation int8 testée et rejetée », et non « export quantisé validé ».

## D-06 — Cadence des règles et de l'enrichissement
**Décision, d'après la source la plus fiable (le tableau de bord réel) :** les **règles de détection SQL sont réévaluées toutes les 5 minutes** (bandeau de l'écran Détections : « règles SQL … réévaluées toutes les 5 min ») ; la **tâche d'enrichissement s'exécute toutes les 15 minutes**. La fenêtre glissante des règles reste de 15 minutes (déduplication). Le rapport écrit : « règles de détection réévaluées toutes les 5 minutes sur une fenêtre glissante de 15 minutes ; enrichissement sémantique toutes les 15 minutes ». Le scénario mesuré du 19/08 (détection à +15 min) correspond à la fenêtre, pas à la cadence.
**Vérification 10 s (kit U4) :** `grep -n schedule terraform/modules/detection/main.tf terraform/modules/ml-pipeline/main.tf` pour confirmer « */5 » (détection) et « */15 » (enrichissement). Si l'un diffère, corrigez la valeur ; le reste du raisonnement tient.

## D-10 — Sous-réseau public inutilisé
**Décision : retrait.** Le sous-réseau public n'est utilisé par aucune ressource et affaiblit le discours Zero Trust. Le rapport écrit, à l'écart É2 : « Sous-réseau public non utilisé ; retrait décidé le 25/08/2026, à appliquer par un `terraform apply` (aucune ressource ne l'utilise, aucun impact). » On ne laisse pas « non tranché » dans un rapport final.

## D-11 — Cible de pages
**Décision : corps de 60 pages (maximum 65), hors pages liminaires et annexes.** Écart avec « environ 40 » assumé en une phrase de l'introduction : le rapport documente une chaîne complète besoin → conception → réalisation → preuve, avec matrice de traçabilité et registre des écarts ; ces éléments d'ingénierie justifient le volume. À valider en une ligne avec Mme Matoussi.

## Date de référence du rapport
**Décision : 25/08/2026.** C'est la date de vos preuves les plus récentes (captures du tableau de bord). Tous les statuts d'écarts et de tests sont exprimés « à la date de référence, 25/08/2026 ». À indiquer en §6.1 et en note sous le tableau des écarts.

## Récapitulatif des écarts corrigés grâce aux captures du 25/08
- É1 (journaux de refus réseau) : corrigé le 19/08, vérifié.
- É3 (identité du service d'encodage) : corrigé le 19/08, vérifié.
- É7 (nouveau) : politiques d'organisation définies dans le code mais inapplicables sans organisation GCP.
- É8 (nouveau) : déploiement par étiquette = SHA du commit (empreinte résolue à la reconstruction).
- É2 : sous-réseau public — retrait décidé (D-10).
- Détection « path traversal » : une règle **R3** existe et fonctionne (captures) ; à relier honnêtement à l'écart H13 (un motif brut particulier a renvoyé 302 au lieu de 403) — R3 détecte les tentatives (bloquées ou non), H13 concerne un contournement ponctuel du WAF sur un payload précis. Les deux sont compatibles et doivent être écrits ensemble.
