'use client'

import { Bell, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useSupabaseClient } from '@/lib/supabase/context'
import { useProfile } from '@/hooks/useProfile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function NotificationsSection() {
  const supabase    = useSupabaseClient()
  const queryClient = useQueryClient()
  const { data: profile } = useProfile()

  const digestEnabled = profile?.daily_digest_enabled ?? true

  async function toggleDigest() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, daily_digest_enabled: !digestEnabled }, { onConflict: 'id' })

    if (error) {
      toast.error('Erreur lors de la mise à jour')
      return
    }

    await queryClient.invalidateQueries({ queryKey: ['profile'] })
    toast.success(digestEnabled ? 'Récap désactivé' : 'Récap activé')
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Notifications</h2>
      </div>

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
