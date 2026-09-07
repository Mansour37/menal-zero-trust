# RAPPORT_FINAL_CH5.md — vague finale, chapitre 5 « Réalisation et industrialisation »

**Périmètre d'écriture** : `latex/chapters/final/ch5_realisation.tex` **uniquement**.
**Nom de travail de compilation** : `buildX`. **Date** : 30/08/2026.
Aucun fichier supprimé. Aucun LaTeX écrit par heredoc, `sed`, `perl` ou `echo` :
tous les patchs sont des scripts Python en `io.open(..., encoding='utf-8', newline='\n')`,
chacun refusant de s'exécuter si sa chaîne cible est absente ou trouvée plusieurs fois.

---

## 0. Mesure d'entrée — compilée, non estimée

`buildX.pdf` du 30/08, `grep -c '^!' buildX.log` = **0**, **154 pages**.
Relevé sur `buildX.toc` : chapitre 5 = **p. 67 à 91**, soit **25 pages**. Cible : **17**.

Composition d'entrée mesurée (source) : 1 656 lignes, dont 734 de flottant et 773 de prose ;
**9 figures** et **6 tableaux**. Étalonnage retenu (`RAPPORT_REDONDANCES` §0) :
42 lignes de prose = 1 page ; pour un flottant, seule la hauteur composée compte.

*(Ce fichier est écrit au fur et à mesure ; les sections suivantes sont ajoutées à
chaque lot terminé et compilé.)*
