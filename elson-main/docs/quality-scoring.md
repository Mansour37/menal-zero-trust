# Scoring par qualité (malus) — Spécification

> **Statut** : implémenté, **inactif par défaut**. S'active uniquement quand
> l'horodatage de bascule (`quality_scoring_cutoff`) est posé. **Non rétroactif.**

## Objectif

Récompenser la **qualité** des traductions, pas seulement la quantité. Une
traduction excellente rapporte plus qu'une traduction moyenne, et une traduction
incorrecte ne rapporte (presque) rien. Un contributeur avec **moins** de
traductions mais **meilleures** peut **dépasser** un contributeur prolifique mais
médiocre.

Le score de qualité est **caché** : on n'affiche ni le score ni la pénalité.
Personne n'est humilié publiquement.

## Le calcul

Chaque traduction vaut **jusqu'à 15 points** :

```
15 pts = 7,5 (texte) + 7,5 (audio)
```

La **note médiane** des évaluateurs (1 à 5) détermine la part gardée de chaque
moitié :

```
part gardée = 7,5 × (médiane − 1) / 4
```

| Médiane | Part gardée (sur 7,5) |
|--------:|----------------------:|
| 5/5     | 7,5  (100 %)          |
| 4/5     | 5,625 (75 %)          |
| 3/5     | 3,75  (50 %)          |
| 2/5     | 1,875 (25 %)          |
| 1/5     | 0     (0 %)           |

**Score d'une traduction** = part texte + part audio, borné entre **0 et 15**.

## Pourquoi la MÉDIANE et pas la moyenne ?

Contrainte : **une seule personne ne doit jamais pouvoir faire perdre des points.**
La médiane est robuste à un évaluateur isolé (malveillant ou maladroit) :

| Notes texte | Moyenne | Médiane | Garde (médiane) |
|-------------|--------:|--------:|----------------:|
| [5, 5, 1]   | 3,67    | **5**   | 7,5 — le 1 isolé est ignoré ✅ |
| [5, 4, 1]   | 3,33    | **4**   | 5,625 |
| [1, 1, 5]   | 2,33    | **1**   | 0 — la **majorité** tranche ✅ |
| [3, 3, 3]   | 3,00    | **3**   | 3,75 |

Avec la moyenne, le [5,5,1] ferait perdre 2,5 pts à cause d'**une** personne.
Avec la médiane, il faut que la **majorité** soit d'accord.

## Règles

1. **Minimum 3 évaluateurs distincts** (post-bascule) avant de calculer le moindre
   point. Jamais sur 1 ou 2 personnes.
2. **Médiane** des notes (texte et audio séparément), robuste à un outlier.
3. Le `validator_trust` existant reste en place côté approbation (un spammeur connu
   pèse moins dans la décision d'approbation).
4. Le score se **fige à 5 évaluateurs** (`quality_locked = true`) → stable ensuite.
5. **Audio absent** → la moitié audio = 0 (la traduction plafonne à 7,5).
   *Décision modifiable : voir `update_quality_after_validation()` pour rescaler le
   texte sur 15 si on préfère ne pas pénaliser le texte seul.*

## NON RÉTROACTIF — la contrainte centrale

Le malus **ne s'applique qu'aux évaluations faites APRÈS la bascule.**

- On pose `competition_config.quality_scoring_cutoff` = l'instant de réouverture
  de l'évaluation (format ISO `timestamptz`). Vide = système **inactif**.
- Le trigger **ignore** toute validation dont `created_at < cutoff`.
- Une traduction n'obtient un score qualité que lorsqu'elle reçoit **≥ 3
  évaluations post-bascule**.
- Les **4 414 évaluations déjà faites** ne déclenchent aucun malus. Elles
  continuent juste à servir l'approbation classique (ancien barème +10 inchangé).

## Stockage

| Table.colonne | Rôle |
|---|---|
| `competition_config.quality_scoring_cutoff` | Horodatage de bascule (vide = off) |
| `contributions.quality_points` (0–15) | Score qualité **caché** de la traduction |
| `contributions.quality_eval_count` | Nb d'évaluateurs post-bascule comptés |
| `contributions.quality_locked` | Figé à 5 évaluateurs |
| `profiles.quality_points` | Somme cachée par utilisateur (classement réel) |
| vue `quality_leaderboard` | Classement qualité (admin) |

Les **points affichés** (`profiles.points`) et le classement public **ne changent
pas** : le score qualité vit en parallèle, caché. Le basculement du classement
officiel des gagnants vers `quality_points` est une étape séparée, réversible, à
décider plus tard.

## Flux à la réouverture

1. On rouvre **seulement l'évaluation** (la contribution reste fermée).
2. Chaque évaluateur gagne **+3 pts** (inchangé) → récompense d'évaluer.
3. La file sert chaque traduction jusqu'à **5 évaluations post-bascule** (au lieu
   de 5 évaluations totales), pour que les anciennes traductions reçoivent assez de
   **nouvelles** évaluations.
4. Dès 3 évaluations post-bascule → score qualité calculé (médiane), figé à 5.
5. Score caché → le classement réel reflète la qualité, sans humilier personne.

## Autre changement livré avec

- **Cap de 200 validations / 24 h SUPPRIMÉ** dans `/api/validate/next`
  (`validation illimitée`, décision utilisateur). Les protections par action
  (anti-auto-validation, anti-scraping, 1 avis/validateur) restent.
