import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * GET /api/tenant/config
 * Retourne les credentials publics du tenant courant (url + anon key uniquement).
 * La service role key n'est jamais exposée ici.
 *
 * En mode tenant : lit les headers x-tenant-* injectés par le middleware.
 * En mode solo / dev local : retourne les variables d'environnement par défaut.
 */
export async function GET() {
  const headerStore = await headers()

  const url =
    headerStore.get('x-tenant-supabase-url') ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!

  const anonKey =
    headerStore.get('x-tenant-anon-key') ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return NextResponse.json({ url, anonKey })
}
