export const dynamic = 'force-dynamic'

import { createMasterAdminClient } from '@/lib/admin/auth'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { CheckCircle2, XCircle, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TenantToggleButton } from '@/components/admin/TenantToggleButton'
import { TenantInviteManagerButton } from '@/components/admin/TenantInviteManagerButton'
import { TenantDeleteButton } from '@/components/admin/TenantDeleteButton'
import { CardDavProvision } from '@/components/admin/CardDavProvision'
import { TenantAIConfigSection } from '@/components/admin/TenantAIConfigSection'
import { generateCarddavPassword } from '@/lib/carddav/password'

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

interface TenantUser {
  id: string
  user_id: string
  role: string
  created_at: string
}

interface CardDavConfig {
  server: string
  username: string
  password: string
  path: string
}

interface CardDavUser {
  email: string
  role: string
  userId: string
  config: CardDavConfig | null
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

  // Récupérer tous les utilisateurs du tenant avec leur statut CardDAV depuis master
  let cardDavUsers: CardDavUser[] = []
  try {
    const { data: tenantUsersData } = await master
      .from('tenant_users')
      .select('user_id, role, carddav_password')
      .eq('tenant_id', t.id)

    if (tenantUsersData && tenantUsersData.length > 0) {
      const {
        data: { users: authUsers },
      } = await master.auth.admin.listUsers()
      const authMap = new Map(authUsers.map((u) => [u.id, u.email]))

      const carddavHost = process.env.CARDDAV_HOST ?? 'https://carddav.pipeleads.app'

      cardDavUsers = tenantUsersData
        .filter((tu) => authMap.has(tu.user_id))
        .map((tu) => {
          const email = authMap.get(tu.user_id) ?? ''
          const hasPassword = !!(tu as { carddav_password?: string | null }).carddav_password

          let config: CardDavConfig | null = null
          if (hasPassword && email) {
            try {
              const password = generateCarddavPassword(email)
              config = {
                server: carddavHost,
                username: email,
                password,
                path: `/${email}/${t.slug}-addressbook/`,
              }
            } catch {
              // CARDDAV_PASSWORD_SECRET not set — config unavailable
            }
          }

          return {
            userId: tu.user_id,
            email,
            role: tu.role as string,
            config,
          }
        })
    }
  } catch {
    // Pas encore d'utilisateurs CardDAV pour ce tenant
  }

  // Récupérer les managers depuis le projet Supabase du tenant
  let managers: Array<{ email: string | undefined; createdAt: string; role: string }> = []
  try {
    const tenantAdmin = createSupabaseAdmin(t.supabase_url, t.supabase_service_role_key)

    const { data: tenantUsers } = await tenantAdmin
      .from('tenant_users')
      .select('id, user_id, role, created_at')
      .eq('role', 'manager')
      .order('created_at', { ascending: true })

    if (tenantUsers && tenantUsers.length > 0) {
      const { data: { users } } = await tenantAdmin.auth.admin.listUsers()
      const authMap = new Map(users.map((u) => [u.id, u.email]))

      managers = (tenantUsers as TenantUser[]).map((tu) => ({
        email: authMap.get(tu.user_id),
        createdAt: tu.created_at,
        role: tu.role,
      }))
    }
  } catch {
    // Tenant Supabase peut ne pas encore avoir la table tenant_users
  }

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

      {/* CardDAV */}
      <div className="rounded-lg border p-4">
        <CardDavProvision
          tenantName={t.name}
          users={cardDavUsers}
        />
      </div>

      {/* Configuration IA */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Configuration IA</h2>
        <TenantAIConfigSection slug={t.slug} />
      </div>

      {/* Managers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Managers</h2>
          <TenantInviteManagerButton
            tenantSlug={t.slug}
            supabaseUrl={t.supabase_url}
            serviceKey={t.supabase_service_role_key}
          />
        </div>

        <div className="rounded-lg border divide-y">
          {managers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-zinc-500">
              <UserPlus className="h-6 w-6 opacity-30" />
              Aucun manager. Invitez le premier manager.
            </div>
          ) : (
            managers.map((m, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                  {m.email ? m.email.slice(0, 2).toUpperCase() : '??'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.email ?? 'Email inconnu'}</p>
                  <p className="text-xs text-zinc-500">
                    Manager depuis le{' '}
                    {new Date(m.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
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
