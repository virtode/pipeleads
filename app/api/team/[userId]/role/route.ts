import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/tenant/roles'
import { getTenantFromHeaders } from '@/lib/tenant/context'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
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

  try {
    await requireManager(supabase, user.id)
  } catch {
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

  const tenant = await getTenantFromHeaders()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
  }

  const adminClient = createSupabaseAdmin(tenant.supabaseUrl, serviceKey)

  const { error } = await adminClient
    .from('tenant_users')
    .update({ role: parsed.data.role })
    .eq('user_id', targetUserId)

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du rôle' }, { status: 500 })
  }

  return NextResponse.json({ data: { userId: targetUserId, role: parsed.data.role } })
}
