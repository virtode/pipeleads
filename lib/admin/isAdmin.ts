import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Vérifie si l'utilisateur connecté est un super admin.
 * Interroge la table admin_users du Supabase master.
 * Retourne false en cas d'erreur (jamais throws).
 * Utilisable uniquement dans les Server Components.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) return false

    const masterUrl = process.env.MASTER_SUPABASE_URL
    const masterKey = process.env.MASTER_SUPABASE_SERVICE_KEY

    if (!masterUrl || !masterKey) return false

    const master = createSupabaseClient(masterUrl, masterKey, {
      auth: { persistSession: false },
    })

    const { data } = await master
      .from('admin_users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    return data !== null
  } catch {
    return false
  }
}
