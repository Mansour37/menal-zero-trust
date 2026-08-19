"""
Chiffrement au repos du secret TOTP (mfa_secret).

Portee volontairement minimale (projet PFE, pas une plateforme d'entreprise) :
un chiffrement symetrique Fernet (AES-128-CBC + HMAC-SHA256, authentifie) avec
une cle unique chargee depuis l'environnement (meme pattern que JWT_SECRET
dans app/config.py), PAS de nouvelle infrastructure KMS/enveloppe.

Menace couverte : un dump de la base (backup vole, injection SQL en lecture,
acces DBA non audite) n'expose plus directement le secret TOTP en clair —
il faudrait aussi la cle MFA_ENCRYPTION_KEY (env var / Secret Manager cote
Cloud Run, hors du perimetre de la base).

Menace NON couverte : un attaquant qui obtient a la fois la base ET la cle
(ex. acces complet au projet GCP) peut toujours dechiffrer. Ce n'est pas une
enveloppe KMS avec role IAM dedie — cf. ADR 0002/0003 sur le choix de ne pas
introduire de compte de service dedie pour ce socle.
"""
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)


def _fernet() -> Fernet:
    return Fernet(settings.MFA_ENCRYPTION_KEY.encode("utf-8"))


def encrypt_mfa_secret(plain_secret: str) -> str:
    """Chiffre un secret TOTP avant ecriture en base."""
    return _fernet().encrypt(plain_secret.encode("utf-8")).decode("utf-8")


def decrypt_mfa_secret(stored_value: str) -> str:
    """
    Dechiffre une valeur lue en base et renvoie le secret TOTP en clair,
    pret pour pyotp.

    Tolerance "legacy" (volontaire) : avant ce correctif, mfa_secret etait
    ecrit EN CLAIR (base32, 32 caracteres, produit par pyotp.random_base32()).
    Rejeter ces comptes existants aurait signifie soit une migration de donnees
    destructive (perte du secret -> MFA casse pour tous les comptes deja
    enroles), soit un correctif qui ne s'applique qu'aux nouveaux comptes.
    On choisit donc : si la valeur stockee n'est PAS un token Fernet valide
    (InvalidToken / erreur de decodage), on la traite comme un secret legacy
    en clair, on la retourne telle quelle (le TOTP continue de fonctionner),
    et on loggue un avertissement pour tracer la dette residuelle. Le compte
    est re-chiffre automatiquement au prochain passage par le flux d'ecriture
    (setup, ou toute future rotation) puisque ce flux appelle toujours
    encrypt_mfa_secret() avant db.commit().
    """
    try:
        return _fernet().decrypt(stored_value.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        logger.warning(
            "mfa_secret lu en base au format legacy (non chiffre) — "
            "sera re-chiffre automatiquement a la prochaine verification reussie."
        )
        return stored_value


def is_legacy_plaintext(stored_value: str) -> bool:
    """
    True si la valeur stockee n'est PAS un token Fernet valide, donc un
    secret legacy pre-migration ecrit en clair.

    Utilise par les routes appelantes (verify_mfa, enable_mfa) pour re-chiffrer
    et persister le secret des la premiere verification reussie qui suit ce
    correctif, plutot que d attendre un hypothetique flux de rotation qui
    n existe pas encore pour un compte MFA deja actif (le /auth/mfa/setup est
    bloque tant que mfa_enabled=True). C'est le point de migration le plus
    naturel : on ne le fait qu APRES un TOTP valide, jamais sur un simple echec.
    """
    try:
        _fernet().decrypt(stored_value.encode("utf-8"))
        return False
    except (InvalidToken, ValueError):
        return True
