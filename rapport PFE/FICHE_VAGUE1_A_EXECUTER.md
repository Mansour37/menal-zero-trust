# FICHE D'EXÉCUTION — vague 1

**Objet.** Le mémoire est livrable en l'état : les six protocoles sans résultat y sont rattachés
à un **plan de validation continue daté**, jamais présentés comme un manque. Cette fiche existe
pour le jour où vous voudrez les exécuter — chacun se referme en moins d'une heure, et chacun
fait basculer une ligne du tableau de synthèse de « planifié » à « conforme ».

**Ordre recommandé** : T-0 d'abord (quinze minutes, et il conditionne K19), puis les protocoles
courts, puis la reconstruction chronométrée.

---

## T-0 — Versionner le fichier de variables d'environnement · 15 min

**Ce n'est pas un test, c'est un prérequis, et c'est la seule action de cette fiche qui change
la valeur de vérité d'un objectif du mémoire.**

Le fichier qui porte la configuration réelle de la recette est exclu du dépôt par une règle
d'ignorance générique sur son extension. Il ne contient **aucun secret** — les mots de passe
sont générés et stockés dans le coffre — mais il porte des décisions de sécurité : chemins
protégés par la limitation de débit, services ingérés dans la supervision, exclusions de règle
de détection, adresses d'administration exemptées du filtrage géographique.

Deux conséquences, tant qu'il n'est pas versionné :
1. une reconstruction depuis le seul dépôt **ne reproduit pas** l'environnement réel — c'est
   exactement ce que l'objectif O2 revendique ;
2. des décisions de sécurité ne sont ni revues, ni versionnées, ni traçables.

**Action** : restreindre la règle d'ignorance aux fichiers de variables réellement sensibles, et
versionner celui-ci. Relire une dernière fois son contenu avant de le pousser.

**Où le reporter** : §5.1 du chapitre 5, dans l'énumération des six exceptions au principe de
description en code (PR4). L'exception disparaît, le compte passe de six à cinq, et la phrase
« un principe dont on ne sait pas dire la frontière n'est pas appliqué, il est proclamé » gagne
encore.

---

## Les six protocoles

Pour chacun : ce qu'il faut faire, la durée, la preuve à conserver, et la section où reporter le
résultat. **Conservez la sortie brute à côté de chaque capture** : c'est ce qui permet à un tiers
de recouper.

### T17 — Protection de l'état d'infrastructure · 10 min · le plus rapide
Tenter la lecture de l'emplacement de l'état d'infrastructure sous une identité non autorisée.
**Critère** : refus d'autorisation horodaté, avec le droit manquant nommé dans le message.
**Preuve** : la sortie du refus, horodatée.
**Reporter** : tableau de synthèse du chapitre 6, ligne T17 ; et §5.1 du chapitre 5, sur la
sécurité de l'état.

### T15 — Charge sur l'enrichissement · 25 min
Injecter un lot de détections de test, déclencher la tâche d'enrichissement, relever sur **la
même exécution** : nombre traité, durée, et l'égalité entre le nombre d'entrées et le nombre de
sorties.
**Critère** : la tâche se termine sans perte, entrées = sorties.
**Preuve** : le journal d'exécution de la tâche.
**Reporter** : chapitre 6, évaluation de l'enrichissement sémantique.

### T20 — Sortie réseau restreinte · 30 min
Depuis une charge de travail, tenter une connexion sortante vers une destination non autorisée,
puis retrouver la ligne de refus dans l'entrepôt de supervision.
**Critère** : les deux horodatages se recoupent — celui de la tentative et celui du refus
journalisé.
**Preuve** : les deux horodatages, côte à côte.
**Reporter** : chapitre 6, tableau de synthèse ; et la couche réseau du chapitre 4, qui porte
aujourd'hui la réserve correspondante.
**Attention** : la topologie du chapitre 4 signale que le chemin de sortie du connecteur n'est
pas attesté par le code. Ce test est aussi ce qui trancherait cette question ouverte.

### T19 — Consommation anormale · 30 min
Créer une alerte de budget de facturation — **elle n'existe pas encore** — fixer un seuil bas,
la déclencher, relever la notification.
**Critère** : notification de dépassement reçue.
**Preuve** : la notification, horodatée.
**Reporter** : chapitre 6, section performance, résilience et coût.

### T12 — Interruption de collecte · 45 min, dont attente
Désactiver temporairement un export de journaux, attendre le déclenchement de la politique
d'alerte sur absence de données, relever l'heure de notification, **réactiver**.
**Critère** : la notification arrive, et l'écart entre l'interruption et le déclenchement est
mesuré.
**Preuve** : la notification, et les deux horodatages.
**Reporter** : chapitre 6, tableau de synthèse ; la mesure du délai enrichit aussi la section
sur l'observabilité d'exploitation.

### T14 — Sortie du service d'encodage · dépend d'un prérequis
Ce protocole établirait que la sortie réseau du service d'encodage est restreinte. **Son
prérequis n'est pas rempli** : il faut d'abord poser une règle de refus de sortie par défaut,
qui n'existe pas aujourd'hui — la sortie est autorisée par défaut et régie par le paramètre de
la plateforme d'exécution, non par le réseau. Tant que cette règle n'est pas posée, exécuter T14
mesurerait l'absence de contrôle, pas le contrôle.
**Ne l'exécutez pas sans avoir d'abord posé la règle**, sans quoi le résultat serait une
non-conformité sans enseignement.

---

## K19 — Reconstruction chronométrée · 90 min, dont attente

**C'est le meilleur rapport effort/impact de tout le projet : quatre-vingt-dix minutes pour un
objectif complet.** L'objectif O2 passe de « capacité acquise, mesure planifiée » à « acquise et
mesurée ».

**À faire seulement après T-0.** Sans le fichier de variables versionné, vous mesureriez une
reconstruction incomplète, et le résultat serait faux au sens strict.

**Sur l'environnement de développement, jamais sur la recette.**

Détruire puis reconstruire l'environnement **depuis le seul dépôt**, en une exécution continue
chronométrée, avec une vérification applicative finale — le service répond correctement à une
requête réelle.

**Relever** : horodatage de début, horodatage de fin, durée totale, et la réponse applicative
qui prouve que le service est à nouveau disponible.
**Reporter** : chapitre 6, section performance et résilience, à l'endroit où l'objectif O2 est
confronté à sa mesure ; et la réponse aux objectifs, en fin de chapitre.

---

## Après exécution — les trois choses à ne pas rater

1. **Reporter le résultat, et sa date.** Tout chiffre décrivant un système vivant porte sa date
   de relevé dans ce mémoire : c'est une règle tenue partout, ne l'entamez pas.
2. **Mettre à jour le bilan de campagne** au chapitre 6, **et** la conclusion générale, qui le
   reprend. Les deux comptes doivent rester identiques — c'est le genre d'écart qu'un jury
   trouve en comparant deux pages.
3. **Ne pas retirer la non-conformité T1.** Une campagne de vingt tests sans aucune
   non-conformité indiquerait que les tests ont été choisis pour réussir. Celle-ci en garde une,
   nommée, expliquée et assortie de son correctif : c'est un atout.

## Si vous produisez des captures

Trois règles, reprises de la note de méthode de l'annexe E :
- **masquer par rectangle noir opaque, jamais par floutage** — un flou reste réversible, et le
  contrôle final se fait à fort grossissement dans le PDF ;
- **l'horodatage figure dans le cadre capturé**, pas seulement en légende ;
- **conserver la sortie brute** à côté de chaque capture.

Et la règle qui prime sur les trois : **aucun cadre vide ne subsiste dans le document final.**
Si une capture n'est pas produite, la figure entière est retirée et le texte se tient sans elle.
C'est l'état actuel du mémoire — ne le défaites pas en réservant des emplacements.
