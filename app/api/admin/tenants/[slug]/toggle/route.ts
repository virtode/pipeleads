import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient } from '@/lib/admin/auth'

/**
 * POST /api/admin/tenants/[slug]/toggle
 * Active ou désactive un tenant (bascule is_active).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const master = createMasterAdminClient()

  const { data: tenant } = await master
    .from('tenants')
    .select('id, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 404 })
  }

  const { error } = await master
    .from('tenants')
    .update({ is_active: !tenant.is_active })
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  return NextResponse.json({ data: { slug, is_active: !tenant.is_active } })
}
