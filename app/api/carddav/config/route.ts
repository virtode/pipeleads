import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMasterAdminClient } from '@/lib/admin/auth'
import { generateCarddavPassword } from '@/lib/carddav/password'

/**
 * GET /api/carddav/config?tenantSlug=xxx&userEmail=xxx
 * Returns the CardDAV iOS config for a specific user in a tenant.
 * The requester must be authenticated. Admin can query any user;
 * regular users can only query themselves.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const tenantSlug = searchParams.get('tenantSlug')
  const userEmail = searchParams.get('userEmail') ?? user.email

  if (!tenantSlug || !userEmail) {
    return NextResponse.json({ error: 'tenantSlug et userEmail requis' }, { status: 422 })
  }

  const master = createMasterAdminClient()

  // Resolve tenant
  const { data: tenant } = await master
    .from('tenants')
    .select('id, name')
    .eq('slug', tenantSlug)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })
  }

  // Resolve the target user in master auth
  const { data: { users: authUsers } } = await master.auth.admin.listUsers()
  const targetUser = authUsers.find((u) => u.email === userEmail)

  if (!targetUser) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  // A non-admin user can only query their own config
  if (targetUser.id !== user.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Verify the user belongs to this tenant
  const { data: tenantUser } = await master
    .from('tenant_users')
    .select('id, carddav_password')
    .eq('tenant_id', tenant.id)
    .eq('user_id', targetUser.id)
    .single()

  if (!tenantUser) {
    return NextResponse.json(
      { error: 'Cet utilisateur n\'appartient pas à ce tenant' },
      { status: 403 }
    )
  }

  let carddavPassword: string
  try {
    carddavPassword = generateCarddavPassword(userEmail)
  } catch {
    return NextResponse.json({ error: 'CARDDAV_PASSWORD_SECRET manquant' }, { status: 500 })
  }

  const carddavHost = process.env.CARDDAV_HOST ?? 'https://carddav.pipeleads.app'

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
