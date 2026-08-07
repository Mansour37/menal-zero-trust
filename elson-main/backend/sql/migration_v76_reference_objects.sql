-- ══════════════════════════════════════════════════════════
-- Migration V76: objets de référence manquants (audit §4.4.2)
--
-- Trois objets utilisés par le code n'avaient AUCUNE définition versionnée
-- (créés manuellement en production) : un environnement reconstruit depuis
-- le dépôt voyait la phase de vote comparatif échouer en 500 (42P01) et
-- /api/public/stats dégrader silencieusement.
--
-- ⚠️ Définitions RECONSTRUITES depuis l'usage réel du code (colonnes et
-- jointures ci-dessous). À réconcilier avec `pg_dump --schema-only` de la
-- production avant toute migration de données — le sens des colonnes est
-- vérifié, les contraintes exactes de production peuvent différer.
--
-- Idempotent.
-- ══════════════════════════════════════════════════════════

-- ── votes ──────────────────────────────────────────────────
-- Usages : INSERT INTO votes (voter_id, phrase_id, chosen_contribution_id)
--          (validate.ts:510) ; SELECT … FROM votes v WHERE v.voter_id = $1
--          AND v.phrase_id = vp.phrase_id (validate.ts:230) ;
--          LEFT JOIN votes v ON v.chosen_contribution_id = c.id (users.ts:2455) ;
--          DELETE FROM votes WHERE phrase_id = $1 (users.ts:2487) ;
--          votes.created_at (users.ts:2181,2210,3008).
CREATE TABLE IF NOT EXISTS votes (
    id                      BIGSERIAL PRIMARY KEY,
    voter_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phrase_id               BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
    chosen_contribution_id  BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un vote par (votant, phrase) — le code vérifie l'absence puis insère ;
-- la contrainte ferme la course de concurrents.
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_voter_phrase ON votes (voter_id, phrase_id);
CREATE INDEX IF NOT EXISTS idx_votes_phrase ON votes (phrase_id);
CREATE INDEX IF NOT EXISTS idx_votes_chosen ON votes (chosen_contribution_id);

-- ── votable_phrases (vue) ──────────────────────────────────
-- Usages : SELECT vp.* … ORDER BY vp.approved_count DESC (validate.ts:226-234) ;
--          SELECT vp.phrase_id, vp.source_text, vp.source_lang, vp.category,
--          vp.approved_count (users.ts:2440-2444).
-- Sémantique : une phrase est votable quand elle porte au moins 2 traductions
-- approuvées non archivées — c'est ce qui rend le choix comparatif possible.
CREATE OR REPLACE VIEW votable_phrases AS
SELECT
    p.id AS phrase_id,
    p.source_text,
    p.source_lang,
    p.category,
    COUNT(c.id)::int AS approved_count
FROM phrases p
JOIN contributions c ON c.phrase_id = p.id
WHERE p.is_active = true
  AND c.status = 'approved'
  AND c.quarantined = false
  AND c.season0 = false
GROUP BY p.id
HAVING COUNT(c.id) >= 2;

-- ── season0_contributors (table de transparence) ──────────
-- Usage : SELECT username, contributions FROM season0_contributors
--         WHERE contributions >= 5 ORDER BY contributions DESC (server.ts:300).
-- Snapshotted en production lors du reset V23 : aucune donnée versionnable,
-- la structure seule est reconstruite ici ; les lignes restent à injecter
-- depuis l'environnement réel le cas échéant.
CREATE TABLE IF NOT EXISTS season0_contributors (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    contributions INT  NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_season0_contributors_count ON season0_contributors (contributions DESC);

-- ── profiles.total_votes ───────────────────────────────────
-- Colonne créée manuellement en production, jamais versionnée : les vues de
-- classement v15/v33/v34/v47/v48 référencent p.total_votes. Un environnement
-- reconstruit voyait DROP/CREATE VIEW échouer (42P01) dès v15.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_votes INT NOT NULL DEFAULT 0;