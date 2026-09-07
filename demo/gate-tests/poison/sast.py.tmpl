# FAILLE VOLONTAIRE — test de la porte Semgrep (SAST). NE JAMAIS FUSIONNER.
# Déposé en api/app/_gate_sast.py par run-gate-test.sh, puis supprimé.
# Semgrep p/default doit lever :
#   - python.lang.security.audit.eval-detected
#   - python.lang.security.audit.dangerous-subprocess-use-audit (shell=True)
import subprocess


def run_user_expression(expr):
    # eval sur une entrée utilisateur => exécution de code arbitraire
    return eval(expr)  # noqa


def run_user_command(cmd):
    # subprocess shell=True sur une entrée utilisateur => injection de commande
    return subprocess.check_output(cmd, shell=True)  # noqa
