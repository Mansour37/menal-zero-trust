# FAILLE VOLONTAIRE — test de la porte pytest. NE JAMAIS FUSIONNER.
# Déposé en api/tests/test_gate_block.py par run-gate-test.sh, puis supprimé.
def test_gate_block_demo():
    # Test volontairement cassé : prouve que la porte pytest bloque le pipeline.
    assert 1 == 2, "porte pytest : echec volontaire pour la demonstration"
