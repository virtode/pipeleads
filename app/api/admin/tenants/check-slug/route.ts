import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient } from '@/lib/admin/auth'

/**
 * GET /api/admin/tenants/check-slug?slug=xxx
 * Vérifie en temps réel si un slug est disponible.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.toLowerCase() ?? ''

  if (!slug || !/^[a-z0-9-]{2,63}$/.test(slug)) {
    return NextResponse.json({ available: false, reason: 'Format invalide' })
  }

  const master = createMasterAdminClient()
  const { data } = await master
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  return NextResponse.json({ available: !data })
}
