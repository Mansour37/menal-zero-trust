# CE QUI RESTE À FAIRE, ET RIEN D'AUTRE

> État au 26/08/2026. Le rapport est **complet, compilable et cohérent en l'état**. Il ne contient
> plus aucun marqueur `\acompleter{}`, aucun `\attente{}`, aucune valeur inventée et aucune case
> ouverte dans le texte.
>
> Cette liste ne recense donc pas des trous à boucher, mais **trois actions extérieures au
> rapport** : deux formalités administratives et un renforcement facultatif de la preuve.

---

## 1. Deux champs administratifs, à renseigner dès qu'ils sont connus

| Champ | Où | État actuel |
|---|---|---|
| Intitulé officiel de la filière ESPRIT | `latex/config/metadata.tex`, macro `\filiere` | Porte la valeur générique « Cycle ingénieur ». Un commentaire signale l'emplacement dans le source. Aucun intitulé n'a été inventé. |
| Date de soutenance | Page de garde et formulaire de dépôt | Aucune date factice n'est imprimée : un espace de saisie est prévu. |

Ces deux champs ne bloquent pas la compilation ni la relecture.

---

## 2. Les captures d'écran

Neuf emplacements sont posés dans le corps et deux en annexe H. **Ils s'affichent déjà** sous
forme de cadres réservés portant l'identifiant : le document est cohérent sans les images.

Pour intégrer une capture, il suffit de déposer le fichier `latex/figures/<IDENTIFIANT>.png` et
de recompiler. Aucune modification du LaTeX n'est nécessaire. Le détail des neuf captures, leur
commande de reproduction et leur consigne de masquage figurent dans `PLAN_CAPTURES.md`.

Les onze autres identifiants ne sont volontairement pas posés : ils correspondent à des tests que
le rapport déclare non exécutés. Les poser créerait une contradiction interne. Leur protocole de
preuve est décrit en annexe H, section 2.

---

## 3. Renforcement facultatif de la preuve expérimentale

Le rapport publie aujourd'hui **3 tests conformes, 5 partiellement conformes et 12 non exécutés**,
avec la raison de ces douze écrite noir sur blanc et leur protocole publié en annexe E. C'est une
position défendable devant un jury, et elle est assumée telle quelle.

Si l'auteur souhaite renforcer la campagne avant la soutenance, l'ordre de rendement est le
suivant :

| Priorité | Action | Ce que cela ferait gagner |
|---|---|---|
| 1 | Rejouer **T4, T6, T14, T17** | Quatre tests qui se ramènent à une seule commande chacune, et qui portent sur des contrôles déjà configurés |
| 2 | Rejouer **T10 et T8** | Débloque les captures K01 et K03, et transforme deux portes « configurées » en portes « éprouvées » |
| 3 | Compléter **T7 et T16** | Archiver l'inventaire des clés, rejouer le protocole de dérive corrigé |
| 4 | Chronométrer une **reconstruction complète** depuis le dépôt | Comble la seule mesure de résilience manquante (débloque K19) |
| 5 | Exporter la **facturation ventilée** par poste | Remplacerait l'ordre de grandeur reconstitué de §6.5.3 par une mesure |
| 6 | Exécuter le protocole d'évaluation **M0 / M1 / M2** de l'annexe F | Seule façon de conclure sur la valeur de l'enrichissement sémantique |

**Aucune de ces actions n'est requise pour déposer.** Chacune améliore la position sur une
question de jury identifiée, sans changer le fond du rapport.

---

## Règle à respecter si une valeur est ajoutée plus tard

Toute nouvelle valeur doit venir avec quatre éléments : sa **date**, son **environnement**, la
**commande ou requête exécutée**, et une **preuve conservée**. Sans ces quatre éléments, conserver
le statut « non mesuré » ou « non exécuté ». C'est la règle qui a permis, à l'audit, de retirer
trois chiffres non sourcés du rapport.
