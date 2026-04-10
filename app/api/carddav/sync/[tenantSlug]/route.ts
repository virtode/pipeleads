import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/carddav/sync/[tenantSlug]
 * Admin-only. Déclenche une synchronisation manuelle des contacts
 * vers la collection CardDAV d'un tenant spécifique.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params

  const syncUrl = process.env.CARDDAV_SYNC_URL ?? 'http://localhost:3001'
  const internalSecret = process.env.CARDDAV_INTERNAL_SECRET

  if (!internalSecret) {
    console.error('[carddav/sync] CARDDAV_INTERNAL_SECRET not set')
    return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
  }

  const res = await fetch(`${syncUrl}/sync/${encodeURIComponent(tenantSlug)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${internalSecret}` },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[carddav/sync] sync-service error for ${tenantSlug}:`, text)
    return NextResponse.json({ error: 'Erreur de synchronisation' }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json({ data })
}
