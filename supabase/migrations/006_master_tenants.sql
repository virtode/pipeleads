-- Migration 006 : Master Supabase project — tables for multi-tenant registry
--
-- Ce fichier est destiné AU PROJET SUPABASE MASTER uniquement.
-- Il NE doit PAS être appliqué aux projets Supabase par tenant.
--
-- Tables :
--   - tenants       : registre de tous les clients (slug → credentials Supabase)
--   - admin_users   : utilisateurs autorisés à accéder au backoffice /admin
--
-- Accès : uniquement via la service role key (RLS activé, aucune policy public).
-- ---------------------------------------------------------------------------

-- Tenants registry
create table if not exists tenants (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,          -- ex: "client1"
  name                    text not null,                 -- nom de l'entreprise
  supabase_url            text not null,
  supabase_anon_key       text not null,
  supabase_service_role_key text not null,
  manager_email           text,                          -- email du premier manager (optionnel)
  is_active               boolean not null default true,
  created_at              timestamptz not null default now()
);

-- Backoffice admin users
create table if not exists admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- RLS : activer mais n'exposer aucune donnée sans service role key
alter table tenants     enable row level security;
alter table admin_users enable row level security;

-- Aucune policy publique — seule la service role key bypasse RLS.
-- Les clients ne peuvent pas accéder directement au master.
