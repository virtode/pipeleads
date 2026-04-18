'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSupabaseClient, useTenantId } from '@/lib/supabase/context'
import type { InsertDto, UpdateDto } from '@/lib/supabase/types'

export function useInteractions(contactId: string | null) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['interactions', contactId],
    queryFn: async () => {
      if (!contactId) return []
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('contact_id', contactId)
        .order('date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!contactId,
  })
}

export function useInteractionCount(contactId: string | null) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['interactions-count', contactId],
    queryFn: async () => {
      if (!contactId) return 0
      const { count, error } = await supabase
        .from('interactions')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', contactId)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!contactId,
  })
}

export function useCreateInteraction() {
  const supabase = useSupabaseClient()
  const tenantId = useTenantId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Omit<InsertDto<'interactions'>, 'tenant_id' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('interactions')
        .insert({ ...input, tenant_id: tenantId!, created_by: user?.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['interactions', row.contact_id] })
      queryClient.invalidateQueries({ queryKey: ['interactions-count', row.contact_id] })
    },
    onError: (err) => {
      console.error('[useCreateInteraction]', err)
      toast.error('Erreur lors de l\'ajout')
    },
  })
}

export function useUpdateInteraction() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, contactId, data }: { id: string; contactId: string; data: UpdateDto<'interactions'> }) => {
      const { data: row, error } = await supabase
        .from('interactions')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return { row, contactId }
    },
    onSuccess: ({ contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['interactions', contactId] })
    },
    onError: (err) => {
      console.error('[useUpdateInteraction]', err)
      toast.error('Erreur lors de la modification')
    },
  })
}

export function useDeleteInteraction() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, contactId }: { id: string; contactId: string }) => {
      const { error } = await supabase.from('interactions').delete().eq('id', id)
      if (error) throw error
      return contactId
    },
    onSuccess: (contactId) => {
      queryClient.invalidateQueries({ queryKey: ['interactions', contactId] })
      queryClient.invalidateQueries({ queryKey: ['interactions-count', contactId] })
    },
    onError: (err) => {
      console.error('[useDeleteInteraction]', err)
      toast.error('Erreur lors de la suppression')
    },
  })
}
