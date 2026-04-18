'use client'

import { useQuery } from '@tanstack/react-query'
import { useSupabaseClient } from '@/lib/supabase/context'

export function useProfile() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { timezone: 'Europe/Paris' }

      const { data } = await supabase
        .from('profiles')
        .select('timezone, daily_digest_enabled')
        .eq('id', user.id)
        .maybeSingle()

      return {
        timezone:             data?.timezone             ?? 'Europe/Paris',
        daily_digest_enabled: data?.daily_digest_enabled ?? true,
      }
    },
    staleTime: 10 * 60_000,
  })
}
