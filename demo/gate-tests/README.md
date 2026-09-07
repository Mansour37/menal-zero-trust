# Kit de test des portes — prouver que CHAQUE porte bloque

Ce kit démontre que **chaque porte** de la chaîne de livraison (`app-delivery.yml`)
**arrête réellement** le pipeline face à une vraie faille — donc qu'**aucun déploiement**
n'est possible tant qu'une porte est rouge.

## Principe
Pour une porte donnée, `run-gate-test.sh` :
1. crée une **branche jetable** depuis `main` ;
2. y injecte **une vraie faille** ciblant cette porte ;
3. ouvre une **PR** → la chaîne s'exécute et **la porte visée passe au rouge** ;
4. `Build & Deploy` ne se produit jamais.
Puis on **nettoie** (PR fermée + branche supprimée).

> Le kit lui-même est **inerte** : les failles sont des *templates* (`poison/*.tmpl`)
> ou générées à la volée (le secret), donc committer ce dossier ne déclenche aucune porte.

## Les 5 portes et leur faille

| Porte | Outil | Faille injectée | Job qui devient ROUGE |
|---|---|---|---|
| **Secrets** | Gitleaks | une clé secrète haute entropie (générée) dans `api/app/_leaked_config.py` | Security Scans → *Gitleaks - Secret Scanning* |
| **SAST** | Semgrep `p/default` | `eval()` + `subprocess(shell=True)` sur entrée utilisateur (`api/app/_gate_sast.py`) | Security Scans → *Semgrep - SAST* |
| **Tests API** | pytest | un test `assert 1 == 2` (`api/tests/test_gate_block.py`) | Unit Tests → *Run API unit tests* |
| **Tests dashboard** | jest | un test `expect(1).toBe(2)` (`dashboard/src/__tests__/gateBlock.test.ts`) | Dashboard Unit Tests → *Run dashboard unit tests* |
| **CVE image** | Trivy | `PyYAML==5.3.1` — CVE-2020-14343 (CRITICAL, corrigée en 5.4) | Build & Deploy API → *Trivy - CVE Scan (bloquant sur CRITICAL)* |

## Utilisation
```bash
# Lancer un test (ouvre une PR jetable) :
bash demo/gate-tests/run-gate-test.sh secret      # (ou sast | pytest | jest | trivy)

# Suivre le run, puis nettoyer :
bash demo/gate-tests/run-gate-test.sh clean gate-test/secret-XXduring   # (l'URL/branche est affichée)
```

## Runs de blocage capturés (référence démo, 07/09)

| Porte | Run rouge |
|---|---|
| Secrets (Gitleaks) | https://github.com/Mansour37/menal-zero-trust/actions/runs/34156975237 |
| SAST (Semgrep) | https://github.com/Mansour37/menal-zero-trust/actions/runs/34157964162 |
| Tests API (pytest) | https://github.com/Mansour37/menal-zero-trust/actions/runs/34156988890 |
| Tests dashboard (jest) | https://github.com/Mansour37/menal-zero-trust/actions/runs/34157004008 |
| CVE image (Trivy) | https://github.com/Mansour37/menal-zero-trust/actions/runs/34157018479 |

> Note : le test **SAST a révélé que la porte Semgrep était cassée** (action dépréciée qui plantait
> en vert). Réparée dans `app-delivery.yml` (Semgrep diff-aware). Le run ci-dessus est celui d'APRÈS
> réparation : Semgrep bloque bien le poison.
