import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient, getAdminSession } from '@/lib/admin/auth'
import { z } from 'zod'

const InviteSchema = z.object({
  email: z.string().email('Email invalide'),
  role: z.enum(['manager', 'member']).default('member'),
})

/**
 * GET /api/admin/tenants/[slug]/users
 * Liste tous les utilisateurs du tenant avec email, rôle et date d'ajout.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { slug } = await params
  const master = createMasterAdminClient()

  const { data: tenant, error: tenantError } = await master
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 404 })
  }

  const { data: tenantUsers, error: tuError } = await master
    .from('tenant_users')
    .select('user_id, role, created_at')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: true })

  if (tuError) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des utilisateurs' }, { status: 500 })
  }

  if (!tenantUsers || tenantUsers.length === 0) {
    return NextResponse.json({ users: [] })
  }

  const { data: { users: authUsers } } = await master.auth.admin.listUsers()
  const authMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))

  const users = tenantUsers.map((tu) => ({
    userId: tu.user_id,
    email: authMap.get(tu.user_id) ?? '',
    role: tu.role as 'manager' | 'member',
    createdAt: tu.created_at,
  }))

  return NextResponse.json({ users })
}

/**
 * POST /api/admin/tenants/[slug]/users
 * Invite un nouvel utilisateur sur ce tenant (master auth).
 * Body: { email, role }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { slug } = await params
  const body = await req.json().catch(() => null)
  const parsed = InviteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { email, role } = parsed.data
  const master = createMasterAdminClient()

  const { data: tenant, error: tenantError } = await master
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 404 })
  }

  // Vérifier l'unicité de l'email sur tous les tenants
  const { data: { users: masterUsers } } = await master.auth.admin.listUsers()
  const existingUser = masterUsers.find((u) => u.email === email)
  if (existingUser) {
    const { data: existingTu } = await master
      .from('tenant_users')
      .select('id')
      .eq('user_id', existingUser.id)
      .limit(1)
      .maybeSingle()
    if (existingTu) {
      return NextResponse.json(
        { error: 'Cet email est déjà associé à un tenant.' },
        { status: 409 }
      )
    }
  }

  const { data: invited, error: inviteError } = await master.auth.admin.inviteUserByEmail(email)

  if (inviteError) {
    return NextResponse.json(
      { error: inviteError.message ?? 'Erreur lors de l\'invitation' },
      { status: 500 }
    )
  }

  const { error: tuError } = await master.from('tenant_users').insert({
    user_id: invited.user.id,
    tenant_id: tenant.id,
    role,
  })

  if (tuError) {
    console.error('[admin/users] tenant_users insert error:', tuError)
    return NextResponse.json(
      { error: 'Utilisateur invité mais erreur d\'enregistrement du rôle' },
      { status: 500 }
    )
  }

  return NextResponse.json({ user: { userId: invited.user.id, email, role } })
}
