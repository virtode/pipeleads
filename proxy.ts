import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Chemins accessibles sans session
const PUBLIC_PATHS = ['/login', '/callback']

// Noms des cookies de session Stytch
const STYTCH_SESSION_COOKIE = 'stytch_session'
const STYTCH_SESSION_JWT_COOKIE = 'stytch_session_jwt'

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Laisse passer les routes publiques
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Vérifie la présence du cookie de session Stytch
  // Le JWT (stytch_session_jwt) est préféré car il peut être vérifié sans appel réseau.
  // Pour une vérification cryptographique complète, installer le SDK serveur `stytch`
  // et valider la signature via stytch.sessions.authenticate().
  const sessionToken =
    request.cookies.get(STYTCH_SESSION_JWT_COOKIE)?.value ||
    request.cookies.get(STYTCH_SESSION_COOKIE)?.value

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url)
    // Conserve l'URL de destination pour rediriger après login si besoin
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Applique le middleware à toutes les routes SAUF :
     * - _next/static  (fichiers statiques)
     * - _next/image   (optimisation images)
     * - favicon.ico
     * - fichiers avec extension (images, fonts, etc.)
     * - routes API (ont leur propre vérification)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\..*).*)',
  ],
}
