'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, LogOut, Loader2 } from 'lucide-react'
import { useSupabaseClient } from '@/lib/supabase/context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { TimezoneSection } from '@/components/settings/TimezoneSection'
import { IcalSection } from '@/components/settings/IcalSection'
import { NotionSettingsSection } from '@/components/settings/NotionSettingsSection'
import { CardDavSettingsSection } from '@/components/settings/CardDavSettingsSection'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [logoutLoading, setLogoutLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
  }, [supabase])

  async function handleLogout() {
    setLogoutLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      setLogoutLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl w-full space-y-8 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure les intégrations et ton compte.
        </p>
      </div>

      <TimezoneSection />

      <Separator />

      <IcalSection />

      <Separator />

      <NotionSettingsSection />

      <Separator />

      <CardDavSettingsSection />

      <Separator />

      {/* ================================================================ */}
      {/* Account                                                           */}
      {/* ================================================================ */}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Compte</h2>
        </div>

        <Card>
          <CardContent className="pt-5 space-y-4">
            {userEmail && (
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Utilisateur connecté</p>
                <p className="text-sm text-muted-foreground">{userEmail}</p>
              </div>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                  <LogOut className="h-3.5 w-3.5" />
                  Se déconnecter
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tu seras redirigé vers la page de connexion.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLogout}
                    disabled={logoutLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {logoutLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Se déconnecter
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
