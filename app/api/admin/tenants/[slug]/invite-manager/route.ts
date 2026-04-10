import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient } from '@/lib/admin/auth'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { z } from 'zod'
import { autoProvisionCardDav } from '@/lib/carddav/provision'

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
    .select('id, supabase_url, supabase_service_role_key')
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

  // Insert into tenant's own tenant_users
  const { error: tuError } = await tenantAdmin.from('tenant_users').insert({
    user_id: invited.user.id,
    role: 'manager',
  })

  if (tuError) {
    console.error('[invite-manager] tenant_users insert error:', tuError)
  }

  // Also ensure the user exists in master auth and upsert into master tenant_users
  // so the CardDAV sync-service can provision them.
  try {
    const { data: masterUsersData } = await master.auth.admin.listUsers()
    let masterUserId: string | null = null

    const existingMasterUser = masterUsersData?.users.find((u) => u.email === email)
    if (existingMasterUser) {
      masterUserId = existingMasterUser.id
    } else {
      const { data: newMasterUser, error: createErr } = await master.auth.admin.createUser({
        email,
        email_confirm: true,
      })
      if (createErr || !newMasterUser?.user) {
        console.error('[invite-manager] create master user error:', createErr)
      } else {
        masterUserId = newMasterUser.user.id
      }
    }

    if (masterUserId) {
      const { data: masterTu, error: masterTuError } = await master
        .from('tenant_users')
        .upsert(
          { user_id: masterUserId, tenant_id: tenant.id, role: 'manager' },
          { onConflict: 'user_id,tenant_id' }
        )
        .select('id')
        .single()

      if (masterTuError) {
        console.error('[invite-manager] master tenant_users upsert error:', masterTuError)
      } else if (masterTu) {
        // Auto-provision CardDAV (non-bloquant)
        const carddavPassword = await autoProvisionCardDav(email, slug)
        if (carddavPassword) {
          await master.from('tenant_users')
            .update({ carddav_password: carddavPassword })
            .eq('id', masterTu.id)
        }
      }
    }
  } catch (err) {
    console.error('[invite-manager] master provisioning failed:', err)
    // Non-bloquant — l'invitation a réussi
  }

  return NextResponse.json({ data: { email, userId: invited.user.id } })
}
