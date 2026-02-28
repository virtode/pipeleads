-- Migration 005 : Supabase Auth natif
--
-- Contexte :
--   - Migration 002 : user_id converti en text (pour Stytch IDs) + FK auth.users supprimée
--   - Migration 004 : toutes les policies RLS ouvertes (using true) car JWKS Stytch
--     nécessitait Supabase Pro
--
-- Objectif :
--   - Supprimer les policies "open" créées en 004
--   - Restaurer des policies propres basées sur auth.uid()::text = user_id
--     (user_id reste text, auth.uid() est un UUID → cast nécessaire)
--   - Les nouvelles données auront un user_id = auth.uid()::text (UUID sous forme text)
-- ---------------------------------------------------------------------------

-- contacts
drop policy if exists "contacts_open" on contacts;
create policy "own data" on contacts
  for all using (auth.uid()::text = user_id);

-- pipelines
drop policy if exists "pipelines_open" on pipelines;
create policy "own data" on pipelines
  for all using (auth.uid()::text = user_id);

-- pipeline_stages (filtre via pipelines)
drop policy if exists "pipeline_stages_open" on pipeline_stages;
create policy "own stages" on pipeline_stages
  for all using (
    pipeline_id in (select id from pipelines where auth.uid()::text = user_id)
  );

-- contact_pipeline (filtre via contacts)
drop policy if exists "contact_pipeline_open" on contact_pipeline;
create policy "own data" on contact_pipeline
  for all using (
    contact_id in (select id from contacts where auth.uid()::text = user_id)
  );

-- pipeline_history (filtre via contacts)
drop policy if exists "pipeline_history_open" on pipeline_history;
create policy "own data" on pipeline_history
  for all using (
    contact_id in (select id from contacts where auth.uid()::text = user_id)
  );

-- ai_enrichments (filtre via contacts)
drop policy if exists "ai_enrichments_open" on ai_enrichments;
create policy "own data" on ai_enrichments
  for all using (
    contact_id in (select id from contacts where auth.uid()::text = user_id)
  );

-- notion_config
drop policy if exists "notion_config_open" on notion_config;
create policy "own data" on notion_config
  for all using (auth.uid()::text = user_id);
