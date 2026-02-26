'use client'

import { useState } from 'react'
import { useStytch, useStytchSession } from '@stytch/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2, Mail, Zap } from 'lucide-react'

export default function LoginPage() {
  const stytch = useStytch()
  const { session } = useStytchSession()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirige si déjà connecté
  useEffect(() => {
    if (session) {
      router.replace('/contacts')
    }
  }, [session, router])

  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return

    setIsSending(true)
    setError(null)

    try {
      await stytch.magicLinks.email.loginOrCreate(email.trim(), {
        login_magic_link_url: `${window.location.origin}/callback`,
        signup_magic_link_url: `${window.location.origin}/callback`,
      })
      setSent(true)
    } catch (err) {
      console.error('[Stytch] Magic link error:', err)
      const message = err instanceof Error ? err.message : JSON.stringify(err)
      setError(`Erreur : ${message}`)
    } finally {
      setIsSending(false)
    }
  }

  function handleGoogle() {
    setIsGoogleLoading(true)
    setError(null)
    try {
      stytch.oauth.google.start({
        login_redirect_url: `${window.location.origin}/callback`,
        signup_redirect_url: `${window.location.origin}/callback`,
      })
    } catch {
      setError('Impossible de démarrer la connexion Google.')
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / titre */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">PipeLeads</h1>
          <p className="text-sm text-muted-foreground">
            Connecte-toi pour accéder à ton espace
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Connexion</CardTitle>
            <CardDescription>
              Reçois un lien de connexion par email ou utilise Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Magic Link */}
            {!sent ? (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="toi@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSending}>
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi en cours…
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Recevoir un lien de connexion
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="rounded-lg bg-muted p-4 text-center text-sm">
                <p className="font-medium">Vérifie ta boîte mail !</p>
                <p className="mt-1 text-muted-foreground">
                  Un lien de connexion a été envoyé à{' '}
                  <span className="font-medium text-foreground">{email}</span>.
                </p>
                <button
                  onClick={() => { setSent(false); setEmail('') }}
                  className="mt-3 text-xs text-primary underline underline-offset-2"
                >
                  Utiliser une autre adresse
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">ou</span>
              <Separator className="flex-1" />
            </div>

            {/* OAuth Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continuer avec Google
            </Button>

            {/* Erreur */}
            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
