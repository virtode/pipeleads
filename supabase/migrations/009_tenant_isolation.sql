-- ============================================================
-- 009_tenant_isolation.sql
-- Isolation mono-instance par tenant_id (RLS)
--
-- Abandonne le modèle "une instance Supabase par tenant" au
-- profit d'une isolation par tenant_id dans le Supabase master.
-- ============================================================

-- ── 1. Colonnes tenant_id sur toutes les tables métier ──────

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE contact_pipeline ADD COLUMN IF NOT EXISTS
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE pipeline_history ADD COLUMN IF NOT EXISTS
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE ai_enrichments ADD COLUMN IF NOT EXISTS
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE contact_files ADD COLUMN IF NOT EXISTS
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- ── 2. Index pour les performances ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id
  ON contacts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_pipelines_tenant_id
  ON pipelines(tenant_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_tenant_id
  ON pipeline_stages(tenant_id);

CREATE INDEX IF NOT EXISTS idx_contact_pipeline_tenant_id
  ON contact_pipeline(tenant_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_history_tenant_id
  ON pipeline_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_enrichments_tenant_id
  ON ai_enrichments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_contact_files_tenant_id
  ON contact_files(tenant_id);

-- ── 3. Fonction helper current_tenant_id() ──────────────────
--
-- Lit app.tenant_id depuis les paramètres de session PostgreSQL.
-- Retourne NULL si non défini (→ compte principal, domaine racine).

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT NULLIF(
    current_setting('app.tenant_id', true),
    ''
  )::uuid
$$ LANGUAGE sql STABLE;

-- ── 4. Mise à jour des policies RLS ─────────────────────────
--
-- Logique : tenant_id IS NOT DISTINCT FROM current_tenant_id()
-- couvre les deux cas :
--   - tenant_id IS NULL  ET  current_tenant_id() IS NULL  → compte principal
--   - tenant_id = uuid   ET  current_tenant_id() = même uuid → tenant isolé
--
-- On DROP et recrée pour être idempotent.

-- contacts
DROP POLICY IF EXISTS "own data" ON contacts;
CREATE POLICY "own data" ON contacts FOR ALL USING (
  auth.uid()::text = user_id
  AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
);

-- pipelines
DROP POLICY IF EXISTS "own data" ON pipelines;
CREATE POLICY "own data" ON pipelines FOR ALL USING (
  auth.uid()::text = user_id
  AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
);

-- pipeline_stages
DROP POLICY IF EXISTS "own stages" ON pipeline_stages;
CREATE POLICY "own stages" ON pipeline_stages FOR ALL USING (
  pipeline_id IN (
    SELECT id FROM pipelines
    WHERE user_id = auth.uid()::text
      AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
);

-- contact_pipeline
DROP POLICY IF EXISTS "own data" ON contact_pipeline;
CREATE POLICY "own data" ON contact_pipeline FOR ALL USING (
  contact_id IN (
    SELECT id FROM contacts
    WHERE user_id = auth.uid()::text
      AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
);

-- pipeline_history
DROP POLICY IF EXISTS "own data" ON pipeline_history;
CREATE POLICY "own data" ON pipeline_history FOR ALL USING (
  contact_id IN (
    SELECT id FROM contacts
    WHERE user_id = auth.uid()::text
      AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
);

-- ai_enrichments
DROP POLICY IF EXISTS "own data" ON ai_enrichments;
CREATE POLICY "own data" ON ai_enrichments FOR ALL USING (
  contact_id IN (
    SELECT id FROM contacts
    WHERE user_id = auth.uid()::text
      AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
);

-- contact_files (SELECT / INSERT / DELETE séparés)
DROP POLICY IF EXISTS "own contact files select" ON contact_files;
DROP POLICY IF EXISTS "own contact files insert" ON contact_files;
DROP POLICY IF EXISTS "own contact files delete" ON contact_files;

CREATE POLICY "own contact files select" ON contact_files FOR SELECT USING (
  contact_id IN (
    SELECT id FROM contacts
    WHERE user_id = auth.uid()::text
      AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
);

CREATE POLICY "own contact files insert" ON contact_files FOR INSERT WITH CHECK (
  contact_id IN (
    SELECT id FROM contacts
    WHERE user_id = auth.uid()::text
      AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
);

CREATE POLICY "own contact files delete" ON contact_files FOR DELETE USING (
  contact_id IN (
    SELECT id FROM contacts
    WHERE user_id = auth.uid()::text
      AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
);
