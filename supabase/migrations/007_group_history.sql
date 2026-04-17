-- ============================================================
-- Migration 007: Ny tabell — group_history
-- Datum: 2026-03
-- Beskrivning:
--   - Loggar barnets gruppmedlemskap vid borttag eller upplösning
--   - Sparar lärare, ämne och status vid tillfället för borttag
--   - Används för att visa historik i adminpanelen
-- ============================================================

CREATE TABLE IF NOT EXISTS group_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  teacher_name TEXT,
  subject     TEXT,
  group_status TEXT,
  removed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index för snabb hämtning per barn
CREATE INDEX IF NOT EXISTS idx_group_history_child_id ON group_history(child_id);

-- RLS: endast service-roll kan skriva, admin kan läsa
ALTER TABLE group_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin kan läsa grupphistorik"
  ON group_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── ROLLBACK ─────────────────────────────────────────────────
-- DROP POLICY IF EXISTS "Admin kan läsa grupphistorik" ON group_history;
-- DROP INDEX IF EXISTS idx_group_history_child_id;
-- DROP TABLE IF EXISTS group_history;
