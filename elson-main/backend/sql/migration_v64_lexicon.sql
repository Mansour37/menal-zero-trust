-- V64: VALIDATED spelling lexicon. When a reviewer validates a phrase, the words of the
-- corrected text enter here → they become "known" everywhere (spell-checker) even at freq 1.
-- This is the flywheel: review → reference spelling that keeps improving. Additive.
CREATE TABLE IF NOT EXISTS lexicon (
  word       TEXT PRIMARY KEY,            -- Arabic word, tashkeel removed (spell-checker convention)
  freq       INT NOT NULL DEFAULT 1,
  source     TEXT NOT NULL DEFAULT 'review',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
