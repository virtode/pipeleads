'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { Loader2, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return

    setIsSending(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (otpError) {
        if (otpError.message.toLowerCase().includes('signups not allowed')) {
          setError('Adresse email non reconnue. Contacte l\'administrateur.')
        } else {
          setError(`Erreur : ${otpError.message}`)
        }
        return
      }

      setSent(true)
    } catch (err) {
      console.error('[Auth] Magic link error:', err)
      setError('Erreur inattendue. Réessaie.')
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
            src="/logo.png"
            alt="PipeLeads"
            width={200}
            height={50}
            className="mx-auto mb-8"
            priority
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
                <p className="font-medium">Vérifie ta boîte mail ✉️</p>
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
