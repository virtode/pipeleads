import { headers } from 'next/headers'

export interface TenantContext {
  tenantId: string
  slug: string
  name: string
  supabaseUrl: string
  anonKey: string
}

/**
 * Lit les informations du tenant depuis les headers injectés par le middleware.
 * Utilisable dans les Server Components et les Route Handlers (côté serveur uniquement).
 *
 * Retourne null si aucun header tenant n'est présent (mode solo / dev local).
 */
export async function getTenantFromHeaders(): Promise<TenantContext | null> {
  const headerStore = await headers()

  const tenantId = headerStore.get('x-tenant-id')
  const slug = headerStore.get('x-tenant-slug')
  const name = headerStore.get('x-tenant-name')
  const supabaseUrl = headerStore.get('x-tenant-supabase-url')
  const anonKey = headerStore.get('x-tenant-anon-key')

  if (!tenantId || !slug || !supabaseUrl || !anonKey) return null

  return {
    tenantId,
    slug,
    name: name ?? slug,
    supabaseUrl,
    anonKey,
  }
}
