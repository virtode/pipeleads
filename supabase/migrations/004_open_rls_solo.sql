-- ============================================================
-- Migration 004 — Open RLS policies for solo personal app
-- ============================================================
-- The JWT-based policies in 002 require Supabase Pro (JWKS provider).
-- Since this is a single-user personal app, Stytch handles auth at
-- the application level. RLS is kept enabled but made permissive so
-- the anon key client can read/write without a validated JWT.
-- ============================================================

drop policy if exists "contacts_owner"         on public.contacts;
drop policy if exists "pipelines_owner"        on public.pipelines;
drop policy if exists "pipeline_stages_owner"  on public.pipeline_stages;
drop policy if exists "contact_pipeline_owner" on public.contact_pipeline;
drop policy if exists "pipeline_history_owner" on public.pipeline_history;
drop policy if exists "ai_enrichments_owner"   on public.ai_enrichments;
drop policy if exists "notion_config_owner"    on public.notion_config;

create policy "contacts_open"         on public.contacts         for all using (true) with check (true);
create policy "pipelines_open"        on public.pipelines        for all using (true) with check (true);
create policy "pipeline_stages_open"  on public.pipeline_stages  for all using (true) with check (true);
create policy "contact_pipeline_open" on public.contact_pipeline for all using (true) with check (true);
create policy "pipeline_history_open" on public.pipeline_history for all using (true) with check (true);
create policy "ai_enrichments_open"   on public.ai_enrichments   for all using (true) with check (true);
create policy "notion_config_open"    on public.notion_config    for all using (true) with check (true);
