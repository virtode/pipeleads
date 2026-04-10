import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  // Verify user session via the standard server client
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const master = createMasterAdminClient()

  const body = await req.json().catch(() => null)
  const parsed = ProvisionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { tenantSlug, userEmail, carddavPassword } = parsed.data

  // Resolve tenant
  const { data: tenant } = await master
    .from('tenants')
    .select('id, name')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })
  }

  // Resolve target user by email (master auth)
  const { data: { users: authUsers } } = await master.auth.admin.listUsers()
  const targetUser = authUsers.find((u) => u.email === userEmail)

  if (!targetUser) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  // Security: verify userEmail belongs to this tenant
  const { data: tenantUser } = await master
    .from('tenant_users')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('user_id', targetUser.id)
    .single()

  if (!tenantUser) {
    return NextResponse.json(
      { error: 'Cet utilisateur n\'appartient pas à ce tenant' },
      { status: 403 }
    )
  }

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

  // Persist carddav_password in tenant_users so initialSync can reprovision on restart
  try {
    await master
      .from('tenant_users')
      .update({ carddav_password: carddavPassword })
      .eq('id', tenantUser.id)
  } catch (err) {
    // Non-fatal: provisioning succeeded, just log the persistence failure
    console.error('[carddav/provision] Failed to persist carddav_password:', err)
  }

  return NextResponse.json({
    data: {
      server: carddavHost,
      username: userEmail,
      password: carddavPassword,
      path: `/${userEmail}/${tenantSlug}-addressbook/`,
      tenantName: tenant.name,
    },
  })
}
