'use client'

import { useQuery } from '@tanstack/react-query'
import { useSupabaseClient } from '@/lib/supabase/context'

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
  date: string
  count: number
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

export function useStageDistribution(filters: ReportFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['reports-distribution', filters.pipelineId],
    queryFn: async (): Promise<StageDistributionItem[]> => {
      if (!filters.pipelineId) return []

      const { data: stages, error: stagesErr } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, is_lost, is_referral, is_won')
        .eq('pipeline_id', filters.pipelineId)
        .order('position', { ascending: true })

      if (stagesErr) throw stagesErr

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

      const unassignedCount = counts.get(null) ?? 0
      if (unassignedCount > 0) {
        result.push({
          stageId: null,
          stageName: 'Sans étape',
          stageColor: '',
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

      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        const day = row.changed_at.slice(0, 10)
        counts.set(day, (counts.get(day) ?? 0) + 1)
      }

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
