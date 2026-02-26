'use client'

import { useState } from 'react'
import { useStytch, useStytchSession } from '@stytch/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { Loader2, Mail } from 'lucide-react'

export default function LoginPage() {
  const stytch = useStytch()
  const { session } = useStytchSession()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / titre */}
        <div className="flex flex-col items-center gap-2 text-center">
          <Image
            src="/logo.svg"
            alt="PipeLeads"
            width={160}
            height={40}
            className="mx-auto mb-8"
          />
          <p className="text-sm text-muted-foreground">
            Connecte-toi pour accéder à ton espace
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Connexion</CardTitle>
            <CardDescription>
              Reçois un lien de connexion par email.
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
