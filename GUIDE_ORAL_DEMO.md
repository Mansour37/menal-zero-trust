# Guide oral total — démonstration technique du socle MENAL

**À réciter tel quel.** Pour chaque plan : l'**écran/commande** à préparer, ce que tu **montres**,
ce que tu **dis** (mot à mot), et la **réponse** si le jury coupe. Tout est aligné sur le système
réel (testé en direct le 07/09), pas sur le PDF.

---

## PARTIE 1 — La logique du système (à avoir en tête, c'est ce qui te rend défendable)

Un jury technique ne teste pas tes slides, il teste ta **cohérence**. Voici les 8 décisions de
logique qui tiennent, et pourquoi.

| Question probable | La logique, défendable |
|---|---|
| **Le verdict est-il automatique ou humain ?** | **Humain, toujours.** C'est le principe de la qualification *assistée* : le modèle **propose** les 3 techniques ATT&CK les plus proches, l'analyste **décide** (vrai/faux positif). Rien n'est appliqué automatiquement. Le dashboard montre les deux, dans l'ordre : « le socle propose » **puis** « décision humaine ». |
| **Comment le socle propose-t-il ?** | Encodeur **ATT&CK-BERT** (ONNX float32), similarité sémantique cosinus, top-3 au-dessus de 0,60, **déterministe** (à alerte identique, candidats identiques) et **exécuté localement** (pas de modèle génératif, pas d'appel externe). |
| **Et si le modèle se trompe ?** | L'humain garde la décision, et son verdict est **tracé** (append-only). Ces verdicts alimentent le **taux de faux positifs par règle** (écran Santé des règles) → boucle d'amélioration. Le modèle ne décide jamais seul. |
| **Pourquoi une seule alerte pour 13 requêtes ?** | Une détection par **(règle, entité, fenêtre)**. Le compteur donne l'ampleur (« 13 requêtes bloquées en 15 min »). On évite 13 lignes pour une rafale — c'est la fatigue d'alerte qu'on combat. |
| **Comment un incident est-il scoré ?** | Somme des sévérités des détections de l'entité + **bonus +15 si ≥ 2 tactiques MITRE distinctes** (signature d'une chaîne d'attaque). Plafonné à 100. Déterministe. |
| **Peut-on falsifier une preuve ?** | Non par un composant d'analyse : chaque table a **un seul auteur**, et l'auteur n'est jamais le consommateur. Le job d'enrichissement peut lire les détections mais **pas y écrire** (vérifié : INSERT → refusé). Les verdicts sont en **ajout seul**. |
| **Où est le DevSecOps dans la supervision ?** | Les vulnérabilités trouvées par **Trivy en CI** remontent dans l'écran **Vulnérabilités** (table `cve_findings`, enrichie KEV/EPSS). La chaîne de livraison alimente la supervision. |
| **Deux notions d'alerte ?** | Oui, assumé : **Alertes API** = erreurs HTTP applicatives ; **Détections SIEM** = règles de sécurité sur l'entrepôt. Deux niveaux, deux écrans. |

**Ce que le dashboard comporte, et pourquoi c'est cohérent** (du macro au détail) :
`Vue d'ensemble` (le SOC du matin : que s'est-il passé ?) → `Détections` (sortie brute des 7 règles)
→ `Incidents` (corrélation par entité) → `Détail incident` (score → **le socle propose** →
**décision humaine** → chronologie) → `Couverture ATT&CK` (ce qu'on détecte/ne détecte pas) →
`Vulnérabilités` (lien DevSecOps) → `Santé des règles` (faux positifs, via verdicts) → `Sécurité (MFA)`.

---

## PARTIE 2 — L'environnement à préparer AVANT d'enregistrer

**Trois fenêtres, prêtes et réveillées** (les services sont à zéro hors trafic) :

1. **Navigateur — onglet ELSON** : `https://elson.menal-sarl.com`
2. **Navigateur — onglet Dashboard** : `https://dashboard.menal-sarl.com` (connecté en admin)
3. **Terminal** (Git Bash), avec cette variable posée : `BASE="https://elson.menal-sarl.com"`

**Réveil (à lancer 3–5 min avant, pour éviter le démarrage à froid) :**
```bash
curl -s -o /dev/null https://elson.menal-sarl.com/
curl -s -o /dev/null https://api-staging.menal-sarl.com/health
curl -s -o /dev/null https://dashboard.menal-sarl.com/login
```

**Contrôles visuels obligatoires (à chaque plan dashboard) :**
- Pastille en haut à droite = **« Données à jour »** (verte) + « Live ». Jamais « Mode démonstration ».
- Si tu tournes le dashboard en local : `API_URL=https://api-staging.menal-sarl.com DEMO_MODE=false`,
  et **`next start`/build de production**, jamais `next dev` (en dev, l'auth est bypassée et le mock autorisé).

**Deux points à assumer à l'oral, une fois, calmement :**
- Le badge « RECETTE » = « environnement de validation, topologie de production ».
- Les adresses IP affichées sont celles du **poste de test** (les miennes), pas floutées — c'est mon propre trafic.

**⚠️ Avant le tournage, une action hors-démo :** si tu veux montrer le second facteur au login,
**active la MFA sur l'admin** (menu Sécurité MFA → enrôler). Sinon, ne parle pas de 2FA pendant la démo.

---

## PARTIE 3 — Le script oral, plan par plan

> Débit calme, ~150 mots/min. Total visé : 4 min 40.

### Plan 0 — Ouverture (0:00–0:25)
- **Écran :** diapositive de titre.
- **Tu dis :** « MENAL-SARL développe plusieurs produits. J'ai conçu et réalisé un socle cloud commun
  qui apporte à chaque application trois choses : une livraison sécurisée, une architecture Zero
  Trust, et une supervision. Je vais le prouver en suivant une seule version d'ELSON, de son code
  jusqu'à une attaque en ligne. »

### Plan 1 — ELSON en ligne (0:25–0:40) · *Zero Trust*
- **Écran :** onglet navigateur sur `https://elson.menal-sarl.com`. Montre le cadenas HTTPS.
- **Tu dis :** « Voici ELSON en ligne, joignable uniquement par le point d'entrée unique, en HTTPS,
  certificat renouvelé automatiquement. Nous allons lui livrer une nouvelle version. »

### Plan 2 — Le développeur livre (0:40–0:55) · *F3*
- **Écran :** GitHub — un commit poussé, une Pull Request ouverte.
- **Tu dis :** « J'ouvre une demande de fusion. La chaîne exécute tous ses contrôles mais ne publie
  rien : elle ne s'authentifie même pas auprès du cloud. L'identité fédérée n'est obtenue qu'à la
  fusion sur la branche principale. »
- **Si on te demande « pourquoi ? » :** « Moindre privilège : un contributeur ne peut ni publier ni
  déployer depuis une branche de travail. La condition de fédération exige le dépôt **et** la branche `main`. »

### Plan 3 — Une porte bloque (0:55–1:30) · *F3* — **plan clé, laisse-lui ses 35 s**
- **Écran :** le journal GitHub Actions. Surligne la porte en **rouge** (Trivy CRITICAL, ou Semgrep),
  et le code de sortie 1.
- **Tu dis :** « La chaîne enchaîne : recherche de secrets avec Gitleaks, analyse statique avec
  Semgrep, tests, puis analyse de l'image avec Trivy. Ici, une porte détecte une vulnérabilité
  critique et corrigeable, et arrête tout : aucune image publiée, rien déployé. Ce refus est
  provoqué. Mais le même mécanisme a produit un vrai incident le 16 août : une porte d'analyse qui
  se déclarait verte sans rien évaluer — un faux-vert que j'ai détecté et corrigé. »
- **Ne jamais dire** que le refus filmé est « réel non provoqué ». Le refus réel, c'est le faux-vert du 16/08.

### Plan 4 — La correction, puis le vert (1:30–1:50) · *F3*
- **Écran :** le commit de correction, la même chaîne intégralement verte.
- **Tu dis :** « Je corrige, je relance. Cette fois toutes les portes passent : aucun secret, aucun
  constat bloquant, aucune vulnérabilité critique corrigeable. La version est autorisée à être publiée. »

### Plan 5 — La fusion déclenche le déploiement (1:50–2:10) · *F3 → Zero Trust*
- **Écran :** le bouton de fusion, la chaîne qui repart.
- **Tu dis :** « Je fusionne sur la branche principale. C'est seulement maintenant que la chaîne
  s'authentifie : elle présente un jeton signé par GitHub, vérifié pour le dépôt **et** la branche,
  et reçoit une identité de courte durée. »

### Plan 6 — Déployée, sans clé (2:10–2:30) · *Zero Trust*
- **Écran :** la révision Cloud Run (console) : identité de service, image taguée du commit.
- **Tu dis :** « La nouvelle révision tourne sous une identité dédiée, aux droits minimaux, et
  exécute exactement l'image qui a passé les portes, taguée par l'empreinte du commit. Aucune clé
  n'est stockée : la chaîne a prouvé son identité, elle ne l'a pas détenue. Sur huit comptes de
  service, l'inventaire relève **zéro clé**. »

### Plan 7 — Rien n'est joignable directement (2:30–2:50) · *Zero Trust* — **preuve live au terminal**
- **Écran :** terminal. Tape ces deux lignes en direct :
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" https://elson-web-staging-slxt6oscea-ew.a.run.app/   # 404
  curl -s -o /dev/null -w "%{http_code}\n" https://elson.menal-sarl.com/                          # 200
  ```
- **Tu dis :** « L'adresse directe que le fournisseur attribue au service — 404 : elle n'accepte plus
  Internet. Le domaine public, à travers le filtrage — 200. La base de données, elle, n'a aucune
  adresse publique. C'est ça, Zero Trust : ce n'est pas la position réseau qui autorise, c'est l'identité. »

### Plan 8 — L'attaque (2:50–3:15) · *F4* — **preuve live au terminal**
- **Écran :** terminal. Lance la boucle :
  ```bash
  for p in "q=1' OR '1'='1" "q=<script>alert(1)</script>" "file=/etc/passwd" "cmd=;cat /etc/hosts"; do
    curl -s -o /dev/null -w "%{http_code}\n" -G "$BASE/api/search" --data-urlencode "$p"   # 403
  done
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/health"                                # 200
  ```
- **Tu dis :** « J'envoie des requêtes malveillantes depuis mon poste — injection SQL, script
  inter-sites, inclusion de fichier. Toutes reçoivent un 403 du filtrage applicatif, avant
  d'atteindre ELSON ; la requête légitime, elle, est servie en 200. »

### — CARTON DE MONTAGE : « ~5 minutes plus tard » —
*(la détection tombe après le cycle des règles ; couper ici, ne jamais laisser tourner la vidéo)*

### Plan 9 — La détection (3:15–3:40) · *F4*
- **Écran :** dashboard → onglet **Détections**. Montre les lignes réelles : R2 « Pic WAF » avec le
  message « N requêtes bloquées par Cloud Armor… en 15 min », R3 « Path traversal », R6 « Pattern injection ».
- **Tu dis :** « Les refus sont journalisés, puis lus dans l'entrepôt BigQuery par sept règles
  écrites en SQL, versionnées, exécutées toutes les cinq minutes sur une fenêtre de quinze minutes.
  La règle R2 compte les requêtes bloquées par adresse ; au-delà de dix, elle écrit **une seule**
  détection. Une rafale ne produit pas dix alertes, mais une, dont le compteur donne l'ampleur. »
- **Dis « entrepôt de sécurité »**, pas « SIEM commercial » — c'est un choix assumé.

### Plan 10 — La qualification assistée (3:40–4:05) · *F4, cœur du projet*
- **Écran :** dashboard → **Incidents** → clique sur l'entité → la Card **« Le socle propose —
  Techniques ATT&CK »**. Montre les 3 candidats avec leurs barres de score.
- **Tu dis :** « C'est l'apport principal. Pour aider une personne seule à qualifier, le socle
  propose automatiquement les trois techniques d'attaque les plus proches **sémantiquement**, avec un
  score. Sur mon attaque d'inclusion de fichier `/etc/passwd`, il propose en tête **T1003.008 — vol
  d'identifiants via /etc/passwd, à 0,71**, alors qu'aucun mot "identifiant" n'apparaît dans la
  requête : le modèle comprend le **sens**. C'est un encodeur spécialisé, ATT&CK-BERT, déterministe,
  exécuté localement — pas un modèle génératif. »

### Plan 11 — Le verdict humain (4:05–4:40) · *F4 → clôture* — **le clic**
- **Écran :** juste en dessous, la Card **« UC5 — Décision humaine »**. **Clique sur « Vrai positif ».**
  Le verdict s'affiche.
- **Tu dis :** « Le socle propose, mais c'est l'administrateur qui tranche : vrai positif. Ce verdict
  est écrit dans une table à part, en ajout seul — la preuve n'est jamais modifiée, la décision
  humaine s'y ajoute. De bout en bout, du commit au verdict, j'ai réalisé les trois chaînes : la
  livraison sécurisée, l'architecture Zero Trust et la supervision. ELSON n'est que le premier cas
  de validation : l'architecture est décrite en code, **indépendante de l'application supervisée**. Merci. »

---

## PARTIE 4 — Les questions du jury, réponses courtes

| Question | Réponse (une phrase) |
|---|---|
| « Le verdict, c'est automatique ? » | Non — humain. Le socle propose les 3 techniques ATT&CK ; l'analyste décide. C'est ce que montrent les deux cartes, dans l'ordre. |
| « Le blocage CI, vous l'avez fabriqué ? » | Celui filmé, oui (provoqué). Le vrai, c'est le faux-vert Semgrep du 16/08, détecté et corrigé — preuve K23. |
| « Déployez-vous sans clé ? » | Oui, fédération WIF contrainte au dépôt et à la branche. Inventaire : **0 clé sur 8 comptes**. |
| « En quoi est-ce du Zero Trust ? » | Adresse directe → 404, base sans IP publique, et sur le cloud c'est l'identité qui décide, pas le réseau. Prouvé en direct : 404 vs 200. |
| « Combien de règles ? » | Sept règles SQL versionnées (R1–R7) + deux détecteurs temps réel. Chacune pose une technique MITRE. |
| « Que se passe-t-il si le modèle se trompe ? » | L'humain garde la décision ; le verdict est tracé et alimente le taux de faux positifs par règle. Le modèle ne décide jamais seul. |
| « Où est le DevSecOps dans la supervision ? » | Écran Vulnérabilités : les CVE trouvées par Trivy en CI y remontent, enrichies KEV/EPSS. |
| « Y a-t-il des limites ? » | Oui, assumées : pas encore de production (dev+staging), la MFA de l'admin de démo reste à activer, la couverture de tests du dashboard est faible et tracée en CI, et le déploiement se fait par tag de commit, pas par digest. Chacune s'ajoute sans refondre l'architecture. |

---

## En une phrase

> « Du commit au verdict, j'ai réalisé les trois chaînes du socle — livraison sécurisée, Zero Trust,
> supervision — le socle **propose**, l'humain **décide**, et ELSON n'en est que le premier cas de validation. »
