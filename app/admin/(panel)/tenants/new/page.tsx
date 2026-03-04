'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default function NewTenantPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<NewTenantForm>({
    resolver: zodResolver(NewTenantSchema),
    defaultValues: { managerEmail: '' },
  })

  const slug = watch('slug') ?? ''
  const slugStatus = useSlugCheck(slug)

  async function onSubmit(data: NewTenantForm) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur lors de la création')
        return
      }

      toast.success('Tenant créé avec succès')
      router.push(`/admin/tenants/${data.slug}`)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

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

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || slugStatus === 'taken'} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
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
