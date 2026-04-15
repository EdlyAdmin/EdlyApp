-- ============================================================
-- Edly — Komplett schema (kör denna på nytt Supabase-projekt)
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('family', 'teacher', 'admin');
CREATE TYPE teacher_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE subject AS ENUM ('svenska', 'matte', 'engelska');
CREATE TYPE group_status AS ENUM ('active', 'closed');
CREATE TYPE proposal_status AS ENUM ('pending', 'approved', 'rejected');

-- ── Tabeller ─────────────────────────────────────────────────

CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE families (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_name TEXT NOT NULL,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE children (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id               UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  name                    TEXT NOT NULL,
  birthdate               DATE NOT NULL,
  subjects                subject[] NOT NULL,
  diagnoses               TEXT[] NOT NULL DEFAULT '{}',
  diagnosis_other         TEXT,
  extra_info              TEXT,
  membership_consented_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE consent_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  policy_version TEXT NOT NULL DEFAULT '1.0',
  consented_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE teachers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  motivation          TEXT,
  subjects_can        subject[] NOT NULL,
  subjects_blocked    subject[] NOT NULL DEFAULT '{}',
  max_groups          INT NOT NULL DEFAULT 2 CHECK (max_groups BETWEEN 1 AND 10),
  status              teacher_status NOT NULL DEFAULT 'pending',
  notify_new_children BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE RESTRICT NOT NULL,
  status     group_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  child_id   UUID REFERENCES children(id) ON DELETE RESTRICT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE match_proposals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL UNIQUE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE RESTRICT NOT NULL,
  status     proposal_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE mail_error_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,
  recipient  TEXT NOT NULL,
  error      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved   BOOLEAN NOT NULL DEFAULT false
);

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX idx_children_created_at ON children(created_at);
CREATE INDEX idx_children_subjects   ON children USING GIN(subjects);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_groups_teacher      ON groups(teacher_id);
CREATE INDEX idx_proposals_status    ON match_proposals(status);
CREATE INDEX idx_teachers_status     ON teachers(status);

-- ── Vy för uppdragsbanken ────────────────────────────────────
CREATE VIEW assignment_bank AS
  SELECT c.id, c.birthdate, c.subjects, c.diagnoses, c.created_at
  FROM children c
  WHERE c.id NOT IN (SELECT child_id FROM group_members)
    AND c.id NOT IN (
      SELECT child_id FROM match_proposals WHERE status = 'approved'
    );

-- ── Trigger: skapa profil vid ny auth-användare ───────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role)
  VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::user_role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE families       ENABLE ROW LEVEL SECURITY;
ALTER TABLE children       ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_error_log  ENABLE ROW LEVEL SECURITY;

-- Hjälpfunktioner
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_teacher_id()
RETURNS UUID AS $$
  SELECT id FROM teachers WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── profiles ──────────────────────────────────────────────────
CREATE POLICY "profiles: läs egen profil"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "profiles: uppdatera egen profil"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ── families ──────────────────────────────────────────────────
CREATE POLICY "families: familjen ser sin egen"
  ON families FOR SELECT
  USING (profile_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "families: familjen skapar sin"
  ON families FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "families: familjen uppdaterar sin"
  ON families FOR UPDATE
  USING (profile_id = auth.uid());

-- ── children ──────────────────────────────────────────────────
CREATE POLICY "children: familjen ser sina barn"
  ON children FOR SELECT
  USING (
    family_id IN (SELECT id FROM families WHERE profile_id = auth.uid())
    OR get_my_role() = 'admin'
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

-- ── teachers ──────────────────────────────────────────────────
CREATE POLICY "teachers: läraren ser sig själv, admin ser alla"
  ON teachers FOR SELECT
  USING (profile_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "teachers: läraren skapar sin profil"
  ON teachers FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- OBS: Ingen WITH CHECK med subquery på teachers (undviker rekursion)
CREATE POLICY "teachers: läraren uppdaterar sin profil"
  ON teachers FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "teachers: admin uppdaterar status"
  ON teachers FOR UPDATE
  USING (get_my_role() = 'admin');

-- ── groups ────────────────────────────────────────────────────
CREATE POLICY "groups: läraren ser sina grupper, admin ser alla"
  ON groups FOR SELECT
  USING (teacher_id = get_my_teacher_id() OR get_my_role() = 'admin');

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
    group_id IN (SELECT id FROM groups WHERE teacher_id = get_my_teacher_id())
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
