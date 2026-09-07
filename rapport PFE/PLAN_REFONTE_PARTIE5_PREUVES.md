# PARTIE 5 — REMONTÉE DE PREUVES : les tests sous-déclarés

> Extrait matérialisé sur disque le 29/08/2026, en complément de `PLAN_REFONTE_PFE.md`.
> **Règle qui prime sur tout le reste** : une remontée n'est légitime que si la preuve invoquée
> **couvre le critère d'acceptation du protocole**, et que cette preuve est **vérifiée dans
> `DOSSIER_TECHNIQUE_MENAL.md`**. Si le dossier technique ne la confirme pas, la remontée n'est
> pas faite — c'est le comportement attendu, pas un échec.

## 5.1 Le constat

Le tableau de synthèse du chapitre 6 annonce **3 conformes, 5 partiels, 12 non exécutés**. C'est
le chiffre le plus dommageable du mémoire : un jury lit « 12/20 non faits » et referme.

Or ce chiffre est **faux par excès de prudence**. Huit de ces douze protocoles disposent d'une
preuve exploitable **déjà présente dans le dépôt ou dans l'infrastructure déployée**. Le rapport
ne les compte pas parce qu'il exige une capture d'écran horodatée, alors qu'un test automatisé
exécuté en intégration continue, une configuration vérifiée en direct ou un journal d'exécution
archivé sont des preuves **au moins équivalentes** — et souvent supérieures, car reproductibles.

## 5.2 Les huit remontées, une par une

| Test | Statut actuel | Preuve déjà existante | Nouveau statut légitime |
|---|---|---|---|
| **T4** — inaccessibilité directe des données | Non exécuté | La description d'infrastructure déclare l'instance sans adresse publique, en accès par appairage privé, avec chiffrement en transit obligatoire. **Et surtout** : le contrôle d'isolation entre locataires exécuté quotidiennement tente réellement une connexion croisée et la voit refusée — six vérifications sur six le 19/08/2026. | **Partiellement conforme** — la propriété est vérifiée par configuration et par un contrôle d'exécution quotidien ; la tentative depuis un hôte externe appartient au plan de validation continue. |
| **T6** — authentification entre services | Non exécuté | Le service d'encodage est configuré en entrée interne exclusive, et le droit d'invocation lui est accordé **nominativement** à la seule identité de la tâche d'enrichissement — pas à un ensemble ouvert. La chaîne d'appel emploie un jeton d'identité obtenu du serveur de métadonnées. | **Partiellement conforme** — l'autorisation nominative est vérifiée dans l'état des droits ; l'appel négatif sans jeton appartient au plan de validation continue. |
| **T7** — absence de clé de longue durée | Partiellement conforme | Recherche exhaustive dans le dépôt : aucune ressource de clé de compte de service, aucun fichier d'identifiants, aucune variable d'environnement pointant un fichier de clé. La fédération d'identité est en place et contrainte sur le dépôt **et** la branche. | **Conforme** — l'inventaire est la preuve, et il est reproductible par une commande. La distinction entre garantie préventive (politique d'organisation, indisponible) et garantie vérifiée (inventaire) **qualifie** le résultat, elle ne l'annule pas. |
| **T8** — artefact vulnérable bloqué | Non exécuté | **Un refus réel a eu lieu** : la porte d'analyse de vulnérabilité a bloqué une livraison sur une faille critique d'une bibliothèque d'archivage embarquée par le gestionnaire de paquets de l'image de base. Corrigé en retirant ce gestionnaire de l'image finale. **C'est déjà écrit au chapitre 5** — et compté comme « non exécuté » dix pages plus loin. | **Conforme** — un refus réellement survenu sur le code de l'auteur est une preuve plus forte qu'un scénario rejoué. Rattacher explicitement l'incident au protocole T8. |
| **T9** — registre de confiance | Non exécuté | Le déploiement référence une étiquette égale à l'empreinte du commit ; le chemin d'amorçage résout une empreinte d'image réelle. L'écart É8 est déjà documenté et daté. | **Partiellement conforme** — le critère a été **révisé en cours de projet** (étiquette ≠ empreinte immuable), ce que le rapport dit déjà. Un résultat partiel avec critère révisé et documenté est un résultat, pas une absence. |
| **T10** — secret versionné bloqué | Non exécuté | La détection de secrets s'exécute à chaque livraison, en tête de chaîne, en porte bloquante, sur l'historique complet. Les journaux de la chaîne l'attestent sur toutes les exécutions. | **Partiellement conforme** — le contrôle est prouvé actif ; le déclenchement volontaire appartient au plan de validation continue. |
| **T11** — intégrité de la preuve | Conforme (sans capture) | **Il existe un test de bout en bout automatisé qui tente réellement l'écriture interdite** sur les tables de preuves depuis l'identité de la tâche d'enrichissement, et vérifie le refus. Il s'exécute à chaque livraison. | **Conforme** — et c'est le meilleur test de toute la campagne. Le mémoire doit le mettre en avant, pas s'excuser de l'absence de capture : un test automatisé rejoué à chaque livraison bat une capture d'écran unique. |
| **T13** — attribution des actions privilégiées | Non exécuté | Les journaux d'accès aux données sont explicitement activés en code pour l'entrepôt, le service de clés, le coffre de secrets et la base ; les journaux d'activité d'administration sont produits par défaut et collectés. | **Partiellement conforme** — l'attribution est établie pour le plan d'administration. La réserve déjà écrite (les journaux d'accès aux données n'ont pas d'export dédié) **qualifie correctement** le résultat. |
| **T16** — dérive de configuration | Partiellement conforme | L'incident du 08/08/2026 est une **détection de dérive en conditions réelles**, non simulée : un échec partiel d'application a laissé l'état local divergent, l'écart a été détecté par comparaison explicite, puis corrigé par resynchronisation. S'y ajoute la planification sans différence du 19/08. | **Conforme** — un mécanisme éprouvé par un incident réel est mieux validé qu'un mécanisme éprouvé par un scénario. Reformuler en ce sens. |

## 5.3 Les protocoles sans preuve : T12, T15, T17, T19, T20

**La vague 1 n'a pas été exécutée.** Ces cinq protocoles n'ont pas de résultat et **ne peuvent
pas être requalifiés en conforme**. Ils relèvent de la question Q3 : plan de validation continue
daté. Même traitement pour la reconstruction chronométrée de l'objectif O2.

Ce que chacun exigerait, pour mémoire et pour le plan daté :

| Test | Ce qu'il faut faire | Durée | Preuve produite |
|---|---|---|---|
| T12 — interruption de collecte | Désactiver temporairement un export de journaux, attendre le déclenchement de la politique d'alerte sur absence de données, relever l'heure de notification, réactiver | 45 min | Notification reçue + horodatages |
| T15 — charge sur l'enrichissement | Injecter un lot de détections de test, déclencher la tâche, relever nombre traité / durée / égalité entrées-sorties | 25 min | Journal d'exécution de la tâche |
| T17 — protection de l'état d'infrastructure | Tenter la lecture de l'emplacement de l'état sous une identité non autorisée, capturer le refus horodaté et le droit manquant nommé | 10 min | Refus d'autorisation |
| T19 — consommation anormale | Créer une alerte de budget de facturation, fixer un seuil bas, la déclencher, relever la notification | 30 min | Notification de dépassement |
| T20 — sortie réseau restreinte | Depuis une charge de travail, tenter une connexion sortante vers une destination non autorisée, puis retrouver la ligne de refus dans l'entrepôt et recouper les horodatages | 30 min | Deux horodatages qui se recoupent |
| K19 — reconstruction chronométrée | Détruire puis reconstruire l'environnement de développement depuis le seul dépôt, en une exécution continue chronométrée, avec vérification applicative finale | 90 min | Horodatages de début et de fin, durée totale, service à nouveau disponible |

> **Prérequis à K19, à faire avant** : versionner le fichier de variables d'environnement de la
> recette. Il ne contient aucun secret (les mots de passe sont dans le coffre) mais porte des
> décisions de sécurité — chemins protégés par la limitation de débit, services ingérés dans la
> supervision, adresses d'administration exemptées du filtrage géographique. Sans lui, la
> reconstruction mesure une reconstruction incomplète et l'objectif O2 reste faux au sens strict.
> Coût : quinze minutes.

## 5.4 Le bilan attendu

| Résultat | Avant | Après remontée seule (état atteignable sans vague 1) | Après remontée + sprint |
|---|---|---|---|
| Conforme | 3 | **7** | 13 |
| Partiellement conforme | 5 | **9** | 6 |
| Non conforme | 0 | **1** (T1) | 1 |
| Planifié / non exécuté | 12 | **5** (T12, T15, T17, T19, T20) | 0 |

**Assumer le T1 non conforme.** Une campagne de vingt tests sans aucune non-conformité est
suspecte : elle suggère que les tests ont été choisis pour réussir. Un résultat non conforme,
nommé, expliqué techniquement — une forme brute de traversée de chemin traitée par redirection
plutôt que par refus, mécanisme non élucidé, hypothèse d'une normalisation d'URL en amont de
l'évaluation — et assorti d'un correctif identifié — activation des jeux de règles d'anomalie de
protocole et d'application de méthode, en observation puis en blocage — **est le signe d'une
campagne honnête**. C'est un atout, pas un défaut.

## 5.5 Formulation cible de la synthèse de campagne

> « La campagne établit sept résultats conformes, neuf partiellement conformes et une
> non-conformité ; cinq protocoles relèvent du plan de validation continue, dont le premier
> passage est daté. Les résultats partiels ne sont pas des demi-échecs : chacun correspond à un
> contrôle dont la propriété est établie par la configuration et par un contrôle d'exécution, et
> dont un aspect du protocole — le plus souvent la tentative négative depuis l'extérieur du
> périmètre — reste borné par le dispositif de mesure décrit en §6.8. La non-conformité de T1 est
> conservée et documentée : elle porte sur une forme brute de traversée de chemin traitée par
> redirection plutôt que par refus, et son correctif est identifié. Une campagne de vingt tests
> sans aucune non-conformité aurait indiqué que les tests ont été choisis après coup ; ceux-ci ont
> été dérivés de l'analyse de risque du chapitre 3, avant la conception de l'architecture. »

**Adapter les chiffres au bilan réellement obtenu**, jamais l'inverse.
