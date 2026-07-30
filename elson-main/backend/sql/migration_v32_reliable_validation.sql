-- ══════════════════════════════════════════════════════════
-- Migration V32: Reliable, non-discriminatory validation
--
-- Goal: every genuine contribution gets a FAIR quality score, while abuse loses
-- its power — WITHOUT blocking anyone (the platform is thin; gates would starve it).
-- Everything is WEIGHT-based and EARNABLE. Three signals combine into one
-- per-vote weight `validator_weight(validator, contributor)`:
--   1. base validator_trust  (existing: agreement with consensus, 0.1–1.5)
--   2. contribution factor    (0.4 if never contributed → 1.0 at ≥3 contributions)
--                             → curbs pure-evaluators / fake accounts, but still
--                               counts, and is fully earnable (non-discriminatory).
--   3. reciprocity factor     (1.0 up to 30 validations of the SAME author, then
--                               decays) → breaks friend-rings (up-vote OR sabotage)
--                               without punishing a power-validator who validates
--                               many DIFFERENT people.
-- The hidden quality score now uses a TRUST-WEIGHTED MEDIAN (robust to one person
-- AND to a low-weight ring), via wmedian(). The ≥3-distinct-evaluators rule stays.
-- ══════════════════════════════════════════════════════════

-- Per-vote weight: trust × contribution-factor × reciprocity-factor. Never 0.
CREATE OR REPLACE FUNCTION validator_weight(p_validator UUID, p_contributor UUID) RETURNS NUMERIC AS $$
DECLARE base NUMERIC; contribs INT; pair_n INT; cfac NUMERIC; rfac NUMERIC;
BEGIN
    SELECT COALESCE(validator_trust, 1.0) INTO base FROM profiles WHERE user_id = p_validator;
    base := COALESCE(base, 1.0);

    -- contribution factor: rewards people who also contribute (earnable, floor 0.4)
    SELECT COUNT(*) INTO contribs FROM contributions
    WHERE user_id = p_validator AND season0 = false AND quarantined = false;
    cfac := LEAST(1.0, 0.4 + 0.2 * COALESCE(contribs, 0));   -- 0→0.4, 3+→1.0

    -- reciprocity factor: how often this validator already judged THIS author's work
    SELECT COUNT(*) INTO pair_n
    FROM validations v JOIN contributions c ON c.id = v.contribution_id
    WHERE v.validator_id = p_validator AND c.user_id = p_contributor;
    rfac := LEAST(1.0, 1.0 / (1.0 + GREATEST(0, COALESCE(pair_n, 0) - 30) / 50.0));  -- ≤30 full, then decays

    RETURN GREATEST(0.02, base * cfac * rfac);
END;
$$ LANGUAGE plpgsql STABLE;

-- Trust-weighted median of a contribution's post-cutoff, non-disqualified ratings.
-- p_audio=false → text_accuracy ; p_audio=true → audio_clarity. The value at the
-- weight-midpoint: a low-weight ring can't move it; the trusted majority decides.
CREATE OR REPLACE FUNCTION wmedian(p_cid BIGINT, p_cutoff TIMESTAMPTZ, p_audio BOOLEAN) RETURNS NUMERIC AS $$
DECLARE v_contributor UUID; res NUMERIC;
BEGIN
    SELECT user_id INTO v_contributor FROM contributions WHERE id = p_cid;
    WITH w AS (
        SELECT (CASE WHEN p_audio THEN v.audio_clarity ELSE v.text_accuracy END)::numeric AS val,
               validator_weight(v.validator_id, v_contributor) AS wt
        FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
        WHERE v.contribution_id = p_cid AND v.created_at >= p_cutoff AND pv.disqualified = false
          AND (NOT p_audio OR v.audio_clarity IS NOT NULL)
    ), o AS (
        SELECT val, SUM(wt) OVER (ORDER BY val) AS cum, SUM(wt) OVER () AS tot FROM w
    )
    SELECT val INTO res FROM o WHERE tot > 0 AND cum >= tot / 2.0 ORDER BY val LIMIT 1;
    RETURN res;
END;
$$ LANGUAGE plpgsql STABLE;

-- Quality trigger: same gates as v30 (cutoff, ≥3 distinct NON-disqualified post-cutoff
-- evaluators, skip disqualified contributor) but the SCORE now uses the trust-weighted
-- median instead of the plain median.
CREATE OR REPLACE FUNCTION update_quality_after_validation() RETURNS TRIGGER AS $$
DECLARE
    v_cutoff TIMESTAMPTZ; v_contributor UUID; v_has_audio BOOLEAN; v_locked BOOLEAN;
    v_n INT; v_med_text NUMERIC; v_med_audio NUMERIC; v_text_pts NUMERIC; v_audio_pts NUMERIC; v_q NUMERIC;
    v_contributor_dq BOOLEAN;
BEGIN
    SELECT NULLIF(value, '')::timestamptz INTO v_cutoff FROM competition_config WHERE key = 'quality_scoring_cutoff';
    IF v_cutoff IS NULL THEN RETURN NEW; END IF;
    IF NEW.created_at < v_cutoff THEN RETURN NEW; END IF;

    SELECT user_id, (audio_url IS NOT NULL), COALESCE(quality_locked, false)
    INTO v_contributor, v_has_audio, v_locked
    FROM contributions WHERE id = NEW.contribution_id;
    IF v_locked THEN RETURN NEW; END IF;

    SELECT disqualified INTO v_contributor_dq FROM profiles WHERE user_id = v_contributor;
    IF v_contributor_dq THEN RETURN NEW; END IF;

    -- threshold = distinct NON-disqualified post-cutoff evaluators (unchanged, ≥3)
    SELECT COUNT(DISTINCT v.validator_id) INTO v_n
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND v.created_at >= v_cutoff AND pv.disqualified = false;
    IF v_n < 3 THEN RETURN NEW; END IF;

    -- score = TRUST-WEIGHTED median
    v_med_text  := wmedian(NEW.contribution_id, v_cutoff, false);
    v_med_audio := wmedian(NEW.contribution_id, v_cutoff, true);

    v_text_pts := 7.5 * (COALESCE(v_med_text, 1) - 1) / 4.0;
    IF v_has_audio AND v_med_audio IS NOT NULL THEN v_audio_pts := 7.5 * (v_med_audio - 1) / 4.0;
    ELSE v_audio_pts := 0; END IF;
    v_q := GREATEST(0, LEAST(15, ROUND((v_text_pts + v_audio_pts)::numeric, 2)));

    UPDATE contributions SET quality_points = v_q, quality_eval_count = v_n, quality_locked = (v_n >= 5)
    WHERE id = NEW.contribution_id;

    UPDATE profiles SET quality_points = (
        SELECT COALESCE(SUM(c.quality_points), 0) FROM contributions c
        WHERE c.user_id = v_contributor AND c.quality_points IS NOT NULL AND c.season0 = false AND c.quarantined = false
    ) WHERE user_id = v_contributor;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Admin view: reciprocal pairs (who validates whom, both directions) to spot rings.
CREATE OR REPLACE VIEW reciprocity_pairs AS
WITH val AS (
    SELECT v.validator_id, c.user_id AS author, COUNT(*) AS n
    FROM validations v JOIN contributions c ON c.id = v.contribution_id
    WHERE c.season0 = false GROUP BY 1, 2
)
SELECT a.validator_id AS user_a, ua.username AS name_a,
       a.author AS user_b, ub.username AS name_b,
       a.n AS a_validates_b, b.n AS b_validates_a, (a.n + b.n) AS total
FROM val a
JOIN val b ON a.validator_id = b.author AND a.author = b.validator_id
JOIN users ua ON ua.id = a.validator_id
JOIN users ub ON ub.id = a.author
WHERE a.validator_id < a.author
ORDER BY (a.n + b.n) DESC;
