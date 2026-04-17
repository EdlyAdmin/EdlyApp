-- ============================================================
-- Migration 004: Teachers-tabell — utökade kolumner
-- Datum: 2026-03
-- Beskrivning:
--   - Ny kolumn: age_groups TEXT[] — lärarens åldersgrupps-kompetenser
--   - Ny kolumn: phone TEXT — telefonnummer
--   - Ny kolumn: motivation TEXT — motivationsbrev / presentation
-- ============================================================

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS age_groups TEXT[];
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS motivation TEXT;

-- ── ROLLBACK ─────────────────────────────────────────────────
-- ALTER TABLE teachers DROP COLUMN IF EXISTS age_groups;
-- ALTER TABLE teachers DROP COLUMN IF EXISTS phone;
-- ALTER TABLE teachers DROP COLUMN IF EXISTS motivation;
