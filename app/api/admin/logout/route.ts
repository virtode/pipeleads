import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/logout
 * Déconnecte l'admin en supprimant les cookies de session Supabase master.
 */
export async function POST() {
  const cookieStore = await cookies()

  // Supprimer les cookies de session Supabase (préfixe sb-)
  const allCookies = cookieStore.getAll()
  const response = NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_ROOT_DOMAIN ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}` : 'http://localhost:3000'))

  for (const cookie of allCookies) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.delete(cookie.name)
    }
  }

  return response
}
