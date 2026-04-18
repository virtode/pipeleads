import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type TenantRole = 'manager' | 'member'

/**
 * Retourne le rôle d'un utilisateur dans le tenant courant, ou null s'il n'existe pas.
 */
export async function getUserRole(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<TenantRole | null> {
  const { data, error } = await supabase
    .from('tenant_users')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data.role as TenantRole
}

/**
 * Retourne true si l'utilisateur est manager du tenant courant.
 */
export async function isManager(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const role = await getUserRole(supabase, userId)
  return role === 'manager'
}

/**
 * Lance une erreur si l'utilisateur n'est pas manager.
 * Utiliser dans les Route Handlers pour protéger les endpoints.
 */
export async function requireManager(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const ok = await isManager(supabase, userId)
  if (!ok) {
    throw new Error('FORBIDDEN: manager role required')
  }
}

/**
 * HOF : enveloppe un handler Next.js Route Handler pour vérifier le rôle manager
 * avant d'exécuter la logique métier.
 *
 * Usage :
 *   export const POST = withManagerRole(async (req, { supabase, userId }) => { ... })
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type HandlerContext = {
  supabase: SupabaseClient<Database>
  userId: string
}

type Handler = (
  req: NextRequest,
  ctx: HandlerContext,
  params?: Record<string, string>
) => Promise<NextResponse>

export function withManagerRole(handler: Handler) {
  return async (req: NextRequest, params?: Record<string, string>): Promise<NextResponse> => {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    try {
      await requireManager(supabase, user.id)
    } catch {
      return NextResponse.json({ error: 'Accès réservé aux managers' }, { status: 403 })
    }

    return handler(req, { supabase, userId: user.id }, params)
  }
}
