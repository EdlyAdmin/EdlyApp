-- ============================================================
-- Migration 010: Teachers-tabell — profile_id nullable
-- Datum: 2026-04
-- Beskrivning:
--   - profile_id görs nullable för att tillåta import-skapade lärare
--     som inte har ett Supabase Auth-konto (t.ex. via Excel-import).
--   - Lärare skapade via normal registrering har alltid profile_id satt.
-- ============================================================

ALTER TABLE teachers ALTER COLUMN profile_id DROP NOT NULL;

-- ── ROLLBACK ─────────────────────────────────────────────────
-- ALTER TABLE teachers ALTER COLUMN profile_id SET NOT NULL;
