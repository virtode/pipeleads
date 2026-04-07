import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * POST /api/admin/logout
 * Déconnecte l'admin via supabase.auth.signOut() — @supabase/ssr gère
 * la suppression des cookies automatiquement.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()

  const response = NextResponse.redirect(new URL('/admin/login', req.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.signOut()

  return response
}
