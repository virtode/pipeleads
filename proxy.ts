/**
 * middleware.ts — Multi-tenant subdomain routing + Supabase session refresh
 *
 * Flux complet :
 *   1. Lit le header "host" de chaque requête.
 *   2. Extrait le slug du sous-domaine :
 *        client1.pipeleads.app → "client1"
 *        pipeleads.app / www.pipeleads.app → null (domaine racine)
 *        localhost:3000 → null (dev local sans tenant)
 *        client1.localhost:3000 → "client1" (dev local avec tenant)
 *   3. Si slug présent :
 *        - Interroge la table `tenants` du Supabase master via service role key.
 *        - Tenant inexistant ou is_active = false → redirect /tenant-not-found.
 *        - Tenant valide → injecte x-tenant-id, x-tenant-slug, x-tenant-name.
 *   4. Rafraîchit la session Supabase (instance unique partagée).
 *   5. Protège les routes non-auth (redirect /login si pas de session).
 *
 * Headers injectés (lisibles via `headers()` de next/headers) :
 *   x-tenant-id     UUID du tenant dans le master (absent si domaine racine)
 *   x-tenant-slug   slug du tenant
 *   x-tenant-name   nom de l'entreprise
 *
 * Tous les clients Supabase (serveur et browser) utilisent les mêmes
 * credentials (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY). L'isolation est
 * assurée par RLS via app.tenant_id dans chaque transaction.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'pipeleads.app'
const MASTER_URL = process.env.MASTER_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const MASTER_KEY = process.env.MASTER_SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'dev', 'admin', 'staging', 'carddav']

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantRow {
  id: string
  slug: string
  name: string
  is_active: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extrait le slug tenant depuis le host, ou null si domaine racine / localhost nu. */
function extractSlug(host: string): string | null {
  const hostname = host.split(':')[0]

  // Dev local : client1.localhost
  if (hostname.endsWith('.localhost')) {
    const slug = hostname.replace(/\.localhost$/, '')
    return slug && !RESERVED_SUBDOMAINS.includes(slug) ? slug : null
  }

  // Production : client1.pipeleads.app
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = hostname.replace(`.${ROOT_DOMAIN}`, '')
    return slug && !RESERVED_SUBDOMAINS.includes(slug) ? slug : null
  }

  return null
}

/** Résout un tenant depuis le Supabase master. Retourne null en cas d'erreur. */
async function resolveTenant(slug: string): Promise<TenantRow | null> {
  if (!MASTER_URL || !MASTER_KEY) return null

  try {
    const res = await fetch(
      `${MASTER_URL}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,is_active&limit=1`,
      {
        headers: {
          apikey: MASTER_KEY,
          Authorization: `Bearer ${MASTER_KEY}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) return null
    const rows = await res.json() as TenantRow[]
    return rows[0] ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const slug = extractSlug(host)
  const pathname = request.nextUrl.pathname

  // ── Routes admin : ne pas résoudre de tenant ──────────────────────────────
  const isAdminRoute =
    pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
  const isTenantNotFound = pathname.startsWith('/tenant-not-found')

  if (isTenantNotFound || isAdminRoute) {
    return NextResponse.next({ request })
  }

  const isIcalRoute = pathname.startsWith('/api/ical/')
  if (isIcalRoute) {
    return NextResponse.next({ request })
  }

  const isCronRoute = pathname.startsWith('/api/cron/')
  if (isCronRoute) {
    return NextResponse.next({ request })
  }

  // ── Résolution du tenant ──────────────────────────────────────────────────
  let requestHeaders = new Headers(request.headers)

  if (slug) {
    if (!MASTER_URL || !MASTER_KEY) {
      console.error('[middleware] MASTER_SUPABASE_URL ou MASTER_SUPABASE_SERVICE_KEY manquant')
      return NextResponse.redirect(new URL('/tenant-not-found', request.url))
    }

    const tenant = await resolveTenant(slug)

    if (!tenant || !tenant.is_active) {
      return NextResponse.redirect(new URL('/tenant-not-found', request.url))
    }

    requestHeaders.set('x-tenant-id', tenant.id)
    requestHeaders.set('x-tenant-slug', tenant.slug)
    requestHeaders.set('x-tenant-name', tenant.name)
  }

  // ── Rafraîchissement de session Supabase ──────────────────────────────────
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Protection des routes ─────────────────────────────────────────────────
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|api/ical|email-templates/|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)',
  ],
}
