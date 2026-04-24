-- ============================================================
-- Migration 003: Groups-tabell — ny statusmodell och ämneskolumn
-- Datum: 2026-03
-- Beskrivning:
--   - group_status-enum ersätts med fri TEXT (forming/full/active/rejected)
--   - Ny kolumn: subject TEXT — låser gruppen till ett ämne
-- ============================================================

-- Ta bort gamla enum-begränsningen och byt till TEXT
ALTER TABLE groups ALTER COLUMN status TYPE TEXT;

-- Lägg till subject-kolumn
ALTER TABLE groups ADD COLUMN IF NOT EXISTS subject TEXT;

-- Index för snabbare filtrering på status
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);

-- ── ROLLBACK ─────────────────────────────────────────────────
-- ALTER TABLE groups DROP COLUMN IF EXISTS subject;
-- ALTER TABLE groups ALTER COLUMN status TYPE group_status USING status::group_status;
-- DROP INDEX IF EXISTS idx_groups_status;
