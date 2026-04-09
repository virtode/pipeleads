-- ============================================================
-- 011_tenant_users_unique_per_tenant.sql
-- Assouplissement de la contrainte UNIQUE sur tenant_users
-- pour permettre à un même utilisateur d'être manager
-- de plusieurs tenants.
-- ============================================================

-- Ajouter la colonne tenant_id si elle n'existe pas encore
ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Supprimer l'ancienne contrainte UNIQUE(user_id)
ALTER TABLE public.tenant_users
  DROP CONSTRAINT IF EXISTS tenant_users_user_id_key;

-- Ajouter la contrainte UNIQUE(user_id, tenant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_users_user_tenant_unique'
  ) THEN
    ALTER TABLE public.tenant_users
      ADD CONSTRAINT tenant_users_user_tenant_unique
      UNIQUE (user_id, tenant_id);
  END IF;
END $$;

-- Mettre à jour les policies RLS (idempotent)
DROP POLICY IF EXISTS "own row"          ON public.tenant_users;
DROP POLICY IF EXISTS "manager sees all" ON public.tenant_users;

-- Un utilisateur voit toutes ses propres lignes (potentiellement plusieurs tenants)
CREATE POLICY "own row" ON public.tenant_users
  FOR SELECT USING (auth.uid() = user_id);

-- Un manager voit toutes les entrées du même tenant
CREATE POLICY "manager sees all" ON public.tenant_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role = 'manager'
        AND tu.tenant_id IS NOT DISTINCT FROM current_tenant_id()
    )
  );
