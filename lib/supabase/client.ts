'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

/**
 * Crée un client Supabase côté browser.
 *
 * Architecture mono-instance : tous les tenants utilisent les mêmes
 * credentials (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).
 * L'isolation est assurée par RLS via tenant_id côté serveur.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
