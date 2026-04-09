'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

type TypedSupabaseClient = SupabaseClient<Database>

interface SupabaseContextValue {
  client: TypedSupabaseClient
  tenantId: string | null
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null)

interface SupabaseProviderProps {
  children: ReactNode
}

/**
 * Fournit un client Supabase browser et le tenantId courant.
 *
 * Architecture mono-instance : le client utilise toujours les variables
 * d'env (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY) — plus besoin de recréer
 * le client avec des credentials différents par tenant.
 *
 * Le tenantId est récupéré depuis /api/tenant/config au montage,
 * puis exposé via useTenantId() pour que les hooks puissent l'inclure
 * dans leurs mutations (INSERT).
 */
export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [tenantId, setTenantId] = useState<string | null>(null)

  const client = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  useEffect(() => {
    fetch('/api/tenant/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tenantId: string } | null) => {
        if (data?.tenantId) setTenantId(data.tenantId)
      })
      .catch(() => {})
  }, [])

  return (
    <SupabaseContext.Provider value={{ client, tenantId }}>
      {children}
    </SupabaseContext.Provider>
  )
}

function useSupabaseContext(): SupabaseContextValue {
  const ctx = useContext(SupabaseContext)
  if (!ctx) {
    throw new Error('useSupabaseClient / useTenantId doivent être utilisés dans un SupabaseProvider')
  }
  return ctx
}

/**
 * Hook pour accéder au client Supabase browser.
 * Doit être utilisé à l'intérieur d'un SupabaseProvider.
 */
export function useSupabaseClient(): TypedSupabaseClient {
  return useSupabaseContext().client
}

/**
 * Hook pour accéder au tenantId courant (null = compte principal / solo).
 * Doit être utilisé à l'intérieur d'un SupabaseProvider.
 */
export function useTenantId(): string | null {
  return useSupabaseContext().tenantId
}
