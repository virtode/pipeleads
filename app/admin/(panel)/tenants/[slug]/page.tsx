export const dynamic = 'force-dynamic'

import { createMasterAdminClient } from '@/lib/admin/auth'
import { notFound } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TenantToggleButton } from '@/components/admin/TenantToggleButton'
import { TenantDeleteButton } from '@/components/admin/TenantDeleteButton'
import { TenantAIConfigSection } from '@/components/admin/TenantAIConfigSection'
import { TenantUsersSection } from '@/components/admin/TenantUsersSection'

interface Tenant {
  id: string
  slug: string
  name: string
  supabase_url: string
  supabase_anon_key: string
  supabase_service_role_key: string
  manager_email: string | null
  is_active: boolean
  created_at: string
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function TenantDetailPage({ params }: Props) {
  const { slug } = await params
  const master = createMasterAdminClient()

  const { data: tenant } = await master
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!tenant) notFound()

  const t = tenant as Tenant

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t.name}</h1>
          <p className="mt-1 font-mono text-sm text-zinc-500">{t.slug}.pipeleads.app</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={t.is_active ? 'secondary' : 'outline'}
            className={`gap-1 ${t.is_active ? 'text-green-600' : 'text-zinc-400'}`}
          >
            {t.is_active ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {t.is_active ? 'Actif' : 'Inactif'}
          </Badge>
          <TenantToggleButton slug={t.slug} isActive={t.is_active} />
          <TenantDeleteButton slug={t.slug} name={t.name} />
        </div>
      </div>

      {/* Infos */}
      <div className="rounded-lg border divide-y">
        <InfoRow label="ID" value={t.id} mono />
        <InfoRow label="Créé le" value={new Date(t.created_at).toLocaleString('fr-FR')} />
        <InfoRow label="Supabase URL" value={t.supabase_url} mono />
      </div>

      {/* Utilisateurs */}
      <TenantUsersSection slug={t.slug} />

      {/* Configuration IA */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Configuration IA</h2>
        <TenantAIConfigSection slug={t.slug} />
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="w-32 shrink-0 text-sm text-zinc-500">{label}</span>
      <span className={`flex-1 text-sm truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  )
}
