import { NextResponse } from 'next/server'
import { getTenantFromHeaders } from '@/lib/tenant/context'

/**
 * GET /api/tenant/me
 * Retourne les infos publiques du tenant courant (pas les clés Supabase).
 * En mode solo / dev local, retourne data: null.
 */
export async function GET() {
  const tenant = await getTenantFromHeaders()

  if (!tenant) {
    return NextResponse.json({ data: null })
  }

  return NextResponse.json({
    data: {
      tenantId: tenant.tenantId,
      slug: tenant.slug,
      name: tenant.name,
    },
  })
}
