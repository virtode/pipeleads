'use client'

import { useQuery } from '@tanstack/react-query'
import { useSupabaseClient } from '@/lib/supabase/context'
import type { Contact, Pipeline, PipelineStage } from '@/types'

export interface KanbanCardData {
  cp_id: string
  contact_id: string
  stage_id: string | null
  value: number | null
  contact: Contact
}

export interface KanbanColumnData {
  stage: PipelineStage
  cards: KanbanCardData[]
}

export interface KanbanData {
  pipeline: Pipeline
  columns: KanbanColumnData[]
  unassigned: KanbanCardData[]
}

export function useKanban(pipelineId: string | null) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['kanban', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return null

      const { data: pipeline, error: pipelineErr } = await supabase
        .from('pipelines')
        .select('*, pipeline_stages(*)')
        .eq('id', pipelineId)
        .order('position', { referencedTable: 'pipeline_stages', ascending: true })
        .single()

      if (pipelineErr) throw pipelineErr

      const { data: entries, error: entriesErr } = await supabase
        .from('contact_pipeline')
        .select('id, contact_id, stage_id, value, contacts(*)')
        .eq('pipeline_id', pipelineId)

      if (entriesErr) throw entriesErr

      const stages = (pipeline.pipeline_stages ?? []) as PipelineStage[]

      const cardsByStage = new Map<string | null, KanbanCardData[]>()
      for (const entry of entries ?? []) {
        const card: KanbanCardData = {
          cp_id: entry.id,
          contact_id: entry.contact_id,
          stage_id: entry.stage_id,
          value: entry.value,
          contact: entry.contacts as Contact,
        }
        const key = entry.stage_id ?? null
        const list = cardsByStage.get(key) ?? []
        list.push(card)
        cardsByStage.set(key, list)
      }

      const columns: KanbanColumnData[] = stages.map((stage) => ({
        stage,
        cards: cardsByStage.get(stage.id) ?? [],
      }))

      const result: KanbanData = {
        pipeline: pipeline as Pipeline,
        columns,
        unassigned: cardsByStage.get(null) ?? [],
      }

      return result
    },
    enabled: !!pipelineId,
  })
}
