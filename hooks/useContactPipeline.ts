'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSupabaseClient, useTenantId } from '@/lib/supabase/context'

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
      const { error: updateErr } = await supabase
        .from('contact_pipeline')
        .update({ stage_id: toStageId, updated_at: new Date().toISOString() })
        .eq('id', cpId)

      if (updateErr) throw updateErr

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
