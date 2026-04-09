import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManager } from '@/lib/tenant/roles'

/**
 * GET /api/team
 * Réservé aux managers.
 * Retourne la liste des tenant_users avec email et created_at depuis auth.users.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    await requireManager(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'Accès réservé aux managers' }, { status: 403 })
  }

  const adminClient = createAdminClient()

  const { data: tenantUsers, error: tuError } = await adminClient
    .from('tenant_users')
    .select('id, user_id, role, invited_by, created_at')
    .order('created_at', { ascending: true })

  if (tuError) {
    return NextResponse.json({ error: 'Erreur lors de la récupération de l\'équipe' }, { status: 500 })
  }

  // Récupérer les emails depuis auth.users
  const userIds = tenantUsers.map((u) => u.user_id)
  const { data: { users: authUsers }, error: usersError } = await adminClient.auth.admin.listUsers()

  if (usersError) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des utilisateurs' }, { status: 500 })
  }

  const authMap = new Map(authUsers.map((u) => [u.id, u]))

  const team = tenantUsers.map((tu) => {
    const authUser = authMap.get(tu.user_id)
    return {
      id: tu.id,
      userId: tu.user_id,
      role: tu.role,
      invitedBy: tu.invited_by,
      createdAt: tu.created_at,
      email: authUser?.email ?? null,
      lastSignIn: authUser?.last_sign_in_at ?? null,
    }
  })

  return NextResponse.json({ data: team })
}
