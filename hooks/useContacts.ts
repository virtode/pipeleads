'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStytchSession } from '@stytch/nextjs'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { ContactFilters, ContactSortField } from '@/types'
import type { InsertDto, UpdateDto } from '@/lib/supabase/types'

export const CONTACTS_PAGE_SIZE = 20

interface UseContactsParams {
  page?: number
  filters?: ContactFilters
  sort?: ContactSortField
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useContacts({
  page = 0,
  filters = {},
  sort = { field: 'created_at', direction: 'desc' },
}: UseContactsParams = {}) {
  const { session } = useStytchSession()

  return useQuery({
    queryKey: ['contacts', page, filters, sort],
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })

      if (filters.search) {
        const s = filters.search
        query = query.or(
          `first_name.ilike.%${s}%,last_name.ilike.%${s}%,company.ilike.%${s}%`
        )
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags)
      }

      if (filters.company) {
        query = query.ilike('company', `%${filters.company}%`)
      }

      query = query.order(sort.field, { ascending: sort.direction === 'asc' })

      const from = page * CONTACTS_PAGE_SIZE
      query = query.range(from, from + CONTACTS_PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error

      return { contacts: data ?? [], total: count ?? 0 }
    },
    enabled: !!session,
  })
}

export function useContact(id: string | null) {
  const { session } = useStytchSession()

  return useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      if (!id) return null
      const supabase = createClient()

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          contact_pipeline (
            *,
            pipeline:pipelines (*),
            stage:pipeline_stages (*)
          ),
          ai_enrichments (
            id, type, content, model, created_at
          )
        `)
        .eq('id', id)
        .order('created_at', { ascending: false, referencedTable: 'ai_enrichments' })
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id && !!session,
  })
}

export function useContactTags() {
  const { session } = useStytchSession()

  return useQuery({
    queryKey: ['contact-tags'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('contacts')
        .select('tags')
        .not('tags', 'is', null)

      if (error) throw error
      const all = (data ?? []).flatMap((c) => c.tags ?? [])
      return [...new Set(all)].sort()
    },
    enabled: !!session,
    staleTime: 5 * 60_000,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateContact() {
  const { session } = useStytchSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Omit<InsertDto<'contacts'>, 'user_id'>) => {
      const supabase = createClient()
      const userId = session?.user_id ?? ''

      const { data, error } = await supabase
        .from('contacts')
        .insert({ ...input, user_id: userId })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
      toast.success('Contact créé')
    },
    onError: () => toast.error('Erreur lors de la création'),
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDto<'contacts'> }) => {
      const supabase = createClient()

      const { data: contact, error } = await supabase
        .from('contacts')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return contact
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact', id] })
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
      toast.success('Contact mis à jour')
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
      toast.success('Contact supprimé')
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })
}

export function useDeleteContacts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const supabase = createClient()
      const { error } = await supabase.from('contacts').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
      toast.success(`${ids.length} contact${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}`)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })
}
