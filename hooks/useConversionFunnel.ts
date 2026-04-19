'use client'

import { useQuery } from '@tanstack/react-query'
import { useSupabaseClient } from '@/lib/supabase/context'
import { buildFunnelSteps } from '@/lib/reports/funnel'
import type { ReportFilters } from './useStageDistribution'

export type { ConversionStep } from '@/lib/reports/funnel'

export function useConversionFunnel(pipelineId: string | null, filters: ReportFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['reports-funnel', pipelineId, filters.startDate.toISOString().slice(0, 10), filters.endDate.toISOString().slice(0, 10)],
    queryFn: async () => {
      if (!pipelineId) return []

      const { data: stages, error: stagesErr } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, position, is_lost, is_referral, is_won')
        .eq('pipeline_id', pipelineId)
        .order('position', { ascending: true })

      if (stagesErr) throw stagesErr
      if (!stages || stages.length === 0) return []

      const { data: current, error: currentErr } = await supabase
        .from('contact_pipeline')
        .select('stage_id')
        .eq('pipeline_id', pipelineId)
        .not('stage_id', 'is', null)

      if (currentErr) throw currentErr

      const stageCounts = new Map<string, number>()
      for (const row of current ?? []) {
        if (row.stage_id) {
          stageCounts.set(row.stage_id, (stageCounts.get(row.stage_id) ?? 0) + 1)
        }
      }

      const totalInPipeline = (current ?? []).length

      return buildFunnelSteps(stages, stageCounts, totalInPipeline)
    },
    enabled: !!pipelineId,
    staleTime: 60_000,
  })
}
