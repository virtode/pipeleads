-- ============================================================
-- Migration 002 — Compatibilité auth Stytch
-- ============================================================
-- ORDRE OBLIGATOIRE :
--   1. Supprimer les policies (elles dépendent de user_id)
--   2. Supprimer les FK vers auth.users
--   3. Modifier le type de user_id (uuid → text)
--   4. Recréer les index
--   5. Recréer les policies avec auth.jwt() ->> 'sub'
--
-- SETUP REQUIS dans le dashboard Supabase après cette migration :
--   Authentication → Sign In / Up → Third-Party Auth
--   → Add provider → Custom (JWKS)
--   → JWKS URL : https://test.stytch.com/v1/sessions/jwks/{STYTCH_PROJECT_ID}
--   (remplacer "test" par "live" en production)
-- ============================================================

-- ============================================================
-- 1. SUPPRIMER LES POLICIES (dépendent de user_id)
-- ============================================================

drop policy if exists "contacts_owner"         on public.contacts;
drop policy if exists "pipelines_owner"        on public.pipelines;
drop policy if exists "pipeline_stages_owner"  on public.pipeline_stages;
drop policy if exists "contact_pipeline_owner" on public.contact_pipeline;
drop policy if exists "pipeline_history_owner" on public.pipeline_history;
drop policy if exists "ai_enrichments_owner"   on public.ai_enrichments;
drop policy if exists "notion_config_owner"    on public.notion_config;

-- anciens noms au cas où la migration 001 utilisait d'autres noms
drop policy if exists "own data"   on public.contacts;
drop policy if exists "own data"   on public.pipelines;
drop policy if exists "own stages" on public.pipeline_stages;
drop policy if exists "own data"   on public.contact_pipeline;
drop policy if exists "own data"   on public.pipeline_history;
drop policy if exists "own data"   on public.ai_enrichments;
drop policy if exists "own data"   on public.notion_config;

-- ============================================================
-- 2. SUPPRIMER LES FK VERS auth.users
-- ============================================================

alter table public.contacts      drop constraint if exists contacts_user_id_fkey;
alter table public.pipelines     drop constraint if exists pipelines_user_id_fkey;
alter table public.notion_config drop constraint if exists notion_config_user_id_fkey;

-- ============================================================
-- 3. MODIFIER user_id : uuid → text
-- ============================================================

alter table public.contacts      alter column user_id type text using user_id::text;
alter table public.pipelines     alter column user_id type text using user_id::text;
alter table public.notion_config alter column user_id type text using user_id::text;

-- ============================================================
-- 4. RECRÉER LES INDEX
-- ============================================================

drop index if exists idx_contacts_user_id;
drop index if exists idx_pipelines_user_id;

create index idx_contacts_user_id  on public.contacts  (user_id);
create index idx_pipelines_user_id on public.pipelines (user_id);

-- ============================================================
-- 5. RECRÉER LES POLICIES (basées sur auth.jwt() ->> 'sub')
-- ============================================================

create policy "contacts_owner" on public.contacts
  for all
  using  ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "pipelines_owner" on public.pipelines
  for all
  using  ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "pipeline_stages_owner" on public.pipeline_stages
  for all
  using (
    pipeline_id in (
      select id from public.pipelines where user_id = (auth.jwt() ->> 'sub')
    )
  )
  with check (
    pipeline_id in (
      select id from public.pipelines where user_id = (auth.jwt() ->> 'sub')
    )
  );

create policy "contact_pipeline_owner" on public.contact_pipeline
  for all
  using (
    contact_id in (
      select id from public.contacts where user_id = (auth.jwt() ->> 'sub')
    )
  )
  with check (
    contact_id in (
      select id from public.contacts where user_id = (auth.jwt() ->> 'sub')
    )
  );

create policy "pipeline_history_owner" on public.pipeline_history
  for all
  using (
    contact_id in (
      select id from public.contacts where user_id = (auth.jwt() ->> 'sub')
    )
  )
  with check (
    contact_id in (
      select id from public.contacts where user_id = (auth.jwt() ->> 'sub')
    )
  );

create policy "ai_enrichments_owner" on public.ai_enrichments
  for all
  using (
    contact_id in (
      select id from public.contacts where user_id = (auth.jwt() ->> 'sub')
    )
  )
  with check (
    contact_id in (
      select id from public.contacts where user_id = (auth.jwt() ->> 'sub')
    )
  );

create policy "notion_config_owner" on public.notion_config
  for all
  using  ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);
