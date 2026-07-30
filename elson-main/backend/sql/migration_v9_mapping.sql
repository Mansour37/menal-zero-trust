-- ══════════════════════════════════════════════════════════
-- Migration V9: Complete audio-text mapping + export views
-- ══════════════════════════════════════════════════════════

-- 1. Full dataset export view with COMPLETE mapping
DROP VIEW IF EXISTS whisper_dataset;
CREATE OR REPLACE VIEW whisper_dataset AS
SELECT
    c.id AS contribution_id,
    -- Source phrase
    p.id AS phrase_id,
    p.source_text,
    p.source_lang,
    p.category,
    p.difficulty,
    p.hassaniya_reference,
    -- Translation
    c.hassaniya_text,
    -- Audio
    c.audio_url,
    c.audio_format,
    c.audio_duration_ms,
    c.audio_size_bytes,
    -- Quality scores
    c.quality_score AS text_quality,
    c.avg_audio_score AS audio_quality,
    c.avg_text_score,
    c.validation_count,
    c.text_status,
    c.audio_status,
    c.status AS overall_status,
    -- Translator info
    u.id AS translator_id,
    u.username AS translator,
    u.first_name AS translator_first_name,
    u.last_name AS translator_last_name,
    -- Timestamps
    c.created_at AS translated_at
FROM contributions c
JOIN phrases p ON p.id = c.phrase_id
JOIN users u ON u.id = c.user_id
WHERE c.audio_url IS NOT NULL
ORDER BY c.quality_score DESC NULLS LAST;

-- 2. Approved-only dataset (for Whisper training)
CREATE OR REPLACE VIEW whisper_training_set AS
SELECT * FROM whisper_dataset
WHERE overall_status = 'approved'
  AND text_status = 'approved'
  AND audio_status = 'approved';

-- 3. All contributions with audio (including pending — for review)
CREATE OR REPLACE VIEW whisper_review_set AS
SELECT * FROM whisper_dataset
WHERE overall_status = 'pending';

-- 4. Stats per phrase with all translations
CREATE OR REPLACE VIEW phrase_translation_map AS
SELECT
    p.id AS phrase_id,
    p.source_text,
    p.source_lang,
    p.hassaniya_reference,
    p.category,
    COUNT(c.id) AS total_translations,
    COUNT(c.id) FILTER (WHERE c.status = 'approved') AS approved_translations,
    COUNT(c.id) FILTER (WHERE c.audio_url IS NOT NULL) AS with_audio,
    ARRAY_AGG(
        json_build_object(
            'id', c.id,
            'text', c.hassaniya_text,
            'audio', c.audio_url,
            'status', c.status,
            'text_status', c.text_status,
            'audio_status', c.audio_status,
            'quality', c.quality_score,
            'translator', u.username
        ) ORDER BY c.quality_score DESC NULLS LAST
    ) FILTER (WHERE c.id IS NOT NULL) AS translations
FROM phrases p
LEFT JOIN contributions c ON c.phrase_id = p.id
LEFT JOIN users u ON u.id = c.user_id
WHERE p.is_active = true
GROUP BY p.id, p.source_text, p.source_lang, p.hassaniya_reference, p.category
ORDER BY p.id;
