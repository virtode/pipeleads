'use client'

import { useState } from 'react'
import { Loader2, DatabaseZap, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface TenantInitSchemaButtonProps {
  supabaseUrl: string
  serviceKey: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'

export function TenantInitSchemaButton({ supabaseUrl, serviceKey }: TenantInitSchemaButtonProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleInit() {
    setStatus('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/admin/tenants/init-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl, supabaseServiceRoleKey: serviceKey }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setErrorMsg(json.error ?? 'Erreur inconnue')
        setStatus('error')
        return
      }

      setStatus('success')
    } catch {
      setErrorMsg('Erreur réseau')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-1.5 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        Schéma initialisé
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={status === 'loading'}
            className="gap-2"
          >
            {status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <DatabaseZap className="h-3.5 w-3.5" />
            )}
            {status === 'loading' ? 'Initialisation...' : 'Initialiser le schéma'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Initialiser le schéma ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va créer (ou recréer) les tables, index et politiques RLS PipeLeads
              sur le projet Supabase de ce tenant. Les données existantes ne seront pas supprimées
              (utilisation de <code className="font-mono text-xs">CREATE TABLE IF NOT EXISTS</code>).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleInit}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {status === 'error' && errorMsg && (
        <p className="text-xs text-destructive max-w-xs text-right">{errorMsg}</p>
      )}
    </div>
  )
}
