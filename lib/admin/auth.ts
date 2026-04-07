import { createClient } from '@supabase/supabase-js'
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
 * Crée un client Supabase Master avec la session de l'utilisateur courant
 * (pour les appels authentifiés depuis le browser via l'admin UI).
 */
export function createMasterClient() {
  const url = process.env.MASTER_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // Le master peut réutiliser une anon key dédiée

  if (!url || !anonKey) {
    throw new Error('Configuration master manquante')
  }

  return createClient(url, anonKey)
}

/**
 * Vérifie que l'utilisateur connecté est dans la table admin_users du master.
 * Redirige vers /admin/login si non autorisé.
 * À appeler dans les Server Components de l'admin.
 */
export async function requireAdminAuth(): Promise<{ email: string; id: string }> {
  const cookieStore = await cookies()
  const masterUrl = process.env.MASTER_SUPABASE_URL
  const masterKey = process.env.MASTER_SUPABASE_SERVICE_KEY

  if (!masterUrl || !masterKey) {
    redirect('/admin/login')
  }

  // Supabase JS v2 stocke le token dans sb-[PROJECT_REF]-auth-token
  // On cherche tous les cookies qui commencent par 'sb-' et finissent par '-auth-token'
  const allCookies = cookieStore.getAll()
  const authCookie = allCookies.find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))
  const sessionStr = authCookie?.value

  if (!sessionStr) {
    redirect('/admin/login')
  }

  // Décoder le cookie base64
  let accessToken: string | undefined
  try {
    const decoded = Buffer.from(decodeURIComponent(sessionStr), 'base64').toString('utf-8')
    const session = JSON.parse(decoded)
    accessToken = session?.access_token
  } catch {
    redirect('/admin/login')
  }

  if (!accessToken) {
    redirect('/admin/login')
  }

  // Vérifier le token via le master
  const adminClient = createMasterAdminClient()
  const { data: { user }, error } = await adminClient.auth.getUser(accessToken)

  if (error || !user?.email) {
    redirect('/admin/login')
  }

  // Vérifier que l'email est dans admin_users
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
