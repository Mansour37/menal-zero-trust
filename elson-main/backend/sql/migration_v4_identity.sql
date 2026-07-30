-- ══════════════════════════════════════════════════════════
-- Migration V4: NNI + WhatsApp identity verification
-- NNI = Numéro National d'Identité (Mauritanie) — unique per person
-- WhatsApp = unique phone number — one per person
-- ══════════════════════════════════════════════════════════

-- 1. Add NNI and WhatsApp to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS nni TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Unique constraints — ONE account per NNI, ONE account per WhatsApp
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nni ON users (nni) WHERE nni IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_whatsapp ON users (whatsapp) WHERE whatsapp IS NOT NULL;

-- 3. Protect identity fields — cannot be changed after registration
CREATE OR REPLACE FUNCTION protect_identity_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Block changes to identity fields once set
    IF OLD.nni IS NOT NULL AND NEW.nni IS DISTINCT FROM OLD.nni THEN
        RAISE EXCEPTION 'NNI cannot be changed after registration';
    END IF;
    IF OLD.whatsapp IS NOT NULL AND NEW.whatsapp IS DISTINCT FROM OLD.whatsapp THEN
        RAISE EXCEPTION 'WhatsApp number cannot be changed after registration';
    END IF;
    IF OLD.first_name IS NOT NULL AND NEW.first_name IS DISTINCT FROM OLD.first_name THEN
        RAISE EXCEPTION 'First name cannot be changed after registration';
    END IF;
    IF OLD.last_name IS NOT NULL AND NEW.last_name IS DISTINCT FROM OLD.last_name THEN
        RAISE EXCEPTION 'Last name cannot be changed after registration';
    END IF;
    IF OLD.birthdate IS NOT NULL AND NEW.birthdate IS DISTINCT FROM OLD.birthdate THEN
        RAISE EXCEPTION 'Birthdate cannot be changed after registration';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_identity ON users;
CREATE TRIGGER trg_protect_identity
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION protect_identity_fields();

-- 4. Update competition_fairness view to include identity info
DROP VIEW IF EXISTS competition_fairness;
CREATE OR REPLACE VIEW competition_fairness AS
SELECT
    u.id,
    u.username,
    u.nni,
    u.whatsapp,
    u.identity_verified,
    u.first_name,
    u.last_name,
    p.points,
    p.total_contributions,
    p.total_validations,
    p.validator_trust,
    (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'approved') AS approved_count,
    (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'rejected') AS rejected_count,
    (SELECT COUNT(*) FROM phrase_skips WHERE user_id = u.id AND created_at > now() - interval '24 hours') AS skips_24h,
    u.created_at AS registered_at
FROM users u
JOIN profiles p ON p.user_id = u.id
WHERE u.is_active = true
ORDER BY p.points DESC;
