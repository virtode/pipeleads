/**
 * Schéma SQL à appliquer sur chaque nouveau projet Supabase tenant.
 * Utilise l'auth native Supabase (auth.uid() = user_id en uuid).
 * Compatible PostgreSQL 15+ (Supabase).
 */
export const TENANT_SCHEMA_SQL = /* sql */ `
-- ============================================================
-- PipeLeads — Schéma tenant
-- Appliqué lors de l'onboarding d'un nouveau client.
-- ============================================================

-- ------------------------------------------------------------
-- FONCTION TRIGGER updated_at
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

-- Gestion des rôles utilisateur dans le tenant
create table if not exists public.tenant_users (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  role       text        not null check (role in ('manager', 'member')),
  invited_by uuid        references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- Contacts
create table if not exists public.contacts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users on delete cascade,
  first_name   text        not null,
  last_name    text,
  email        text[],
  phone        text[],
  company      text,
  job_title    text,
  address      text,
  city         text,
  country      text,
  tags         text[],
  notes        text,
  photo_url    text,
  linkedin_url text,
  twitter_url  text,
  website      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Pipelines
create table if not exists public.pipelines (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  name        text        not null,
  description text,
  created_at  timestamptz not null default now()
);

-- Étapes d'un pipeline
create table if not exists public.pipeline_stages (
  id          uuid        primary key default gen_random_uuid(),
  pipeline_id uuid        not null references public.pipelines on delete cascade,
  name        text        not null,
  color       text        not null default '#6366f1',
  position    integer     not null,
  created_at  timestamptz not null default now(),
  unique(pipeline_id, position)
);

-- Association contact <-> pipeline avec étape courante
create table if not exists public.contact_pipeline (
  id          uuid        primary key default gen_random_uuid(),
  contact_id  uuid        not null references public.contacts on delete cascade,
  pipeline_id uuid        not null references public.pipelines on delete cascade,
  stage_id    uuid        references public.pipeline_stages on delete set null,
  value       numeric,
  updated_at  timestamptz not null default now(),
  unique(contact_id, pipeline_id)
);

-- Historique des changements d'étape
create table if not exists public.pipeline_history (
  id            uuid        primary key default gen_random_uuid(),
  contact_id    uuid        not null references public.contacts on delete cascade,
  pipeline_id   uuid        not null references public.pipelines on delete cascade,
  from_stage_id uuid        references public.pipeline_stages on delete set null,
  to_stage_id   uuid        references public.pipeline_stages on delete set null,
  changed_at    timestamptz not null default now()
);

-- Enrichissements IA
create table if not exists public.ai_enrichments (
  id         uuid        primary key default gen_random_uuid(),
  contact_id uuid        not null references public.contacts on delete cascade,
  type       text        not null check (type in ('contact_profile', 'company_news')),
  content    text        not null,
  model      text,
  created_at timestamptz not null default now()
);

-- Paramètres Notion
create table if not exists public.notion_config (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null unique references auth.users on delete cascade,
  database_id   text        not null,
  field_mapping jsonb       not null default '{}',
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TRIGGERS updated_at
-- ------------------------------------------------------------

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

drop trigger if exists contact_pipeline_set_updated_at on public.contact_pipeline;
create trigger contact_pipeline_set_updated_at
  before update on public.contact_pipeline
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- INDEX DE PERFORMANCE
-- ------------------------------------------------------------

create index if not exists idx_contacts_user_id
  on public.contacts (user_id);

create index if not exists idx_contacts_company
  on public.contacts (user_id, company)
  where company is not null;

create index if not exists idx_contacts_tags
  on public.contacts using gin (tags)
  where tags is not null;

create index if not exists idx_contacts_created_at
  on public.contacts (user_id, created_at desc);

create index if not exists idx_pipelines_user_id
  on public.pipelines (user_id);

create index if not exists idx_pipeline_stages_pipeline_position
  on public.pipeline_stages (pipeline_id, position);

create index if not exists idx_contact_pipeline_contact_id
  on public.contact_pipeline (contact_id);

create index if not exists idx_contact_pipeline_pipeline_stage
  on public.contact_pipeline (pipeline_id, stage_id);

create index if not exists idx_pipeline_history_contact_id
  on public.pipeline_history (contact_id, changed_at desc);

create index if not exists idx_pipeline_history_pipeline_id
  on public.pipeline_history (pipeline_id, changed_at desc);

create index if not exists idx_ai_enrichments_contact_created
  on public.ai_enrichments (contact_id, created_at desc);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.tenant_users     enable row level security;
alter table public.contacts         enable row level security;
alter table public.pipelines        enable row level security;
alter table public.pipeline_stages  enable row level security;
alter table public.contact_pipeline enable row level security;
alter table public.pipeline_history enable row level security;
alter table public.ai_enrichments   enable row level security;
alter table public.notion_config    enable row level security;

-- tenant_users : un utilisateur voit sa propre ligne
drop policy if exists "own row" on public.tenant_users;
create policy "own row" on public.tenant_users
  for select using (auth.uid() = user_id);

-- tenant_users : un manager voit toutes les entrées
drop policy if exists "manager sees all" on public.tenant_users;
create policy "manager sees all" on public.tenant_users
  for select using (
    exists (
      select 1 from public.tenant_users tu
      where tu.user_id = auth.uid()
        and tu.role = 'manager'
    )
  );

-- contacts : propriétaire uniquement
drop policy if exists "contacts_owner" on public.contacts;
create policy "contacts_owner" on public.contacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pipelines : propriétaire uniquement
drop policy if exists "pipelines_owner" on public.pipelines;
create policy "pipelines_owner" on public.pipelines
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pipeline_stages : via appartenance au pipeline
drop policy if exists "pipeline_stages_owner" on public.pipeline_stages;
create policy "pipeline_stages_owner" on public.pipeline_stages
  for all
  using (
    pipeline_id in (
      select id from public.pipelines where user_id = auth.uid()
    )
  )
  with check (
    pipeline_id in (
      select id from public.pipelines where user_id = auth.uid()
    )
  );

-- contact_pipeline : via appartenance au contact
drop policy if exists "contact_pipeline_owner" on public.contact_pipeline;
create policy "contact_pipeline_owner" on public.contact_pipeline
  for all
  using (
    contact_id in (
      select id from public.contacts where user_id = auth.uid()
    )
  )
  with check (
    contact_id in (
      select id from public.contacts where user_id = auth.uid()
    )
  );

-- pipeline_history : via appartenance au contact
drop policy if exists "pipeline_history_owner" on public.pipeline_history;
create policy "pipeline_history_owner" on public.pipeline_history
  for all
  using (
    contact_id in (
      select id from public.contacts where user_id = auth.uid()
    )
  )
  with check (
    contact_id in (
      select id from public.contacts where user_id = auth.uid()
    )
  );

-- ai_enrichments : via appartenance au contact
drop policy if exists "ai_enrichments_owner" on public.ai_enrichments;
create policy "ai_enrichments_owner" on public.ai_enrichments
  for all
  using (
    contact_id in (
      select id from public.contacts where user_id = auth.uid()
    )
  )
  with check (
    contact_id in (
      select id from public.contacts where user_id = auth.uid()
    )
  );

-- notion_config : propriétaire uniquement
drop policy if exists "notion_config_owner" on public.notion_config;
create policy "notion_config_owner" on public.notion_config
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
`
