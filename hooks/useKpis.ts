'use client'

import { useQuery } from '@tanstack/react-query'
import { useSupabaseClient } from '@/lib/supabase/context'

export interface KpiData {
  totalContacts: number
  addedThisMonth: number
  activePipelines: number
  contactsWithoutStage: number
}

export function useKpis() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['reports-kpis'],
    queryFn: async (): Promise<KpiData> => {
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [contactsRes, addedRes, pipelinesRes, noStageRes] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).gte('created_at', firstOfMonth),
        supabase.from('pipelines').select('id', { count: 'exact', head: true }),
        supabase.from('contact_pipeline').select('id', { count: 'exact', head: true }).is('stage_id', null),
      ])

      if (contactsRes.error)  throw contactsRes.error
      if (addedRes.error)     throw addedRes.error
      if (pipelinesRes.error) throw pipelinesRes.error
      if (noStageRes.error)   throw noStageRes.error

      return {
        totalContacts: contactsRes.count ?? 0,
        addedThisMonth: addedRes.count ?? 0,
        activePipelines: pipelinesRes.count ?? 0,
        contactsWithoutStage: noStageRes.count ?? 0,
      }
    },
    staleTime: 2 * 60_000,
  })
}
