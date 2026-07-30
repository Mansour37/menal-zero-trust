-- ══════════════════════════════════════════════════════════
-- Migration V25: simplified registration
--
-- Sign-up now requires only EMAIL + PASSWORD. The username is derived from the
-- email, and first name / last name / NNI / birthdate are no longer asked on the
-- form — but the columns stay in the schema (nullable) so they can still be
-- collected later in the background. nni / whatsapp / birthdate were already
-- nullable; first_name / last_name were NOT NULL, so relax them here. Idempotent.
-- ══════════════════════════════════════════════════════════

ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN last_name  DROP NOT NULL;
