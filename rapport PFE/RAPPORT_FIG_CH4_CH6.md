# RAPPORT_FIG_CH4_CH6 — application de la convention graphique aux chapitres 4 à 6

**Équipe** : figures, chapitres 4–6 + conclusion générale. **Date** : 29/08/2026.
**Périmètre en écriture** : `latex/chapters/final/ch4_conception.tex`,
`ch5_realisation.tex`, `ch6_validation.tex`, `conclusion_generale.tex`. Aucun autre fichier du
mémoire n'a été ouvert en écriture. Aucun fichier supprimé.

**Contrat** : `RAPPORT_FIGURES.md` (§2.9 à §2.30, §3.6, §3.9, §1.4, §4.3, §5.3),
`BRIEF_VAGUE_FINALE.md` §0 et §2, `RAPPORT_EXEC_CH3_CH4.md` constat F-4.

**Convention employée** : `latex/config/convention_graphique.tex`, déjà chargée par
`config/commands.tex`. Aucun style nouveau n'a été créé, aucune redéfinition de `\gcprod`.

---

## 0. État de départ, mesuré

Compilation de référence, chaîne `xelatex → biber → xelatex → xelatex`, `-jobname=buildF` :

```
erreurs (^!) = 0
Output written on buildF.pdf (155 pages)   [141 pages numérotées en chiffres arabes + 14 liminaires]
```

L'offset entre la page imprimée et la page du PDF est de **+14** : la page imprimée *n* est la
page *n+14* du PDF. Toutes les extractions PNG de ce rapport en tiennent compte.

Corpus de mon périmètre : **22 figures** (13 en ch. 4, 8 en ch. 5, 2 en ch. 6 — `fig:gantt` est
en ch. 5, `graph:coldstart` et `fig:scenario-19-08` en ch. 6). Aucune figure dans
`conclusion_generale.tex` (vérifié : `grep -c tikzpicture` = 0).

---

## 1. Décisions transverses prises avant la première retouche

**D-a — Les noms de produits restent en `\gcprod`.** `RAPPORT_FIGURES.md` reproche 
aux figures leurs `\scriptsize` « sous le plancher », et cite les noms de produits. Or la
convention, postérieure au rapport, tranche explicitement ce point : `\gcprod` est
`\scriptsize` + `menaltrait` et sa docstring dit « nom de produit ou compteur cité dans un nœud,
**sans valeur démonstrative** ». J'applique la convention : tout nom de produit passe en
`\gcprod`, tout libellé **porteur** passe en `\footnotesize` encre pleine. Le cas litigieux
tranché dans l'autre sens : les compteurs de points d'entrée de `fig:composants-logiciel`
(9 + 4 = 13) **portent la démonstration** — ils sortent de `\gcprod` et passent en encre pleine.

**D-b — Le pointillé ne signifie plus qu'une chose : une décision de politique.** Partout où le
pointillé signifiait autre chose (journal, meilleur effort, lien indirect, rétroaction, lien
logique), il devient soit `fluxevenement` (tirets) s'il transporte un fait, soit `lienstructure`
(trait fin sans pointe) s'il ne transporte rien.

**D-c — Le tiret ne signifie plus qu'une chose : un flux asynchrone / un événement.** Les tirets
qui signifiaient un refus (`ko`, `ref`, `fstop`) passent en `fluxrefuse` + `croixrefus`.

**D-d — Un refus se dessine partout où le mémoire le démontre.** Liste arrêtée : refus du
périmètre (`fig:seq-refus`), refus d'usurpation MFA (`fig:seq-mfa`), interdictions
structurantes d'identité (`fig:plan-identite`), refus croisé entre locataires du 24/08/2026
(`fig:topologie-cible`), chemin non attesté (`fig:topologie-reseau`), arc absent de jointure
(`fig:cycle-donnee`, `fig:modele-donnees`), porte bloquante qui arrête la livraison
(`fig:sequence-livraison`).

*(Suite du rapport écrite au fur et à mesure de l'exécution.)*
