'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSupabaseClient, useTenantId } from '@/lib/supabase/context'
import type { InsertDto, UpdateDto } from '@/lib/supabase/types'
import type { Pipeline, PipelineStage } from '@/types'

export interface PipelineWithStages extends Pipeline {
  pipeline_stages: PipelineStage[]
}

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
      const msg = (err as { message?: string })?.message ?? String(err)
      toast.error(`Erreur suppression pipeline : ${msg}`)
    },
  })
}
