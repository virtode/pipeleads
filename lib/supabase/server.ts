import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import type { Database } from './types'

/**
 * Crée un client Supabase côté serveur.
 *
 * En mode multi-tenant, le middleware injecte les headers :
 *   x-tenant-supabase-url   → URL du projet Supabase du tenant
 *   x-tenant-anon-key       → Anon key du tenant
 *
 * Sans ces headers (dev local / mode solo) → fallback variables d'env.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const url =
    headerStore.get('x-tenant-supabase-url') ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!

  const anonKey =
    headerStore.get('x-tenant-anon-key') ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createServerClient<Database>(url, anonKey, {
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
  })
}
