import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient, getAdminSession } from '@/lib/admin/auth'
import { z } from 'zod'

const RoleSchema = z.object({
  role: z.enum(['manager', 'member']),
})

/**
 * DELETE /api/admin/tenants/[slug]/users/[userId]
 * Supprime définitivement l'utilisateur du tenant et de Supabase Auth.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { slug, userId } = await params
  const master = createMasterAdminClient()

  const { data: tenant, error: tenantError } = await master
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 404 })
  }

  const { error: tuError } = await master
    .from('tenant_users')
    .delete()
    .eq('user_id', userId)
    .eq('tenant_id', tenant.id)

  if (tuError) {
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  const { error: deleteError } = await master.auth.admin.deleteUser(userId)

  if (deleteError) {
    console.error('[admin/users/delete] deleteUser error:', deleteError)
  }

  return NextResponse.json({ success: true })
}

/**
 * PATCH /api/admin/tenants/[slug]/users/[userId]
 * Met à jour le rôle de l'utilisateur dans ce tenant.
 * Body: { role: 'manager' | 'member' }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { slug, userId } = await params
  const body = await req.json().catch(() => null)
  const parsed = RoleSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { role } = parsed.data
  const master = createMasterAdminClient()

  const { data: tenant, error: tenantError } = await master
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 404 })
  }

  const { error } = await master
    .from('tenant_users')
    .update({ role })
    .eq('user_id', userId)
    .eq('tenant_id', tenant.id)

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du rôle' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
