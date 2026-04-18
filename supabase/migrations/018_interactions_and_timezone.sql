-- ============================================================
-- 018_interactions_and_timezone.sql
-- Table interactions (notes + rappels unifiés) + timezone utilisateur
-- ============================================================

-- ── 1. Table profiles (extension auth.users) ────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone    text NOT NULL DEFAULT 'Europe/Paris',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Fonction de validation timezone via pg_timezone_names
CREATE OR REPLACE FUNCTION is_valid_timezone(tz text)
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = tz);
$$ LANGUAGE sql STABLE;

ALTER TABLE profiles
  ADD CONSTRAINT chk_valid_timezone CHECK (is_valid_timezone(timezone));

-- Trigger updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile select" ON profiles;
CREATE POLICY "own profile select" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "own profile update" ON profiles;
CREATE POLICY "own profile update" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "own profile insert" ON profiles;
CREATE POLICY "own profile insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ── 2. Table interactions ────────────────────────────────────

CREATE TABLE IF NOT EXISTS interactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id),
  contact_id       uuid        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type             text        NOT NULL CHECK (type IN ('note', 'reminder')),
  date             timestamptz NOT NULL,
  content          text        NOT NULL,
  action_template  text        NULL CHECK (
    action_template IN (
      'email_followup', 'call', 'linkedin_message',
      'propose_meeting', 'send_document', 'other'
    ) OR action_template IS NULL
  ),
  status           text        NULL CHECK (
    status IN ('pending', 'done') OR status IS NULL
  ),
  completed_at     timestamptz NULL,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_reminder_consistency CHECK (
    (type = 'reminder' AND status IS NOT NULL)
    OR
    (type = 'note' AND status IS NULL AND action_template IS NULL)
  )
);

-- Index performances
CREATE INDEX IF NOT EXISTS idx_interactions_contact_date
  ON interactions (tenant_id, contact_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_pending
  ON interactions (tenant_id, status, date)
  WHERE status = 'pending';

-- Trigger updated_at
DROP TRIGGER IF EXISTS interactions_updated_at ON interactions;
CREATE TRIGGER interactions_updated_at
  BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 3. RLS interactions ──────────────────────────────────────

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own interactions" ON interactions;
CREATE POLICY "own interactions" ON interactions FOR ALL USING (
  tenant_id IS NOT DISTINCT FROM current_tenant_id()
);
