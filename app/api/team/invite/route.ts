import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManager } from '@/lib/tenant/roles'
import { z } from 'zod'

const InviteSchema = z.object({
  email: z.string().email('Email invalide'),
  role: z.enum(['manager', 'member']).default('member'),
})

/**
 * POST /api/team/invite
 * Réservé aux managers.
 * Body : { email, role }
 * Invite l'utilisateur via Supabase Auth et l'enregistre dans tenant_users.
 */
export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => null)
  const parsed = InviteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { email, role } = parsed.data

  const adminClient = createAdminClient()

  // Inviter l'utilisateur via Supabase Auth
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email)

  if (inviteError) {
    console.error('[team/invite] inviteUserByEmail error:', inviteError)
    return NextResponse.json(
      { error: inviteError.message ?? 'Erreur lors de l\'invitation' },
      { status: 500 }
    )
  }

  // Créer l'entrée dans tenant_users
  const { error: tuError } = await adminClient.from('tenant_users').insert({
    user_id: invited.user.id,
    role,
    invited_by: user.id,
  })

  if (tuError) {
    console.error('[team/invite] tenant_users insert error:', tuError)
    return NextResponse.json(
      { error: 'Utilisateur invité mais erreur d\'enregistrement du rôle' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: { userId: invited.user.id, email, role },
  })
}
