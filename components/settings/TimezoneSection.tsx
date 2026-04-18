'use client'

import { useState, useMemo } from 'react'
import { Globe, Check, ChevronsUpDown, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useSupabaseClient } from '@/lib/supabase/context'
import { useProfile } from '@/hooks/useProfile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMMON_TZ = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
]

function getOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    return parts.find((p) => p.type === 'timeZoneName')?.value?.replace('GMT', 'UTC') ?? ''
  } catch {
    return ''
  }
}

function formatTzLabel(tz: string): string {
  const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
  const offset = getOffset(tz)
  return offset ? `${city} (${offset})` : city
}

// ---------------------------------------------------------------------------
// TimezoneSection
// ---------------------------------------------------------------------------

export function TimezoneSection() {
  const supabase    = useSupabaseClient()
  const queryClient = useQueryClient()
  const { data: profile } = useProfile()

  const currentTz      = profile?.timezone ?? 'Europe/Paris'
  const isCommonTz     = COMMON_TZ.includes(currentTz)
  const digestEnabled  = profile?.daily_digest_enabled ?? true

  // Auto-detection
  const [detectedTz]       = useState(() => {
    if (typeof window === 'undefined') return null
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return null }
  })
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const showBanner =
    !bannerDismissed &&
    currentTz === 'Europe/Paris' &&
    !!detectedTz &&
    detectedTz !== 'Europe/Paris'

  // All IANA timezones
  const allZones = useMemo<string[]>(() => {
    if (typeof window === 'undefined') return COMMON_TZ
    try { return Intl.supportedValuesOf('timeZone') } catch { return COMMON_TZ }
  }, [])

  // Combobox state
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')

  const filteredZones = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return allZones.slice(0, 60)
    return allZones
      .filter((tz) =>
        tz.toLowerCase().includes(q) ||
        tz.split('/').pop()?.toLowerCase().replace(/_/g, ' ').includes(q)
      )
      .slice(0, 60)
  }, [allZones, search])

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function saveProfile(patch: { timezone?: string; daily_digest_enabled?: boolean }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...patch }, { onConflict: 'id' })

    if (error) {
      console.error('[TimezoneSection] save error', error)
      toast.error('Erreur lors de la mise à jour')
      return
    }

    await queryClient.invalidateQueries({ queryKey: ['profile'] })
    await queryClient.invalidateQueries({ queryKey: ['pending-reminder-count'] })
  }

  async function saveTimezone(tz: string) {
    await saveProfile({ timezone: tz })
    toast.success('Fuseau horaire mis à jour')
  }

  async function toggleDigest() {
    await saveProfile({ daily_digest_enabled: !digestEnabled })
    toast.success(digestEnabled ? 'Récap désactivé' : 'Récap activé')
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Préférences</h2>
      </div>

      {/* Auto-detect banner */}
      {showBanner && detectedTz && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Votre fuseau détecté est{' '}
            <strong className="text-foreground">{formatTzLabel(detectedTz)}</strong>.
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => { saveTimezone(detectedTz); setBannerDismissed(true) }}
              className="text-primary hover:underline font-medium"
            >
              Mettre à jour →
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Fuseau horaire</CardTitle>
          <CardDescription>
            Utilisé pour afficher les dates et grouper les rappels dans l&apos;agenda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Common timezone list */}
          {COMMON_TZ.map((tz) => (
            <button
              key={tz}
              type="button"
              onClick={() => { if (tz !== currentTz) saveTimezone(tz) }}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors text-left',
                currentTz === tz
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted text-foreground',
              )}
            >
              {formatTzLabel(tz)}
              {currentTz === tz && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}

          {/* Autre… — combobox */}
          <div className="pt-1">
            <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch('') }}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors text-left border border-dashed border-border hover:border-primary/50 hover:bg-muted',
                    !isCommonTz && 'border-primary/30 bg-primary/5 text-primary font-medium',
                  )}
                >
                  <span>{isCommonTz ? 'Autre…' : formatTzLabel(currentTz)}</span>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Rechercher un fuseau…"
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Aucun résultat</CommandEmpty>
                    {filteredZones.map((tz) => (
                      <CommandItem
                        key={tz}
                        value={tz}
                        onSelect={() => {
                          saveTimezone(tz)
                          setOpen(false)
                          setSearch('')
                        }}
                        className="flex items-center justify-between"
                      >
                        <span>{formatTzLabel(tz)}</span>
                        {currentTz === tz && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* ── Digest quotidien ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Récap quotidien par email</CardTitle>
          <CardDescription>
            Reçois chaque matin à 7h (heure locale) un résumé des rappels en retard et du jour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={toggleDigest}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors',
              digestEnabled ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0" />
              {digestEnabled ? 'Activé' : 'Désactivé'}
            </span>
            {/* Toggle pill */}
            <span
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                digestEnabled ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                  digestEnabled ? 'translate-x-4' : 'translate-x-1',
                )}
              />
            </span>
          </button>
        </CardContent>
      </Card>
    </section>
  )
}
