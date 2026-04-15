-- ============================================================
-- Edly — Row Level Security Policies
-- ============================================================

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE families      ENABLE ROW LEVEL SECURITY;
ALTER TABLE children      ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_error_log  ENABLE ROW LEVEL SECURITY;

-- Helper: hämta roll för inloggad användare
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: hämta teacher-id för inloggad lärare
CREATE OR REPLACE FUNCTION get_my_teacher_id()
RETURNS UUID AS $$
  SELECT id FROM teachers WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── profiles ─────────────────────────────────────────────────
CREATE POLICY "profiles: läs egen profil"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "profiles: uppdatera egen profil"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ── families ─────────────────────────────────────────────────
CREATE POLICY "families: familjen ser sin egen"
  ON families FOR SELECT
  USING (
    profile_id = auth.uid()
    OR get_my_role() = 'admin'
  );

CREATE POLICY "families: familjen skapar sin"
  ON families FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "families: familjen uppdaterar sin"
  ON families FOR UPDATE
  USING (profile_id = auth.uid());

-- ── children — ALDRIG direkt tillgänglig för lärare ──────────
CREATE POLICY "children: familjen ser sina barn"
  ON children FOR SELECT
  USING (
    family_id IN (SELECT id FROM families WHERE profile_id = auth.uid())
    OR get_my_role() = 'admin'
    -- Lärare kan se barn i sin godkända grupp
    OR (
      get_my_role() = 'teacher'
      AND id IN (
        SELECT gm.child_id FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE g.teacher_id = get_my_teacher_id()
          AND g.status = 'active'
      )
    )
  );

CREATE POLICY "children: familjen skapar sina barn"
  ON children FOR INSERT
  WITH CHECK (
    family_id IN (SELECT id FROM families WHERE profile_id = auth.uid())
  );

CREATE POLICY "children: familjen uppdaterar sina barn"
  ON children FOR UPDATE
  USING (
    family_id IN (SELECT id FROM families WHERE profile_id = auth.uid())
  );

-- ── consent_log ───────────────────────────────────────────────
CREATE POLICY "consent: familjen ser sitt samtycke"
  ON consent_log FOR SELECT
  USING (
    family_id IN (SELECT id FROM families WHERE profile_id = auth.uid())
    OR get_my_role() = 'admin'
  );

CREATE POLICY "consent: familjen skapar samtycke"
  ON consent_log FOR INSERT
  WITH CHECK (
    family_id IN (SELECT id FROM families WHERE profile_id = auth.uid())
  );

-- ── teachers ─────────────────────────────────────────────────
CREATE POLICY "teachers: läraren ser sig själv, admin ser alla"
  ON teachers FOR SELECT
  USING (
    profile_id = auth.uid()
    OR get_my_role() = 'admin'
  );

CREATE POLICY "teachers: läraren skapar sin profil"
  ON teachers FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "teachers: läraren uppdaterar sin profil (ej status)"
  ON teachers FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (status = (SELECT status FROM teachers WHERE profile_id = auth.uid()));

CREATE POLICY "teachers: admin uppdaterar status"
  ON teachers FOR UPDATE
  USING (get_my_role() = 'admin');

-- ── groups ────────────────────────────────────────────────────
CREATE POLICY "groups: läraren ser sina grupper, admin ser alla"
  ON groups FOR SELECT
  USING (
    teacher_id = get_my_teacher_id()
    OR get_my_role() = 'admin'
  );

CREATE POLICY "groups: admin skapar grupper"
  ON groups FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "groups: admin uppdaterar grupper"
  ON groups FOR UPDATE
  USING (get_my_role() = 'admin');

-- ── group_members ─────────────────────────────────────────────
CREATE POLICY "group_members: läraren ser sin grupps barn, admin ser alla"
  ON group_members FOR SELECT
  USING (
    group_id IN (
      SELECT id FROM groups WHERE teacher_id = get_my_teacher_id()
    )
    OR get_my_role() = 'admin'
  );

CREATE POLICY "group_members: admin hanterar"
  ON group_members FOR ALL
  USING (get_my_role() = 'admin');

-- ── match_proposals ───────────────────────────────────────────
CREATE POLICY "proposals: admin ser och hanterar alla"
  ON match_proposals FOR ALL
  USING (get_my_role() = 'admin');

-- ── mail_error_log ────────────────────────────────────────────
CREATE POLICY "mail_errors: admin ser alla"
  ON mail_error_log FOR ALL
  USING (get_my_role() = 'admin');

-- ── assignment_bank VIEW — tillgänglig för godkända lärare ───
-- (VIEW ärver inte RLS automatiskt — säkras via API-lager
--  som kontrollerar teacher.status = approved)
