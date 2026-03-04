'use client'

import { useQuery } from '@tanstack/react-query'

export interface TenantInfo {
  tenantId: string | null
  slug: string | null
  name: string | null
  isLoading: boolean
}

interface TenantMeResponse {
  tenantId: string
  slug: string
  name: string
}

/**
 * Hook client-side pour accéder aux informations du tenant courant.
 * Lit les données via GET /api/tenant/me (qui relit les headers middleware).
 * En mode solo / dev local, retourne null pour toutes les valeurs.
 */
export function useTenant(): TenantInfo {
  const { data, isLoading } = useQuery<TenantMeResponse | null>({
    queryKey: ['tenant', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/tenant/me')
      if (!res.ok) return null
      const json = await res.json()
      return json.data ?? null
    },
    staleTime: 5 * 60 * 1000, // 5 min — le tenant ne change pas souvent
  })

  return {
    tenantId: data?.tenantId ?? null,
    slug: data?.slug ?? null,
    name: data?.name ?? null,
    isLoading,
  }
}
