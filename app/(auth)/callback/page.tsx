'use client'

import { useEffect, useRef } from 'react'
import { useStytch } from '@stytch/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Loader2, Zap } from 'lucide-react'

// SESSION_DURATION : 30 jours en minutes
const SESSION_DURATION_MINUTES = 60 * 24 * 7 // 7 jours

function CallbackHandler() {
  const stytch = useStytch()
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasRun = useRef(false)

  useEffect(() => {
    // Évite le double appel en StrictMode
    if (hasRun.current) return
    hasRun.current = true

    const token = searchParams.get('token')
    const tokenType = searchParams.get('stytch_token_type')

    if (!token || !tokenType) {
      router.replace('/login')
      return
    }

    async function authenticate() {
      try {
        if (tokenType === 'magic_links') {
          await stytch.magicLinks.authenticate(token!, {
            session_duration_minutes: SESSION_DURATION_MINUTES,
          })
        } else if (tokenType === 'oauth') {
          await stytch.oauth.authenticate(token!, {
            session_duration_minutes: SESSION_DURATION_MINUTES,
          })
        } else {
          router.replace('/login')
          return
        }
        router.replace('/contacts')
      } catch (err) {
        console.error('[Stytch] Callback authentication error:', err)
        router.replace('/login?error=auth_failed')
      }
    }

    authenticate()
  }, [stytch, router, searchParams])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Zap className="h-5 w-5" />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connexion en cours…
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
