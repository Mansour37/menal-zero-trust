import os
import pytest
import requests

API_BASE = os.getenv("E2E_API_URL", "https://api.menal-sarl.com")
DASHBOARD_URL = os.getenv("E2E_DASHBOARD_URL", "https://dash.menal-sarl.com")
API_RUN_URL = os.getenv("E2E_API_RUN_URL", "https://menal-api-dev-riusubanoq-ew.a.run.app")
ML_EMBED_URL = os.getenv("E2E_ML_EMBED_URL", None)
HEALTH_TIMEOUT = int(os.getenv("E2E_HEALTH_TIMEOUT", "10"))
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")


@pytest.fixture
def api_url():
    return API_BASE.rstrip("/")


@pytest.fixture
def dashboard_url():
    return DASHBOARD_URL.rstrip("/")


@pytest.fixture
def api_run_url():
    return API_RUN_URL.rstrip("/")


@pytest.fixture
def ml_embed_url():
    return ML_EMBED_URL


@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"User-Agent": "MENAL-E2E-Test/1.0"})
    s.timeout = HEALTH_TIMEOUT
    yield s
    s.close()


def pytest_collection_modifyitems(items):
    for item in items:
        if "slow" in item.keywords:
            item.add_marker(pytest.mark.skipif(
                not os.getenv("E2E_RUN_SLOW"),
                reason="set E2E_RUN_SLOW=1 to run slow integration tests"
            ))
        if "gcp" in item.keywords:
            item.add_marker(pytest.mark.skipif(
                not os.getenv("GOOGLE_APPLICATION_CREDENTIALS") and not os.getenv("E2E_SKIP_GCP"),
                reason="set GOOGLE_APPLICATION_CREDENTIALS or E2E_SKIP_GCP=1"
            ))
