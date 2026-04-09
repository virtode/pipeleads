import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Crée un client Supabase avec la service_role_key.
 *
 * Architecture mono-instance : tous les tenants partagent le même projet
 * Supabase. Ce client utilise SUPABASE_SERVICE_ROLE_KEY depuis les variables
 * d'environnement — la RLS est contournée (opérations privilégiées uniquement).
 *
 * À utiliser uniquement côté serveur (API Routes, Server Components).
 * Ne jamais exposer ce client côté navigateur.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
