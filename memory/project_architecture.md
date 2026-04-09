---
name: Architecture mono-instance Supabase
description: Refactoring de per-tenant Supabase instances vers isolation par tenant_id dans un Supabase master unique
type: project
---

PipeLeads utilise désormais une **architecture mono-instance Supabase** avec isolation par `tenant_id` via RLS.

**Why:** L'ancien modèle (une URL Supabase par tenant) était trop complexe à opérer — en pratique, tous les tenants pointaient vers le même Supabase.

**How to apply:**
- Tous les clients Supabase (serveur et browser) utilisent `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Le middleware injecte uniquement `x-tenant-id`, `x-tenant-slug`, `x-tenant-name` (plus de credentials par tenant)
- `lib/supabase/server.ts` appelle `set_config('app.tenant_id', ...)` via RPC si `x-tenant-id` est présent
- `lib/supabase/admin.ts` est synchrone (`createAdminClient()` sans await), utilise `SUPABASE_SERVICE_ROLE_KEY`
- Toutes les mutations INSERT incluent `tenant_id` (depuis `useTenantId()` dans les hooks, ou `getTenantFromHeaders()` dans les routes)
- Les Storage paths sont `{tenantId|'solo'}/{contactId}/{uuid}_{filename}`
- `SupabaseProvider` expose `useTenantId()` en plus de `useSupabaseClient()`
- Migration `009_tenant_isolation.sql` ajoute `tenant_id` sur toutes les tables métier + policies RLS avec `current_tenant_id()`
- Données existantes avec `tenant_id = NULL` → compte principal (domaine racine `pipeleads.app`)
