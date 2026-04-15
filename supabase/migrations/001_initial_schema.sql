-- ============================================================
-- Edly Matchningssystem — Initial Schema
-- ============================================================

-- Enums
CREATE TYPE user_role AS ENUM ('family', 'teacher', 'admin');
CREATE TYPE teacher_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE subject AS ENUM ('svenska', 'matte', 'engelska');
CREATE TYPE diagnosis AS ENUM ('dyslexi', 'dyskalkyli', 'båda', 'ingen');
CREATE TYPE group_status AS ENUM ('active', 'closed');
CREATE TYPE proposal_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles (kopplad till Supabase Auth)
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Families
CREATE TABLE families (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_name TEXT NOT NULL,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Children
CREATE TABLE children (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  age         INT NOT NULL CHECK (age BETWEEN 5 AND 20),
  subjects    subject[] NOT NULL,
  diagnosis   diagnosis NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL -- används för FCFS-kö
);

-- Consent log (GDPR)
CREATE TABLE consent_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  policy_version TEXT NOT NULL DEFAULT '1.0',
  consented_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Teachers
CREATE TABLE teachers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  subjects_can     subject[] NOT NULL,
  subjects_blocked subject[] NOT NULL DEFAULT '{}',
  max_groups       INT NOT NULL DEFAULT 2 CHECK (max_groups BETWEEN 1 AND 10),
  status           teacher_status NOT NULL DEFAULT 'pending',
  notify_new_children BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Groups (fasta grupper)
CREATE TABLE groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE RESTRICT NOT NULL,
  status     group_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Group members (max 3 barn per grupp — begränsningen hanteras i applikationslogiken)
CREATE TABLE group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  child_id   UUID REFERENCES children(id) ON DELETE RESTRICT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Match proposals
CREATE TABLE match_proposals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL UNIQUE,
  teacher_id  UUID REFERENCES teachers(id) ON DELETE RESTRICT NOT NULL,
  status      proposal_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Mail error log
CREATE TABLE mail_error_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL, -- 'intro' | 'teacher_notify' | 'welcome' | 'rejected' | 'new_child'
  recipient  TEXT NOT NULL,
  error      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved   BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- Index
-- ============================================================

CREATE INDEX idx_children_created_at  ON children(created_at);
CREATE INDEX idx_children_subjects    ON children USING GIN(subjects);
CREATE INDEX idx_children_diagnosis   ON children(diagnosis);
CREATE INDEX idx_group_members_group  ON group_members(group_id);
CREATE INDEX idx_groups_teacher       ON groups(teacher_id);
CREATE INDEX idx_proposals_status     ON match_proposals(status);
CREATE INDEX idx_teachers_status      ON teachers(status);

-- ============================================================
-- Anonymiserad vy för uppdragsbanken (lärare ser denna)
-- ============================================================

CREATE VIEW assignment_bank AS
  SELECT
    c.id,
    c.age,
    c.subjects,
    c.diagnosis,
    c.created_at
  FROM children c
  WHERE
    -- Inte redan i en grupp
    c.id NOT IN (SELECT child_id FROM group_members)
    -- Inte redan ett godkänt förslag
    AND c.id NOT IN (
      SELECT child_id FROM match_proposals WHERE status = 'approved'
    );

-- ============================================================
-- Trigger: skapa profil automatiskt vid ny auth-användare
-- ============================================================

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
