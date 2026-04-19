'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSupabaseClient, useTenantId } from '@/lib/supabase/context'
import type { InsertDto, UpdateDto } from '@/lib/supabase/types'

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
