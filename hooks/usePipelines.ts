'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSupabaseClient, useTenantId } from '@/lib/supabase/context'
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
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
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
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['pipeline', id],
    queryFn: async () => {
      if (!id) return null
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
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['kanban', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return null

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
  const supabase = useSupabaseClient()
  const tenantId = useTenantId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Omit<InsertDto<'pipelines'>, 'user_id' | 'tenant_id'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('pipelines')
        .insert({ ...input, user_id: user?.id ?? '', tenant_id: tenantId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
    },
    onError: (err) => {
      console.error('[useCreatePipeline]', err)
      const msg = (err as { message?: string })?.message ?? String(err)
      toast.error(`Erreur création pipeline : ${msg}`)
    },
  })
}

export function useUpdatePipeline() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDto<'pipelines'> }) => {
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
    },
    onError: (err) => {
      console.error('[useUpdatePipeline]', err)
      const msg = (err as { message?: string })?.message ?? String(err)
      toast.error(`Erreur mise à jour pipeline : ${msg}`)
    },
  })
}

export function useDeletePipeline() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
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
  const supabase = useSupabaseClient()
  const tenantId = useTenantId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Omit<InsertDto<'pipeline_stages'>, 'tenant_id'>) => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .insert({ ...input, tenant_id: tenantId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', input.pipeline_id] })
    },
    onError: (err) => {
      console.error('[useCreateStage]', err)
      const msg = (err as { message?: string })?.message ?? String(err)
      toast.error(`Erreur création étape : ${msg}`)
    },
  })
}

export function useUpdateStage() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; pipelineId: string; data: UpdateDto<'pipeline_stages'> }) => {
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
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, pipelineId }: { id: string; pipelineId: string }) => {
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
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ pipelineId, stages }: { pipelineId: string; stages: { id: string; position: number }[] }) => {
      const results = await Promise.all(
        stages.map(({ id, position }) =>
          supabase.from('pipeline_stages').update({ position }).eq('id', id)
        )
      )
      const failed = results.find(({ error }) => error)
      if (failed?.error) throw failed.error
    },
    onError: (_, { pipelineId }) => {
      // Refetch from DB to visually restore the correct order after a partial failure
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['kanban', pipelineId] })
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
  const supabase = useSupabaseClient()
  const tenantId = useTenantId()
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
      const { data, error } = await supabase
        .from('contact_pipeline')
        .upsert(
          { contact_id: contactId, pipeline_id: pipelineId, stage_id: stageId, tenant_id: tenantId },
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
  const supabase = useSupabaseClient()
  const tenantId = useTenantId()
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
          tenant_id: tenantId,
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
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactId, pipelineId }: { contactId: string; pipelineId: string }) => {
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
