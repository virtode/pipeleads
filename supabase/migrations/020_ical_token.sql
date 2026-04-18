-- ============================================================
-- 020_ical_token.sql
-- Token de souscription iCal par utilisateur
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ical_token text UNIQUE;
