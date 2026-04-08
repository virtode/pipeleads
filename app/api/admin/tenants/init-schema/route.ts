import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const InitSchemaSchema = z.object({
  supabase_url: z.string().url(),
  service_role_key: z.string().min(10),
})

// ─────────────────────────────────────────────────────────────
// Migrations tenant — ordre : 001 → 003 → 005 → 007
//
// 002 (Stytch) et 004 (RLS open) sont volontairement exclus :
//   ils ont été remplacés par 005 (Supabase Auth natif).
// 006 (master registry) appartient au projet master uniquement.
//
// Toutes les instructions sont idempotentes (IF NOT EXISTS,
// DROP … IF EXISTS avant CREATE, CREATE OR REPLACE).
// ─────────────────────────────────────────────────────────────

const MIGRATION_001 = /* sql */ `
-- ════════════════════════════════════════════════════════════
-- 001 — Schéma initial PipeLeads (idempotent)
-- ════════════════════════════════════════════════════════════

-- 1. Fonction trigger updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Tables
create table if not exists public.contacts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      text        not null,
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

create table if not exists public.pipelines (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,
  name        text        not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.pipeline_stages (
  id          uuid        primary key default gen_random_uuid(),
  pipeline_id uuid        not null references public.pipelines on delete cascade,
  name        text        not null,
  color       text        not null default '#6366f1',
  position    integer     not null,
  created_at  timestamptz not null default now(),
  unique (pipeline_id, position)
);

create table if not exists public.contact_pipeline (
  id          uuid        primary key default gen_random_uuid(),
  contact_id  uuid        not null references public.contacts on delete cascade,
  pipeline_id uuid        not null references public.pipelines on delete cascade,
  stage_id    uuid        references public.pipeline_stages on delete set null,
  value       numeric,
  updated_at  timestamptz not null default now(),
  unique (contact_id, pipeline_id)
);

create table if not exists public.pipeline_history (
  id            uuid        primary key default gen_random_uuid(),
  contact_id    uuid        not null references public.contacts on delete cascade,
  pipeline_id   uuid        not null references public.pipelines on delete cascade,
  from_stage_id uuid        references public.pipeline_stages on delete set null,
  to_stage_id   uuid        references public.pipeline_stages on delete set null,
  changed_at    timestamptz not null default now()
);

create table if not exists public.ai_enrichments (
  id         uuid        primary key default gen_random_uuid(),
  contact_id uuid        not null references public.contacts on delete cascade,
  type       text        not null check (type in ('contact_profile', 'company_news')),
  content    text        not null,
  model      text,
  created_at timestamptz not null default now()
);

create table if not exists public.notion_config (
  id            uuid        primary key default gen_random_uuid(),
  user_id       text        not null unique,
  database_id   text        not null,
  field_mapping jsonb       not null default '{}',
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- 3. Triggers updated_at (idempotents via DROP IF EXISTS)
drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

drop trigger if exists contact_pipeline_set_updated_at on public.contact_pipeline;
create trigger contact_pipeline_set_updated_at
  before update on public.contact_pipeline
  for each row execute function public.set_updated_at();

-- 4. Index de performance
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

-- 5. Row Level Security (activer est idempotent)
alter table public.contacts         enable row level security;
alter table public.pipelines        enable row level security;
alter table public.pipeline_stages  enable row level security;
alter table public.contact_pipeline enable row level security;
alter table public.pipeline_history enable row level security;
alter table public.ai_enrichments   enable row level security;
alter table public.notion_config    enable row level security;
`

const MIGRATION_003 = /* sql */ `
-- ════════════════════════════════════════════════════════════
-- 003 — Colonne encrypted_token dans notion_config (idempotent)
-- ════════════════════════════════════════════════════════════
alter table public.notion_config
  add column if not exists encrypted_token text;
`

const MIGRATION_005 = /* sql */ `
-- ════════════════════════════════════════════════════════════
-- 005 — Policies RLS basées sur auth.uid() (Supabase Auth natif)
-- ════════════════════════════════════════════════════════════

-- Supprimer toutes les policies existantes (nettoyage idempotent)
drop policy if exists "contacts_open"         on public.contacts;
drop policy if exists "contacts_owner"        on public.contacts;
drop policy if exists "own data"              on public.contacts;

drop policy if exists "pipelines_open"        on public.pipelines;
drop policy if exists "pipelines_owner"       on public.pipelines;
drop policy if exists "own data"              on public.pipelines;

drop policy if exists "pipeline_stages_open"  on public.pipeline_stages;
drop policy if exists "pipeline_stages_owner" on public.pipeline_stages;
drop policy if exists "own stages"            on public.pipeline_stages;

drop policy if exists "contact_pipeline_open"  on public.contact_pipeline;
drop policy if exists "contact_pipeline_owner" on public.contact_pipeline;
drop policy if exists "own data"               on public.contact_pipeline;

drop policy if exists "pipeline_history_open"  on public.pipeline_history;
drop policy if exists "pipeline_history_owner" on public.pipeline_history;
drop policy if exists "own data"               on public.pipeline_history;

drop policy if exists "ai_enrichments_open"    on public.ai_enrichments;
drop policy if exists "ai_enrichments_owner"   on public.ai_enrichments;
drop policy if exists "own data"               on public.ai_enrichments;

drop policy if exists "notion_config_open"     on public.notion_config;
drop policy if exists "notion_config_owner"    on public.notion_config;
drop policy if exists "own data"               on public.notion_config;

-- Recréer les policies (auth.uid()::text = user_id)
create policy "own data" on public.contacts
  for all using (auth.uid()::text = user_id);

create policy "own data" on public.pipelines
  for all using (auth.uid()::text = user_id);

create policy "own stages" on public.pipeline_stages
  for all using (
    pipeline_id in (select id from public.pipelines where auth.uid()::text = user_id)
  );

create policy "own data" on public.contact_pipeline
  for all using (
    contact_id in (select id from public.contacts where auth.uid()::text = user_id)
  );

create policy "own data" on public.pipeline_history
  for all using (
    contact_id in (select id from public.contacts where auth.uid()::text = user_id)
  );

create policy "own data" on public.ai_enrichments
  for all using (
    contact_id in (select id from public.contacts where auth.uid()::text = user_id)
  );

create policy "own data" on public.notion_config
  for all using (auth.uid()::text = user_id);
`

const MIGRATION_007 = /* sql */ `
-- ════════════════════════════════════════════════════════════
-- 007 — Table tenant_users (gestion des rôles par tenant)
-- ════════════════════════════════════════════════════════════

create table if not exists public.tenant_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('manager', 'member')),
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.tenant_users enable row level security;

-- Policies (idempotentes via DROP IF EXISTS)
drop policy if exists "own row"         on public.tenant_users;
drop policy if exists "manager sees all" on public.tenant_users;

create policy "own row" on public.tenant_users
  for select using (auth.uid() = user_id);

create policy "manager sees all" on public.tenant_users
  for select using (
    exists (
      select 1 from public.tenant_users tu
      where tu.user_id = auth.uid()
        and tu.role = 'manager'
    )
  );
`

interface MigrationResult {
  name: string
  status: 'ok' | 'error'
  error?: string
}

/**
 * Exécute une requête SQL sur une instance Supabase via l'API postgres-meta
 * exposée par Kong sous /pg/query.
 *
 * Nécessite la service_role_key pour l'authentification.
 * Disponible en self-hosted (Kong) et sur les projets Supabase cloud.
 */
async function executeSql(
  supabaseUrl: string,
  serviceRoleKey: string,
  sql: string
): Promise<void> {
  const base = supabaseUrl.replace(/\/$/, '')
  const endpoint = `${base}/pg/query`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase Kong accepte les deux formes d'authentification
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(body)
  }

  const json = (await res.json()) as { error?: string }
  if (json.error) {
    throw new Error(json.error)
  }
}

/**
 * POST /api/admin/tenants/init-schema
 *
 * Applique le schéma PipeLeads complet sur l'instance Supabase d'un tenant.
 * Les migrations sont exécutées dans l'ordre et sont idempotentes.
 *
 * Body : { supabase_url: string, service_role_key: string }
 *
 * Réponse 200 : { data: { results: MigrationResult[] } }
 * Réponse 207 : { data: { results }, error: string }  — erreurs partielles
 * Réponse 422 : { error: string }                     — payload invalide
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = InitSchemaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { supabase_url, service_role_key } = parsed.data

  const migrations: Array<{ name: string; sql: string }> = [
    { name: '001_initial_schema', sql: MIGRATION_001 },
    { name: '003_notion_token',   sql: MIGRATION_003 },
    { name: '005_supabase_auth',  sql: MIGRATION_005 },
    { name: '007_tenant_users',   sql: MIGRATION_007 },
  ]

  const results: MigrationResult[] = []

  for (const migration of migrations) {
    try {
      await executeSql(supabase_url, service_role_key, migration.sql)
      results.push({ name: migration.name, status: 'ok' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[init-schema] ${migration.name} failed:`, message)
      results.push({ name: migration.name, status: 'error', error: message })
      // On continue malgré l'erreur pour appliquer un maximum de migrations
    }
  }

  const failed = results.filter((r) => r.status === 'error')

  if (failed.length > 0) {
    return NextResponse.json(
      { data: { results }, error: `${failed.length} migration(s) en échec` },
      { status: 207 }
    )
  }

  return NextResponse.json({ data: { results } })
}
