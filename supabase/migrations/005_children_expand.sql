-- ============================================================
-- Migration 005: Children-tabell — utökade kolumner
-- Datum: 2026-03
-- Beskrivning:
--   - Ny kolumn: birthdate DATE — ersätter eventuell ålderskolumn
--   - Ny kolumn: diagnoses TEXT[] — barnets diagnoser (primär diagnos först)
--   - Ny kolumn: diagnosis_other TEXT — fritext om diagnos inte finns i listan
--   - Ny kolumn: extra_info TEXT — övrig information till läraren
--   - Ny kolumn: membership_consented_at TIMESTAMPTZ — tidsstämpel för GDPR-samtycke
-- ============================================================

ALTER TABLE children ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE children ADD COLUMN IF NOT EXISTS diagnoses TEXT[];
ALTER TABLE children ADD COLUMN IF NOT EXISTS diagnosis_other TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS extra_info TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS membership_consented_at TIMESTAMPTZ;

-- ── ROLLBACK ─────────────────────────────────────────────────
-- ALTER TABLE children DROP COLUMN IF EXISTS birthdate;
-- ALTER TABLE children DROP COLUMN IF EXISTS diagnoses;
-- ALTER TABLE children DROP COLUMN IF EXISTS diagnosis_other;
-- ALTER TABLE children DROP COLUMN IF EXISTS extra_info;
-- ALTER TABLE children DROP COLUMN IF EXISTS membership_consented_at;
