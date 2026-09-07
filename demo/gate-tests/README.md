# Kit de test des portes — prouver que CHAQUE porte arrête la chaîne

Ce kit démontre que **chaque porte** de la chaîne de livraison
([`app-delivery.yml`](../../.github/workflows/app-delivery.yml)) **arrête réellement** le pipeline
face à une vraie faille — et qu'une porte rouge **éteint tout l'aval**, donc qu'aucune image ne peut
être publiée ni déployée.

## Principe
Pour une porte donnée, `run-gate-test.sh` :
1. crée une **branche jetable** depuis `main` ;
2. y injecte **une vraie faille** ciblant cette porte (et elle seule) ;
3. ouvre une **PR** → la chaîne s'exécute et **la porte visée passe au rouge** ;
4. **tous les maillons suivants passent en `skipped`** — publication et déploiement inclus.

Puis on nettoie (PR fermée + branche supprimée). Les runs, eux, restent consultables : ce sont les
pièces à conviction.

> Le kit est **inerte** : les failles sont des *gabarits* (`poison/*.tmpl`) ou générées à la volée
> (le secret). Committer ce dossier ne déclenche aucune porte.

## Les 5 portes et leur faille

| Porte (job) | Outil | Faille injectée | Constat attendu |
|---|---|---|---|
| **2 · Recherche de secrets (Gitleaks)** | Gitleaks | clé haute entropie générée dans `api/app/_leaked_config.py` | `generic-api-key`, fichier + ligne pointés |
| **3 · Analyse du code (Semgrep)** | Semgrep `p/default` | `eval()` + `subprocess(shell=True)` dans `api/app/_gate_sast.py` | 2 findings bloquants (`eval-detected`, `subprocess-shell-true`) |
| **4 · Tests automatisés — API (pytest)** | pytest | `assert 1 == 2` dans `api/tests/test_gate_block.py` | échec du test |
| **4 · Tests automatisés — dashboard (jest)** | jest | `expect(1).toBe(2)` dans `dashboard/src/__tests__/gateBlock.test.ts` | échec du test |
| **6 · Analyse de l'image (Trivy) (api)** | Trivy | `PyYAML==5.3.1` ajouté à `api/requirements.txt` | `Total: 1 (CRITICAL: 1)` → CVE-2020-14343, corrigée en 5.4 |

## Utilisation
```bash
# Lancer un test (ouvre une PR jetable) :
bash demo/gate-tests/run-gate-test.sh secret      # (ou sast | pytest | jest | trivy)

# Suivre le run, puis nettoyer (la branche exacte est affichée par le script) :
bash demo/gate-tests/run-gate-test.sh clean gate-test/secret-XXXXXXXXXX
```

Ordre de grandeur : les portes 2 et 3 rendent leur verdict en **moins d'une minute** (elles sont en
tête de chaîne, c'est fait exprès) ; la porte 6 demande ~4 min, le temps de traverser les étapes
2 à 5.

## Runs de blocage capturés (référence démo — 07/09/2026)

Testés contre la chaîne actuelle (8 étapes, chaînage séquentiel) :

| Porte | Run rouge | Aval |
|---|---|---|
| 2 · Secrets (Gitleaks) | [34165824113](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165824113) | 3 → 8 `skipped` |
| 3 · Code (Semgrep) | [34165832135](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165832135) | 4 → 8 `skipped` |
| 4 · Tests API (pytest) | [34165841139](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165841139) | 5 → 8 `skipped` |
| 4 · Tests dashboard (jest) | [34165850179](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165850179) | 5 → 8 `skipped` |
| 6 · Image (Trivy) | [34165859372](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165859372) | 7 → 8 `skipped` |

Runs de référence « tout passe » : [34165113605](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165113605)
(Phase 1, PR — 7 et 8 ignorés) et [34165407841](https://github.com/Mansour37/menal-zero-trust/actions/runs/34165407841)
(Phase 2, `main` — déploiement par empreinte).

> **Ce que ces tests ont fait remonter.** Le test SAST a révélé que la porte Semgrep était
> **silencieusement cassée** : l'action dépréciée plantait sur les règles récentes *en passant au
> vert*. Elle a été réparée (CLI à jour, diff-aware). Le test a aussi montré qu'un libellé annonçait
> « 612 règles » alors que `p/default` en charge **1074** — le nombre a été retiré du libellé.
> Le scénario complet et l'argumentaire de soutenance sont dans
> [`GUIDE_DEMO_DEVSECOPS.md`](../../GUIDE_DEMO_DEVSECOPS.md).
