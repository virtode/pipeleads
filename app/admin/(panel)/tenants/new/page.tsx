'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const NewTenantSchema = z.object({
  slug: z
    .string()
    .min(2, 'Minimum 2 caractères')
    .max(63, 'Maximum 63 caractères')
    .regex(/^[a-z0-9-]+$/, 'Uniquement lettres minuscules, chiffres et tirets'),
  name: z.string().min(1, 'Nom requis'),
  supabaseUrl: z.string().url('URL invalide'),
  supabaseAnonKey: z.string().min(10, 'Clé anon invalide'),
  supabaseServiceRoleKey: z.string().min(10, 'Clé service role invalide'),
  managerEmail: z.string().email('Email invalide').optional().or(z.literal('')),
})

type NewTenantForm = z.infer<typeof NewTenantSchema>

// ---------------------------------------------------------------------------
// Slug availability check (debounced)
// ---------------------------------------------------------------------------

function useSlugCheck(slug: string) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  useEffect(() => {
    if (!slug || slug.length < 2) {
      setStatus('idle')
      return
    }

    setStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/tenants/check-slug?slug=${encodeURIComponent(slug)}`)
        const json = await res.json()
        setStatus(json.available ? 'available' : 'taken')
      } catch {
        setStatus('idle')
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [slug])

  return status
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Phase =
  | 'form'
  | 'creating-tenant'
  | 'init-schema'
  | 'schema-error'
  | 'invite'
  | 'done'

export default function NewTenantPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('form')
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [initSchema, setInitSchema] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<NewTenantForm>({
    resolver: zodResolver(NewTenantSchema),
    defaultValues: { managerEmail: '' },
  })

  const slug = watch('slug') ?? ''
  const slugStatus = useSlugCheck(slug)

  async function runInitSchema(supabaseUrl: string, supabaseServiceRoleKey: string) {
    setPhase('init-schema')
    try {
      const res = await fetch('/api/admin/tenants/init-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl, supabaseServiceRoleKey }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setSchemaError(json.error ?? 'Erreur lors de l\'initialisation du schéma')
        setPhase('schema-error')
        return
      }

      // Si un lien d'invitation a été généré, afficher l'écran invite avant de naviguer
      setPhase(inviteLink ? 'invite' : 'done')
    } catch {
      setSchemaError('Erreur réseau lors de l\'initialisation du schéma')
      setPhase('schema-error')
    }
  }

  async function onSubmit(data: NewTenantForm) {
    setPhase('creating-tenant')
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur lors de la création')
        setPhase('form')
        return
      }

      setCreatedSlug(data.slug)

      // Capturer le lien d'invitation si généré
      if (json.data?.inviteLink) {
        setInviteLink(json.data.inviteLink)
        setInviteEmail(data.managerEmail ?? null)
      }

      if (initSchema) {
        await runInitSchema(data.supabaseUrl, data.supabaseServiceRoleKey)
      } else {
        setPhase(json.data?.inviteLink ? 'invite' : 'done')
      }
    } catch {
      toast.error('Erreur réseau')
      setPhase('form')
    }
  }

  // Auto-navigate once on 'done' (no invite link)
  useEffect(() => {
    if (phase === 'done' && createdSlug) {
      toast.success('Tenant créé avec succès')
      router.push(`/admin/tenants/${createdSlug}`)
    }
  }, [phase, createdSlug, router])

  function handleCopyLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ---------------------------------------------------------------------------
  // Post-submit status screen
  // ---------------------------------------------------------------------------

  if (phase === 'creating-tenant') {
    return (
      <div className="mx-auto max-w-2xl">
        <StatusCard
          icon={<Loader2 className="h-6 w-6 animate-spin text-primary" />}
          title="Création du tenant..."
          description="Enregistrement dans le registre master."
        />
      </div>
    )
  }

  if (phase === 'init-schema') {
    return (
      <div className="mx-auto max-w-2xl">
        <StatusCard
          icon={<Loader2 className="h-6 w-6 animate-spin text-primary" />}
          title="Initialisation du schéma en cours..."
          description="Application des tables, index et politiques RLS sur le projet Supabase du tenant."
        />
      </div>
    )
  }

  if (phase === 'schema-error') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <StatusCard
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title="Tenant créé — échec de l'initialisation du schéma"
          description={schemaError ?? 'Erreur inconnue'}
          variant="error"
        />
        <div className="flex gap-3">
          <Button
            onClick={() => {
              const { supabaseUrl, supabaseServiceRoleKey } = getValues()
              runInitSchema(supabaseUrl, supabaseServiceRoleKey)
            }}
            className="gap-2"
          >
            <Loader2 className="h-4 w-4" />
            Réessayer l'initialisation
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/tenants/${createdSlug}`)}
          >
            Ignorer et aller au tenant
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'invite') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <StatusCard
          icon={<CheckCircle2 className="h-6 w-6 text-green-500" />}
          title="Tenant créé avec succès"
          description="Le compte manager a été créé. Envoyez le lien d'invitation ci-dessous."
        />

        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <p className="text-sm font-medium">Lien d&apos;invitation manager</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs break-all font-mono">
              {inviteLink}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={handleCopyLink}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
          {inviteEmail && (
            <p className="text-xs text-zinc-500">
              À envoyer manuellement à{' '}
              <span className="font-medium">{inviteEmail}</span>
            </p>
          )}
        </div>

        <Button onClick={() => router.push(`/admin/tenants/${createdSlug}`)}>
          Aller au tenant
        </Button>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Nouveau client</h1>
        <p className="mt-1 text-sm text-zinc-500">Crée un nouveau tenant PipeLeads.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Identité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug *</Label>
              <div className="relative">
                <Input
                  id="slug"
                  {...register('slug')}
                  placeholder="client1"
                  className={errors.slug ? 'border-destructive' : ''}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === 'checking' && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {slugStatus === 'available' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {slugStatus === 'taken' && (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
              )}
              {slugStatus === 'taken' && (
                <p className="text-xs text-destructive">Ce slug est déjà utilisé.</p>
              )}
              {slug && slugStatus !== 'idle' && (
                <p className="text-xs text-zinc-500">
                  URL générée :{' '}
                  <span className="font-mono font-medium">{slug}.pipeleads.app</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Nom de l'entreprise *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Acme Corp"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Supabase */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Projet Supabase du tenant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="supabaseUrl">Supabase URL *</Label>
              <Input
                id="supabaseUrl"
                {...register('supabaseUrl')}
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                className={errors.supabaseUrl ? 'border-destructive' : ''}
              />
              {errors.supabaseUrl && (
                <p className="text-xs text-destructive">{errors.supabaseUrl.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supabaseAnonKey">Anon Key *</Label>
              <Input
                id="supabaseAnonKey"
                {...register('supabaseAnonKey')}
                placeholder="eyJ..."
                className={errors.supabaseAnonKey ? 'border-destructive' : ''}
              />
              {errors.supabaseAnonKey && (
                <p className="text-xs text-destructive">{errors.supabaseAnonKey.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supabaseServiceRoleKey">Service Role Key *</Label>
              <Input
                id="supabaseServiceRoleKey"
                type="password"
                {...register('supabaseServiceRoleKey')}
                placeholder="eyJ..."
                className={errors.supabaseServiceRoleKey ? 'border-destructive' : ''}
              />
              {errors.supabaseServiceRoleKey && (
                <p className="text-xs text-destructive">{errors.supabaseServiceRoleKey.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Manager */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Manager initial (optionnel)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="managerEmail">Email du manager</Label>
              <Input
                id="managerEmail"
                type="email"
                {...register('managerEmail')}
                placeholder="manager@client.com"
                className={errors.managerEmail ? 'border-destructive' : ''}
              />
              {errors.managerEmail && (
                <p className="text-xs text-destructive">{errors.managerEmail.message}</p>
              )}
              <p className="text-xs text-zinc-500">
                Si renseigné, une invitation sera envoyée et le compte créé avec le rôle Manager.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Schema init */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="initSchema"
                checked={initSchema}
                onCheckedChange={(checked) => setInitSchema(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="initSchema" className="cursor-pointer font-medium">
                  Initialiser le schéma automatiquement
                </Label>
                <p className="text-xs text-zinc-500">
                  Crée les tables, index et politiques RLS PipeLeads sur le projet Supabase du
                  tenant via la Management API. Nécessite{' '}
                  <span className="font-mono">SUPABASE_MANAGEMENT_API_KEY</span>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={phase !== 'form' || slugStatus === 'taken'} className="gap-2">
            Créer le tenant
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Annuler
          </Button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatusCard helper
// ---------------------------------------------------------------------------

function StatusCard({
  icon,
  title,
  description,
  variant = 'default',
}: {
  icon: React.ReactNode
  title: string
  description: string
  variant?: 'default' | 'error'
}) {
  return (
    <div
      className={`rounded-lg border p-6 flex items-start gap-4 ${
        variant === 'error' ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/40'
      }`}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
    </div>
  )
}
