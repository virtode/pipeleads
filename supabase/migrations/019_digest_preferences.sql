-- ============================================================
-- 019_digest_preferences.sql
-- Préférence digest quotidien + table d'idempotence
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS daily_digest_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS digest_sent (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date date        NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_date)
);

-- RLS activé — aucune policy publique : accès service role uniquement
ALTER TABLE digest_sent ENABLE ROW LEVEL SECURITY;
