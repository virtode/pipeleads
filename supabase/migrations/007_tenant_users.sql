-- Migration 007 : Per-tenant Supabase project — table tenant_users
--
-- Ce fichier est destiné à CHAQUE PROJET SUPABASE TENANT.
-- Il doit être appliqué lors de l'onboarding d'un nouveau client.
--
-- La table tenant_users gère les rôles des utilisateurs au sein d'un tenant :
--   - 'manager' : accès complet + gestion de l'équipe
--   - 'member'  : accès en lecture/écriture aux données CRM
-- ---------------------------------------------------------------------------

create table if not exists tenant_users (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  role        text not null check (role in ('manager', 'member')),
  invited_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  unique (user_id)
);

alter table tenant_users enable row level security;

-- Un utilisateur peut voir sa propre entrée
create policy "own row" on tenant_users
  for select using (auth.uid() = user_id);

-- Un manager peut voir toutes les entrées du tenant
create policy "manager sees all" on tenant_users
  for select using (
    exists (
      select 1 from tenant_users tu
      where tu.user_id = auth.uid()
        and tu.role = 'manager'
    )
  );

-- Seule la service role key peut insérer/modifier/supprimer
-- (les mutations passent par les API routes backend qui utilisent la service role key)
