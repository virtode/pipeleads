import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient } from '@/lib/admin/auth'
import { z } from 'zod'

const ProvisionSchema = z.object({
  tenantSlug: z.string().min(1),
  userEmail: z.string().email(),
  carddavPassword: z.string().min(8),
})

/**
 * POST /api/carddav/provision
 * Admin-only. Provisions a CardDAV user for a tenant and returns iOS config.
 */
export async function POST(req: NextRequest) {
  // Verify master admin session
  const master = createMasterAdminClient()
  const {
    data: { session },
  } = await (master as ReturnType<typeof createMasterAdminClient> & {
    auth: { getSession: () => Promise<{ data: { session: unknown } }> }
  }).auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = ProvisionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { tenantSlug, userEmail, carddavPassword } = parsed.data

  const syncUrl = process.env.CARDDAV_SYNC_URL ?? 'http://localhost:3001'
  const internalSecret = process.env.CARDDAV_INTERNAL_SECRET

  if (!internalSecret) {
    console.error('[carddav/provision] CARDDAV_INTERNAL_SECRET not set')
    return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
  }

  const res = await fetch(`${syncUrl}/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${internalSecret}`,
    },
    body: JSON.stringify({ userEmail, carddavPassword, tenantSlug }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[carddav/provision] sync-service error:', text)
    return NextResponse.json({ error: 'Erreur lors du provisioning' }, { status: 502 })
  }

  const carddavHost = process.env.CARDDAV_HOST ?? 'https://carddav.pipeleads.app'

  const { data: tenant } = await master
    .from('tenants')
    .select('id, name')
    .eq('slug', tenantSlug)
    .single()

  // Persist carddav_password in tenant_users so initialSync can reprovision on restart
  if (tenant) {
    try {
      const { data: { users: authUsers } } = await master.auth.admin.listUsers()
      const authUser = authUsers.find((u) => u.email === userEmail)
      if (authUser) {
        await master
          .from('tenant_users')
          .upsert(
            {
              user_id: authUser.id,
              tenant_id: tenant.id,
              role: 'manager',
              carddav_password: carddavPassword,
            },
            { onConflict: 'user_id,tenant_id' }
          )
      }
    } catch (err) {
      // Non-fatal: provisioning succeeded, just log the persistence failure
      console.error('[carddav/provision] Failed to persist carddav_password:', err)
    }
  }

  return NextResponse.json({
    data: {
      server: carddavHost,
      username: userEmail,
      password: carddavPassword,
      path: `/${userEmail}/${tenantSlug}-addressbook/`,
      tenantName: tenant?.name ?? tenantSlug,
    },
  })
}
