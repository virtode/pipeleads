import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * DELETE /api/team/[userId]
 * Réservé aux managers.
 * Révoque l'accès d'un membre : supprime tenant_users + désactive dans auth.users.
 * Un manager ne peut pas se supprimer lui-même.
 */
export async function DELETE(
  _req: NextRequest,
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
      { error: 'Vous ne pouvez pas révoquer votre propre accès' },
      { status: 400 }
    )
  }

  // Supprimer de tenant_users en premier
  const { error: tuError } = await adminClient
    .from('tenant_users')
    .delete()
    .eq('user_id', targetUserId)

  if (tuError) {
    return NextResponse.json({ error: 'Erreur lors de la révocation' }, { status: 500 })
  }

  // Supprimer définitivement de auth.users
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId)

  if (deleteError) {
    console.error('[team/delete] deleteUser error:', deleteError)
    // Non-bloquant : l'entrée tenant_users est déjà supprimée
  }

  return NextResponse.json({ data: { userId: targetUserId, revoked: true } })
}
