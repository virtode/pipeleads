'use client'

import { useQuery } from '@tanstack/react-query'
import { useSupabaseClient } from '@/lib/supabase/context'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportFilters {
  pipelineId: string | null
  startDate: Date
  endDate: Date
}

export interface StageDistributionItem {
  stageId: string | null
  stageName: string
  stageColor: string
  count: number
  isLost: boolean
  isReferral: boolean
  isWon: boolean
}

export interface TimelinePoint {
  date: string   // 'YYYY-MM-DD'
  count: number  // moves on that day
}

export interface TagCount {
  tag: string
  count: number
}

export interface InactiveContact {
  id: string
  first_name: string
  last_name: string | null
  company: string | null
  daysSinceLastActivity: number
}

export interface ConversionStep {
  stageId: string
  stageName: string
  stageColor: string
  count: number
  rate: number   // cumulative % for normal stages, loss/referral/won rate for exit stages (0–100)
  isLost: boolean
  isReferral: boolean
  isWon: boolean
}

export interface KpiData {
  totalContacts: number
  addedThisMonth: number
  activePipelines: number
  contactsWithoutStage: number
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

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

      if (contactsRes.error) throw contactsRes.error
      if (addedRes.error)    throw addedRes.error
      if (pipelinesRes.error) throw pipelinesRes.error
      if (noStageRes.error)  throw noStageRes.error

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

// ---------------------------------------------------------------------------
// Distribution contacts par statut (étape) dans un pipeline
// ---------------------------------------------------------------------------

export function useStageDistribution(filters: ReportFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['reports-distribution', filters.pipelineId],
    queryFn: async (): Promise<StageDistributionItem[]> => {
      if (!filters.pipelineId) return []

      // Fetch stages for this pipeline
      const { data: stages, error: stagesErr } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, is_lost, is_referral, is_won')
        .eq('pipeline_id', filters.pipelineId)
        .order('position', { ascending: true })

      if (stagesErr) throw stagesErr

      // Count per stage
      const { data: entries, error: entriesErr } = await supabase
        .from('contact_pipeline')
        .select('stage_id')
        .eq('pipeline_id', filters.pipelineId)

      if (entriesErr) throw entriesErr

      const counts = new Map<string | null, number>()
      for (const entry of entries ?? []) {
        const key = entry.stage_id
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }

      const result: StageDistributionItem[] = (stages ?? []).map((stage) => ({
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color,
        count: counts.get(stage.id) ?? 0,
        isLost: stage.is_lost,
        isReferral: stage.is_referral,
        isWon: stage.is_won,
      }))

      // Add "unassigned" if any
      const unassignedCount = counts.get(null) ?? 0
      if (unassignedCount > 0) {
        result.push({
          stageId: null,
          stageName: 'Sans étape',
          stageColor: '#94a3b8',
          count: unassignedCount,
          isLost: false,
          isReferral: false,
          isWon: false,
        })
      }

      return result
    },
    enabled: !!filters.pipelineId,
    staleTime: 60_000,
  })
}

// ---------------------------------------------------------------------------
// Timeline — mouvements par jour
// ---------------------------------------------------------------------------

export function useTimeline(filters: ReportFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['reports-timeline', filters.pipelineId, filters.startDate.toISOString().slice(0, 10), filters.endDate.toISOString().slice(0, 10)],
    queryFn: async (): Promise<TimelinePoint[]> => {
      let query = supabase
        .from('pipeline_history')
        .select('changed_at')
        .gte('changed_at', filters.startDate.toISOString())
        .lte('changed_at', filters.endDate.toISOString())

      if (filters.pipelineId) {
        query = query.eq('pipeline_id', filters.pipelineId)
      }

      const { data, error } = await query
      if (error) throw error

      // Group by day
      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        const day = row.changed_at.slice(0, 10)
        counts.set(day, (counts.get(day) ?? 0) + 1)
      }

      // Build continuous series
      const result: TimelinePoint[] = []
      const cursor = new Date(filters.startDate)
      cursor.setHours(0, 0, 0, 0)
      const end = new Date(filters.endDate)
      end.setHours(23, 59, 59, 999)

      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10)
        result.push({ date: key, count: counts.get(key) ?? 0 })
        cursor.setDate(cursor.getDate() + 1)
      }

      return result
    },
    staleTime: 60_000,
  })
}

// ---------------------------------------------------------------------------
// Top 10 tags
// ---------------------------------------------------------------------------

export function useTagsDistribution() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['reports-tags'],
    queryFn: async (): Promise<TagCount[]> => {
      const { data, error } = await supabase
        .from('contacts')
        .select('tags')
        .not('tags', 'is', null)

      if (error) throw error

      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        for (const tag of row.tags ?? []) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1)
        }
      }

      return [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    },
    staleTime: 2 * 60_000,
  })
}

// ---------------------------------------------------------------------------
// Contacts inactifs (pas de mouvement pipeline depuis N jours)
// ---------------------------------------------------------------------------

export function useInactiveContacts(days: number, pipelineId: string | null) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['reports-inactive', days, pipelineId],
    queryFn: async (): Promise<InactiveContact[]> => {
      const threshold = new Date()
      threshold.setDate(threshold.getDate() - days)

      let query = supabase
        .from('contact_pipeline')
        .select('contact_id, updated_at, contacts(id, first_name, last_name, company)')
        .lt('updated_at', threshold.toISOString())

      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId)
      }

      const { data, error } = await query
      if (error) throw error

      const now = Date.now()
      return (data ?? [])
        .map((row) => {
          const c = row.contacts as { id: string; first_name: string; last_name: string | null; company: string | null } | null
          if (!c) return null
          const daysSince = Math.floor((now - new Date(row.updated_at).getTime()) / 86_400_000)
          return {
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            company: c.company,
            daysSinceLastActivity: daysSince,
          }
        })
        .filter((x): x is InactiveContact => x !== null)
        .sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity)
        .slice(0, 20)
    },
    staleTime: 5 * 60_000,
  })
}

// ---------------------------------------------------------------------------
// Funnel de conversion entre étapes consécutives
// ---------------------------------------------------------------------------

export function useConversionFunnel(pipelineId: string | null, filters: ReportFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['reports-funnel', pipelineId, filters.startDate.toISOString().slice(0, 10), filters.endDate.toISOString().slice(0, 10)],
    queryFn: async (): Promise<ConversionStep[]> => {
      if (!pipelineId) return []

      // Fetch stages ordered
      const { data: stages, error: stagesErr } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, position, is_lost, is_referral, is_won')
        .eq('pipeline_id', pipelineId)
        .order('position', { ascending: true })

      if (stagesErr) throw stagesErr
      if (!stages || stages.length === 0) return []

      // Use current contact_pipeline assignments
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

      // Separate normal vs lost vs referral vs won stages
      const normalStages = stages.filter((s) => !s.is_lost && !s.is_referral && !s.is_won)
      const lostStages = stages.filter((s) => s.is_lost)
      const referralStages = stages.filter((s) => s.is_referral)
      const wonStages = stages.filter((s) => s.is_won)

      // Referral and won contacts are excluded from the conversion/loss rate base
      const referralContactCount = referralStages.reduce(
        (sum, s) => sum + (stageCounts.get(s.id) ?? 0),
        0
      )
      const wonContactCount = wonStages.reduce(
        (sum, s) => sum + (stageCounts.get(s.id) ?? 0),
        0
      )
      const effectiveTotal = totalInPipeline - referralContactCount - wonContactCount

      // Cumulative counts for normal stages: count(i) = contacts at stage i + all subsequent normal stages
      const normalCounts: number[] = normalStages.map((_, i) =>
        normalStages.slice(i).reduce((sum, s) => sum + (stageCounts.get(s.id) ?? 0), 0)
      )

      const normalSteps: ConversionStep[] = normalStages.map((stage, i) => ({
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color,
        count: i === 0 ? effectiveTotal : normalCounts[i],
        rate: effectiveTotal > 0 ? (i === 0 ? 100 : Math.round((normalCounts[i] / effectiveTotal) * 100)) : 0,
        isLost: false,
        isReferral: false,
        isWon: false,
      }))

      // Lost stages: individual counts, rate = count / effectiveTotal
      const lostSteps: ConversionStep[] = lostStages.map((stage) => {
        const count = stageCounts.get(stage.id) ?? 0
        return {
          stageId: stage.id,
          stageName: stage.name,
          stageColor: stage.color,
          count,
          rate: effectiveTotal > 0 ? Math.round((count / effectiveTotal) * 100) : 0,
          isLost: true,
          isReferral: false,
          isWon: false,
        }
      })

      // Referral stages: individual counts, rate = count / totalInPipeline (includes referral contacts)
      const referralSteps: ConversionStep[] = referralStages.map((stage) => {
        const count = stageCounts.get(stage.id) ?? 0
        return {
          stageId: stage.id,
          stageName: stage.name,
          stageColor: stage.color,
          count,
          rate: totalInPipeline > 0 ? Math.round((count / totalInPipeline) * 100) : 0,
          isLost: false,
          isReferral: true,
          isWon: false,
        }
      })

      // Won stages: individual counts, rate = count / totalInPipeline
      const wonSteps: ConversionStep[] = wonStages.map((stage) => {
        const count = stageCounts.get(stage.id) ?? 0
        return {
          stageId: stage.id,
          stageName: stage.name,
          stageColor: stage.color,
          count,
          rate: totalInPipeline > 0 ? Math.round((count / totalInPipeline) * 100) : 0,
          isLost: false,
          isReferral: false,
          isWon: true,
        }
      })

      return [...normalSteps, ...lostSteps, ...referralSteps, ...wonSteps]
    },
    enabled: !!pipelineId,
    staleTime: 60_000,
  })
}
