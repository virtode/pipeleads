'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

type TypedSupabaseClient = SupabaseClient<Database>

const SupabaseContext = createContext<TypedSupabaseClient | null>(null)

interface SupabaseProviderProps {
  children: ReactNode
}

/**
 * Fournit un client Supabase browser initialisé avec les credentials
 * du tenant courant (récupérés via GET /api/tenant/config au montage).
 *
 * Initialisation synchrone avec les variables d'env par défaut pour éviter
 * tout flash / état de chargement. Si le tenant a des credentials différents,
 * le client est recréé après le premier fetch.
 */
export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [client, setClient] = useState<TypedSupabaseClient>(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )

  useEffect(() => {
    async function initTenantClient() {
      try {
        const res = await fetch('/api/tenant/config')
        if (!res.ok) return

        const { url, anonKey } = (await res.json()) as {
          url: string
          anonKey: string
        }

        // Recréer le client uniquement si les credentials diffèrent des env vars
        if (
          url !== process.env.NEXT_PUBLIC_SUPABASE_URL ||
          anonKey !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ) {
          setClient(createBrowserClient<Database>(url, anonKey))
        }
      } catch {
        // Conserver le client par défaut en cas d'erreur réseau
      }
    }

    initTenantClient()
  }, [])

  return (
    <SupabaseContext.Provider value={client}>
      {children}
    </SupabaseContext.Provider>
  )
}

/**
 * Hook pour accéder au client Supabase browser du tenant courant.
 * Doit être utilisé à l'intérieur d'un SupabaseProvider.
 */
export function useSupabaseClient(): TypedSupabaseClient {
  const client = useContext(SupabaseContext)
  if (!client) {
    throw new Error('useSupabaseClient doit être utilisé dans un SupabaseProvider')
  }
  return client
}
