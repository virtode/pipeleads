'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

interface ClientOptions {
  url?: string
  anonKey?: string
}

/**
 * Crée un client Supabase côté browser.
 *
 * En mode multi-tenant, passer { url, anonKey } du tenant courant
 * (récupérés via useTenant()). Sans paramètres → fallback sur les
 * variables d'environnement (dev local / mode solo).
 */
export function createClient(options?: ClientOptions) {
  const url = options?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = options?.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createBrowserClient<Database>(url, key)
}
