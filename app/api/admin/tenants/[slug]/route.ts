import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient } from '@/lib/admin/auth'

/**
 * DELETE /api/admin/tenants/[slug]
 * Supprime un tenant et ses tenant_managers liés.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const master = createMasterAdminClient()

  const { data: tenant } = await master
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 404 })
  }

  // Supprimer les tenant_managers liés
  await master.from('tenant_managers').delete().eq('tenant_id', tenant.id)

  // Supprimer le tenant
  const { error } = await master.from('tenants').delete().eq('id', tenant.id)

  if (error) {
    console.error('[admin/tenants] delete error:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ data: { deleted: true } })
}
