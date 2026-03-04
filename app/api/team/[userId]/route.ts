import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/tenant/roles'
import { getTenantFromHeaders } from '@/lib/tenant/context'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

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

  try {
    await requireManager(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'Accès réservé aux managers' }, { status: 403 })
  }

  if (targetUserId === user.id) {
    return NextResponse.json(
      { error: 'Vous ne pouvez pas révoquer votre propre accès' },
      { status: 400 }
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

  // Supprimer de tenant_users
  const { error: tuError } = await adminClient
    .from('tenant_users')
    .delete()
    .eq('user_id', targetUserId)

  if (tuError) {
    return NextResponse.json({ error: 'Erreur lors de la révocation' }, { status: 500 })
  }

  // Désactiver dans auth.users (ban temporaire via banDuration)
  const { error: banError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    ban_duration: '876000h', // ~100 ans
  })

  if (banError) {
    console.error('[team/delete] ban user error:', banError)
    // Non-bloquant : l'entrée tenant_users est déjà supprimée
  }

  return NextResponse.json({ data: { userId: targetUserId, revoked: true } })
}
