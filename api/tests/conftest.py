from unittest.mock import MagicMock
import pytest


@pytest.fixture(autouse=True)
def _no_real_database(monkeypatch):
    """
    Le middleware d audit (main.py) appelle get_engine() sur quasi toutes les
    routes pour journaliser la requete, en dehors de toute session mockee par
    les tests individuels. Sans ce mock, chaque test hors /health tenterait
    une vraie connexion Cloud SQL (Cloud SQL Python Connector) et resterait
    bloque en l absence d identifiants GCP dans l environnement de test.
    """
    monkeypatch.setattr("main.get_engine", lambda: MagicMock())
