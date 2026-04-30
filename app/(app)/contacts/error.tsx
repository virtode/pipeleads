'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ContactsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-sm text-muted-foreground">
        Une erreur est survenue lors du chargement des contacts.
      </p>
      <Button variant="outline" onClick={reset}>
        Réessayer
      </Button>
    </div>
  )
}
