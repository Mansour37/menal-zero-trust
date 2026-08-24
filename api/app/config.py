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
    _JWT_SECRET_DEFAULT = "dev-secret-change-in-production"
    JWT_SECRET: str = os.getenv("JWT_SECRET", _JWT_SECRET_DEFAULT)
    BQ_DATASET_ID: str = os.getenv("BQ_DATASET_ID", "menal_security_dev")

    # Cle de chiffrement symetrique (Fernet) du secret TOTP au repos, voir
    # app/auth/crypto.py. Meme pattern de chargement que JWT_SECRET ci-dessus :
    # variable d'environnement, injectee en prod via Secret Manager cote
    # Cloud Run (pas de nouvelle infra KMS pour ce correctif, cf. mission).
    # Valeur par defaut = cle Fernet FIXE reservee au dev local (jamais valide
    # hors dev grace au garde-fou fail-closed plus bas).
    _MFA_ENCRYPTION_KEY_DEFAULT = "TUVOQUwtZGV2LW9ubHktZmFrZS1tZmEta2V5LTMyYiE="
    MFA_ENCRYPTION_KEY: str = os.getenv("MFA_ENCRYPTION_KEY", _MFA_ENCRYPTION_KEY_DEFAULT)

    @property
    def DB_PASSWORD(self) -> str:
        env_pw = os.getenv("DB_PASSWORD")
        if env_pw:
            return env_pw
        return get_secret(self.SECRET_NAME, self.GCP_PROJECT_ID)


settings = Settings()

# Fail-closed : hors dev, refuser de demarrer avec le secret JWT par defaut
# (publie dans le depot). Sinon une revision ou le secret n est pas injecte
# signerait des tokens avec une valeur publiquement connue -> forge admin triviale.
if settings.ENVIRONMENT != "dev" and settings.JWT_SECRET == Settings._JWT_SECRET_DEFAULT:
    raise RuntimeError(
        "JWT_SECRET utilise la valeur par defaut hors environnement dev. "
        "Injecter un secret reel (Secret Manager) avant de demarrer."
    )

# Meme garde-fou pour la cle de chiffrement du secret TOTP : la valeur par
# defaut est publiee dans ce depot, donc valide UNIQUEMENT en dev.
if settings.ENVIRONMENT != "dev" and settings.MFA_ENCRYPTION_KEY == Settings._MFA_ENCRYPTION_KEY_DEFAULT:
    raise RuntimeError(
        "MFA_ENCRYPTION_KEY utilise la valeur par defaut hors environnement dev. "
        "Injecter une cle reelle (Secret Manager) avant de demarrer."
    )
