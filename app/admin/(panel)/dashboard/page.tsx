export const dynamic = 'force-dynamic'

import { createMasterAdminClient } from '@/lib/admin/auth'
import { Building2, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface Tenant {
  id: string
  slug: string
  name: string
  is_active: boolean
  created_at: string
}

export default async function AdminDashboardPage() {
  const master = createMasterAdminClient()

  const { data: tenants } = await master
    .from('tenants')
    .select('id, slug, name, is_active, created_at')
    .order('created_at', { ascending: false })

  const all: Tenant[] = tenants ?? []
  const active = all.filter((t) => t.is_active).length
  const inactive = all.filter((t) => !t.is_active).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Vue d'ensemble des tenants PipeLeads.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Total tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{all.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Inactifs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-400">{inactive}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent tenants */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Tenants récents</h2>
        <div className="rounded-lg border divide-y">
          {all.slice(0, 10).map((tenant) => (
            <Link
              key={tenant.id}
              href={`/admin/tenants/${tenant.slug}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tenant.name}</p>
                <p className="text-xs text-zinc-500">{tenant.slug}.pipeleads.app</p>
              </div>
              {tenant.is_active ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-zinc-400" />
              )}
              <span className="text-xs text-zinc-400 shrink-0">
                {new Date(tenant.created_at).toLocaleDateString('fr-FR')}
              </span>
            </Link>
          ))}
          {all.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">Aucun tenant.</p>
          )}
        </div>
      </div>
    </div>
  )
}
