'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { InsertDto, UpdateDto } from '@/lib/supabase/types'
import type { Contact, Pipeline, PipelineStage } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineWithStages extends Pipeline {
  pipeline_stages: PipelineStage[]
}

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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pipelines')
        .select('*, pipeline_stages(*)')
        .order('created_at', { ascending: true })
        .order('position', { referencedTable: 'pipeline_stages', ascending: true })

      if (error) throw error
      return (data ?? []) as PipelineWithStages[]
    },
  })
}

export function usePipeline(id: string | null) {
  return useQuery({
    queryKey: ['pipeline', id],
    queryFn: async () => {
      if (!id) return null
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pipelines')
        .select('*, pipeline_stages(*)')
        .eq('id', id)
        .order('position', { referencedTable: 'pipeline_stages', ascending: true })
        .single()

      if (error) throw error
      return data as PipelineWithStages
    },
    enabled: !!id,
  })
}

export function useKanban(pipelineId: string | null) {
  return useQuery({
    queryKey: ['kanban', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return null
      const supabase = createClient()

      // Fetch pipeline + stages
      const { data: pipeline, error: pipelineErr } = await supabase
        .from('pipelines')
        .select('*, pipeline_stages(*)')
        .eq('id', pipelineId)
        .order('position', { referencedTable: 'pipeline_stages', ascending: true })
        .single()

      if (pipelineErr) throw pipelineErr

      // Fetch contact_pipeline entries with contact data
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
          contact: entry.contacts as unknown as Contact,
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

// ---------------------------------------------------------------------------
// Pipeline mutations
// ---------------------------------------------------------------------------

export function useCreatePipeline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Omit<InsertDto<'pipelines'>, 'user_id'>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('pipelines')
        .insert({ ...input, user_id: user?.id ?? '' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      toast.success('Pipeline créé')
    },
    onError: (err) => {
      console.error('[useCreatePipeline]', err)
      const msg = (err as { message?: string })?.message ?? String(err)
      toast.error(`Erreur création pipeline : ${msg}`)
    },
  })
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDto<'pipelines'> }) => {
      const supabase = createClient()
      const { data: pipeline, error } = await supabase
        .from('pipelines')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return pipeline
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', id] })
      toast.success('Pipeline mis à jour')
    },
    onError: (err) => {
      console.error('[useUpdatePipeline]', err)
      const msg = (err as { message?: string })?.message ?? String(err)
      toast.error(`Erreur mise à jour pipeline : ${msg}`)
    },
  })
}

export function useDeletePipeline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('pipelines').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['kanban'] })
      toast.success('Pipeline supprimé')
    },
    onError: (err) => {
      console.error('[useDeletePipeline]', err)
      const msg = (err as { message?: string })?.message ?? String(err)
      toast.error(`Erreur suppression pipeline : ${msg}`)
    },
  })
}

// ---------------------------------------------------------------------------
// Stage mutations
// ---------------------------------------------------------------------------

export function useCreateStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: InsertDto<'pipeline_stages'>) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pipeline_stages')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', input.pipeline_id] })
    },
  })
}

export function useUpdateStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; pipelineId: string; data: UpdateDto<'pipeline_stages'> }) => {
      const supabase = createClient()
      const { data: stage, error } = await supabase
        .from('pipeline_stages')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return stage
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['kanban', pipelineId] })
    },
  })
}

export function useDeleteStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, pipelineId }: { id: string; pipelineId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from('pipeline_stages').delete().eq('id', id)
      if (error) throw error
      return { pipelineId }
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['kanban', pipelineId] })
    },
  })
}

export function useReorderStages() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ pipelineId, stages }: { pipelineId: string; stages: { id: string; position: number }[] }) => {
      const supabase = createClient()
      // Upsert all at once
      const updates = stages.map(({ id, position }) => ({
        id,
        pipeline_id: pipelineId,
        position,
        name: '', // required by upsert — will be filled by existing row
      }))
      // Use individual updates to preserve name/color
      await Promise.all(
        stages.map(({ id, position }) =>
          supabase.from('pipeline_stages').update({ position }).eq('id', id)
        )
      )
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['kanban', pipelineId] })
    },
  })
}

// ---------------------------------------------------------------------------
// contact_pipeline mutations
// ---------------------------------------------------------------------------

export function useAssignContactToPipeline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      contactId,
      pipelineId,
      stageId,
    }: {
      contactId: string
      pipelineId: string
      stageId: string | null
    }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('contact_pipeline')
        .upsert(
          { contact_id: contactId, pipeline_id: pipelineId, stage_id: stageId },
          { onConflict: 'contact_id,pipeline_id' }
        )
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, { pipelineId, contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['kanban', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact ajouté au pipeline')
    },
    onError: () => toast.error('Erreur lors de l\'ajout au pipeline'),
  })
}

export function useMoveContactStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      cpId,
      contactId,
      pipelineId,
      fromStageId,
      toStageId,
    }: {
      cpId: string
      contactId: string
      pipelineId: string
      fromStageId: string | null
      toStageId: string | null
    }) => {
      const supabase = createClient()

      // Update current stage
      const { error: updateErr } = await supabase
        .from('contact_pipeline')
        .update({ stage_id: toStageId, updated_at: new Date().toISOString() })
        .eq('id', cpId)

      if (updateErr) throw updateErr

      // Record history
      const { error: histErr } = await supabase
        .from('pipeline_history')
        .insert({
          contact_id: contactId,
          pipeline_id: pipelineId,
          from_stage_id: fromStageId,
          to_stage_id: toStageId,
        })

      if (histErr) throw histErr
    },
    onSuccess: (_, { pipelineId, contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['kanban', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
    },
  })
}

export function useRemoveContactFromPipeline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactId, pipelineId }: { contactId: string; pipelineId: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('contact_pipeline')
        .delete()
        .eq('contact_id', contactId)
        .eq('pipeline_id', pipelineId)
      if (error) throw error
    },
    onSuccess: (_, { pipelineId, contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['kanban', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact retiré du pipeline')
    },
    onError: () => toast.error('Erreur lors du retrait du pipeline'),
  })
}
