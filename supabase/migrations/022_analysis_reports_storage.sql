-- ============================================================
-- 022_analysis_reports_storage.sql
-- Bucket storage + RLS pour les rapports d'analyse
-- ============================================================

-- ── 1. Bucket analysis-reports (privé) ──────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'analysis-reports',
  'analysis-reports',
  false,
  10485760, -- 10 MB
  ARRAY['text/html']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. RLS sur storage.objects ───────────────────────────────
--
-- Chemin : reports/{tenant_id}/{report_id}.html
-- (storage.foldername(name))[1] = 'reports'
-- (storage.foldername(name))[2] = tenant_id

DROP POLICY IF EXISTS "tenant upload analysis reports"   ON storage.objects;
DROP POLICY IF EXISTS "tenant read analysis reports"     ON storage.objects;
DROP POLICY IF EXISTS "tenant delete analysis reports"   ON storage.objects;

CREATE POLICY "tenant upload analysis reports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'analysis-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = current_tenant_id()::text
  );

CREATE POLICY "tenant read analysis reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'analysis-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = current_tenant_id()::text
  );

CREATE POLICY "tenant delete analysis reports" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'analysis-reports'
    AND (storage.foldername(name))[1] = 'reports'
    AND (storage.foldername(name))[2] = current_tenant_id()::text
  );
