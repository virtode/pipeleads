import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

/**
 * Crée un client Supabase côté serveur.
 *
 * L'isolation par tenant est assurée par RLS via auth.jwt()->>'tenant_id'.
 * Le tenant_id est injecté dans le JWT au login par custom_access_token_hook
 * (migration 010) — aucune configuration de session nécessaire.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
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
}
