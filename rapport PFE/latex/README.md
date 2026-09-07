# Rapport PFE MENAL — projet LaTeX

Squelette complet du rapport, structuré selon `00_SOMMAIRE_PFE_MENAL.md` (dossier parent).
Tout ce qui pouvait être rédigé dès maintenant à partir des documents projet réels (HLD,
LLD, méthodologie) l'a été ; tout ce qui dépend d'un document non encore fourni est marqué
par un encadré rouge **« En attente de document source »** dans le PDF compilé — ne rien
combler par extrapolation avant d'avoir la source.

## Compilation

Le rapport utilise **Times New Roman** via `fontspec` : la compilation doit se faire en
**XeLaTeX** (pas `pdflatex`), avec **Biber** pour la bibliographie.

```bash
xelatex main.tex
biber main
xelatex main.tex
xelatex main.tex
```

Avec `latexmk` (une fois installé, simplifie la séquence ci-dessus) :

```bash
latexmk -xelatex -shell-escape main.tex
```

Si `Times New Roman` n'est pas trouvée par XeLaTeX (police système absente), remplacer
temporairement la ligne `\setmainfont{Times New Roman}` dans `config/formatting.tex` par
`\setmainfont{Liberation Serif}` (clone métrique libre, mise en page identique).

## Structure

```
latex/
├── main.tex                # assemblage — point d'entrée de compilation
├── config/                 # paquets, mise en forme, commandes, métadonnées
├── frontmatter/             # page de garde, dédicace, remerciements, résumés, abréviations
├── chapters/
│   ├── drafts/              # chapitres en cours d'itération (état actuel : tous ici)
│   └── validated/           # chapitres relus et validés (workflow détaillé dans validated/README.md)
├── figures/                 # schémas et captures (vide — voir figures/README.md)
├── appendices/               # annexes A à H
└── bibliography/references.bib
```

## Conventions utilisées dans les fichiers `.tex`

| Encadré | Signification |
|---|---|
| `attentedoc` (rouge) | Contenu qui dépend d'un document projet pas encore fourni — ne pas remplir par extrapolation |
| `\todo{...}` (texte rouge) | Contenu ponctuel manquant (chiffre, nom, référence, paragraphe court) |
| `keybox` (bleu) | Principe clé / point à retenir |
| `alertbox` (orange) | Point de vigilance |
| `extraitconf` (encadré gris, police monospace) | Extrait court de configuration — jamais un fichier complet, conformément à la règle du guide pédagogique |

## Ce qui bloque encore certaines sections

Voir `00_SOMMAIRE_PFE_MENAL.md` §5 (dossier parent) pour la liste complète des documents
encore nécessaires. En résumé, les sections marquées `attentedoc` dépendent de :

- `06_ECARTS_IMPLEMENTATION.md` — chapitre 5 (écarts), et relecture du chapitre 4
- `09_AUDIT_E2E_STAGING_2026-08-07.md` (intégral) — chapitre 5 (résultats, mesures)
- `03_CAS_UTILISATION.md` — annexe A
- `08_RUNBOOK.md` — annexe G
- Captures d'écran réelles — annexes B et F
- Informations personnelles (nom, encadrants, dates) — page de garde, dédicace, remerciements

## Point d'attention non résolu

Le guide pédagogique demande une pagination bas-droite « sous la forme `/` » — le texte
source (extraction PDF) est tronqué à cet endroit. `config/formatting.tex` implémente
l'hypothèse « page courante / nombre total de pages » (ex. `12/107`). À confirmer avec
l'encadrant académique ; si le format attendu est différent, une seule ligne à changer dans
`config/formatting.tex` (`\fancyfoot[R]{...}`, deux occurrences).
