-- ============================================================
-- Migration 008: Families-tabell — telefonnummer
-- Datum: 2026-04
-- Beskrivning:
--   - Ny kolumn: phone TEXT — förälderns telefonnummer (frivilligt)
-- ============================================================

ALTER TABLE families ADD COLUMN IF NOT EXISTS phone TEXT;

-- ── ROLLBACK ─────────────────────────────────────────────────
-- ALTER TABLE families DROP COLUMN IF EXISTS phone;
