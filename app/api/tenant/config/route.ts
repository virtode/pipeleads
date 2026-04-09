import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * GET /api/tenant/config
 * Retourne le tenantId et le slug du tenant courant.
 * Consommé par SupabaseProvider pour initialiser le tenantId côté browser.
 *
 * En mode solo / dev local (domaine racine) : retourne tenantId: null.
 */
export async function GET() {
  const headerStore = await headers()

  const tenantId = headerStore.get('x-tenant-id') ?? null
  const slug = headerStore.get('x-tenant-slug') ?? null

  return NextResponse.json({ tenantId, slug })
}
