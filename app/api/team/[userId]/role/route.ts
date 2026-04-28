import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const RoleSchema = z.object({
  role: z.enum(['manager', 'member']),
})

/**
 * PATCH /api/team/[userId]/role
 * Réservé aux managers.
 * Body : { role: 'manager' | 'member' }
 * Met à jour le rôle d'un membre de l'équipe.
 * Un manager ne peut pas se rétrograder lui-même.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: roleRow } = await adminClient
    .from('tenant_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!roleRow || roleRow.role !== 'manager') {
    return NextResponse.json({ error: 'Accès réservé aux managers' }, { status: 403 })
  }

  if (targetUserId === user.id) {
    return NextResponse.json(
      { error: 'Vous ne pouvez pas modifier votre propre rôle' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = RoleSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { error } = await adminClient
    .from('tenant_users')
    .update({ role: parsed.data.role })
    .eq('user_id', targetUserId)

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du rôle' }, { status: 500 })
  }

  return NextResponse.json({ data: { userId: targetUserId, role: parsed.data.role } })
}
