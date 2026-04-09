import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import type { Database } from './types'

/**
 * Crée un client Supabase côté serveur.
 *
 * Architecture mono-instance : tous les tenants utilisent le même
 * Supabase (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).
 * L'isolation par tenant est assurée par RLS via app.tenant_id.
 *
 * Si x-tenant-id est présent dans les headers (injecté par le middleware),
 * on configure la session PostgreSQL avec set_config('app.tenant_id', …)
 * afin que les policies RLS puissent filtrer par tenant.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const tenantId = headerStore.get('x-tenant-id')

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component — cookies set via middleware
          }
        },
      },
    }
  )

  if (tenantId) {
    await supabase.rpc('set_config', {
      setting: 'app.tenant_id',
      value: tenantId,
      is_local: true,
    })
  }

  return supabase
}
