"""widen mfa_secret column for encrypted (Fernet) storage

Revision ID: 003
Revises: 002
Create Date: 2026-08-19

Contexte (ecart d'audit HIGH, chiffrement du secret TOTP au repos) :
mfa_secret passe de "stocke en clair" a "stocke chiffre" (Fernet, voir
app/auth/crypto.py). Un token Fernet est nettement plus long que le secret
base32 d origine (~140 caracteres contre 32) : String(32) ne suffit plus.

Cette migration ne touche QUE le type de colonne, jamais les donnees :
- les secrets deja enrolés restent lisibles tels quels (String(255) est un
  sur-ensemble compatible de String(32), aucune conversion necessaire) ;
- ils sont traites comme "legacy en clair" par decrypt_mfa_secret() jusqu a
  leur re-chiffrement opportuniste au prochain /auth/mfa/verify reussi
  (voir le commentaire dans app/auth/crypto.py::decrypt_mfa_secret) ;
- aucune donnee n est reecrite ni perdue ici : une migration Alembic n a pas
  acces a MFA_ENCRYPTION_KEY au moment du deploiement et ne doit pas essayer
  de deviner/forcer un chiffrement en une seule passe destructive.
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "mfa_secret",
        existing_type=sa.String(32),
        type_=sa.String(255),
        existing_nullable=True,
    )


def downgrade() -> None:
    # NB : un downgrade apres migration de secrets chiffres tronquerait les
    # tokens Fernet (>32 caracteres) au lieu de les rendre invalides proprement.
    # Comportement assume : le downgrade est prevu pour un rollback AVANT tout
    # enrolement/re-chiffrement post-003, pas pour revenir en arriere une fois
    # des secrets chiffres stockes.
    op.alter_column(
        "users",
        "mfa_secret",
        existing_type=sa.String(255),
        type_=sa.String(32),
        existing_nullable=True,
    )
