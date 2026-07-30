-- ══════════════════════════════════════════════════════════
-- Migration V5: Auto-leveling + Daily Streaks
-- ══════════════════════════════════════════════════════════

-- ── 1. AUTO-LEVEL: Trigger that updates level when points change ──
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Level thresholds: 1=0, 2=100, 3=500, 4=2000, 5=10000
    NEW.level := CASE
        WHEN NEW.points >= 10000 THEN 5
        WHEN NEW.points >= 2000 THEN 4
        WHEN NEW.points >= 500 THEN 3
        WHEN NEW.points >= 100 THEN 2
        ELSE 1
    END;

    -- Log level up
    IF NEW.level > OLD.level THEN
        INSERT INTO audit_log (user_id, action, details)
        VALUES (NEW.user_id, 'level_up',
                jsonb_build_object(
                    'old_level', OLD.level,
                    'new_level', NEW.level,
                    'points', NEW.points
                ));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_level ON profiles;
CREATE TRIGGER trg_auto_level
    BEFORE UPDATE OF points ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_level();

-- ── 2. DAILY STREAK: Function to call on each contribution/validation ──
CREATE OR REPLACE FUNCTION update_streak()
RETURNS TRIGGER AS $$
DECLARE
    v_last_active DATE;
    v_today DATE := CURRENT_DATE;
BEGIN
    SELECT last_active_date INTO v_last_active
    FROM profiles WHERE user_id = NEW.user_id;

    -- Already active today, nothing to do
    IF v_last_active = v_today THEN
        RETURN NEW;
    END IF;

    IF v_last_active = v_today - 1 THEN
        -- Consecutive day: increment streak
        UPDATE profiles SET
            streak_days = streak_days + 1,
            last_active_date = v_today,
            -- Award streak bonus every 7 days
            points = points + CASE WHEN (streak_days + 1) % 7 = 0 THEN 5 ELSE 0 END
        WHERE user_id = NEW.user_id;

        -- Log milestone streaks
        IF (SELECT streak_days FROM profiles WHERE user_id = NEW.user_id) IN (7, 14, 30, 60, 100) THEN
            INSERT INTO audit_log (user_id, action, details)
            VALUES (NEW.user_id, 'streak_milestone',
                    jsonb_build_object('days', (SELECT streak_days FROM profiles WHERE user_id = NEW.user_id)));
        END IF;
    ELSE
        -- Streak broken (or first activity): reset to 1
        UPDATE profiles SET
            streak_days = 1,
            last_active_date = v_today
        WHERE user_id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger streak on new contribution
DROP TRIGGER IF EXISTS trg_streak_contribution ON contributions;
CREATE TRIGGER trg_streak_contribution
    AFTER INSERT ON contributions
    FOR EACH ROW
    EXECUTE FUNCTION update_streak();

-- Trigger streak on new validation
DROP TRIGGER IF EXISTS trg_streak_validation ON validations;
CREATE TRIGGER trg_streak_validation
    AFTER INSERT ON validations
    FOR EACH ROW
    EXECUTE FUNCTION update_streak();

-- ── 3. BADGE AUTO-AWARD ──
CREATE OR REPLACE FUNCTION update_badges()
RETURNS TRIGGER AS $$
DECLARE
    v_badges TEXT[];
BEGIN
    v_badges := '{}';

    -- Contribution badges
    IF NEW.total_contributions >= 1 THEN v_badges := array_append(v_badges, 'first_contribution'); END IF;
    IF NEW.total_contributions >= 10 THEN v_badges := array_append(v_badges, 'ten_contributions'); END IF;
    IF NEW.total_contributions >= 50 THEN v_badges := array_append(v_badges, 'fifty_contributions'); END IF;
    IF NEW.total_contributions >= 100 THEN v_badges := array_append(v_badges, 'hundred_contributions'); END IF;

    -- Recording badges
    IF NEW.total_recordings >= 1 THEN v_badges := array_append(v_badges, 'first_recording'); END IF;
    IF NEW.total_recordings >= 10 THEN v_badges := array_append(v_badges, 'ten_recordings'); END IF;

    -- Validation badges
    IF NEW.total_validations >= 1 THEN v_badges := array_append(v_badges, 'first_validation'); END IF;

    -- Streak badges
    IF NEW.streak_days >= 7 THEN v_badges := array_append(v_badges, 'streak_7'); END IF;
    IF NEW.streak_days >= 30 THEN v_badges := array_append(v_badges, 'streak_30'); END IF;

    -- Milestone points
    IF NEW.points >= 100 THEN
        -- Award milestone bonuses (only if not already at that level)
        IF OLD.total_contributions = 9 AND NEW.total_contributions = 10 THEN
            NEW.points := NEW.points + 50;  -- 10 contributions milestone
        END IF;
        IF OLD.total_contributions = 49 AND NEW.total_contributions = 50 THEN
            NEW.points := NEW.points + 200; -- 50 contributions milestone
        END IF;
        IF OLD.total_contributions = 99 AND NEW.total_contributions = 100 THEN
            NEW.points := NEW.points + 500; -- 100 contributions milestone
        END IF;
    END IF;

    NEW.badges := v_badges;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_badges ON profiles;
CREATE TRIGGER trg_update_badges
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_badges();

-- ── 4. Fix existing users: set correct level ──
UPDATE profiles SET
    level = CASE
        WHEN points >= 10000 THEN 5
        WHEN points >= 2000 THEN 4
        WHEN points >= 500 THEN 3
        WHEN points >= 100 THEN 2
        ELSE 1
    END;
