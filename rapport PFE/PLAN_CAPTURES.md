# PLAN DES CAPTURES K01 à K32

> État au 27/08/2026, **vérifié dans les sources LaTeX** et non déclaré (sections 1 à 3 datées
> du 26/08, sections 3 bis et 3 ter ajoutées le 27/08 après extension de la nomenclature).
> Les emplacements sont posés par la macro `\capture{ID}{légende}{consigne}` ou
> `\capturedouble{IDa}{IDb}{...}`. Si le fichier `figures/<ID>.png` existe, il est inséré
> automatiquement ; sinon un cadre de hauteur réservée tient la place, avec l'identifiant en
> petit gris dans la version de remise et la consigne de masquage dans la version de travail.
>
> **Rien à modifier dans le LaTeX pour intégrer une capture : il suffit de déposer le fichier
> image au bon nom et de recompiler.**

## 1. Emplacements posés dans le corps (7 figures, 9 captures)

| ID | Emplacement | Ce que la capture doit montrer | Preuve disponible |
|---|---|---|---|
| K22 | §5.2.2, chaîne d'infrastructure | Planification sans différence : la configuration déclarée correspond à l'état provisionné | **Oui**, 19/08/2026 |
| K05 | §5.7, interface de supervision | Vue des incidents sous compte analyste, alerte R2 rattachée à T1498, attribuée au locataire | **Oui**, 23/08/2026 |
| K07 | §5.9.1, second locataire | Contrôle d'isolation : six vérifications sur six, connexion croisée refusée | **Oui**, 19/08/2026 |
| K23 + K02 | §5.10.2, incident de la porte d'analyse statique | Figure double : exécution verte du 16/08 (porte n'évaluant aucune règle) contre exécution du 19/08 (612 règles, 439 fichiers, 74 constats, code 1) | **Oui**, 16 et 19/08/2026 |
| K14 + K15 | §6.2, campagne de tests | Figure double : T1 (trois charges refusées en 403, contrôle légitime en 200) et T2 (dix réponses 422 puis une 429) | **Oui**, 23/08 et 19/08/2026 |
| K16 | §6.2, campagne de tests | Cloisonnement de l'identité du second locataire : deux rôles exactement, usurpation refusée | **Oui**, 23/08/2026 |
| K21 | §6.7, démonstration globale | Alerte R2 du 19/08 à 16:56:08 UTC : treize requêtes bloquées comptées sur la fenêtre de quinze minutes | **Oui**, 19/08/2026 |

## 2. Emplacements posés en annexe H

| ID | Ce que la capture doit montrer | Preuve disponible |
|---|---|---|
| K06 | Indicateurs de l'enrichissement : dernier rattachement à 12:16:15 UTC, technique T1556.003, similarité 0,698 | Partielle, 19/08/2026 |
| K20 | Retour arrière par bascule de révision : 11,6 s puis 16,5 s | **Oui** mais ancienne, 07/08/2026, à rejouer |

## 3. Captures volontairement NON posées

Ces onze identifiants correspondent à des tests que le rapport déclare lui-même **non exécutés**
ou à des chiffres qu'il refuse explicitement de publier. Poser une capture les concernant serait
une contradiction interne, immédiatement visible par un jury.

| ID | Test ou objet | Pourquoi elle n'est pas posée |
|---|---|---|
| K01 | T10, secret factice bloqué | Test déclaré non exécuté au chapitre 6 |
| K03 | T8, vulnérabilité critique bloquée | Test déclaré non exécuté |
| K04 | Configuration d'infrastructure refusée | Trace non archivée, déclarée non exécutée |
| K10 | T4, données inaccessibles depuis Internet | Test déclaré non exécuté |
| K11 | T11, intégrité de la chaîne de preuve | Preuve indirecte seulement ; à poser au rejeu |
| K12 | T7, inventaire de clés vide | Inventaire exhaustif non archivé |
| K13 | T16, dérive détectée | Protocole corrigé non rejoué |
| K17 | Couverture ATT&CK par tactique | Le rapport refuse de publier un taux faute de dénominateur versionné |
| K18 | Comparaison des méthodes d'enrichissement | Évaluation déclarée non exécutée |
| K19 | Reconstruction complète chronométrée | Non chronométrée, et le rapport ne la compte pas comme résultat |
| K08 | Réservé | Sans objet, retiré de la nomenclature |

Un commentaire `% capture Kxx` est posé dans le source à chacun de ces emplacements, pour la
traçabilité. L'annexe H section 2 en donne le protocole de preuve sous forme de tableau : ce que
la capture devra montrer et ce qu'il faudra masquer, le jour où le test sera rejoué.

**K24** était close dans sa définition initiale : elle devait montrer des extraits de code, ce que
l'annexe B fait déjà sous forme d'extraits encadrés copiés du dépôt.

## 3 bis. Nomenclature étendue K24 à K32 — ajoutée le 27/08/2026

La passe de contrôle qualité du 27/08/2026 a réservé un emplacement de preuve à **chacun des
douze protocoles déclarés non exécutés**, pour qu'aucun ne reste sans condition de clôture écrite.
L'identifiant K24 est donc réattribué, et huit identifiants nouveaux sont créés. Ils n'existent
que comme **spécification** dans le tableau de l'annexe H, section H.2 : aucun cadre n'est posé
dans le corps, aucune image n'est attendue avant le rejeu du protocole correspondant.

| ID | Test | ID | Test |
|---|---|---|---|
| K24 | T6 --- appels entre services | K29 | T15 --- charge sur l'enrichissement |
| K25 | T9 --- registre de confiance | K30 | T17 --- protection de l'état |
| K26 | T12 --- interruption de collecte | K31 | T19 --- consommation anormale |
| K27 | T13 --- attribution des actions | K32 | T20 --- sorties réseau restreintes |
| K28 | T14 --- sortie du composant d'inférence | | |

Les quatre restants parmi les douze réutilisent des identifiants déjà spécifiés : K01 (T10),
K03 (T8), K10 (T4) et — hors des douze mais au même titre — K11, K12, K13 et K19.

Chacun porte en annexe E un **attendu formulé avant exécution**, et en annexe H son critère de
recevabilité et sa consigne de masquage. Rien à produire tant que le protocole n'est pas rejoué.

## 3 ter. Ce qui est réellement à produire aujourd'hui

Seuls **onze fichiers**, correspondant à **neuf cadres** effectivement posés, laissent un
rectangle gris dans la version de remise : K02, K05, K06, K07, K14, K15, K16, K20, K21, K22, K23.
Tous les autres identifiants sont soit des placeholders visibles en version de travail seulement,
soit des spécifications sans cadre.

**Point critique** : ces onze cadres portent déjà, dans leur légende imprimée, la valeur exacte
que la capture devra montrer (horodatage, décompte, code de retour). Cinq d'entre eux se
recapturent depuis une source durable **avec leur date d'origine intacte** ; les six autres
exigent un rejeu, qui produira l'horodatage du jour et impose alors de **corriger la date dans la
légende**. Le détail capture par capture figure dans le cahier de preuves publié le 27/08/2026.

## 4. Comment produire les captures

1. **Capturer pendant l'exécution, jamais après.** Une capture reconstituée n'est pas une preuve.
2. **Résolution** : largeur d'au moins 1600 px, PNG sans perte, sans redimensionnement ensuite.
   Zoom du terminal ou du navigateur à 125 % avant capture, pour rester lisible à l'impression.
3. **Horodatage visible** dans le cadre : `date -u` en tête de bloc, colonne de date de
   l'interface, ou horodatage du journal. Une capture non datable est écartée.
4. **Toujours visible aussi** : le code de retour ou le statut HTTP, qui distingue un refus d'une
   panne.
5. **Cadrage** sur le bloc utile : pas d'écran entier, pas de barre des tâches, pas d'onglets.
6. **Masquage par rectangle noir opaque**, jamais par floutage. À masquer systématiquement :
   identifiant complet de projet cloud, courriels et domaines de comptes de service, jetons et
   valeurs de secrets même factices, adresses IP réelles (remplacer par une adresse de
   documentation), noms de dépôt et d'organisation, empreintes d'images tronquées à douze
   caractères.
7. **Nom du fichier livré** : `latex/figures/K22.png` — exactement l'identifiant, rien d'autre.
   Pour le second panneau d'une figure double : `K02.png`, `K15.png`, `K23.png`.
8. **Fichier de travail** conservé à part sous un nom parlant, avec la sortie brute en `.txt` à
   côté, pour pouvoir rejouer la preuve.
9. **Contrôle final** : rouvrir le PDF compilé et vérifier, capture par capture, qu'aucune valeur
   masquée ne reste lisible à fort grossissement.

## 5. Commandes de reproduction

| ID | Comment reproduire la preuve |
|---|---|
| K22 | Planification de l'infrastructure sur l'environnement de recette ; sortie attendue : aucune différence |
| K05 | Connexion au tableau de bord sous un compte de rôle analyste, vue liste des détections |
| K07 | Exécution du job de contrôle d'isolation entre locataires, puis lecture de ses journaux |
| K23 / K02 | Historique des exécutions de la chaîne d'intégration : exécution du 16/08, puis exécution du 19/08 sur la demande de fusion |
| K14 | Les quatre requêtes du protocole T1 : trois charges d'attaque et une requête de contrôle légitime |
| K15 | Onze requêtes successives sur le point d'entrée de vérification du second facteur |
| K16 | Lecture de la politique d'accès filtrée sur le compte du locataire, puis tentative d'usurpation d'identité |
| K21 | Rejeu du scénario de bout en bout, puis lecture de la table des détections filtrée sur la règle R2 |
| K06 | Vue des indicateurs d'enrichissement du tableau de bord |
| K20 | Bascule de révision du service d'API, chronométrée dans les deux sens |
