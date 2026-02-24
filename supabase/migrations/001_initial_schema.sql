-- ============================================================
-- LeadFlow CRM — Schéma initial
-- ============================================================

-- ------------------------------------------------------------
-- 1. FONCTION TRIGGER updated_at
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
-- 2. TABLES
-- ------------------------------------------------------------

-- Contacts
create table public.contacts (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  first_name  text        not null,
  last_name   text,
  email       text[],
  phone       text[],
  company     text,
  job_title   text,
  address     text,
  city        text,
  country     text,
  tags        text[],
  notes       text,
  photo_url   text,
  linkedin_url text,
  twitter_url text,
  website     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Pipelines
create table public.pipelines (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  name        text        not null,
  description text,
  created_at  timestamptz not null default now()
);

-- Étapes d'un pipeline
create table public.pipeline_stages (
  id          uuid        primary key default gen_random_uuid(),
  pipeline_id uuid        not null references public.pipelines on delete cascade,
  name        text        not null,
  color       text        not null default '#6366f1',
  position    integer     not null,
  created_at  timestamptz not null default now(),
  unique(pipeline_id, position)
);

-- Association contact <-> pipeline avec étape courante
create table public.contact_pipeline (
  id          uuid        primary key default gen_random_uuid(),
  contact_id  uuid        not null references public.contacts on delete cascade,
  pipeline_id uuid        not null references public.pipelines on delete cascade,
  stage_id    uuid        references public.pipeline_stages on delete set null,
  value       numeric,
  updated_at  timestamptz not null default now(),
  unique(contact_id, pipeline_id)
);

-- Historique des changements d'étape
create table public.pipeline_history (
  id            uuid        primary key default gen_random_uuid(),
  contact_id    uuid        not null references public.contacts on delete cascade,
  pipeline_id   uuid        not null references public.pipelines on delete cascade,
  from_stage_id uuid        references public.pipeline_stages on delete set null,
  to_stage_id   uuid        references public.pipeline_stages on delete set null,
  changed_at    timestamptz not null default now()
);

-- Enrichissements IA
create table public.ai_enrichments (
  id         uuid        primary key default gen_random_uuid(),
  contact_id uuid        not null references public.contacts on delete cascade,
  type       text        not null check (type in ('contact_profile', 'company_news')),
  content    text        not null,
  model      text,
  created_at timestamptz not null default now()
);

-- Paramètres Notion
create table public.notion_config (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null unique references auth.users on delete cascade,
  database_id   text        not null,
  field_mapping jsonb       not null default '{}',
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. TRIGGERS updated_at
-- ------------------------------------------------------------

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger contact_pipeline_set_updated_at
  before update on public.contact_pipeline
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. INDEX DE PERFORMANCE
-- ------------------------------------------------------------

-- contacts
create index idx_contacts_user_id
  on public.contacts (user_id);

create index idx_contacts_company
  on public.contacts (user_id, company)
  where company is not null;

create index idx_contacts_tags
  on public.contacts using gin (tags)
  where tags is not null;

create index idx_contacts_created_at
  on public.contacts (user_id, created_at desc);

-- pipelines
create index idx_pipelines_user_id
  on public.pipelines (user_id);

-- pipeline_stages
create index idx_pipeline_stages_pipeline_position
  on public.pipeline_stages (pipeline_id, position);

-- contact_pipeline
create index idx_contact_pipeline_contact_id
  on public.contact_pipeline (contact_id);

create index idx_contact_pipeline_pipeline_stage
  on public.contact_pipeline (pipeline_id, stage_id);

-- pipeline_history
create index idx_pipeline_history_contact_id
  on public.pipeline_history (contact_id, changed_at desc);

create index idx_pipeline_history_pipeline_id
  on public.pipeline_history (pipeline_id, changed_at desc);

-- ai_enrichments
create index idx_ai_enrichments_contact_created
  on public.ai_enrichments (contact_id, created_at desc);

-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.contacts         enable row level security;
alter table public.pipelines        enable row level security;
alter table public.pipeline_stages  enable row level security;
alter table public.contact_pipeline enable row level security;
alter table public.pipeline_history enable row level security;
alter table public.ai_enrichments   enable row level security;
alter table public.notion_config    enable row level security;

-- contacts : propriétaire uniquement
create policy "contacts_owner" on public.contacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pipelines : propriétaire uniquement
create policy "pipelines_owner" on public.pipelines
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pipeline_stages : via appartenance au pipeline
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
create policy "notion_config_owner" on public.notion_config
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
