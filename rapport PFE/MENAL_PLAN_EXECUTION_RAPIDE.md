# MENAL — Plan d'exécution rapide du rapport PFE
## Stratégies · Prompts agents et reviewers · Actions auteur (chemin le plus court) · Validation finale du PDF

**Basé sur :** `MENAL_Rapport_PFE_Diagnostic_et_Plan.md` (diagnostic, registre C01–C30, plan de captures K01–K24, décisions D-01–D-14), `PROMPT_FINAL_AGENTS.md` (cahier des charges détaillé), et les sources du projet (main.pdf, 01_ARCHITECTURE_MENAL.md, 02_SECURITE_AUDITS_ECARTS.md, guide vidéo, note pédagogique ESPRIT).
**Objectif :** livrer un rapport solide en 4 jours (marge au 5e), en faisant travailler les agents et vous en parallèle, avec un reviewer à chaque étape.

---

## 0. Mode d'emploi (5 minutes de lecture)

1. **Préparez un dossier de travail** contenant : les sources LaTeX du rapport (`main.tex` + chapitres + annexes), `main.pdf`, `01_ARCHITECTURE_MENAL.md`, `02_SECURITE_AUDITS_ECARTS.md`, `guide_reel_preuves_menal.html`, la note ESPRIT, `MENAL_Rapport_PFE_Diagnostic_et_Plan.md`, `PROMPT_FINAL_AGENTS.md`, ce document, et un sous-dossier vide `apports_auteur/`.
2. **Remplissez le kit U1 (10 à 30 minutes)** : huit décisions, une ligne chacune. C'est le seul élément bloquant. Déposez-le dans `apports_auteur/U1_decisions.md`.
3. **Lancez l'agent Orchestrateur avec le PROMPT A0** (partie 4). Il enchaîne A1 → R1 → A2 → R2 → A3 → R3 → A4 → R4, tient les registres, et vous envoie chaque soir un compte rendu de 10 lignes avec ce qu'il attend de vous.
4. **Pendant que les agents travaillent**, faites les kits U2 (session de preuves, 90 min), U3 (questionnaire personnel, 45 min) et U4 (mesures, 60 min). Déposez tout dans `apports_auteur/`.
5. **Quand vos apports sont déposés**, l'Orchestrateur lance A5 (intégration) → R5, puis A6 (PROMPT FINAL : critique, correction, validation du PDF).
6. **Vous validez le PDF final** avec la checklist de 30 minutes (partie 7) et vous l'envoyez à l'encadrant.

Si vous n'avez qu'une heure aujourd'hui : faites U1, lancez A0, et enchaînez U2 demain matin. Rien d'autre ne bloque les agents.

---

## 1. Stratégie de livraison rapide

### 1.1 Cinq principes

1. **Deux voies en parallèle.** Les agents traitent le texte, la structure, la cohérence et la forme. Vous traitez les décisions, les preuves et les informations personnelles. Aucune voie n'attend l'autre, sauf aux points de synchronisation S0 à S4.
2. **Chemin critique court.** Il tient en quatre maillons : vos décisions (U1) → contenu (A2) → intégration de vos apports (A5) → validation finale (A6). Tout le reste se fait en parallèle.
3. **Règle d'or du fond.** Aucun chiffre sans mesure datée ; aucun « 45 s » sans mesure ; aucun changement du projet lui-même. Les agents reformulent, réorganisent, condensent, clarifient ; ils n'inventent pas.
4. **Qualité par barrières.** Chaque phase se termine par un reviewer qui rend un verdict PASS ou FAIL avec une liste numérotée. Deux boucles de correction au maximum ; au-delà, l'Orchestrateur vous demande une décision ou documente l'abandon.
5. **Fait vaut mieux que parfait.** Ce qui n'est pas mesurable avant J3 est déclaré « non mesuré » dans le rapport, avec la raison. Le rapport prévoit déjà cette convention (chapitre 6) ; elle est plus solide qu'une valeur douteuse.

### 1.2 Calendrier sur quatre jours (marge au cinquième)

| Jour | Agents | Vous (auteur) | Synchro |
|---|---|---|---|
| **J1 matin** | A0 démarre ; A1 cadrage (2 h) ; R1 | U1 décisions (30 min) | S0 : U1 déposé avant A1 ; S1 : registre validé |
| **J1 après-midi** | A2 contenu et structure (4–5 h) | U2 session de preuves (90 min) | — |
| **J2 matin** | R2 ; A3 pédagogie et langue (3 h) | U3 questionnaire (45 min) ; U4 mesures (60 min) | — |
| **J2 après-midi** | R3 ; A4 forme LaTeX (3 h) ; R4 | Tri et dépôt des captures (30 min) | S2 : apports déposés avant 18 h |
| **J3** | A5 intégration (3 h) ; R5 ; A6 validation finale (2 h) ; corrections ; PDF candidat | Réponses aux questions restantes de A5 (30 min) | S3 : PDF candidat |
| **J4** | A6 second passage si FAIL ; PDF final | Checklist de validation (30 min) ; envoi à l'encadrant | S4 : PDF final |
| **J5 (marge)** | — | Options U5 (reconstruction chronométrée, tests différés) | — |

### 1.3 Ce qui est livré à la fin

- `main.pdf` final (version de remise, placeholders invisibles) et `main_brouillon.pdf` (placeholders visibles).
- Registres : `REGISTRE_CORRECTIONS.md`, `DECISIONS_AUTEUR.md`, `A_COMPLETER_AUTEUR.md`, `PLAN_CAPTURES.md`, `QUESTIONS_JURY.md`, `CHANGELOG_RAPPORT.md`, `CHECKLIST_ESPRIT.md`, `RAPPORT_VALIDATION_FINALE.md`.
- Une liste courte de ce qui reste ouvert pour la soutenance (et la réponse à donner au jury pour chaque point).

---

## 2. Classification des modifications

### 2.1 Faites entièrement par les agents (aucun apport de votre part)

| Phase | Corrections | Contenu |
|---|---|---|
| A1 cadrage | C01 (date de référence), chronologie datée, registre, sommaire cible, budget de pages | Aucun texte final ; décisions préparées pour vous |
| A2 contenu | C02, C03, C04, C05, C06, C09, C10, C11, C12, C13, C14, C15, C16, C17, C18, C20, C21, C26, C27 (budget de latence sans le chiffre 45 s), C28, C29 ; nouvelles §4.4, §5.9 (avec le nommage par défaut), §6.7 ; fusions ch. 2 et 3 ; tab. 25 (É7, É8), tab. 30/31/34/36 avec statuts proposés ; emplacements de captures K01–K24 ; annexe A.2 | Tout est tiré des sources 01/02 et du guide |
| A3 langue | Style, phrases, feuilles de route, conclusions de chapitre, définitions, brouillons du résumé, de l'abstract, de l'introduction et de la conclusion, passe « 18 questions du jury » | Brouillons marqués « à valider par l'auteur » |
| A4 forme | L1–L17 : liste des graphiques, références en français, numérotation, tableaux coupés, pages blanches, page de garde, macros de placeholders, bibliographie, entrées de la table des matières | Compilation propre |

### 2.2 Dépendent de vous (par priorité, chemin le plus court)

| Priorité | Kit | Décision / apport | Temps | Bloque quoi |
|---|---|---|---|---|
| **P0 bloquant** | U1 | D-01 (45 s), D-02 (nommage), D-03 (enrichissement), D-06 (cadence), D-10 (sous-réseau), D-11 (pages), date de référence, nom de l'encadrant ESPRIT et de la spécialité | 10–30 min | A1 et le nommage dans A2 |
| **P1 important** | U2 | D-05 : preuves des tests (une session terminal) + captures K10–K16, K21–K22 | 90 min | A5, chapitre 6 |
| **P1 important** | U3 | D-04 (dates), D-08 (service, mission, rôle, tâches quotidiennes), remerciements, dédicace | 45 min | A5, chapitre 1, §5.10, pages liminaires |
| **P2 utile** | U4 | D-07 (coût par poste), D-06 confirmé, mesure « détection → incident » (si option A), D-12 (versions ATT&CK / CIS) | 60 min | §6.5.3, §4.4, annexe E.1 |
| **P2 utile** | — | D-09 : validation des brouillons (résumé, abstract, introduction, conclusion) | 30 min | Pages liminaires |
| **P3 optionnel** | U5 | D-14 reconstruction chronométrée ; D-13 évaluation M0/M1/M2 ; tests T3, T12, T15, T19 | 2 h à 3 j | O2, O5 ; sinon « non mesuré » |

### 2.3 Faites par les agents après vos apports (phase A5)

| Apport reçu | Ce que les agents font |
|---|---|
| U1 | Applique le nommage, insère ou non le segment « 45 s », écrit la décision sur l'enrichissement (C19), tranche l'écart É2 (sous-réseau), fixe `\dateref` |
| U2 | Remplit tab. 30 et annexe E avec les statuts définitifs et les preuves datées ; place les captures ; réécrit T7/T9/T14/T20 selon ce que vous avez réellement constaté |
| U3 | Rédige §1.1.2, §1.1.3, §5.10.1, le Gantt (fig. 12), les remerciements ; met la chronologie en cohérence (C23) |
| U4 | Remplit tab. 33/§6.5.3, §4.4 et §6.3.3, annexe E.1 ; remplit tab. 36 (O1–O6) avec des valeurs |
| U5 (si fait) | Intègre fig. 17 (reconstruction), graph. 4 (M0/M1/M2), résultats de T3/T12/T15/T19 ; sinon déclare « non mesuré » avec la raison |

### 2.4 Ce qui peut attendre la soutenance sans nuire au rapport

Reconstruction complète chronométrée (démonstration en direct annoncée en §6.5.2) · évaluation M0/M1/M2 (déclarée « non mesurée », résultat négatif admis par avance en O5) · tests de charge et d'interruption (T3, T12, T15, T19) · segmentation réseau par locataire (perspective).

---

## 3. Voie Auteur — kits guidés (chemin le plus court)

Chaque kit se fait seul, dans l'ordre, et se dépose dans `apports_auteur/`. Les valeurs par défaut sont indiquées : si vous hésitez, gardez la valeur par défaut, elle est la plus sûre devant un jury.

### U1 — Formulaire de décisions (10 à 30 minutes, bloquant)

Copiez ce bloc dans `apports_auteur/U1_decisions.md`, remplacez chaque `>` par votre réponse (une ligne).

```markdown
# U1 — Décisions (une ligne par réponse)

D-01 Délai « 45 s ». Choix : A (budget de latence + mesure du segment détection→incident) / B (chemin d'alerte L7 distinct, mesuré) / C (budget de latence sans chiffre 45 s).
> Défaut : A si je peux faire la mesure du kit U4 ; sinon C.

D-02 Nommage. « Elson » (second locataire, onboardé le 07/08) est-il l'application pilote ELSON hébergée sur le socle, ou une organisation distincte ?
> Réponse : [même entité / distincte]. Convention retenue dans le rapport : « application pilote » et « second locataire ».

D-03 Enrichissement sémantique et score d'incident : « informationnel assumé » (décision datée) ou « jointure au score réalisée avant la remise » ?
> Défaut : informationnel assumé (décision du JJ/MM/2026), jointure en perspective.

D-06 Cadence des requêtes planifiées de détection (5 ou 15 min) et fenêtre glissante (15 min ?). Regarder `schedule` dans terraform/modules/detection/main.tf.
> Cadence : … ; fenêtre : …

D-10 Sous-réseau public inutilisé : supprimer (recommandé par l'audit) ou justifier ?
> Défaut : « suppression décidée le JJ/MM/2026, appliquée / à appliquer ».

D-11 Cible de pages du corps (55 ou 60), validée avec l'encadrant ESPRIT.
> Défaut : 60 (maximum 65).

Date de référence du rapport (état du système décrit) :
> Défaut : 23/08/2026 (date des dernières preuves).

Identité : nom de l'étudiant, spécialité ESPRIT, encadrant académique, encadrant entreprise (M. Houssein Ezzedine), année universitaire.
> …
```

### U2 — Session de preuves (90 minutes, une seule session terminal)

Objectif : transformer le « 20 non exécutés » en une table avec des preuves datées. Une commande par preuve, un `clear` entre deux, un titre `echo "===== Tx ====="` avant chaque bloc (même méthode que la vidéo), une capture d'écran par bloc, nommée `apports_auteur/captures/Kxx_Tyy.png`. **Sur l'environnement de recette uniquement.** Ne montrez jamais un secret, un jeton ou un identifiant de projet complet (floutez après coup).

Variables à définir en début de session : `P` (projet de recette), `DS` (dataset SIEM, ex. `menal_security_staging`), `REG` (région), `E` (URL de l'application hébergée), `A` (URL de l'API de la plateforme), `D` (URL du tableau de bord).

Ordre conseillé (du plus rapide au plus long) :

| # | Test | Commande (à adapter : `$P` projet, `$DS` dataset SIEM, `$REG` région) | Preuve attendue | Capture |
|---|---|---|---|---|
| 1 | T4 | `gcloud sql instances describe <instance> --project $P --format="table(ipAddresses[].type,ipAddresses[].ipAddress)"` puis `gcloud compute addresses list --project $P` puis, depuis la VM hors GCP : `timeout 5 nc -vz <ip_privée> 5432; echo "retour $?"` | Uniquement PRIVATE ; liste d'adresses publiques vide ; connexion en échec | K10 |
| 2 | T7 | `for sa in $(gcloud iam service-accounts list --project $P --format="value(email)"); do echo "-- $sa"; gcloud iam service-accounts keys list --iam-account="$sa" --managed-by=user --project $P; done` | Aucune clé pour aucun compte. **Ne créez pas de clé** : sans organisation GCP la création réussirait (écart É7) ; le rapport le dira | K12 |
| 3 | T5 / T11 | `bq show --format=prettyjson $P:$DS \| jq '.access'` puis `for t in raw_logs detections alert_enrichment; do echo "-- $t"; bq get-iam-policy $P:$DS.$t; done` | `sa-enrich-job` en écriture sur `alert_enrichment` seulement ; `sa-ml-embed` et les identités applicatives absents des tables de preuve | K11, K16 |
| 4 | T6 | `URL=$(gcloud run services describe ml-embed --region $REG --project $P --format="value(status.url)"); curl -s -o /dev/null -w "ml-embed direct -> HTTP %{http_code}\n" "$URL/"` puis `gcloud run services get-iam-policy ml-embed --region $REG --project $P` | 403/404 depuis Internet ; aucun `allUsers` invocateur | nouvelle (K06 bis) |
| 5 | T14 / T20 | `gcloud compute routers nats list --router <routeur> --region $REG --project $P` puis `gcloud compute routers nats describe <nat> --router <routeur> --region $REG --project $P --format="yaml(sourceSubnetworkIpRangesToNat,subnetworks,logConfig)"` | **Regardez honnêtement** : si la NAT couvre le sous-réseau du connecteur, les services ont une sortie Internet ; le rapport dira alors « sortie contrôlée par la NAT, journalisée », pas « aucune sortie ». Si `ml-embed` a bien une sortie nulle, notez comment (route, sous-réseau exclu) | K-nouvelle |
| 6 | T13 + T16 (même action) | `gcloud compute firewall-rules update deny-all-ingress --description "test T16 $(date -u +%H:%M)" --project $P` puis `terraform plan -no-color \| tail -n 40` (dans l'environnement de recette) puis `gcloud logging read 'logName:"cloudaudit.googleapis.com%2Factivity" AND protoPayload.methodName:"compute.firewalls"' --project $P --limit 3 --format="table(timestamp,protoPayload.authenticationInfo.principalEmail,protoPayload.methodName)"` puis `terraform apply` pour revenir à l'état décrit et `terraform plan` → « No changes » | Le plan signale la différence ; le journal d'audit donne l'auteur et l'heure ; retour à zéro différence | K13, K22 |
| 7 | T17 | `gsutil iam get gs://<bucket_etat>; gsutil pap get gs://<bucket_etat>; gsutil versioning get gs://<bucket_etat>` | Accès limité à deux identités, prévention d'accès public activée, versionnage activé | K-nouvelle |
| 8 | T2 | `A=https://<domaine-api>; for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code} " -X POST -H 'Content-Type: application/json' -d '{"code":"000000"}' "$A/auth/mfa/verify"; done; echo` puis `bq query --use_legacy_sql=false --project_id $P "SELECT timestamp, rule_id, entity, service, message FROM \`$P.$DS.detections\` WHERE rule_id='R1' ORDER BY timestamp DESC LIMIT 3"` | 10 × 422 puis 429 ; ligne R1 dans l'entrepôt (au cycle suivant) | K15 |
| 9 | T1 | Les quatre `curl` du guide vidéo (SQLi, XSS, LFI → 403 `text/html` ; contrôle → 200) ; ajoutez le motif brut : `curl --path-as-is -s -o /dev/null -w "%{http_code}\n" "$E/api/health?f=../../etc/passwd"` | 403 × 3, 200, et le résultat réel du motif brut (302 attendu : réserve H13) | K14 |
| 10 | T10 | Sur une branche jetable : ajouter un fichier avec un secret **factice** de format reconnaissable (ex. `AKIA` + 16 caractères), `git push` ; ouvrir le job en échec | Chaîne arrêtée à l'étape Gitleaks, code de retour ≠ 0, règle nommée, **valeur jamais visible** | K01 |
| 11 | T8 | Sur la même branche : image de base ancienne dans le Dockerfile (ex. `python:3.9.0-slim`), `git push` ; ouvrir le job en échec | Chaîne arrêtée à l'étape Trivy sur une CVE `CRITICAL` | K03 |
| 12 | T18 | Capture de la demande de fusion avec le plan Terraform publié en commentaire et le scan IaC vert ; note : « apply exécuté manuellement par l'administrateur » | Preuve de la revue humaine | K04 bis |
| 13 | Refus IaC | Sur la branche : ajouter un bucket avec `uniform_bucket_level_access = false` et un binding `allUsers`, `git push` ; ouvrir le job de scan IaC | Politique violée, code de retour ≠ 0, avant toute création | K04 |
| 14 | Nettoyage | Supprimer la branche jetable ; vérifier `terraform plan` = « No changes » | — | — |

Non faits dans cette session (déclarés « non exécutés » avec la raison) : T3 (charge), T9 (critère à réécrire par les agents : la chaîne ne déploie que l'image qu'elle vient de publier, étiquette = SHA), T12 (interruption de collecte), T15 (charge d'enrichissement), T19 (consommation anormale). Si vous avez 10 minutes de plus : T3 avec `seq 1 1200 | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" $E/api/health | sort | uniq -c` (attendu : apparition de 429 au-delà du seuil global).

Déposez ensuite `apports_auteur/U2_resultats.md` avec, par test, trois lignes : date/heure UTC, résultat observé (une phrase), nom du fichier de capture.

### U3 — Questionnaire personnel (45 minutes)

Répondez en style télégraphique dans `apports_auteur/U3_questionnaire.md` ; les agents rédigent les sections en français simple à partir de vos réponses (§1.1.2, §1.1.3, §5.10.1, Gantt, remerciements).

```markdown
# U3 — Questionnaire (réponses courtes)
1. Dates de début et de fin du stage : …
2. Service d'accueil : intitulé, effectif, rattachement, votre place dans l'organigramme : …
3. Mission telle que formulée au départ (lettre de mission ou entretien) : …
4. Interlocuteurs (encadrant entreprise, encadrant ESPRIT, autres) et rythme des points : …
5. Votre rythme de travail : jours, outils, réunions, revues de code : …
6. Un changement de mission en cours de stage ? (oui/non, lequel) : …
7. Dates réelles des phases : P0 audit (…→…), P1 conception (…→…), P2 socle (…→…), P3 livraison/détection (…→…), P4 validation (…→…) : …
8. Jalons connus : 29/07 audit · 01/08 quantisation rejetée · 03/08 restauration · 05–07/08 mesures démarrage à froid · 07/08 second locataire · 08/08 HA + incident CMEK · 11/08, 18/08, 19/08 audits et correctifs · 16/08 dernier run CI vert · 23/08 captures — confirmez ou corrigez : …
9. Ce que le stage vous a apporté (3 points) ; ce que vous avez apporté à l'entreprise (3 points) : …
10. Remerciements : personnes à citer (noms, rôles) : …
11. Dédicace (facultatif) : …
```

Micro-prompt si vous préférez rédiger vous-même (à donner à un assistant avec vos réponses) : *« À partir de ces réponses, rédige en français simple (phrases de 15 à 25 mots, pas de formule) les sections suivantes d'un rapport de PFE ESPRIT : 1.1.2 service d'accueil (0,4 page), 1.1.3 mission et rôle de l'élève-ingénieur (0,4 page), 5.10.1 déroulement et tâches quotidiennes (0,5 page), remerciements (1 page). Utilise la première personne dans 1.1.3 et 5.10.1. N'invente aucun fait. »*

### U4 — Mesures (60 minutes)

| Mesure | Où | Comment | Dépôt |
|---|---|---|---|
| Coût mensuel par poste (D-07) | Console → Facturation → Rapports ; projet de recette ; mois complet le plus récent ; grouper par service | Capture + recopie des six postes (ingestion des journaux, base de données, services d'exécution, connecteur, périmètre, requêtes de l'entrepôt) ; statut de l'anomalie « 78 Go/j » | `U4_couts.md` + capture |
| Cadence et fenêtre (D-06) | `grep -n "schedule" terraform/modules/detection/main.tf terraform/modules/ml-pipeline/main.tf` ; `grep -n "INTERVAL" terraform/modules/detection/main.tf` | Recopier les valeurs | `U1` (mise à jour) |
| Segment « détection → incident » (D-01, option A) | BigQuery → Requêtes planifiées → historique d'exécution de R2 (heure de fin de la dernière exécution ayant produit une détection) ; puis immédiatement `date -u; curl -s -H "Authorization: Bearer <jeton>" "$A/siem/incidents/<entité>" \| head -c 300` | Deux horodatages ; délai = différence ; répéter deux fois ; noter aussi si l'API était à froid | `U4_latence.md` + capture |
| Visibilité (étape 2 du budget de latence) | Comparer l'horodatage d'un blocage WAF (journal) et l'heure à laquelle il apparaît dans l'onglet journaux du tableau de bord | Une valeur en secondes | `U4_latence.md` |
| Versions (D-12) | Version de la matrice ATT&CK utilisée pour `attack_embeddings` (script de chargement) ; version du CIS GCP Benchmark utilisée | Deux lignes | `U4_versions.md` |
| Annotateur (annexe F) | Qui annote le jeu d'évaluation, si l'évaluation est faite | Une ligne | `U4_versions.md` |

### U5 — Options (seulement si J5 existe)

- **Reconstruction chronométrée** (2–3 h) : `terraform destroy` puis `terraform apply` sur un projet de recette jetable, `date -u` avant chaque phase, réinjection des secrets, redéploiement, `terraform plan` final → fig. 17. Sinon : « démonstration prévue en soutenance ».
- **Évaluation M0/M1/M2** (2,5 à 3,5 jours, annexe F) : à ne faire que si tout le reste est livré ; sinon « non mesuré, résultat négatif admis par avance (O5) ».
- **T12, T15, T19** : reportés, raison écrite.

### Dépôt des apports — structure attendue

```
apports_auteur/
  U1_decisions.md
  U2_resultats.md
  U3_questionnaire.md
  U4_couts.md   U4_latence.md   U4_versions.md
  captures/  K01_T10.png  K03_T8.png  K04_iac.png  K10_T4.png  K11_T11.png  K12_T7.png  K13_T16.png
             K14_T1.png   K15_T2.png  K16_T5.png   K21_scenario_19-08.png  K22_plan.png  ...
```

---

## 4. Voie Agents — prompts de production (A0 à A5)

Conventions communes à tous les prompts : les fichiers cités sont dans le dossier de travail ; les sources font foi dans l'ordre 02_SECURITE > 01_ARCHITECTURE > guide vidéo > main.tex > note ESPRIT ; le cahier des charges détaillé est `PROMPT_FINAL_AGENTS.md` (règles absolues §3, structure §6, contenus nouveaux §7, registre §8, tests §9, style §10, LaTeX §12, conformité §13, captures §14) ; le diagnostic détaillé est `MENAL_Rapport_PFE_Diagnostic_et_Plan.md`.

### PROMPT A0 — Orchestrateur

```
Tu es l'Orchestrateur d'une équipe d'agents chargée d'améliorer un rapport de PFE ESPRIT (LaTeX) sans en changer le fond.
Cahier des charges : PROMPT_FINAL_AGENTS.md (à lire en entier avant toute action). Diagnostic : MENAL_Rapport_PFE_Diagnostic_et_Plan.md. Plan d'exécution : MENAL_PLAN_EXECUTION_RAPIDE.md.

Ton rôle
1. Lancer les phases dans l'ordre A1 → R1 → A2 → R2 → A3 → R3 → A4 → R4, puis, dès que apports_auteur/ contient U1 à U4 : A5 → R5 → A6 (validation finale). Utiliser les prompts A1–A6 et R1–R5 tels quels.
2. Tenir à jour, à chaque phase : REGISTRE_CORRECTIONS.md (C01–C30 : appliquée / en attente auteur / non applicable + raison), DECISIONS_AUTEUR.md (D-01–D-14 : question, options, défaut recommandé, section impactée), A_COMPLETER_AUTEUR.md, CHANGELOG_RAPPORT.md (fichier, section, avant/après en une ligne, identifiant), PLAN_CAPTURES.md, QUESTIONS_JURY.md, CHECKLIST_ESPRIT.md.
3. Appliquer la barrière de revue : une phase n'avance que sur GATE: PASS du reviewer. Sur FAIL, renvoyer la liste au producteur ; deux boucles au maximum ; ensuite, escalader à l'auteur (question précise, options, défaut) et continuer sur ce qui ne dépend pas de la réponse.
4. Envoyer à l'auteur, à la fin de chaque phase, un compte rendu de 10 lignes maximum : fait / reste / décisions attendues / nombre de pages du corps / risques.
5. Ne jamais bloquer : si une information manque, poser la formulation prudente, marquer \acompleter{...}, noter dans A_COMPLETER_AUTEUR.md, continuer.

Règles absolues (rappel, détail §3 du cahier des charges)
- Aucun chiffre inventé ; aucun « 45 s » inséré de ta propre initiative ; fond du projet inchangé ; aucune ligne de code dans le corps ; une date de référence unique (\dateref) ; français simple ; rien d'absolu sans preuve ; identifiants du rapport conservés ; placeholders invisibles en version de remise.

Compte rendu attendu à chaque étape
- Titre de la phase, GATE (PASS/FAIL, itération n), 5 lignes de résultat, décisions attendues de l'auteur (identifiants D-xx), pages du corps (compte réel après compilation), prochain pas.
```

### PROMPT A1 — Cadrage et alignement sur le réel (Experts : structuration, smart thinking, cybersécurité, architecture, product)

```
Phase A1 — Cadrage. Durée cible : 2 heures. Aucune modification du texte des chapitres dans cette phase.

Entrées : sources LaTeX ; main.pdf ; 01_ARCHITECTURE_MENAL.md ; 02_SECURITE_AUDITS_ECARTS.md ; guide_reel_preuves_menal.html ; note ESPRIT ; PROMPT_FINAL_AGENTS.md ; MENAL_Rapport_PFE_Diagnostic_et_Plan.md ; apports_auteur/U1_decisions.md s'il existe (sinon, valeurs par défaut du kit U1 : option A ou C pour D-01, nommage « application pilote » / « second locataire », enrichissement informationnel assumé, cible 60 pages, date de référence 23/08/2026).

Tâches
1. Lire les cinq sources en entier. Produire CHRONOLOGIE.md : toutes les dates citées (29/07, 01/08, 03/08, 05–07/08, 07/08, 08/08, 11/08, 16/08, 18/08, 19/08, 23/08) avec l'événement et la source ; signaler toute incohérence de date entre le rapport et les sources.
2. Créer, dans les sources LaTeX, les macros de travail : \dateref, \acompleter{...} (visible en mode brouillon, invisible en mode remise), \attente{...}, \capture{ID}{légende}{consigne}. Ne pas encore les utiliser dans les chapitres.
3. Construire REGISTRE_CORRECTIONS.md à partir de PROMPT_FINAL_AGENTS.md §8 : pour chaque C01–C30, localiser le ou les passages concernés dans les sources LaTeX (fichier + ligne ou texte de repère), écrire la correction à appliquer en une ligne, indiquer si elle dépend d'une décision D-xx.
4. Construire DECISIONS_AUTEUR.md (D-01 à D-14) : question, options, valeur par défaut recommandée, sections impactées, état (reçue / en attente). Reporter les réponses de U1 si présentes.
5. Figer SOMMAIRE_CIBLE.md (structure §6.2 du cahier des charges) et BUDGET_PAGES.md (corps 57–60, max 65 ; par chapitre : intro 2, ch.1 8, ch.2 6–7, ch.3 8, ch.4 9, ch.5 12, ch.6 10–11, conclusion 2). Mesurer le nombre de pages actuel par chapitre à partir de main.pdf (pdftotext par page) et écrire l'écart.
6. Construire la table PREUVES_TESTS.md : T1–T20 avec preuve datée existante (02_SECURITE §7/§8/§10, guide annexe A), statut proposé (Conforme / Partiellement conforme / Non exécuté) et ce qui reste à faire ; base : PROMPT_FINAL_AGENTS.md §9.
7. Lister dans A_COMPLETER_AUTEUR.md tout ce qui, dans le rapport, ne peut venir que de l'auteur (67 marqueurs actuels regroupés par kit U1–U5).

Sorties : CHRONOLOGIE.md, REGISTRE_CORRECTIONS.md, DECISIONS_AUTEUR.md, SOMMAIRE_CIBLE.md, BUDGET_PAGES.md, PREUVES_TESTS.md, A_COMPLETER_AUTEUR.md, macros LaTeX. Compte rendu de 10 lignes.

Critères de sortie : chaque C-xx est localisé dans les sources LaTeX ; chaque D-xx a une valeur par défaut ; le sommaire cible est numéroté ; la chronologie ne contient aucune contradiction non signalée.
```

### PROMPT A2 — Restructuration et alignement du contenu (Experts : cybersécurité, architecture, réseaux, software engineering, data, product, captures)

```
Phase A2 — Contenu. Durée cible : 4 à 5 heures. Tu modifies les sources LaTeX sur le fond, sans encore travailler le style.

Entrées : sorties de A1 (validées par R1) ; sources ; cahier des charges (§6 structure, §7 contenus nouveaux, §8 registre, §9 tests, §14 captures).

Tâches, dans cet ordre
1. Appliquer les corrections C01–C30 qui ne dépendent pas de l'auteur (liste §2.1 de MENAL_PLAN_EXECUTION_RAPIDE.md). Pour celles qui dépendent d'une décision : appliquer la valeur par défaut de DECISIONS_AUTEUR.md et laisser la variante en commentaire LaTeX « % VARIANTE D-xx : ... ».
2. Réorganiser selon SOMMAIRE_CIBLE.md : renumérotation du chapitre 4 (nouvelle §4.4), sections nouvelles §5.9 et §6.7, fusions ch. 3 (tab. 8+9 ; tab. 13+14+15 → synthèse, détail en annexe C), fusion §2.2.2/2.2.3, tab. 22 → texte, §4.2.2 réduit de moitié, un seul graphique de démarrage à froid, incident « état divergent » raconté une seule fois (§5.10.2), annexe A.2 complétée depuis le chapitre 2.
3. Rédiger §4.4 « De l'attaque à l'incident : fonctionnement de bout en bout et budget de latence » : texte de 15 à 20 lignes + figure TikZ de chronologie à cinq repères, selon §7.3 du cahier des charges ; valeurs mesurées avec leur date ; cases \acompleter pour la visibilité et le segment détection→incident ; jamais « 45 s » sans mesure de l'auteur.
4. Rédiger §5.9 (second locataire : preuve vivante + limites) selon §7.1 et §6.7 (démonstration du fonctionnement global : scénario du 19/08 + correspondance avec les cinq preuves de soutenance) selon §7.2.
5. Mettre à jour tab. 25 (écarts, statuts à \dateref, ajout É7 politiques d'organisation inapplicables et É8 déploiement par étiquette SHA), tab. 30 et annexe E (statuts proposés de PREUVES_TESTS.md, colonne « preuve datée »), tab. 31 (angles morts : exfiltration, abus IAM/plan de contrôle, seuils codés en dur, absence de tests par règle), tab. 34, tab. 36 (O1–O6 avec valeurs connues, cases ouvertes sinon).
6. Ajouter le 4e incident (porte SAST en faux vert, 02/08 → 19/08, corrigée et vérifiée en CI de branche : 74 constats) en §5.10.2 ; corriger le retour arrière (§6.5.2 : 11,6 s / 16,5 s) ; préciser la restauration (tab. 32 : configuration zonale avant HA).
7. Poser tous les emplacements de captures avec \capture{Kxx}{légende datée}{consigne de masquage} et un appel dans le texte (K01–K24 du cahier des charges §14), en regroupant a/b les captures d'un même test.
8. Vérifier la cohérence des identifiants après renumérotation (sections, tableaux, figures, F1–F7, L1–L7, É1–É8, T1–T20). Compiler. Mesurer les pages par chapitre ; si un chapitre dépasse BUDGET_PAGES.md, condenser avant de rendre.

Interdits : inventer une mesure ; changer une décision d'architecture ; garder deux statuts différents pour un même écart ; écrire « impossible », « jamais », « aucune » sans preuve ; laisser un doublon de graphique ou un tableau coupé avec légende répétée.

Sorties : sources LaTeX modifiées + main_brouillon.pdf ; REGISTRE_CORRECTIONS.md (statuts mis à jour) ; CHANGELOG_RAPPORT.md ; PLAN_CAPTURES.md ; pages par chapitre. Compte rendu de 10 lignes.
```

### PROMPT A3 — Pédagogie et langue (Experts : pédagogie, smart thinking, captures)

```
Phase A3 — Langue. Durée cible : 3 heures. Tu réécris le style sans toucher au fond validé en A2.

Entrées : sources LaTeX après R2 ; cahier des charges §10 (guide de style) et §11 (questions du jury) ; MENAL_Rapport_PFE_Diagnostic_et_Plan.md partie 8 (exemples avant/après).

Tâches
1. Réécrire chaque chapitre : 12 à 25 mots par phrase en moyenne, aucune phrase de plus de 40 mots sans nécessité, une idée par phrase, tirets cadratins réservés aux tableaux, vocabulaire courant, définition à la première occurrence (locataire, requête planifiée, fenêtre glissante, porte bloquante, empreinte, étiquette, fédération d'identité, démarrage à froid, dérive, plan, apply) avec renvoi au glossaire (annexe G, à compléter).
2. Supprimer les maximes et les jugements (au plus une phrase de principe par chapitre, dans l'introduction du chapitre) ; supprimer : « honnête », « honnêtement », « sans détour », « dissimul », « faute méthodologique », « argumentaire commercial », « déclaration d'intention », « pièce maîtresse », « exemplaire », « le meilleur … de tout le projet » ; remplacer « matérialiser » → « montrer / mettre en place », « démontrable » → « vérifié » quand c'est un fait.
3. Feuille de route en tête de chaque chapitre (5–8 lignes : ce que le chapitre fait, ce qu'on saura à la fin) ; conclusion de chapitre de 8–10 lignes (résultats + transition). Couper la question centrale (§1.4.1) en deux phrases.
4. Rendre visible le rôle de l'élève-ingénieur : première personne autorisée en §1.1.3, §5.10 et conclusion (texte à partir de U3 s'il est déjà déposé ; sinon cadre \acompleter avec questions guides).
5. Rédiger les brouillons : résumé (15–20 lignes, contexte → problème → démarche → architecture → résultats mesurés → conclusion, mots-clés), abstract (traduction fidèle), introduction générale (2 pages, cinq mouvements ESPRIT, sans résultat chiffré), conclusion générale (2 pages, cinq points ESPRIT, perspectives : segmentation réseau par locataire, digest strict, jointure de l'enrichissement au score, signature des images, tests unitaires par règle). Marquer « brouillon à valider par l'auteur » en commentaire LaTeX.
6. Passe « jury » : pour chacune des 18 questions (cahier des charges §11), vérifier que la section prévue répond en une à trois phrases ; sinon les ajouter. Écrire QUESTIONS_JURY.md : question, section, réponse en trois lignes.
7. Contrôle chiffré à rendre : moyenne de mots par phrase (cible ≤ 22), pourcentage de phrases > 40 mots (cible < 5 %), nombre de tirets cadratins hors tableaux (cible < 100), zéro occurrence des termes interdits. Utiliser pdftotext + un script de comptage sur le corps (introduction → conclusion).
8. Finaliser PLAN_CAPTURES.md (légende, appel, masquage, existence de la preuve).

Sorties : sources LaTeX ; main_brouillon.pdf ; QUESTIONS_JURY.md ; PLAN_CAPTURES.md ; métriques de style. Compte rendu de 10 lignes.
```

### PROMPT A4 — Forme LaTeX (Expert : LaTeX / qualité du document)

```
Phase A4 — Forme. Durée cible : 3 heures. Aucune modification du sens.

Entrées : sources LaTeX après R3 ; cahier des charges §12 (L1–L17) et §13 (conformité ESPRIT) ; MENAL_Rapport_PFE_Diagnostic_et_Plan.md partie 9.

Tâches
1. L1 liste des graphiques : déclarer correctement le flottant « graph » (\newfloat ou newfloat) et sa liste ; vérifier l'affichage numéro + titre + page.
2. L2 références croisées en français : cleveref option french, \crefname{table}{tableau}{tableaux}, \crefname{figure}{figure}{figures}, \crefname{section}{section}{sections}, \crefpairconjunction{ et } ; supprimer les doublons « tableau table », « Le table », « Le fig. », tout « and ».
3. L3 numérotation des tableaux : le tableau numéroté 1 absent de la liste (acronymes) sort de la numérotation ; les listes commencent à 1.
4. L4 tableaux coupés : [!htbp] + \FloatBarrier, ou longtable avec légende « (suite) » sans double entrée dans la liste ; aucune légende répétée dans la liste des tableaux.
5. L5 pages blanches : openany (sauf consigne contraire de l'encadrant notée dans U1) ; supprimer les \clearpage avant les placeholders ; hauteur des cadres de placeholder ≤ 0,25 page ; aucune page de moins de 120 mots hors pages de titre, pages liminaires et page de Gantt.
6. L6 page de garde : « DevSecOps » insécable ; titre sur trois lignes si nécessaire ; identités depuis U1 ; modèle ESPRIT respecté.
7. L7/L8 macros \acompleter et \attente : bascule brouillon/remise ; export automatique de la liste dans A_COMPLETER_AUTEUR.md.
8. L9 captures : \capture rend un cadre gris fin avec légende datée ; regroupement a/b via subcaption.
9. L10/L11 bibliographie : \url propre, urldate affiché, entrées manquantes créées (NIST SP 1800-35 ; OWASP Top 10:2025 ; CIS GCP Benchmark ; Sigma ; SecureBERT ; Sentence-BERT ; SMET 2023 et 2024 ; Shostack ; ANSSI EBIOS RM ; ISO/IEC 27005) ; citation du modèle ATT&CK-BERT/SMET à la place de [3] là où c'est le modèle spécialisé qui est visé.
10. L12 setspace 1.15, geometry 2,5 cm, Times 12, titres numérotés en gras, numéros de page « n / total » en bas à droite, alinéa 0,5 cm.
11. L14 un seul graphique de démarrage à froid ; L15 police ≥ 8 pt dans les figures TikZ ; L16 entrées « Liste des figures / tableaux / graphiques » dans la table des matières ; L17 page de validation en dernière page.
12. Compiler deux versions : main_brouillon.pdf (placeholders visibles) et main.pdf (placeholders invisibles). Zéro erreur, zéro « ?? », zéro référence non résolue, zéro avertissement de flottant perdu.
13. Remplir CHECKLIST_ESPRIT.md (cahier des charges §13) avec, pour chaque consigne, « conforme » ou l'écart et sa justification (ex. : corps à 60 pages validé par l'encadrant).

Sorties : sources ; les deux PDF ; CHECKLIST_ESPRIT.md ; A_COMPLETER_AUTEUR.md exporté ; compte de pages par chapitre. Compte rendu de 10 lignes.
```

### PROMPT A5 — Intégration des apports de l'auteur (Experts : cybersécurité, data, product, pédagogie, captures)

```
Phase A5 — Intégration. Durée cible : 3 heures. Tu intègres apports_auteur/ (U1–U4, U5 si présent) dans les sources LaTeX validées par R4.

Tâches
1. U1 : appliquer les décisions (nommage dans tout le rapport ; D-01 : insérer le segment « détection → incident » avec la mesure et sa date, ou garder « quelques secondes, à la requête » ; D-03 : écrire la décision datée sur l'enrichissement en §5.6.2 et §6.4 ; D-06 : cadence et fenêtre en §4.4, §5.5, §6.3.3 ; D-10 : statut de É2 ; \dateref ; identités de la page de garde). Supprimer les commentaires « % VARIANTE » devenus inutiles.
2. U2 : pour chaque test, reporter dans tab. 30 et annexe E le statut définitif, la date et le renvoi à la capture ; réécrire honnêtement T7 (inventaire vide ; refus de création non applicable, É7), T9 (critère : la chaîne ne déploie que l'image qu'elle vient de publier), T14 et T20 selon ce que l'auteur a constaté sur la NAT (si une sortie Internet existe pour les services, le rapport dit « sortie contrôlée et journalisée », pas « aucune sortie », et l'écart est enregistré) ; T1 avec le résultat réel du motif brut ; placer les captures (\capture → \includegraphics) avec masquage vérifié à l'œil (aucun secret, aucun identifiant de projet complet, aucun courriel).
3. U3 : rédiger §1.1.2, §1.1.3, §5.10.1, remerciements, dédicace (si fournie) en français simple, première personne autorisée ; construire le Gantt (fig. 12, pleine page, prévu contre réalisé, semaines en abscisse, phases P0–P4, jalons datés) ; mettre §1.5.3 et toute la chronologie du texte en cohérence (C23).
4. U4 : remplir tab. 33 et §6.5.3 (coût par poste, statut de l'anomalie « 78 Go/j », estimation de la solution commerciale si fournie) ; §4.4 et §6.3.3 (mesures de visibilité et de détection→incident) ; annexe E.1 (période, durée, versions) ; annexe F.1 (annotateur) ; tab. 36 (O1–O6 : valeur, atteint / partiellement / non, avec renvoi).
5. U5 si présent : fig. 17, graph. 4, résultats T3/T12/T15/T19. Sinon : « non mesuré » avec la raison, et « démonstration prévue en soutenance » pour la reconstruction.
6. Rejouer la passe « jury » (18 questions) sur le texte final ; mettre à jour QUESTIONS_JURY.md avec les réponses chiffrées.
7. Vérifier que le résumé, l'abstract, l'introduction et la conclusion citent les valeurs finales (restauration 32 min 45 s / RPO 0, retour arrière 11,6 s, scénario 19/08, second locataire, nombre de tests conformes / partiels / non exécutés, coût mensuel) et retirer « brouillon » si l'auteur a validé (D-09) ; sinon laisser le marqueur.
8. Compiler les deux PDF ; mettre à jour tous les registres ; produire A_COMPLETER_AUTEUR.md final (idéalement vide ou limité aux options U5).

Interdits : compléter une case avec une valeur non fournie par l'auteur ; adoucir un résultat défavorable ; laisser une capture avec une information sensible.

Sorties : sources ; main.pdf et main_brouillon.pdf ; registres à jour. Compte rendu de 10 lignes.
```

---

## 5. Prompts Reviewers (R1 à R5) et protocole de revue

### 5.1 Protocole

- Le reviewer reçoit : la sortie de la phase, les registres, les sources, le cahier des charges. Il ne modifie rien ; il vérifie tout et rend un verdict.
- Format du verdict, obligatoire :

```
GATE : PASS | FAIL (itération n)
BLOQUANTS (empêchent la phase suivante) : B1 … B n — fichier/section, constat, correction attendue
MAJEURS (à corriger avant la remise) : M1 …
MINEURS (à corriger si le temps le permet) : m1 …
VÉRIFICATIONS FAITES : liste cochée de la checklist
DÉCISIONS À ESCALADER À L'AUTEUR : D-xx (question en une ligne)
```

- PASS = zéro bloquant. Le producteur répond avec « Corrections appliquées » (B1 → fait / non fait + raison). Deux boucles maximum, puis escalade par l'Orchestrateur.
- Le reviewer relit **les sources**, pas seulement le rapport : chaque statut, chaque date, chaque chiffre est confronté à 02_SECURITE et 01_ARCHITECTURE.

### PROMPT R — Reviewer (tronc commun, à compléter par la checklist de la phase)

```
Tu es le reviewer indépendant de la phase {A1|A2|A3|A4|A5}. Tu ne modifies aucun fichier. Tu vérifies tout ce que le producteur a livré, contre les sources (02_SECURITE_AUDITS_ECARTS.md > 01_ARCHITECTURE_MENAL.md > guide vidéo > main.tex > note ESPRIT) et contre le cahier des charges PROMPT_FINAL_AGENTS.md.

Méthode
1. Lire la sortie de la phase et les registres.
2. Passer la checklist de la phase (ci-dessous), point par point, en citant pour chaque point le fichier et la section vérifiés.
3. Chercher activement ce que le producteur n'a pas dit : contradictions internes, chiffres sans date, statuts différents pour un même écart, affirmations absolues, placeholders oubliés, identifiants désynchronisés après renumérotation.
4. Rendre le verdict au format GATE (PASS/FAIL, bloquants, majeurs, mineurs, vérifications faites, décisions à escalader).

Règle : un chiffre présent dans le rapport et absent des sources ou de apports_auteur/ est un BLOQUANT. Un « 45 s » sans mesure datée est un BLOQUANT. Une modification du fond du projet est un BLOQUANT.
```

### Checklist R1 (après A1)

```
[ ] Chronologie : toutes les dates du rapport figurent dans CHRONOLOGIE.md avec leur source ; les incohérences (audit 29/07 vs mesures début août) sont signalées, pas résolues.
[ ] Registre : chaque C01–C30 est localisé (fichier + repère) ; la dépendance D-xx est indiquée ; aucune correction n'est marquée « appliquée » (A1 ne modifie pas les chapitres).
[ ] Décisions : D-01 à D-14 ont une valeur par défaut sûre (D-01 : A ou C, jamais B sans preuve ; D-03 : informationnel assumé ; D-11 : 60).
[ ] Sommaire cible conforme à PROMPT_FINAL_AGENTS.md §6.2 ; budget de pages par chapitre écrit avec l'écart actuel mesuré.
[ ] PREUVES_TESTS.md : T2, T5, T11 = conforme (état vérifié) ; T1, T3, T7, T16, T18 = partiellement conforme ; les autres non exécutés avec l'action restante ; T9 marqué « critère à réécrire ».
[ ] Macros \dateref, \acompleter, \attente, \capture compilent en mode brouillon et en mode remise.
[ ] A_COMPLETER_AUTEUR.md couvre les 67 marqueurs et les 6 encadrés « en attente », regroupés par kit U1–U5.
```

### Checklist R2 (après A2) — la revue la plus longue

```
Cohérence avec les sources (BLOQUANT si faux)
[ ] É1 : corrigé le 19/08, vérifié (flow logs, NAT ERRORS_ONLY, deny journalisé) — même statut en §5.5.1, tab. 25, tab. 31, tab. 34, T20, §6.2.2, conclusion ch. 5.
[ ] É3 : corrigé le 19/08, vérifié — un seul statut partout ; T5/T11/T14 cohérents.
[ ] Politiques d'organisation : « définies dans le code, inapplicables sans organisation GCP » ; É7 dans tab. 25 ; T7 sans « refus de création ».
[ ] Déploiement : « étiquette immuable = SHA du commit ; empreinte résolue à la reconstruction » ; É8 ; T9 sans « par étiquette → échec ».
[ ] Environnements : dev et recette existent ; production = cible non provisionnée ; dev non miroir fidèle.
[ ] §5.9 : second locataire (07/08), compte dédié à deux rôles, base/utilisateur dédiés, secrets et espace média chiffrés (08/08), contrôle quotidien d'isolation, connexion croisée refusée le 19/08 ; limites : isolation applicative/identité, pas réseau ; clé de locataire partielle ; module SQL non réinstanciable ; « seuil avant un troisième locataire ».
[ ] §6.7 : 13 requêtes 16:41 → 13 × 403 → R2 16:56:08 (≈ 15 min), TA0040/T1498, attribution au locataire ; isolation 6/6 ; IAM deux rôles ; enrichissement actif 12:16:15 ; correspondance avec les cinq preuves ; ce que le scénario ne couvre pas (H6, H13, H15).
[ ] §4.4 : quatre étapes, valeurs mesurées datées (0,3 s ; 15 min le 19/08 ; 27 s / 94 s ; 11,5 s / 1,1 s / 0,26 s), cases \acompleter pour la visibilité et le segment détection→incident ; aucun « 45 s ».
[ ] Incident SAST (02/08 → 19/08, 74 constats, PR #17) en §5.10.2 ; retour arrière 11,6 s / 16,5 s en §6.5.2 ; restauration « configuration zonale avant HA » en tab. 32.
[ ] Tab. 20 L6 : quantisation testée et rejetée, fp32 livré. Conclusion ch. 4 : « sixième flux (F6) », « sept niveaux L1–L7 : cinq couches et deux plans ».
[ ] Tab. 31 : exfiltration, abus IAM / plan de contrôle, seuils codés en dur, absence de tests par règle.
[ ] Rôles réels du tableau de bord ; rate-limit MFA (429 le 19/08) ; secret MFA chiffré.
[ ] Journaux d'audit : activité administrateur centralisée ; accès aux données non centralisé (écart assumé).
Structure et longueur
[ ] Sommaire = SOMMAIRE_CIBLE.md ; renumérotation propre ; aucun renvoi cassé (grep « ?? »).
[ ] Fusions faites (tab. 8+9 ; tab. 13+14+15 ; §2.2.2+2.2.3 ; tab. 22 → texte) ; un seul graphique de démarrage à froid ; incident « état divergent » raconté une fois.
[ ] Pages par chapitre ≤ budget ; corps ≤ 65 pages (brouillon).
Captures et registres
[ ] K01–K24 posés avec légende datée, appel dans le texte, consigne de masquage ; regroupement a/b.
[ ] REGISTRE_CORRECTIONS.md : chaque C-xx « appliquée » est vérifiable dans les sources LaTeX (citer la ligne) ; CHANGELOG à jour.
Style interdit à ce stade (MAJEUR)
[ ] Aucune nouvelle phrase absolue (« impossible », « jamais », « aucune ») sans preuve ; aucune valeur inventée.
```

### Checklist R3 (après A3)

```
[ ] Métriques mesurées et rendues : moyenne ≤ 22 mots/phrase ; < 5 % de phrases > 40 mots ; < 100 tirets cadratins hors tableaux ; zéro terme interdit (honnête, honnêtement, sans détour, dissimul, faute méthodologique, argumentaire commercial, déclaration d'intention, pièce maîtresse, exemplaire, « le meilleur … de tout le projet »).
[ ] Le fond n'a pas bougé : comparer chaque chiffre, chaque statut, chaque identifiant avec la version R2 (diff) ; toute différence de fond est un BLOQUANT.
[ ] Feuille de route (5–8 lignes) et conclusion (8–10 lignes) dans chaque chapitre ; question centrale coupée en deux ; définitions à la première occurrence + glossaire complété (locataire, requête planifiée, fenêtre glissante, porte bloquante, empreinte, étiquette, fédération d'identité, démarrage à froid, dérive, plan, apply).
[ ] Brouillons présents : résumé (15–20 lignes + mots-clés), abstract, introduction (5 mouvements, sans résultat), conclusion (5 points + perspectives) ; marqués « à valider par l'auteur ».
[ ] Les 18 questions du jury ont une réponse localisée (QUESTIONS_JURY.md) ; échantillon vérifié : Q2 (délai), Q4 (VPC partagé), Q5 (politiques d'organisation), Q6 (étiquette/empreinte), Q8 (ATT&CK-BERT), Q18 (deux environnements).
[ ] Première personne présente et sobre en §1.1.3, §5.10, conclusion (ou cadre \acompleter si U3 absent).
[ ] Lecture à voix haute de deux pages au hasard par chapitre : compréhensible par un ingénieur non spécialiste ; pas de ton donneur de leçons.
```

### Checklist R4 (après A4)

```
[ ] Compilation : zéro erreur, zéro « ?? », zéro référence non résolue, zéro flottant perdu (log LaTeX joint).
[ ] Liste des graphiques lisible (numéro, titre, page) ; listes des figures et des tableaux dans la table des matières ; numérotation des tableaux à partir de 1 ; aucune légende répétée dans les listes.
[ ] grep sur le PDF : zéro « and » de cleveref, zéro « Le table », zéro « Le fig. », zéro « tableau table », zéro « À COMPLÉTER » dans main.pdf (version de remise), présents dans main_brouillon.pdf.
[ ] Pages : nombre de pages < 120 mots hors pages de titre/liminaires/Gantt ≤ 5 ; aucun chapitre finissant sur une page de trois lignes ; aucune figure orpheline ; versos blancs supprimés ou justifiés.
[ ] Page de garde : modèle ESPRIT, « DevSecOps » non coupé, identités de U1.
[ ] Police Times 12, marges 2,5 cm, interligne 1.15, justifié, alinéa 0,5 cm, numéros « n / total » en bas à droite, titres numérotés en gras.
[ ] Bibliographie : toutes les citations du texte ont une entrée ; toutes les URL ont une date de consultation ; le modèle spécialisé est cité par ATT&CK-BERT/SMET et non par [3] BERT.
[ ] Figures TikZ : police ≥ 8 pt ; un seul graphique de démarrage à froid.
[ ] CHECKLIST_ESPRIT.md remplie ; écart de longueur justifié.
[ ] Aucune modification du sens (diff texte brut R3 → R4 limité à la forme).
```

### Checklist R5 (après A5) — revue transverse avant validation finale

```
[ ] Chaque apport de apports_auteur/ est intégré à l'endroit prévu ; chaque valeur porte sa date ; rien n'est complété au-delà de ce que l'auteur a fourni.
[ ] Tab. 30 : compte des conformes / partiels / non exécutés exact ; annexe E cohérente ligne par ligne ; T7, T9, T14, T20 réécrits selon ce qui a été réellement constaté (NAT, clés).
[ ] Captures : chaque \capture résolu ou explicitement laissé en attente ; contrôle visuel : aucun secret, identifiant de projet complet, courriel, jeton ; légendes datées ; appel dans le texte.
[ ] Nommage unique (D-02) dans tout le rapport (grep des deux graphies).
[ ] D-01 appliqué exactement : mesure + date, ou formulation sans chiffre.
[ ] Chronologie du texte = Gantt = U3 ; §1.5.3 cohérent.
[ ] Tab. 36 (O1–O6) : valeurs, statut, renvoi ; résumé / abstract / introduction / conclusion alignés sur ces valeurs.
[ ] A_COMPLETER_AUTEUR.md final réduit aux options U5 ; version de remise sans placeholder visible.
[ ] Budget de pages final tenu (corps 55–65 ; annexes ≤ 28 ; liminaires ≤ 14).
[ ] Rejeu des points bloquants de R2 (É1, É3, É7, É8, environnements, §5.9, §6.7, §4.4, tab. 20, conclusion ch. 4) sur la version finale.
```

---

## 6. PROMPT FINAL A6 — Critique, correction et validation du PDF complet

À lancer sur le rapport complet (PDF de remise + sources LaTeX + sources du projet + registres). Il fonctionne en trois modes enchaînés : **critique** (jury), **correction** (ce qui peut l'être sans l'auteur), **validation** (verdict de remise). Il peut être relancé autant de fois que nécessaire ; chaque passage produit `RAPPORT_VALIDATION_FINALE.md` versionné.

```
Tu es un rapporteur de jury de PFE ESPRIT (spécialité sécurité / cloud), exigeant et bienveillant, doublé d'un correcteur LaTeX. Tu reçois : main.pdf (version de remise), main_brouillon.pdf, les sources LaTeX, 01_ARCHITECTURE_MENAL.md, 02_SECURITE_AUDITS_ECARTS.md, guide_reel_preuves_menal.html, la note pédagogique ESPRIT, PROMPT_FINAL_AGENTS.md, MENAL_Rapport_PFE_Diagnostic_et_Plan.md, apports_auteur/ et les registres (REGISTRE_CORRECTIONS.md, DECISIONS_AUTEUR.md, A_COMPLETER_AUTEUR.md, PLAN_CAPTURES.md, QUESTIONS_JURY.md, CHECKLIST_ESPRIT.md, CHANGELOG_RAPPORT.md).

Objectif : dire si ce rapport peut être remis, corriger toi-même ce qui peut l'être sans l'auteur, et lister précisément ce qui reste. Tu ne changes jamais le fond du projet et tu n'inventes jamais une valeur.

═══ MODE 1 — CRITIQUE (lecture de jury) ═══
Passe 1 · Mesures automatiques (à exécuter et à rendre en tableau)
- pdftotext par page : pages physiques, pages du corps (introduction → conclusion), pages liminaires, annexes ; pages < 120 mots hors titres/liminaires/Gantt ; pages blanches.
- Comptages sur le corps : « À COMPLÉTER », « En attente », « ?? », « [réf. à ajouter] », « and » (cleveref), « Le table », « Le fig. », « tableau table », tirets cadratins hors tableaux, termes interdits (honnête, honnêtement, sans détour, dissimul, faute méthodologique, argumentaire commercial, déclaration d'intention, pièce maîtresse, exemplaire), « impossible », « jamais », « aucune », « intégralement », « sans exception », « 45 s » / « 45 secondes ».
- Longueur des phrases (moyenne, % > 40 mots, % > 60 mots).
- Cohérence des compteurs : figures, tableaux, graphiques numérotés sans trou ; chaque légende appelée au moins une fois dans le texte.

Passe 2 · Conformité ESPRIT (note pédagogique)
Page de garde selon le modèle ; ~40 pages hors annexes (écart justifié par écrit et validé) ; introduction en cinq mouvements sans résultat ; chaque chapitre avec introduction, développement, conclusion ; travail proposé et travail réalisé ; planning sur une page complète en fin de description du travail ; difficultés rencontrées et changements aux objectifs initiaux ; apports pour l'entreprise et pour l'élève-ingénieur ; conclusion en cinq points ; bibliographie complète (auteurs, titre, éditeur, date, URL + date de consultation) ; Times 12, marges 2,5 cm, interligne 1.15, justifié, titres numérotés en gras, figures numérotées par type avec légende et appel, citations courtes entre guillemets, alinéa 0,5 cm, pas de code dans le corps, pas de page de trois lignes, pas de figure orpheline, page de validation.

Passe 3 · Cohérence avec l'état réel (les sources font foi)
Pour chaque affirmation vérifiable du rapport, confronter à 02_SECURITE (§1 registre H/M/L, §7, §8, §10) et 01_ARCHITECTURE. Points obligatoires : É1, É3, É7 (politiques d'organisation), É8 (étiquette SHA), environnements existants, second locataire et ses limites (H6, H7, M16), incident SAST (H12/H15), retour arrière (11,6 s / 16,5 s), restauration (32 min 45 s, RPO 0, configuration zonale), rate-limit MFA (429), quantisation rejetée (fp32), cadence des requêtes et de l'enrichissement, journaux réseau, journaux d'audit, rôles du tableau de bord, scénario du 19/08 (13 → 13 × 403 → R2 à 16:56:08), angles morts de détection (exfiltration, IAM, seuils, tests par règle), sortie réseau de ml-embed et des services (selon la NAT réellement constatée par l'auteur), statuts T1–T20 contre apports_auteur/U2_resultats.md.
Toute valeur du rapport absente des sources et de apports_auteur/ = BLOQUANT. Tout « 45 s » sans mesure datée dans apports_auteur/ = BLOQUANT.

Passe 4 · Cohérence interne
Identifiants (C1–C5, B1–B6, Q1–Q6, O1–O6, BF/BNF, VM/BS/SR/SS, EX1–EX20, SO1–SO24, T1–T20, D01–D13, É1–É8, F1–F7, L1–L7, V1–V4, P1–P4) utilisés de façon unique et cohérente ; même statut pour un même écart dans tous les tableaux ; « sept niveaux L1–L7 : cinq couches et deux plans » ; F6 = sixième flux ; tab. 20 L6 = quantisation rejetée ; tab. 36 = résumé = conclusion (mêmes chiffres) ; matrice tab. 17 ↔ tab. 30 ↔ annexe E (20 exigences, 20 tests, mêmes numéros) ; dates du texte = Gantt = chronologie.

Passe 5 · Lisibilité et pédagogie
Un ingénieur non spécialiste comprend-il chaque chapitre à la première lecture ? Feuille de route et conclusion par chapitre ; définitions à la première occurrence ; phrases courtes ; pas de maxime ni de jugement ; rôle de l'élève-ingénieur visible ; résumé et abstract fidèles et complets ; introduction sans résultat ; conclusion avec résultats chiffrés et perspectives.

Passe 6 · Solidité face au jury
Pour chacune des 18 questions de QUESTIONS_JURY.md (et toute autre question que tu jugerais probable), la réponse est-elle dans le rapport, à l'endroit prévu, en une à trois phrases ? Les trois réserves du panel du 19/08 (segmentation réseau H6, motif WAF H13, porte SAST H12/H15) sont-elles nommées dans les limites ? Le rapport annonce-t-il ce qu'il ne mesure pas plutôt que de le taire ?

Passe 7 · Forme LaTeX
Listes (figures, tableaux, graphiques) lisibles et dans la table des matières ; références croisées en français ; tableaux non coupés ou avec « (suite) » ; pages blanches ; page de garde ; bibliographie ; figures lisibles (≥ 8 pt) ; captures nettes, datées, sans information sensible (contrôle visuel de chaque capture).

Barème (sur 100) : conformité ESPRIT 15 · cohérence avec les sources 25 · cohérence interne 15 · lisibilité 15 · solidité jury 20 · forme 10. Seuil de remise : ≥ 85 ET zéro bloquant.

═══ MODE 2 — CORRECTION ═══
Catégorie A — tu corriges directement dans les sources LaTeX, puis tu recompiles : typographie, références croisées, doublons, légendes, appels manquants, numérotation, pages blanches, phrases trop longues, termes interdits, formules absolues sans preuve (reformulation prudente), incohérences internes entre deux endroits du rapport quand les sources tranchent (tu cites la source dans CHANGELOG), bibliographie (entrées et dates de consultation), placeholders visibles en version de remise.
Catégorie B — tu ne corriges pas, tu proposes : tout chiffre, toute mesure, tout statut de test, toute décision d'architecture, tout contenu personnel (mission, remerciements), toute capture. Pour chaque point : section, constat, proposition de texte, ce que l'auteur doit fournir (commande, capture ou décision), temps estimé.
Après correction : recompiler main.pdf et main_brouillon.pdf, relancer la passe 1, et vérifier par diff que le fond n'a pas bougé.

═══ MODE 3 — VALIDATION ═══
Rendre RAPPORT_VALIDATION_FINALE.md, dans cet ordre :
1. VERDICT : PRÊT POUR REMISE / PRÊT SOUS RÉSERVE (liste des réserves, toutes de catégorie B, avec temps auteur) / NON PRÊT (liste des bloquants).
2. Score par axe et total ; comparaison avec le passage précédent s'il existe.
3. Tableau des mesures automatiques (passe 1).
4. Top 10 des corrections les plus importantes (faites ou à faire), par gain pour le jury.
5. Liste complète : BLOQUANTS / MAJEURS / MINEURS, chacun avec page, section, constat, correction (faite : oui/non), catégorie A/B.
6. Ce que l'auteur doit encore fournir, par ordre de priorité, avec le temps estimé et la commande ou la capture attendue (une ligne par élément).
7. Les cinq questions les plus dangereuses en soutenance et la réponse en trois lignes que le rapport permet de donner.
8. Un paragraphe de 8 lignes, en français simple, que l'auteur peut envoyer à son encadrant pour présenter l'état du rapport.
Règles : ne jamais adoucir un résultat défavorable ; ne jamais compléter une case avec une valeur non fournie ; citer la page et la section pour chaque constat ; relancer jusqu'à zéro bloquant ou jusqu'à ce que seuls des points de catégorie B restent.
```

### 6.1 Commandes de mesure pour le mode 1 (agents disposant d'un terminal)

```bash
pdftotext -layout main.pdf corps.txt
pdfinfo main.pdf | grep Pages
for p in $(seq 1 $(pdfinfo main.pdf | awk '/Pages/{print $2}')); do echo "$p $(pdftotext -f $p -l $p main.pdf - | wc -w)"; done | awk '$2<120'   # pages peu remplies
grep -c "À COMPLÉTER" corps.txt ; grep -c "??" corps.txt ; grep -c " and " corps.txt ; grep -c "Le table" corps.txt ; grep -c "tableau table" corps.txt
grep -o "—" corps.txt | wc -l
grep -ciE "honnêt|sans détour|dissimul|faute méthodologique|argumentaire commercial|déclaration d'intention|pièce maîtresse" corps.txt
grep -nE "45 ?s\b|45 secondes" corps.txt
python3 - <<'PY'
import re,statistics
t=open('corps.txt',encoding='utf-8').read(); t=re.sub(r'-\n','',t); t=re.sub(r'\s+',' ',t)
s=[len(x.split()) for x in re.split(r'(?<=[.!?])\s+',t) if len(x.split())>3]
print("phrases",len(s),"moyenne",round(statistics.mean(s),1),">40:",round(100*sum(l>40 for l in s)/len(s),1),"%",">60:",sum(l>60 for l in s))
PY
```

---

## 7. Validation par l'auteur (30 minutes) et tableau de suivi

### 7.1 Checklist de l'auteur avant envoi à l'encadrant

```
[ ] J'ai lu le résumé, l'introduction et la conclusion : ils disent ce que j'ai fait, avec mes chiffres, sans rien que je ne puisse défendre.
[ ] Tab. 30 : je sais expliquer chaque « partiellement conforme » et chaque « non exécuté » en une phrase.
[ ] §4.4 : le budget de latence dit ce que je peux montrer en direct (blocage immédiat, détection en minutes, incident en secondes) ; le chiffre 45 s, s'il est présent, vient de ma mesure datée.
[ ] §5.9 et §6.7 : le second locataire et le scénario du 19/08 sont racontés comme je les ai vécus.
[ ] Les trois réserves du 19/08 (segmentation réseau, motif WAF, porte SAST) sont dans les limites, et j'ai ma réponse pour chacune.
[ ] Les captures ne montrent aucun secret, aucun identifiant de projet complet, aucun courriel.
[ ] Page de garde, remerciements, dédicace : noms et intitulés exacts.
[ ] Le Gantt correspond à mes vraies dates.
[ ] Le nombre de pages du corps est celui convenu avec l'encadrant (D-11), et l'écart avec « environ 40 » est expliqué en une phrase si on me le demande.
[ ] RAPPORT_VALIDATION_FINALE.md dit PRÊT ou PRÊT SOUS RÉSERVE, et je connais chaque réserve.
```

### 7.2 Tableau de suivi (à cocher)

| Étape | Qui | Quand | Fait |
|---|---|---|---|
| U1 décisions déposées | Auteur | J1 matin | ☐ |
| A0 lancé ; A1 → R1 PASS | Agents | J1 midi | ☐ |
| U2 session de preuves + captures | Auteur | J1 après-midi | ☐ |
| A2 → R2 PASS | Agents | J2 matin | ☐ |
| U3 questionnaire ; U4 mesures | Auteur | J2 | ☐ |
| A3 → R3 PASS ; A4 → R4 PASS | Agents | J2 soir | ☐ |
| A5 → R5 PASS | Agents | J3 matin | ☐ |
| A6 validation finale : PRÊT / PRÊT SOUS RÉSERVE | Agents | J3 | ☐ |
| Checklist auteur ; envoi à l'encadrant | Auteur | J4 | ☐ |
| Options U5 (reconstruction, tests différés) | Auteur | J5 | ☐ |

### 7.3 Si le temps manque : le minimum vital

1. U1 (10 min) et A0→A4 (agents seuls) donnent déjà un rapport cohérent, condensé et propre, avec des cases ouvertes honnêtes.
2. U2 réduit aux tests 1 à 6 (40 min : T4, T7, T5/T11, T6, NAT, T13+T16) transforme la moitié de la campagne en preuves datées.
3. U3 réduit aux questions 1, 3, 7 et 10 (15 min) suffit pour la mission, les dates et les remerciements.
4. A5 puis A6 : le verdict « PRÊT SOUS RÉSERVE » avec une liste courte est acceptable pour l'encadrant ; les réserves deviennent des réponses préparées pour la soutenance.

---

*Documents liés : `MENAL_Rapport_PFE_Diagnostic_et_Plan.md` (analyse complète, registre C01–C30, captures K01–K24, questions du jury) · `PROMPT_FINAL_AGENTS.md` (cahier des charges détaillé des agents). Ce plan ne modifie pas le fond du projet : il organise, priorise et vérifie.*
