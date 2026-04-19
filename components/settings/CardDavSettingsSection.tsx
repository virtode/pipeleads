'use client'

import { useState, useEffect } from 'react'
import { Smartphone, Copy, Check, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useSupabaseClient } from '@/lib/supabase/context'
import { useTenant } from '@/lib/tenant/useTenant'

interface CardDavConfig {
  server: string
  username: string
  password: string
  path: string
  tenantName: string
}

function CarddavRow({
  label,
  value,
  secret,
  revealed,
  onToggle,
}: {
  label: string
  value: string
  secret?: boolean
  revealed?: boolean
  onToggle?: () => void
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <span className="w-28 shrink-0 text-muted-foreground text-sm">{label}</span>
      <span className="flex-1 font-mono text-xs truncate">
        {secret && !revealed ? '••••••••' : value}
      </span>
      {secret && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          {revealed ? 'Masquer' : 'Afficher'}
        </button>
      )}
    </div>
  )
}

export function CardDavSettingsSection() {
  const supabase = useSupabaseClient()
  const { slug: tenantSlug, isLoading: tenantLoading } = useTenant()

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [carddavConfig, setCarddavConfig] = useState<CardDavConfig | null>(null)
  const [carddavLoading, setCarddavLoading] = useState(false)
  const [carddavCopied, setCarddavCopied] = useState(false)
  const [carddavRevealed, setCarddavRevealed] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
  }, [supabase])

  // Fetch CardDAV config once we have both email and tenantSlug
  useEffect(() => {
    if (!userEmail || !tenantSlug) return
    setCarddavLoading(true)
    fetch(`/api/carddav/config?tenantSlug=${encodeURIComponent(tenantSlug)}&userEmail=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setCarddavConfig(json.data as CardDavConfig)
      })
      .catch(() => {})
      .finally(() => setCarddavLoading(false))
  }, [userEmail, tenantSlug])

  if (!tenantSlug) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Synchronisation iOS</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Contacts sur iPhone / iPad</CardTitle>
          <CardDescription>
            Utilise ces identifiants pour ajouter un compte CardDAV sur ton appareil iOS.
            Réglages → Contacts → Comptes → Ajouter → Autre → Compte CardDAV
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(carddavLoading || tenantLoading) ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : carddavConfig ? (
            <div className="space-y-3">
              <div className="rounded border divide-y text-sm">
                <CarddavRow label="Serveur" value={carddavConfig.server} />
                <CarddavRow label="Identifiant" value={carddavConfig.username} />
                <CarddavRow
                  label="Mot de passe"
                  value={carddavConfig.password}
                  secret
                  revealed={carddavRevealed}
                  onToggle={() => setCarddavRevealed((v) => !v)}
                />
                <CarddavRow
                  label="Description"
                  value={`PipeLeads - ${carddavConfig.tenantName}`}
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Chemin : {carddavConfig.path}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  const text = [
                    'Configuration iOS :',
                    'Réglages → Contacts → Comptes → Ajouter → Autre → Compte CardDAV',
                    '',
                    `Serveur      : ${carddavConfig.server}`,
                    `Identifiant  : ${carddavConfig.username}`,
                    `Mot de passe : ${carddavConfig.password}`,
                    `Description  : PipeLeads - ${carddavConfig.tenantName}`,
                  ].join('\n')
                  await navigator.clipboard.writeText(text)
                  setCarddavCopied(true)
                  setTimeout(() => setCarddavCopied(false), 2000)
                  toast.success('Configuration copiée')
                }}
              >
                {carddavCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copier la configuration
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              La synchronisation CardDAV n'est pas encore configurée pour ce compte.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
