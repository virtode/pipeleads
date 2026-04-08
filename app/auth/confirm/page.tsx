'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, LogIn, ShieldCheck, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type PageState = 'ready' | 'verifying' | 'success' | 'error' | 'no-token'

/**
 * Page intermédiaire anti-Outlook SafeLinks.
 *
 * Outlook pré-fetch les liens dans les emails pour les scanner.
 * Si le magic link pointait directement sur GoTrue (/auth/v1/verify?token=...),
 * ce pré-fetch consommerait le token avant que l'utilisateur clique.
 *
 * Solution : le template email pointe ici avec le token_hash en paramètre.
 * Cette page est du HTML statique — SafeLinks la scanne sans déclencher GoTrue.
 * Le token n'est consommé que quand l'utilisateur clique "Confirmer".
 *
 * Template email Supabase à configurer (Auth → Email Templates → Magic Link) :
 *   <a href="https://ton-domaine.com/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">
 *     Confirmer ma connexion
 *   </a>
 */
export default function AuthConfirmPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<PageState>('ready')
  const [tokenHash, setTokenHash] = useState<string | null>(null)
  const [otpType, setOtpType] = useState<string>('magiclink')

  useEffect(() => {
    setMounted(true)
    const params = new URLSearchParams(window.location.search)
    const hash = params.get('token_hash')
    const type = params.get('type') ?? 'magiclink'

    if (!hash) {
      setState('no-token')
    } else {
      setTokenHash(hash)
      setOtpType(type)
    }
  }, [])

  async function handleConfirm() {
    if (!tokenHash) return

    setState('verifying')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType as 'magiclink' | 'email' | 'recovery' | 'invite',
      })

      if (error) {
        console.error('[AuthConfirm] verifyOtp error:', error.message)
        setState('error')
        return
      }

      setState('success')
      router.push('/contacts')
    } catch {
      setState('error')
    }
  }

  const logo = mounted && resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo.png'

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="flex flex-col items-center gap-2 text-center">
          <Image
            src={logo}
            alt="PipeLeads"
            width={200}
            height={50}
            className="mx-auto mb-8"
            priority
          />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Confirmation de connexion</CardTitle>
            <CardDescription>
              {state === 'no-token' || state === 'error'
                ? 'Ce lien est invalide ou a déjà été utilisé.'
                : 'Clique sur le bouton pour finaliser ta connexion.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {(state === 'ready' || state === 'verifying') && tokenHash && (
              <Button
                className="w-full"
                onClick={handleConfirm}
                disabled={state === 'verifying'}
              >
                {state === 'verifying' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Vérification…
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Confirmer ma connexion
                  </>
                )}
              </Button>
            )}

            {state === 'success' && (
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400">
                <ShieldCheck className="h-4 w-4" />
                Connexion réussie, redirection…
              </div>
            )}

            {(state === 'no-token' || state === 'error') && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {state === 'no-token'
                    ? 'Lien manquant ou malformé.'
                    : 'Lien invalide ou déjà utilisé.'}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/login')}
                >
                  Retourner à la connexion
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  )
}
