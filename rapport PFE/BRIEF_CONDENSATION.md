# BRIEF DE CONDENSATION — vague 3

**Décision de l'auteur, prise le 29/08/2026 sur mesure réelle** : le mémoire est ramené à
**116 pages au total**, format déjà validé par sa checklist ESPRIT. La refonte a produit un
excellent contenu, mais elle a porté le document à 179 pages — soit 4,5 fois la norme
« environ 40 pages hors annexes ». **Aucune qualité de contenu ne compense un format
irrecevable.**

Ta tâche est une **condensation**, pas une amputation. La différence est tout le sujet de ce
brief.

---

## 1. CE QUI NE PEUT PAS ÊTRE SUPPRIMÉ

Ces pièces sont ce qui distingue le mémoire d'un rapport de stage. Tu peux les **resserrer**,
jamais les retirer :

- la matrice de traçabilité menace → exigence → contrôle → test (ch. 3) ;
- le registre des décisions d'architecture D00–D14 ;
- le registre des écarts É1–É11 ;
- les quatre incidents d'ingénierie (ch. 5) ;
- la section « ce que le système ne détecte pas » (ch. 6) ;
- la section « ce que le filtrage applicatif ne protège pas » (ch. 6) ;
- la frontière de responsabilité hébergeur / éditeur (ch. 5) ;
- le bilan de campagne et la non-conformité assumée T1 (ch. 6) ;
- les vingt exigences EX1–EX20 dans leur formulation complète (ch. 3) ;
- toute valeur mesurée et datée.

**Aucune figure produite ne doit être supprimée ni déplacée.** Elles ont été compilées et
vérifiées visuellement. Ne touche pas aux environnements `figure` ni à leur contenu TikZ.

---

## 2. LES SEPT TECHNIQUES DE CONDENSATION, PAR ORDRE DE PRÉFÉRENCE

Applique-les dans cet ordre. Les premières sont sans perte ; les dernières coûtent quelque chose.

1. **Supprimer la redondance inter-chapitres.** Le même fait est souvent énoncé au ch. 4 (comme
   conception) et au ch. 5 (comme réalisation), parfois au ch. 6 (comme mesure). Garde-le une
   fois, à l'endroit où il porte le plus, et remplace les deux autres par un renvoi `\cref`.
   **C'est de loin le meilleur gisement : cherche-le en premier.**
2. **Supprimer le paragraphe qui reformule le tableau qui le précède.** Un tableau bien fait n'a
   pas besoin d'être récité. Garde la phrase qui dit ce qu'il faut y lire ; supprime celle qui
   en reprend les lignes.
3. **Ramener une comparaison à trois colonnes.** Un tableau à cinq colonnes larges coûte deux
   fois la place d'un tableau à trois. Garde « objet / critère décisif / prix payé » dans le
   corps et bascule la colonne « alternatives évaluées » en une phrase introductive qui les
   nomme. L'argument survit, la place est divisée par deux.
4. **Fusionner deux sous-sections voisines** dont l'une fait moins d'un tiers de page.
5. **Ramener le chapeau de chapitre à 4 lignes et la conclusion de chapitre à 8.**
6. **Convertir une énumération en prose dense** quand elle compte moins de quatre éléments —
   une liste à puces de trois items coûte plus qu'une phrase.
7. **Ne garder qu'un exemple** là où il y en a deux qui font la même démonstration.

## 3. CE QUI EST INTERDIT

- **Rendre une affirmation plus vague pour gagner de la place.** La précision technique est le
  premier critère de qualité. Une phrase raccourcie qui perd sa date, son chiffre ou sa réserve
  est une régression, pas une condensation.
- **Réintroduire un terme du registre d'audit** — « non exécuté », « reste à », « faute de
  temps », « à rejouer », « ce qui manque ». Le mémoire en est totalement expurgé : ne l'y
  ramène pas en réécrivant.
- **Casser un renvoi.** Si tu supprimes un `\label`, vérifie qu'aucun `\cref` ou `\ref` ne le
  cible. Si tu supprimes un tableau appelé dans le texte, supprime aussi son appel.
- **Déplacer du contenu vers les annexes.** Les annexes sont elles-mêmes en réduction : elles
  n'ont pas de place. Tout ce qui sort du corps est supprimé, pas déplacé.
- **Toucher un fichier hors de ton périmètre.**

## 4. MÉTHODE

1. **Mesure d'abord.** Le rapport compile ; ta cible est exprimée en pages réelles. Repère les
   deux ou trois sections les plus longues de ton chapitre : c'est là qu'est ton gisement, pas
   dans un rabotage uniforme.
2. **Cherche la redondance avant de couper quoi que ce soit.** Lis les chapitres voisins en
   lecture seule pour la repérer. Une demi-journée de jury se perd sur un mémoire qui répète.
3. **Coupe par blocs, pas par phrases.** Supprimer une sous-section entière redondante vaut
   mieux que raboter vingt paragraphes, qui deviennent alors tous secs.
4. Ne compile pas — l'équipe qualité compile et remesure.

## 5. PIÈGE D'OUTILLAGE

**L'écriture de LaTeX par un *heredoc* bash mange les antislashs, même en heredoc quoté.**
`\begin` y devient un caractère de contrôle invisible. **Édite avec les outils Read/Edit/Write,
jamais par `cat <<EOF` ni par `sed`/`perl` avec des antislashs dans les arguments.**

## 6. LIVRABLE

1. **Tableau des coupes** : ce qui a été supprimé / où / pourquoi c'était supprimable / gain
   estimé en lignes source.
2. **Estimation du volume atteint**, et si tu n'as pas atteint la cible, **la liste ordonnée de
   ce qu'il faudrait couper ensuite**, avec le coût de chaque coupe. C'est une information
   utile : ne force pas une coupe que tu juges destructrice, signale-la.
3. **Renvois vérifiés** : liste des `\label` supprimés et preuve qu'aucun `\cref` ne les cible.
4. `git status --porcelain` sur tes seuls fichiers.
