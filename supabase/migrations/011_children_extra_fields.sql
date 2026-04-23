-- ============================================================
-- Migration 011: Children-tabell — nya fält
-- Datum: 2026-04
-- Beskrivning:
--   - session_length TEXT — hur länge barnet klarar en videolektion
--   - has_webcam BOOLEAN — om familjen har webbkamera
--   - admin_notes TEXT — interna noteringar från admin
-- ============================================================

ALTER TABLE children ADD COLUMN IF NOT EXISTS session_length TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS has_webcam BOOLEAN;
ALTER TABLE children ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- ── ROLLBACK ─────────────────────────────────────────────────
-- ALTER TABLE children DROP COLUMN IF EXISTS session_length;
-- ALTER TABLE children DROP COLUMN IF EXISTS has_webcam;
-- ALTER TABLE children DROP COLUMN IF EXISTS admin_notes;
