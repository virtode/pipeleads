'use client'

import { useQuery } from '@tanstack/react-query'

export function useContactFiles(contactId: string | null, enabled = true) {
  return useQuery<{ id: string }[]>({
    queryKey: ['contact-files', contactId],
    queryFn: async () => {
      if (!contactId) return []
      const res = await fetch(`/api/contacts/${contactId}/files`)
      if (!res.ok) return []
      const json = await res.json() as { data: { id: string }[] }
      return json.data
    },
    enabled: !!contactId && enabled,
  })
}
