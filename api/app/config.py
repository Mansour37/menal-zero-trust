import os
from google.cloud import secretmanager


def get_secret(secret_id: str, project_id: str) -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "dev")
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")
    CLOUD_SQL_CONNECTION_NAME: str = os.getenv(
        "CLOUD_SQL_CONNECTION_NAME", "menal-zero-trust-dev:europe-west1:menal-db-dev"
    )
    DB_NAME: str = os.getenv("DB_NAME", "menal_db")
    DB_USER: str = os.getenv("DB_USER", "api_user")
    SECRET_NAME: str = os.getenv("SECRET_NAME", "db-password-dev")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
    BQ_DATASET_ID: str = os.getenv("BQ_DATASET_ID", "menal_security_dev")

    @property
    def DB_PASSWORD(self) -> str:
        env_pw = os.getenv("DB_PASSWORD")
        if env_pw:
            return env_pw
        return get_secret(self.SECRET_NAME, self.GCP_PROJECT_ID)


settings = Settings()
