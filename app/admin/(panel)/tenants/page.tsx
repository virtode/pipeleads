export const dynamic = 'force-dynamic'

import { createMasterAdminClient } from '@/lib/admin/auth'
import Link from 'next/link'
import { Plus, CheckCircle2, XCircle, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TenantToggleButton } from '@/components/admin/TenantToggleButton'

interface Tenant {
  id: string
  slug: string
  name: string
  is_active: boolean
  created_at: string
}

export default async function AdminTenantsPage() {
  const master = createMasterAdminClient()
  const { data: tenants } = await master
    .from('tenants')
    .select('id, slug, name, is_active, created_at')
    .order('created_at', { ascending: false })

  const all: Tenant[] = tenants ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Tenants</h1>
          <p className="mt-1 text-sm text-zinc-500">{all.length} client{all.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild>
          <Link href="/admin/tenants/new">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau client
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border divide-y">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-medium text-zinc-500">
          <span>Client</span>
          <span>Statut</span>
          <span>Créé le</span>
          <span />
        </div>

        {all.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-zinc-500">
            <Building2 className="h-8 w-8 opacity-30" />
            Aucun tenant. <Link href="/admin/tenants/new" className="text-primary underline">Créer le premier</Link>
          </div>
        )}

        {all.map((tenant) => (
          <div key={tenant.id} className="relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
            <Link href={`/admin/tenants/${tenant.slug}`} className="absolute inset-0" aria-label={tenant.name} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{tenant.name}</p>
              <p className="text-xs text-zinc-500">{tenant.slug}.pipeleads.app</p>
            </div>

            <Badge
              variant={tenant.is_active ? 'secondary' : 'outline'}
              className={`gap-1 ${tenant.is_active ? 'text-green-600' : 'text-zinc-400'}`}
            >
              {tenant.is_active ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {tenant.is_active ? 'Actif' : 'Inactif'}
            </Badge>

            <span className="text-xs text-zinc-500 shrink-0">
              {new Date(tenant.created_at).toLocaleDateString('fr-FR')}
            </span>

            <div className="relative z-10">
              <TenantToggleButton slug={tenant.slug} isActive={tenant.is_active} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
