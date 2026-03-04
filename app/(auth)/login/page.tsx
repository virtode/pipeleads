'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { Loader2, Mail, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const RESEND_COOLDOWN = 30

export default function LoginPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [phase, setPhase] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleSendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return

    setIsSending(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      })

      if (otpError) {
        if (otpError.message.toLowerCase().includes('signups not allowed')) {
          setError("Adresse email non reconnue. Contacte l'administrateur.")
        } else {
          setError(`Erreur : ${otpError.message}`)
        }
        return
      }

      setCode('')
      setPhase('otp')
      startCooldown()
      setTimeout(() => codeInputRef.current?.focus(), 50)
    } catch {
      setError('Erreur inattendue. Réessaie.')
    } finally {
      setIsSending(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0) return

    setIsSending(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      })

      if (otpError) {
        setError(`Erreur : ${otpError.message}`)
        return
      }

      setCode('')
      startCooldown()
      codeInputRef.current?.focus()
    } catch {
      setError('Erreur inattendue. Réessaie.')
    } finally {
      setIsSending(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (code.length !== 6) return

    setIsVerifying(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'email',
      })

      if (verifyError) {
        setError('Code invalide ou expiré, vérifie ton email ou demande un nouveau code.')
        return
      }

      router.push('/contacts')
    } catch {
      setError('Erreur inattendue. Réessaie.')
    } finally {
      setIsVerifying(false)
    }
  }

  function handleBackToEmail() {
    setPhase('email')
    setCode('')
    setError(null)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    setCooldown(0)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="flex flex-col items-center gap-2 text-center">
          <Image
            src={mounted && resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo.png'}
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
              {phase === 'email'
                ? 'Reçois un code à 6 chiffres par email.'
                : `Code envoyé à ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {phase === 'email' ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
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
                      Recevoir un code
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="code">Code à 6 chiffres</Label>
                  <Input
                    ref={codeInputRef}
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoComplete="one-time-code"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isVerifying || code.length !== 6}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vérification…
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Valider
                    </>
                  )}
                </Button>

                <div className="flex flex-col items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || isSending}
                    className="text-xs text-primary underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cooldown > 0
                      ? `Renvoyer un code (${cooldown}s)`
                      : 'Renvoyer un code'}
                  </button>
                  <button
                    type="button"
                    onClick={handleBackToEmail}
                    className="text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Modifier l'adresse email
                  </button>
                </div>
              </form>
            )}

            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
