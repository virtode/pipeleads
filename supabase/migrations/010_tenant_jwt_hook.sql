-- ============================================================
-- 010_tenant_jwt_hook.sql
-- Isolation tenant via JWT claims (approche recommandée Supabase)
--
-- Remplace l'ancienne approche set_config / app.tenant_id
-- (qui ne persiste pas entre les connexions PostgREST poolées)
-- par une injection de tenant_id directement dans le JWT.
-- ============================================================

-- ── 1. Auth Hook : injecte tenant_id dans le JWT au login ───

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  tenant_rec record;
  user_id uuid;
BEGIN
  user_id := (event->>'user_id')::uuid;
  claims := event->'claims';

  -- Cherche si cet utilisateur est associé à un tenant via tenant_users
  SELECT tu.tenant_id INTO tenant_rec
  FROM public.tenant_users tu
  WHERE tu.user_id = user_id
  LIMIT 1;

  IF tenant_rec.tenant_id IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{tenant_id}',
      to_jsonb(tenant_rec.tenant_id::text)
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ── 2. Fonction helper current_tenant_id() ──────────────────
--
-- Lit tenant_id depuis le JWT (auth.jwt()->>'tenant_id')
-- au lieu de current_setting('app.tenant_id', true).
-- Retourne NULL si absent (compte principal / solo).

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid AS $$
  SELECT NULLIF(
    auth.jwt()->>'tenant_id',
    ''
  )::uuid
$$ LANGUAGE sql STABLE;

-- ── 3. Mise à jour des policies RLS ─────────────────────────
--
-- On recrée les policies pour ajouter WITH CHECK là où il manquait
-- et pour documenter clairement le passage à auth.jwt().
-- La logique tenant_id IS NOT DISTINCT FROM current_tenant_id()
-- est inchangée — seule l'implémentation de current_tenant_id()
-- a changé (JWT au lieu de session setting).

-- contacts
DROP POLICY IF EXISTS "own data" ON contacts;
CREATE POLICY "own data" ON contacts FOR ALL
  USING (
    auth.uid()::text = user_id
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  WITH CHECK (
    auth.uid()::text = user_id
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  );

-- pipelines
DROP POLICY IF EXISTS "own data" ON pipelines;
CREATE POLICY "own data" ON pipelines FOR ALL
  USING (
    auth.uid()::text = user_id
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  WITH CHECK (
    auth.uid()::text = user_id
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  );

-- pipeline_stages
DROP POLICY IF EXISTS "own stages" ON pipeline_stages;
CREATE POLICY "own stages" ON pipeline_stages FOR ALL
  USING (
    pipeline_id IN (
      SELECT id FROM pipelines
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  WITH CHECK (
    pipeline_id IN (
      SELECT id FROM pipelines
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  );

-- contact_pipeline
DROP POLICY IF EXISTS "own data" ON contact_pipeline;
CREATE POLICY "own data" ON contact_pipeline FOR ALL
  USING (
    contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  WITH CHECK (
    contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  );

-- pipeline_history
DROP POLICY IF EXISTS "own data" ON pipeline_history;
CREATE POLICY "own data" ON pipeline_history FOR ALL
  USING (
    contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  WITH CHECK (
    contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  );

-- ai_enrichments
DROP POLICY IF EXISTS "own data" ON ai_enrichments;
CREATE POLICY "own data" ON ai_enrichments FOR ALL
  USING (
    contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  )
  WITH CHECK (
    contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  );

-- contact_files (policies SELECT / INSERT / DELETE séparées)
DROP POLICY IF EXISTS "own contact files select" ON contact_files;
DROP POLICY IF EXISTS "own contact files insert" ON contact_files;
DROP POLICY IF EXISTS "own contact files delete" ON contact_files;

CREATE POLICY "own contact files select" ON contact_files FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  );

CREATE POLICY "own contact files insert" ON contact_files FOR INSERT
  WITH CHECK (
    contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  );

CREATE POLICY "own contact files delete" ON contact_files FOR DELETE
  USING (
    contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()::text
        AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
    AND tenant_id IS NOT DISTINCT FROM current_tenant_id()
  );
