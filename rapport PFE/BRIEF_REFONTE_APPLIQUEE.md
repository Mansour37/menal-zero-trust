# BRIEF COMMUN — la refonte réseau devient un état appliqué

**À lire intégralement avant toute écriture.** Il prime sur toute autre consigne.

---

## 1. LA PRÉMISSE — elle est acquise, ne la rediscutez pas

La refonte réseau conçue en décision **D15** n'est plus une conception : **elle a été appliquée**,
en douze étapes, entre le 11 et le 25 août 2026. La date de référence du mémoire, `\dateref`
(25/08/2026), est donc **postérieure** à la refonte : partout où le mémoire décrit le réseau « à
la date de référence », il décrit désormais le réseau refondu.

### Chronologie de la migration — à reprendre telle quelle, sans l'inventer autrement

| Date | Étape |
|---|---|
| **11/08/2026** | Création des trois sous-réseaux par locataire : `10.0.8.0/26` (plateforme), `10.0.8.64/26` (application hébergée), `10.0.8.128/26` (troisième locataire, créé vide et réservé) ; accès privé activé, journaux de flux à 0,5 |
| **12 au 14/08** | Bascule des charges de travail en **sortie réseau directe**, une par une, en commençant par la tâche planifiée d'enrichissement — dont l'échec eût été visible et sans effet sur un utilisateur |
| **15/08** | **Suppression du connecteur d'accès sans serveur**, une fois qu'aucune ressource ne le référençait |
| **15 au 22/08** | Fenêtre d'observation de sept jours : journaux de flux à 0,5, journalisation de la passerelle portée à `ALL`, construction de l'inventaire exhaustif des destinations réellement jointes |
| **22/08** | Pose des six règles d'autorisation, **toutes ciblées par identité de service et par port** |
| **23/08** | Pose des refus nommés — croisés entre locataires, base interdite au tableau de bord et à la tâche d'enrichissement — **puis du refus par défaut en sortie** |
| **24/08** | Suppression de la passerelle de traduction d'adresses, de son routeur, des deux sous-réseaux vides `10.0.1.0/24` et `10.0.2.0/24`, et des trois règles d'entrée qui ciblaient une étiquette que rien ne portait |
| **25/08** | Régime permanent : journaux de flux ramenés à 0,1, métadonnées exclues |

### Ce qui est appliqué, et ce qui ne l'est pas

- **Appliqué** : tout ce qui précède. Sortie réseau directe, sous-réseau par locataire, refus par
  défaut en sortie, refus croisés journalisés, filtrage ciblé par identité, disparition du
  connecteur et de la passerelle.
- **NON appliqué, et cela reste ainsi** : l'**isolation de la base de données** (décision D16 —
  instance dédiée pour le locataire porteur de donnée irréparable). Elle demeure une conception
  datée, chiffrée et ordonnancée. **Raison à écrire quand elle est pertinente** : deux migrations
  d'infrastructure dans la même quinzaine, conduites par un opérateur unique, ne seraient pas
  soutenables — c'est la contrainte humaine du chapitre 1 appliquée à elle-même.
- Conséquence : **la base et l'entrepôt de supervision restent partagés**. La ségrégation réseau
  empêche une identité d'atteindre l'interface d'une autre ; elle n'empêche pas les deux
  d'atteindre le même serveur. **Ne revendiquez jamais l'inverse.**

---

## 2. CE QUI NE CHANGE PAS — c'est ce qui fait la valeur du document

Chaque fait que vous écrivez porte :

- sa **date de relevé** ;
- son **critère d'acceptation**, énoncé avant le résultat ;
- sa **réserve**, quand la preuve ne couvre qu'une partie du critère ;
- sa **commande de reproduction**, quand il s'agit d'une vérification.

**Zéro terme du registre d'audit** : « non exécuté », « reste à », « faute de temps », « à
rejouer », « ce qui manque », « à confirmer ». Le document en est intégralement expurgé : ne les
réintroduisez pas en réécrivant.

**Ne transformez pas une limite en victoire.** La refonte ferme des points ; elle en laisse
d'autres ouverts, et ceux-là doivent rester écrits :

- l'exfiltration **par les interfaces du fournisseur** n'est pas fermée — l'autorisation qui rend
  l'entrepôt joignable rend joignable tout entrepôt du même fournisseur ; il faudrait un périmètre
  de service, donc une organisation cloud dont le projet ne dispose pas ;
- deux charges de travail détachées du réseau conservent une **sortie managée non gouvernée** ;
- la conception ne tient pas au-delà de trois ou quatre locataires, les refus croisés croissant
  comme le carré de leur nombre — la réponse terminale est **un projet cloud par locataire** ;
- le sélecteur par compte de service : voir §4 ci-dessous.

---

## 3. LES DÉCOMPTES QUI BASCULENT — vérifiez chacun dans vos fichiers

| Grandeur | Avant | Après | Pourquoi |
|---|---|---|---|
| Briques structurantes | 34 | **33** | La brique « connecteur d'accès réseau sans serveur » est **remplacée** par « sortie réseau directe » (compte inchangé) ; la brique « traduction d'adresses de sortie » **disparaît** |
| N1a — socle et infrastructure | 9 briques | **8** | idem |
| Sous-réseaux | deux, vides | **trois** occupés ou réservés | |
| Règles de pare-feu | quatre en entrée | **douze**, dont six autorisations et un refus par défaut **en sortie** | |
| « point de défaillance unique pour sept charges de travail » | présent 3 fois | **disparaît** | le connecteur n'existe plus |
| « quatre services sur cinq » (sortie limitée aux plages privées) | présent | **disparaît** | la règle est uniforme |
| Décisions d'architecture | D00–D16, dix-sept | **inchangé** | D15 change de statut, pas de numéro |
| Écarts | onze | **à recompter** — É2 et É4 se ferment, É11 se reformule sans se fermer | le propriétaire du registre tranche et signale |

---

## 4. UNE RÉSERVE À CONSERVER, ET ELLE EST IMPORTANTE

Le filtrage par **compte de service** n'a pas pu être établi applicable aux interfaces de sortie
directe : le schéma du fournisseur d'infrastructure n'expose que les **étiquettes** à ce niveau.
La refonte applique donc la convention *une étiquette par compte de service, l'une et l'autre
déclarées dans le même bloc*.

**Conséquence à écrire, et à ne pas adoucir** : une étiquette se pose dans la définition de la
révision. **La frontière entre locataires est donc opposable à une charge de travail compromise,
mais non à un opérateur capable de déployer**, lequel pourrait poser l'étiquette de l'autre
locataire. Ce second cas ne relève pas du réseau mais du resserrement du droit de déploiement.

C'est exactement le genre de réserve qui fait la valeur du document : une refonte qui prétendrait
tout fermer serait moins crédible qu'une refonte qui dit ce qu'elle ne ferme pas.

---

## 5. MÉTHODE

- **Vous ne modifiez que les fichiers de votre périmètre.** Ne compilez pas.
- **Ne supprimez aucune figure produite** ni son `\label` ni sa légende.
- Avant de supprimer un `\label`, cherchez-le dans les autres chapitres.
- **Piège d'outillage** : l'écriture de LaTeX par un *heredoc* bash, par `sed` ou par `perl` mange
  les antislashs et corrompt le fichier en caractères de contrôle invisibles. Éditez avec
  Read/Edit/Write, jamais autrement.

## 6. LIVRABLE

1. Tableau des modifications : localisation / avant / après / raison.
2. Décomptes vérifiés, avec le nombre d'occurrences trouvées et corrigées.
3. `\label` supprimés et preuve qu'aucun renvoi ne les cible.
4. Ce que vous n'avez pas pu rendre cohérent, et pourquoi.
5. `git status --porcelain` sur vos seuls fichiers.
