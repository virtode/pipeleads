'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { endOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { useSupabaseClient } from '@/lib/supabase/context'
import { useProfile } from '@/hooks/useProfile'
import type { Tables } from '@/lib/supabase/types'

export type AgendaReminder = Tables<'interactions'> & {
  contact: Pick<Tables<'contacts'>, 'id' | 'first_name' | 'last_name'> | null
}

export function useAgendaReminders() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['agenda-reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interactions')
        .select('*, contact:contacts(id, first_name, last_name)')
        .eq('status', 'pending')
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as AgendaReminder[]
    },
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  })
}

export function usePendingReminderCount() {
  const supabase = useSupabaseClient()
  const { data: profile } = useProfile()
  const timezone = profile?.timezone ?? 'Europe/Paris'

  return useQuery({
    queryKey: ['pending-reminder-count', timezone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interactions')
        .select('date')
        .eq('status', 'pending')
      if (error) throw error

      const now = new Date()
      const endOfTodayUtc = fromZonedTime(
        endOfDay(toZonedTime(now, timezone)),
        timezone,
      )
      return (data ?? []).filter((r) => new Date(r.date) <= endOfTodayUtc).length
    },
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
  })
}
