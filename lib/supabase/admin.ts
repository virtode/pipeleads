import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import type { Database } from './types'

/**
 * Crée un client Supabase avec la service_role_key.
 *
 * En mode multi-tenant, récupère la service_role_key du tenant
 * depuis la table `tenants` du projet master.
 * En mode solo (pas de tenant), utilise les variables d'env.
 *
 * À utiliser uniquement côté serveur (API Routes, Server Components).
 * Ne jamais exposer ce client côté navigateur.
 */
export async function createAdminClient() {
  const headerStore = await headers()

  const url =
    headerStore.get('x-tenant-supabase-url') ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!

  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // En mode tenant : récupère la service_role_key depuis le master
  const tenantId = headerStore.get('x-tenant-id')
  if (tenantId && process.env.MASTER_SUPABASE_URL && process.env.MASTER_SUPABASE_SERVICE_KEY) {
    try {
      const res = await fetch(
        `${process.env.MASTER_SUPABASE_URL}/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}&select=supabase_service_role_key&limit=1`,
        {
          headers: {
            apikey: process.env.MASTER_SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${process.env.MASTER_SUPABASE_SERVICE_KEY}`,
          },
          cache: 'no-store',
        }
      )
      if (res.ok) {
        const rows = await res.json() as Array<{ supabase_service_role_key: string }>
        if (rows[0]?.supabase_service_role_key) {
          serviceRoleKey = rows[0].supabase_service_role_key
        }
      }
    } catch {
      // Fallback sur la clé env
    }
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
