'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, Copy, Check, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSupabaseClient } from '@/lib/supabase/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const APP_URL = `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'pipeleads.app'}`

function tokenToUrl(token: string) {
  return `${APP_URL}/api/ical/${token}/calendar.ics`
}

export function IcalSection() {
  const supabase = useSupabaseClient()

  const [token,       setToken]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [copied,      setCopied]      = useState(false)

  // Fetch current token on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('ical_token')
        .eq('id', user.id)
        .maybeSingle()

      setToken(data?.ical_token ?? null)
      setLoading(false)
    }
    load()
  }, [supabase])

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/settings/ical/regenerate', { method: 'POST' })
      const json = await res.json() as { token?: string; error?: string }
      if (!res.ok || !json.token) {
        toast.error('Erreur lors de la génération')
        return
      }
      setToken(json.token)
      toast.success('URL de synchronisation générée')
    } finally {
      setGenerating(false)
    }
  }

  async function copyUrl() {
    if (!token) return
    await navigator.clipboard.writeText(tokenToUrl(token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('URL copiée')
  }

  const icalUrl = token ? tokenToUrl(token) : null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Synchronisation calendrier</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Abonnement iCal</CardTitle>
          <CardDescription>
            Ajoute tes rappels comme événements dans Apple Calendar, Google Calendar ou Outlook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : icalUrl ? (
            <>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={icalUrl}
                  className="flex-1 font-mono text-xs text-muted-foreground"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyUrl}
                  aria-label="Copier l'URL"
                >
                  {copied
                    ? <Check className="h-4 w-4 text-green-500" />
                    : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Ajoute cette URL comme calendrier abonné dans Apple Calendar, Google Calendar ou
                Outlook. Les rappels marqués «&nbsp;fait&nbsp;» disparaîtront à la prochaine
                synchronisation (≤&nbsp;30&nbsp;min).
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    disabled={generating}
                  >
                    {generating
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    Régénérer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Régénérer l'URL ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      L'ancienne URL ne fonctionnera plus. Les abonnements existants devront être
                      mis à jour avec la nouvelle adresse.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={generate}>Régénérer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button onClick={generate} disabled={generating} className="gap-1.5">
              {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Générer une URL de synchronisation
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
