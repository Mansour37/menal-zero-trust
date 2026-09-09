# Discours de soutenance — socle MENAL (Zero Trust & DevSecOps)

Support : `soutenance_PFE_socle_MENAL.pptx` (20 slides, notes du présentateur intégrées). Durée cible : **17 minutes** de présentation (slides 1 à 17 et 19), puis **5 minutes** de démonstration vidéo (slide 18), puis questions.

## 1. Minutage

| Slide | Contenu | Temps | Cumul |
|---|---|---|---|
| 1 | Titre | 0.50 min | 0.50 min |
| 2 | Plan | 0.50 min | 1.00 min |
| 3 | 1 — Entreprise d'accueil | 1.00 min | 2.00 min |
| 4 | 2 — Objectifs | 1.00 min | 3.00 min |
| 5 | 3 — Problématique | 1.00 min | 4.00 min |
| 6 | 4 — Solution : le socle | 1.25 min | 5.25 min |
| 7 | 4 — Cas d'utilisation simplifié | 1.00 min | 6.25 min |
| 8 | 5 — Besoins | 0.75 min | 7.00 min |
| 9 | 6 — Outils | 1.00 min | 8.00 min |
| 10 | 7 — Méthodologie | 1.00 min | 9.00 min |
| 11 | 8 — Architecture de déploiement | 1.50 min | 10.50 min |
| 12 | 8 — Identités et MFA | 1.25 min | 11.75 min |
| 13 | 8 — Chaîne de détection | 1.25 min | 13.00 min |
| 14 | 9 — Sprints | 1.00 min | 14.00 min |
| 15 | 9 — Chaîne DevSecOps | 1.25 min | 15.25 min |
| 16 | 9 — Supervision | 1.00 min | 16.25 min |
| 17 | 9 — Validation et résultats | 1.25 min | 17.50 min |
| 18 | 10 — Démonstration vidéo | 0.50 min | 18.00 min |
| 19 | 11 — Perspectives | 1.00 min | 19.00 min |
| 20 | Merci | 0.00 min | 19.00 min |

Total présentation : 17 minutes (hors vidéo). Marge : si le temps manque, raccourcir les slides 9 (outils) et 14 (sprints) à 30 secondes chacune ; ne jamais raccourcir les slides 11, 13, 15 et 17, qui portent la technique et les preuves.

## 2. Discours slide par slide

Pour chaque slide : ce qui est affiché, **ce que je dis** (texte fluide, ≈ 130 à 170 mots par minute), les **trois idées à retenir** (mémorisation) et la **phrase de transition**.

### Slide 1 — Titre  ·  0.50 min

**Affiché.** Titre du projet, sous-titre « le socle MENAL », nom, encadrants, dates.

**Ce que je dis.** Bonjour à tous, Mesdames et Messieurs les membres du jury. Je suis Habiboullah Mansour et je vous présente mon projet de fin d'études, réalisé chez MENAL-SARL à Nouakchott de mars à septembre 2026 : la conception et la réalisation d'une architecture cloud sécurisée, fondée sur le Zero Trust et le DevSecOps, que nous avons appelée le socle MENAL. L'idée en une phrase : offrir à une petite entreprise une plateforme d'hébergement dont la sécurité se démontre, avec une seule personne pour l'exploiter et quelques dizaines d'euros par mois. Ma présentation dure dix-sept minutes, suivie d'une démonstration vidéo de cinq minutes.

**À retenir.**
- Nom, sujet, entreprise, dates.
- Une phrase : une plateforme dont la sécurité se démontre, une personne, quelques dizaines d'euros.
- Annoncer 17 min + vidéo de 5 min.

**Transition.** « Voici le plan. »

### Slide 2 — Plan  ·  0.50 min

**Affiché.** Les onze étapes numérotées, encart 17 min + 5 min vidéo.

**Ce que je dis.** Voici le plan. Je commence par l'entreprise et son application pilote, puis les objectifs et la problématique. Je présente ensuite la solution en trois volets — Zero Trust, supervision, détection — avec un cas d'utilisation simplifié. Suivent les besoins, les outils, la méthodologie, puis la conception et la réalisation, organisée en sprints. La démonstration vidéo illustre trois scènes, et je termine par les perspectives.

**À retenir.**
- Onze étapes, dans l'ordre imposé.
- La vidéo vient après la réalisation.
- Ne pas lire la liste : la résumer en une phrase.

**Transition.** « Commençons par l'entreprise. »

### Slide 3 — 1 — Entreprise d'accueil  ·  1.00 min

**Affiché.** Deux cartes (MENAL-SARL ; ELSON, la valeur à protéger), capture de la page d'accueil d'ELSON, carte « Ma mission ».

**Ce que je dis.** MENAL-SARL est une jeune entreprise mauritanienne de Nouakchott, positionnée sur deux axes : des services d'ingénierie cloud et cybersécurité, et ses propres produits numériques. Le principal est ELSON, une plateforme où des participants traduisent et enregistrent des phrases dans quatre langues nationales ; des relecteurs valident, un classement et une compétition entretiennent la participation. Ces contributions forment un corpus linguistique, premier actif de l'entreprise, et les identités des participants sont des données personnelles. L'équipe technique est réduite : une seule personne est référente sur l'infrastructure. Ma mission couvrait toute la chaîne — auditer, concevoir, construire, mettre en service, mesurer — en tenant les rôles d'architecte, de développeur et d'exploitant.

**À retenir.**
- MENAL-SARL : services cloud/cyber + produits (ELSON).
- ELSON = corpus vocal en quatre langues : actif exclusif + données personnelles.
- Une seule personne référente ; ma mission couvre toute la chaîne.

**Transition.** « Ce contexte fixe les objectifs. »

### Slide 4 — 2 — Objectifs  ·  1.00 min

**Affiché.** Quatre lignes C1→O1 … C4→O4 avec indicateur ; trois contraintes K1–K3.

**Ce que je dis.** L'audit de l'hébergement, mené en mars et avril, a produit quatre constats, et chaque constat est devenu un objectif avec un indicateur mesurable. Confiance implicite au réseau : l'objectif O1 est de contrôler chaque accès par l'identité — une identité par service, aucune clé de longue durée, une base sans adresse publique, un second facteur pour l'administrateur. Infrastructure non reproductible : O2, tout décrire en code et détecter les dérives. Livraison non contrôlée : O3, une chaîne à quatre portes bloquantes, sans clé. Supervision absente : O4, détecter et afficher un incident en moins de trois minutes. Le tout sous trois contraintes : une seule personne, cinquante euros par mois au plus, et le respect des données personnelles. Ces indicateurs sont vérifiés en fin de présentation.

**À retenir.**
- Quatre constats → quatre objectifs, chacun avec un indicateur.
- O1 identité, O2 code, O3 portes, O4 détection < 3 min.
- Trois contraintes : une personne, 50 €, données personnelles.

**Transition.** « Pourquoi est-ce difficile ? La problématique. »

### Slide 5 — 3 — Problématique  ·  1.00 min

**Affiché.** Schéma générique du modèle périmétrique (Internet → pare-feu → serveur unique ; script + clé ; SSH) ; encadré de la problématique ; quatre sous-questions.

**Ce que je dis.** L'existant, ici, n'est pas propre à MENAL : c'est le schéma qu'on retrouve dans la plupart des petites structures. Un serveur unique qui porte l'application et sa base, un pare-feu comme seul contrôle, un déploiement par script depuis un poste personnel avec une clé qui n'expire jamais, un administrateur en SSH, et des journaux qui restent sur le disque. Une fois la frontière franchie, plus rien n'est vérifié. La problématique est donc la suivante : comment une entreprise émergente, avec une personne et quelques dizaines d'euros par mois, peut-elle construire une plateforme Zero Trust et DevSecOps, réutilisable pour plusieurs applications, et dont la sécurité se démontre au lieu de s'affirmer ? Elle se décline en quatre questions : l'accès par l'identité, l'infrastructure en code, la livraison contrôlée, la supervision en minutes.

**À retenir.**
- L'existant décrit est celui de la plupart des petites structures (pas seulement MENAL).
- Un seul contrôle : la frontière ; rien de reproductible ; déploiement et supervision absents.
- La question : Zero Trust + DevSecOps, réutilisable, démontrable, avec une personne et quelques dizaines d'euros.

**Transition.** « Notre réponse : le socle. »

### Slide 6 — 4 — Solution : le socle  ·  1.25 min

**Affiché.** Figure périmètre → Zero Trust ; trois cartes Zero Trust / Supervision / Détection ; bandeau « fondation » ; quatre principes.

**Ce que je dis.** La solution est un socle : une base d'hébergement et de supervision commune, que chaque application rejoint en déclarant ses paramètres. Il tient sur trois volets. Le Zero Trust : un seul point d'entrée filtré par un pare-feu applicatif, une identité par service, aucune clé stockée, une base sans adresse publique, et un administrateur authentifié à deux facteurs — le schéma à gauche montre le passage du périmètre au point de décision. La supervision : les journaux partent en flux vers un entrepôt où chaque table n'a qu'un auteur, un tableau de bord les restitue en temps réel, et les décisions de l'analyste sont conservées. La détection : sept règles versionnées, une corrélation par entité et une qualification assistée par un modèle ATT&CK-BERT, pour un incident affiché en moins de trois minutes. Tout repose sur une fondation : l'infrastructure en code sur trois environnements et une chaîne DevSecOps à quatre portes. Quatre principes guident l'ensemble : l'identité décide, tout est en code, refus par défaut, et soutenable avant tout.

**À retenir.**
- Trois volets : Zero Trust, supervision, détection.
- Fondation : infrastructure en code + chaîne à quatre portes.
- Quatre principes : l'identité décide, tout en code, refus par défaut, soutenable.

**Transition.** « Illustrons par un cas concret. »

### Slide 7 — 4 — Cas d'utilisation simplifié  ·  1.00 min

**Affiché.** Six étapes numérotées de l'attaque au verdict ; bandeau « les participants légitimes continuent » ; quatre chiffres du 07/09.

**Ce que je dis.** Pour fixer les idées, voici le cas d'utilisation que la démonstration reprend. Un attaquant envoie treize charges vers l'API d'ELSON — injections SQL, inclusion de fichier, traversées de chemin. Le point d'entrée les refuse toutes, en 403, et journalise chaque verdict. Ces journaux partent en flux vers l'entrepôt ; le job de détection, qui tourne chaque minute, applique les sept règles : trois se déclenchent et produisent quarante-sept détections dédupliquées. L'API les corrèle en un seul incident pour cette adresse, score cent, deux tactiques MITRE — signe d'une chaîne d'attaque. L'administrateur, connecté avec mot de passe et code TOTP, confirme l'incident dans le tableau de bord. Pendant ce temps, les participants légitimes continuent d'utiliser ELSON : le blocage est fait au bord. Sur les relevés du 7 septembre : deux minutes cinq entre l'attaque et l'incident affiché, deux minutes vingt-trois jusqu'au verdict humain.

**À retenir.**
- Six étapes : attaquant → WAF → collecte → détection → corrélation → verdict.
- Les utilisateurs légitimes ne voient rien : blocage au bord.
- Chiffres du 07/09 : 13 × 403, 2 min 05 s, 2 min 23 s.

**Transition.** « Ce cas repose sur des besoins formalisés. »

### Slide 8 — 5 — Besoins  ·  0.75 min

**Affiché.** Huit BF et sept BNF avec cibles ; encart 12 menaces → 12 exigences → 12 tests.

**Ce que je dis.** Les besoins ont été formalisés à partir des constats et de six cas d'utilisation. Huit besoins fonctionnels : un point d'entrée unique et filtré, une identité par service, l'infrastructure en code, une livraison à portes bloquantes, des journaux centralisés avec un incident affiché en moins de trois minutes, trois techniques ATT&CK proposées par alerte, une corrélation par entité avec des verdicts conservés, et l'accueil d'une application par simple paramétrage. Sept besoins non fonctionnels chiffrés : disponibilité, latence, coût, exploitabilité, reconstruction en moins d'une heure, auditabilité, et résilience avec un RTO inférieur à une heure. L'analyse de risque, menée avec STRIDE en partant des valeurs métier à la manière d'EBIOS, a produit douze menaces, traduites en douze exigences, chacune reliée à un test.

**À retenir.**
- Huit besoins fonctionnels, sept non fonctionnels chiffrés.
- Analyse de risque : 12 menaces → 12 exigences → 12 tests.
- Cible clé : incident ≤ 3 min, coût ≤ 50 €, reconstruction < 1 h.

**Transition.** « Avec quels outils ? »

### Slide 9 — 6 — Outils  ·  1.00 min

**Affiché.** Quatre colonnes : plateforme Google Cloud, infrastructure et livraison, applications du socle, référentiels.

**Ce que je dis.** Les outils sont choisis par couche, et chaque choix du rapport est justifié par un critère décisif et un prix payé. Google Cloud fournit les briques managées : Cloud Run pour l'exécution, Cloud SQL privée, BigQuery pour l'entrepôt et la recherche vectorielle, le répartiteur avec Cloud Armor, IAM avec la fédération OIDC, Secret Manager et KMS, la journalisation et la planification. L'infrastructure et la livraison reposent sur Terraform et GitHub Actions, avec les quatre portes : Gitleaks pour les secrets, Semgrep pour le code, pytest et jest pour les tests, Trivy pour les images. Les applications du socle : FastAPI pour l'API, Next.js pour le tableau de bord, PostgreSQL, ATT&CK-BERT exécuté avec ONNX, et le TOTP pour le second facteur. Enfin les référentiels qui servent de grille : NIST 800-207 et 800-218, MITRE ATT&CK, OWASP, CIS, EBIOS et STRIDE.

**À retenir.**
- Un choix par couche, justifié par un critère et un prix payé.
- Google Cloud managé ; Terraform + GitHub Actions ; quatre portes.
- Applications : FastAPI, Next.js, PostgreSQL, ATT&CK-BERT/ONNX, TOTP ; référentiels NIST, MITRE, OWASP, CIS.

**Transition.** « Comment avons-nous travaillé ? »

### Slide 10 — 7 — Méthodologie  ·  1.00 min

**Affiché.** Six chevrons (audit → validation) avec boucle rouge ; trois cartes : règles de travail, quatre rangs de preuve, deux méthodes de risque.

**Ce que je dis.** La méthode va de la valeur à la preuve, en six étapes qui sont aussi les six chapitres du mémoire : l'audit et ses constats, l'état de l'art et les choix justifiés, l'analyse des menaces qui produit les exigences, la conception avec des décisions datées, la réalisation, puis la validation. La flèche rouge est essentielle : un test qui échoue rouvre la conception — c'est arrivé, et je le montrerai. Trois règles de travail : des itérations de deux semaines closes par une démonstration, un journal de décisions daté, et surtout des tests écrits avant la conception — le test T-n vérifie l'exigence EX-n. Chaque preuve porte un rang, du test automatisé rejoué à chaque livraison jusqu'à la configuration contrôlée. L'analyse de risque combine EBIOS pour partir des valeurs métier et STRIDE pour examiner chaque flux.

**À retenir.**
- De la valeur à la preuve, six étapes = six chapitres.
- Tests écrits avant la conception : Tn vérifie EXn ; un échec rouvre la conception.
- Quatre rangs de preuve ; EBIOS + STRIDE.

**Transition.** « Passons à la conception. »

### Slide 11 — 8 — Architecture de déploiement  ·  1.50 min

**Affiché.** Diagramme de déploiement réel (recette, 08/09) ; trois cartes : chemin entrant, chemin vers la base, l'identité décide.

**Ce que je dis.** Voici le déploiement réel de l'environnement de recette, relevé le 8 septembre. En haut, une seule adresse publique : le répartiteur HTTPS avec Cloud Armor. Les services Cloud Run — le site et l'API d'ELSON, l'API de supervision, le tableau de bord, l'encodeur — n'acceptent que le trafic du répartiteur ; trois jobs complètent l'ensemble : détection, enrichissement et contrôle d'isolation des bases. Les services rejoignent le réseau privé par un connecteur d'accès VPC, et la base Cloud SQL n'est joignable que par son adresse privée, en TLS, avec une base et un utilisateur par application. À droite, les services managés : journalisation en flux vers BigQuery, planificateur, identités fédérées, secrets et clés. Trois lectures : un seul chemin entrant, un seul chemin vers la base, et pour tout le reste l'autorisation dépend de l'identité, pas du réseau.

**À retenir.**
- Un seul chemin entrant (répartiteur + WAF).
- Un seul chemin vers la base (connecteur VPC → 10.20.0.3, TLS).
- Pour le reste : l'identité décide (IAM, WIF, secrets, KMS).

**Transition.** « Voyons ces identités de près. »

### Slide 12 — 8 — Identités et MFA  ·  1.25 min

**Affiché.** Neuf identités avec « peut / ne peut pas » condensé ; séquence MFA ; deux écrans réels.

**Ce que je dis.** Puisque l'identité décide, la matrice des identités est le principal instrument de cloisonnement. Neuf identités : l'administrateur, seul humain, propriétaire du projet, protégé par un second facteur et tracé à chaque action ; et huit comptes de service, un par composant. Ce qui compte, ce sont les interdictions : l'application ELSON ne peut pas toucher l'entrepôt, l'API ne peut pas écrire dans les tables de preuves, l'encodeur n'a aucune sortie, et la chaîne de livraison n'a aucune clé — elle s'authentifie par fédération, restreinte au dépôt et à la branche principale. À droite, la session administrateur : le mot de passe donne un jeton intermédiaire de cinq minutes qui ne porte aucun rôle ; seul le code TOTP le convertit en jeton d'accès de soixante minutes. Le contrôle, c'est cette séparation entre authentifié et autorisé. Les compteurs anti-force brute sont indexés sur l'identifiant et le jeton, pas sur l'adresse IP, et la graine TOTP vit dans Secret Manager.

**À retenir.**
- Neuf identités, zéro clé ; les interdictions font la segmentation.
- Chaîne fédérée OIDC restreinte au dépôt et à la branche main.
- MFA : jeton intermédiaire sans rôle → TOTP → jeton d'accès ; compteurs par identifiant et par jeton.

**Transition.** « Dernier élément de conception : la détection. »

### Slide 13 — 8 — Chaîne de détection  ·  1.25 min

**Affiché.** Chaîne en flux avec budget de temps ; sept règles par sévérité ; carte « ce qui fait la détection ».

**Ce que je dis.** La chaîne de détection tourne en flux. Cloud Armor bloque et journalise en temps réel ; le routeur de journaux écrit en continu dans BigQuery ; chaque minute, un job normalise les nouvelles entrées et exécute les sept règles sur une fenêtre de cinq minutes ; le job d'enrichissement propose trois techniques ATT&CK par détection ; l'API corrèle et le tableau de bord se rafraîchit toutes les dix secondes. La somme des bornes donne moins de trois minutes — la première conception, par requêtes planifiées, mettait quinze minutes : le délai était dans la cadence, pas dans le calcul. Les sept règles couvrent cinq tactiques MITRE, de la force brute à l'injection ; leur déduplication est déterministe grâce à un identifiant SHA-256, ce qui fait qu'une rafale produit une détection et non dix. La corrélation regroupe les détections par entité en un incident avec un score pondéré, majoré si plusieurs tactiques sont impliquées. Trois alertes de plateforme surveillent la plateforme elle-même, dont l'absence de journaux.

**À retenir.**
- Flux : WAF → Log Router → BigQuery → job à la minute → enrichissement → API → tableau de bord.
- Budget < 3 min par construction ; 15 min avant D9.
- Sept règles, cinq tactiques, déduplication SHA-256, score d'incident, trois alertes de plateforme.

**Transition.** « Comment tout cela a-t-il été construit ? »

### Slide 14 — 9 — Sprints  ·  1.00 min

**Affiché.** Frise de sept sprints avec dates et livrables ; planning Gantt ; jalons.

**Ce que je dis.** Le stage s'est déroulé en itérations de deux semaines, que je regroupe ici en sept sprints. Le cadrage et l'audit en mars ; l'état de l'art et l'analyse des menaces en avril et mai ; la conception jusqu'à la mi-juin ; puis l'infrastructure en code et les deux chaînes automatisées jusqu'en juillet, avec un jalon important : la recette reconstruite intégralement depuis le dépôt en quarante-et-une minutes. La supervision — règles, enrichissement, API, tableau de bord — de juillet à mi-août ; l'accueil d'ELSON et la campagne de tests en août, avec ses corrections ; et le dernier sprint, début septembre, consacré au passage en flux de la détection, aux cinq refus provoqués et au scénario final. Les phases se chevauchent volontairement : les tests étaient prêts avant les composants.

**À retenir.**
- Sept sprints de mars à septembre, sept jalons.
- Jalon fort : recette reconstruite depuis le dépôt en 41 min.
- Dernier sprint : passage en flux, cinq refus provoqués, scénario du 07/09.

**Transition.** « Zoom sur la chaîne DevSecOps. »

### Slide 15 — 9 — Chaîne DevSecOps  ·  1.25 min

**Affiché.** Chaîne de livraison à huit étapes et quatre portes avec durées ; quatre refus provoqués ; capture Trivy.

**Ce que je dis.** La chaîne de livraison compte huit étapes, calquées sur la conception, dont quatre portes bloquantes : recherche de secrets, analyse du code, tests, analyse de l'image. L'ordre n'est pas arbitraire : un secret poussé est compromis à la seconde, on le cherche donc en premier. Entre la construction et l'analyse, l'image n'existe qu'en artefact interne : publier une image non scannée est techniquement impossible ; la publication et le déploiement se font par empreinte SHA-256, et une sonde vérifie le service à travers le WAF. Sur le run de référence, la chaîne complète prend cinq minutes trente-sept. Surtout, chaque porte a été éprouvée par un refus provoqué le 7 septembre : une clé injectée, un appel eval, un test en échec, une dépendance PyYAML vulnérable — et à chaque fois la chaîne s'éteint pile au maillon attaqué, rien n'est publié. Une porte a aussi refusé une livraison réelle en août, sur une CVE embarquée par le gestionnaire de paquets de l'image de base.

**À retenir.**
- Huit étapes, quatre portes ; 5 min 37 sur le run de référence.
- Image en artefact interne : publier sans scan est impossible ; déploiement par empreinte.
- Cinq refus provoqués le 07/09 + un refus réel le 20/08.

**Transition.** « Puis la supervision. »

### Slide 16 — 9 — Supervision  ·  1.00 min

**Affiché.** Captures vue d'ensemble et incidents ; quatre chiffres ; carte « ce que voit l'administrateur ».

**Ce que je dis.** Voici le tableau de bord MENAL Sentinel, en recette, le soir du scénario. La vue d'ensemble distingue le trafic applicatif de la détection : requêtes, taux d'erreur, blocages du WAF, part d'alertes non mappées par le modèle — un indicateur d'honnêteté que l'on ne cache pas. L'écran des incidents est le vrai apport : quarante-sept détections d'une même adresse deviennent un incident unique, score cent, deux tactiques, confirmé par l'administrateur. Quelques chiffres relevés le 8 septembre : deux cent trente-deux mille journaux bruts collectés, deux cent quatre-vingt-quatre détections, vingt-trois verdicts. La qualification assistée place la bonne technique parmi les trois candidats dans quatre-vingt-huit pour cent des cas sur quarante alertes étiquetées. Les verdicts sont écrits en ajout seul : la preuve n'est jamais modifiée. Le socle propose, l'analyste décide.

**À retenir.**
- MENAL Sentinel : vue d'ensemble, détections, incidents, santé des règles, vulnérabilités.
- 47 détections → un incident, score 100, verdict conservé en ajout seul.
- Chiffres : 232 254 journaux, 284 détections, 23 verdicts, précision 0,88.

**Transition.** « Et la validation. »

### Slide 17 — 9 — Validation et résultats  ·  1.25 min

**Affiché.** Grille des douze tests ; note sur T1, T6, T11 ; six mesures.

**Ce que je dis.** La campagne finale compte douze tests, un par exigence : dix conformes, deux partiellement conformes, aucun non conforme. J'insiste sur deux points de méthode. D'abord T1, le filtrage : il était non conforme le 23 août — une traversée de chemin brute était redirigée au lieu d'être refusée ; le correctif a été appliqué et le re-test du 7 septembre refuse les treize charges. Cette non-conformité est conservée dans le mémoire : elle prouve que les tests ont été écrits avant la conception. Ensuite les deux tests partiels, T6 et T11, sont nommés avec leur part manquante et leur correctif, plutôt que déclarés conformes sans relevé. Les mesures : deux minutes cinq entre l'attaque et l'incident, contre quinze minutes avant le passage en flux ; quatre-vingt-dix-neuf virgule six pour cent de disponibilité ; une reconstruction complète en quarante-et-une minutes ; une restauration en trente-deux minutes sans perte ; un retour arrière en onze secondes ; et quarante-et-un euros par mois, dont quatre-vingt-huit pour cent de coûts fixes.

**À retenir.**
- 12 tests : 10 conformes, 2 partiels, 0 non conforme.
- T1 non conforme le 23/08 → corrigé et rejoué le 07/09 : les tests précèdent la conception.
- Mesures : 2 min 05 s, 99,6 %, 41 min, RTO 32 min 45 s / RPO 0, 11,6 s, 41 €.

**Transition.** « Place à la démonstration. »

### Slide 18 — 10 — Démonstration vidéo  ·  0.50 min

**Affiché.** Trois scènes de la vidéo avec « à observer ».

**Ce que je dis.** Je lance maintenant la démonstration vidéo de cinq minutes, enregistrée sur l'environnement de recette. Trois scènes. La première est la chaîne d'attaque que je vous ai décrite : les treize charges envoyées depuis Kali, les refus 403, puis, dans le tableau de bord, les détections, l'incident à cent points et le verdict — observez les horodatages. La deuxième illustre le Zero Trust : un jeton intermédiaire refusé sur une route métier, une tentative de connexion directe à la base qui échoue, un accès croisé refusé à une identité — le refus vient de l'identité, pas du réseau. La troisième montre la chaîne DevSecOps : une demande de fusion bloquée par la porte Trivy sur une CVE critique, la correction, la chaîne qui redevient verte et le déploiement par empreinte. Rien n'est publié tant qu'une porte est rouge.

**À retenir.**
- Trois scènes : chaîne d'attaque, protection Zero Trust, DevSecOps bloquée puis validée.
- Dire ce qu'il faut observer avant de lancer.
- 5 minutes hors présentation.

**Transition.** « Après la vidéo : les perspectives. »

### Slide 19 — 11 — Perspectives  ·  1.00 min

**Affiché.** Ce qui est démontré ; plan d'amélioration ; trois seuils ; prochaine preuve.

**Ce que je dis.** Pour conclure. Ce que le socle démontre aujourd'hui : une plateforme Zero Trust et DevSecOps exploitée par une seule personne pour quarante-et-un euros par mois ; douze exigences vérifiées par douze tests, chacun avec une preuve datée et hiérarchisée ; ELSON servie avec sa base, son identité et ses secrets propres, la prochaine application s'ajoutant par paramétrage ; et un incident affiché en deux minutes cinq. La revue finale a produit un plan d'amélioration honnête : retirer des droits hérités qui ne servent à aucune charge, chronométrer l'alerte d'absence de journaux pour clore T11, étendre l'alerte de dérive pour clore T6, lire les journaux de flux et signer les images. Trois seuils séparent le socle d'un service commercialisable : alerter réellement une personne d'astreinte, s'engager par écrit, et cloisonner jusqu'au stockage d'objets. La prochaine preuve à dater est la promotion d'ELSON vers la production, par une procédure déjà répétée. Je vous remercie de votre attention et je suis à votre disposition pour vos questions.

**À retenir.**
- Ce qui est démontré : ZT + DevSecOps pour 41 €, 12 tests, ELSON servie, incident en 2 min 05 s.
- Plan d'amélioration honnête (droits hérités, A3, A2, journaux de flux, signature).
- Trois seuils commerciaux ; prochaine preuve : promotion en production v1.0.0.

**Transition.** « Merci ; questions. »

### Slide 20 — Merci  ·  0.00 min

**Affiché.** Merci, dépôt, référence du mémoire.

**Ce que je dis.** Merci de votre attention. Je suis à votre disposition pour vos questions ; l'environnement de recette est accessible si une vérification en direct est souhaitée.

**À retenir.**
- Remercier ; annoncer la disponibilité de l'environnement pour vérification.

## 3. Relecture par un jury d'experts (avant soutenance)

| Relecteur | Question ou remarque attendue | Réponse portée par la présentation | Slide |
|---|---|---|---|
| Jury académique | La démarche est-elle scientifique et vérifiable ? | Six étapes, tests écrits avant la conception, quatre rangs de preuve, résultats défavorables conservés (T1 corrigé, T6/T11 partiels). | 10, 17 |
| Jury académique | Le plan imposé est-il respecté ? Le temps ? | Onze étapes dans l'ordre demandé ; 17 min chronométrées ; vidéo à part. | 2 |
| Expert cloud | Pourquoi un seul fournisseur et quel coût réel ? | Cohérence des services managés pour une personne ; 41 €/mois mesurés, 88 % de coûts fixes (répartiteur, WAF, base) ; HA seulement en production. | 9, 17 |
| Expert cloud | Le réseau est-il réellement privé ? | Connecteur VPC 10.0.3.0/28, appairage 10.20.0.0/16, Cloud SQL 10.20.0.3 sans IPv4 publique, TLS obligatoire ; relevés du 08/09. | 11 |
| Expert cybersécurité | Le WAF suffit-il ? Que se passe-t-il s'il est contourné ? | Entrée Cloud Run réservée au répartiteur (pas de contournement) ; règles OWASP + anomalies de protocole ; T1 rejoué 13/13 ; la détection voit aussi les attaques bloquées. | 7, 11, 17 |
| Expert cybersécurité | Les secrets ? | Neuf secrets, un lecteur par secret, huit chiffrés KMS ; graine TOTP hors base ; chaîne sans aucune clé. | 12 |
| Expert Zero Trust | Où est le point de décision ? L'identité décide-t-elle vraiment ? | Autorisation par identité à chaque appel (IAM par ressource, jetons courts, fédération restreinte) ; le réseau reste une défense complémentaire ; confrontation aux 7 principes NIST dans le mémoire. | 6, 11, 12 |
| Expert Zero Trust | L'administrateur est propriétaire du projet : n'est-ce pas contraire au moindre privilège ? | Seul humain d'une entreprise d'une personne ; second facteur obligatoire, actions tracées et alertées (A1, A2) ; retrait des droits hérités inutiles au plan d'amélioration. | 12, 19 |
| Expert DevSecOps | Une porte qui n'a jamais refusé est-elle une porte ? | Cinq refus provoqués rejouables (Gitleaks 46 s → Trivy 3 min 06) + un refus réel le 20/08 ; image en artefact interne, déploiement par empreinte, sonde via le WAF. | 15 |
| Expert DevSecOps | Pourquoi l'application Terraform reste manuelle ? | Décision : la chaîne ne détient aucun droit d'écriture sur l'infrastructure ; plan relu par l'administrateur avec second facteur ; dérive détectée par plan et alerte A2. | 10, 12 |
| Expert SOC | Sept règles, c'est peu. Que ne détectez-vous pas ? | Cinq tactiques couvertes, liste explicite des non-détections (mouvement latéral refusé, exfiltration vers destination autorisée, fraude métier, attaque distribuée) ; alertes de plateforme A1–A3. | 13, 19 |
| Expert SOC | D'où vient le délai de 2 min 05 s et comment le prouver ? | Budget par maillon (puits en flux ≤ 60 s, job à la minute ≤ 60 s, enrichissement ≤ 15 s, affichage 10 s) ; horodatages du 07/09 ; ancienne conception à 15 min 05 s. | 7, 13 |
| Expert SOC | La qualification par modèle est-elle fiable ? | Déterministe (même alerte → mêmes candidats), 0,88 aux rangs 1–3 sur 40 alertes, seuil 0,60 et part « non mappée » affichée ; l'analyste décide toujours. | 13, 16 |
| Expert présentation | Trop de texte ? Lisibilité ? | ≤ 4 blocs par slide, chiffres en gros, un visuel par slide, titres d'une ligne, aucune coupure de mot ; pas de lecture des slides. | toutes |

## 4. Questions probables et réponses courtes

**Q1. Pourquoi Zero Trust plutôt qu'un simple durcissement du serveur existant ?**  
Parce que le constat C1 est la confiance implicite : durcir la frontière ne change pas le fait qu'un secret volé donne tout. Le Zero Trust déplace la décision vers l'identité, et le socle le prouve par des tests (T3, T4, T5, T10).

**Q2. Le socle est-il vraiment réutilisable ?**  
Oui : accueillir une application = instancier le module `run-service` avec une base et des secrets propres, sans modifier le socle (BF8, UC6). ELSON en est le cas pilote, avec ses deux services et ses cinq secrets.

**Q3. Pourquoi ELSON est servie depuis la recette ?**  
Rodage de trois semaines pour calibrer les seuils R1/R2 sur du trafic réel, sur une topologie identique à la production ; la bascule est un changement DNS et l'application d'un plan déjà répété (reconstruction en 41 min).

**Q4. Une seule instance Cloud SQL pour deux applications, est-ce sûr ?**  
Isolation logique : base et utilisateur par application, super-utilisateur retiré, connexions croisées refusées et vérifiées chaque jour par un job (cinq exécutions consécutives réussies). Le passage à des instances séparées est un paramètre.

**Q5. Pourquoi BigQuery et non un SIEM ?**  
Un seul moteur pour journaux, règles SQL et recherche vectorielle ; coût et exploitation compatibles avec une personne ; le prix payé est l'absence de règles fournies, compensé par sept règles écrites comme du code.

**Q6. Que se passe-t-il si Cloud Logging tombe ?**  
L'alerte A3 signale l'absence de journaux du répartiteur pendant dix minutes ; elle est configurée et sa mesure chronométrée figure au plan d'amélioration — T11 reste partiel, volontairement.

**Q7. Comment garantissez-vous que l'image déployée est celle qui a été scannée ?**  
Publication et déploiement par empreinte SHA-256 relue depuis le registre ; le 07/09, l'empreinte publiée et celle en service étaient identiques ; l'image ne transite qu'en artefact interne avant la porte Trivy.

**Q8. Le compte Compute par défaut a un rôle Éditeur : n'est-ce pas une faille ?**  
Aucune charge ne l'utilise (chaque service porte son identité) ; c'est un droit hérité, identifié par l'inventaire du 08/09 et inscrit au plan d'amélioration avec le droit de lecture résiduel du tableau de bord.

**Q9. Pourquoi TOTP et pas FIDO2 ?**  
Coût nul et aucune dépendance externe ; le contrôle réel est la séparation authentifié/autorisé (jeton intermédiaire sans rôle). FIDO2 est une évolution possible si le matériel est acquis.

**Q10. Quelle est la limite principale du projet ?**  
Les mesures valent pour la recette avec un trafic pilote ; les seuils comportementaux ne sont pas calibrés ; la limitation de débit par adresse est sans effet contre un adversaire distribué et pénalise les réseaux mobiles partagés.

**Q11. Qu'apporte le modèle ATT&CK-BERT par rapport à des mots-clés ?**  
Sur 40 alertes : 0,60 aux rangs 1–3 pour le dictionnaire, 0,70 pour TF-IDF, 0,88 pour ATT&CK-BERT ; il comprend le sens (T1003.008 proposé sur /etc/passwd sans le mot « credential »).

**Q12. Combien de temps par semaine pour exploiter le socle ?**  
Environ 1 h 30 : revue des incidents et verdicts, plan Terraform hebdomadaire, veille sur les vulnérabilités remontées par la chaîne.

## 5. Conseils de restitution

- Répéter trois fois en conditions réelles avec chronomètre ; viser 16 min 30 pour garder une marge.
- Ne jamais lire une slide : chaque slide porte au plus quatre blocs, le discours donne le lien entre eux.
- Sur les slides techniques (11, 13, 15), pointer physiquement le chemin sur le diagramme (entrée → services → base ; WAF → journaux → job → incident).
- Annoncer les chiffres avec leur date et leur environnement (« relevé du 08/09 en recette ») : c'est ce qui rend la présentation défendable.
- Assumer les deux tests partiels avant qu'on vous les reproche : ils prouvent la méthode.
- Lancer la vidéo après avoir dit ce qu'il faut observer ; ne pas la commenter en continu.
- Garder l'environnement de recette ouvert dans un onglet pour une vérification en direct si un membre du jury le demande.
