import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * Crée un client Supabase pour le projet Master en utilisant la service role key.
 * Utilisable uniquement côté serveur.
 */
export function createMasterAdminClient() {
  const url = process.env.MASTER_SUPABASE_URL
  const key = process.env.MASTER_SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error('MASTER_SUPABASE_URL ou MASTER_SUPABASE_SERVICE_KEY manquant')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

/**
 * Vérifie que l'utilisateur connecté est dans la table admin_users du master.
 * Redirige vers /admin/login si non autorisé.
 * À appeler dans les Server Components de l'admin.
 *
 * Utilise @supabase/ssr createServerClient pour lire la session depuis les cookies
 * posés par createBrowserClient côté login — les noms de cookies sont cohérents.
 */
export async function requireAdminAuth(): Promise<{ email: string; id: string }> {
  const cookieStore = await cookies()
  console.log('[AUTH] Cookies disponibles:', cookieStore.getAll().map(c => c.name))
  const masterUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const masterAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const masterServiceKey = process.env.MASTER_SUPABASE_SERVICE_KEY

  if (!masterUrl || !masterAnonKey || !masterServiceKey) {
    redirect('/admin/login')
  }

  // @supabase/ssr gère automatiquement le nom du cookie (sb-[ref]-auth-token)
  // et le décodage — cohérent avec createBrowserClient utilisé dans login/page.tsx
  const supabase = createServerClient(masterUrl, masterAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // setAll peut échouer dans un Server Component en lecture seule
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  console.log('[AUTH] User from session:', user?.email ?? 'null')

  if (!user?.email) {
    redirect('/admin/login')
  }

  // Vérifier que l'email est dans admin_users (via service role)
  const adminClient = createClient(
    process.env.MASTER_SUPABASE_URL!,
    masterServiceKey,
    { auth: { persistSession: false } }
  )

  const { data: adminUser, error: adminError } = await adminClient
    .from('admin_users')
    .select('id, email')
    .eq('email', user.email)
    .single()

  if (adminError || !adminUser) {
    redirect('/admin/login')
  }

  return { email: adminUser.email, id: adminUser.id }
}
