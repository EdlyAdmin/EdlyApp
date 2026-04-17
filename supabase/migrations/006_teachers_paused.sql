-- ============================================================
-- Migration 006: Teachers-tabell — blockering från matchning
-- Datum: 2026-03
-- Beskrivning:
--   - Ny kolumn: paused BOOLEAN — blockerar läraren från ny matchning
--     (t.ex. vid sjukskrivning, tjänstledighet etc.)
-- ============================================================

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT false;

-- Sätt alla befintliga lärare till ej pausade
UPDATE teachers SET paused = false WHERE paused IS NULL;

-- ── ROLLBACK ─────────────────────────────────────────────────
-- ALTER TABLE teachers DROP COLUMN IF EXISTS paused;
