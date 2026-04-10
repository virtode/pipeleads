-- ============================================================
-- 012_carddav_password.sql
-- Ajout du mot de passe CardDAV sur tenant_users
-- Ce champ persiste le mot de passe htpasswd Radicale pour
-- permettre à initialSync() de reprovisioner automatiquement
-- les tenants existants au démarrage du sync-service.
-- ============================================================

ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS carddav_password text;
