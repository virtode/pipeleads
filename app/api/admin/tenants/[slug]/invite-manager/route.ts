import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient } from '@/lib/admin/auth'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { z } from 'zod'

const InviteManagerSchema = z.object({
  email: z.string().email('Email invalide'),
})

/**
 * POST /api/admin/tenants/[slug]/invite-manager
 * Invite un manager sur un tenant existant.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = await req.json().catch(() => null)
  const parsed = InviteManagerSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Email invalide' },
      { status: 422 }
    )
  }

  const { email } = parsed.data
  const master = createMasterAdminClient()

  const { data: tenant } = await master
    .from('tenants')
    .select('supabase_url, supabase_service_role_key')
    .eq('slug', slug)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 404 })
  }

  const tenantAdmin = createSupabaseAdmin(
    tenant.supabase_url,
    tenant.supabase_service_role_key
  )

  const { data: invited, error: inviteError } = await tenantAdmin.auth.admin.inviteUserByEmail(email)

  if (inviteError) {
    return NextResponse.json(
      { error: inviteError.message ?? 'Erreur lors de l\'invitation' },
      { status: 500 }
    )
  }

  const { error: tuError } = await tenantAdmin.from('tenant_users').insert({
    user_id: invited.user.id,
    role: 'manager',
  })

  if (tuError) {
    console.error('[invite-manager] tenant_users insert error:', tuError)
  }

  return NextResponse.json({ data: { email, userId: invited.user.id } })
}
