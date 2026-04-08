import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Reconstruit l'URL de base publique depuis les headers du proxy.
 * request.url pointe vers l'adresse interne du container (localhost:3000)
 * quand Next.js tourne derrière un reverse proxy — on ne doit jamais s'en servir
 * comme base pour les redirections vers le navigateur.
 */
function getPublicBaseUrl(request: NextRequest): string {
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (request.nextUrl.protocol.replace(':', '') || 'https')
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    'localhost:3000'
  return `${proto}://${host}`
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const baseUrl = getPublicBaseUrl(request)

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=true', baseUrl))
  }

  // Le middleware injecte les credentials du bon projet Supabase tenant.
  // Si absent (domaine racine ou dev sans tenant), on retombe sur les vars d'env globales.
  const tenantUrl =
    request.headers.get('x-tenant-supabase-url') ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const tenantAnonKey =
    request.headers.get('x-tenant-anon-key') ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const cookieStore = await cookies()

  const supabase = createServerClient(tenantUrl, tenantAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Auth Callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(new URL('/login?error=true', baseUrl))
  }

  return NextResponse.redirect(new URL('/contacts', baseUrl))
}
