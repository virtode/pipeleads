import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient } from '@/lib/admin/auth'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { z } from 'zod'

const CreateTenantSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(10),
  supabaseServiceRoleKey: z.string().min(10),
  managerEmail: z.string().email().optional().or(z.literal('')),
})

/**
 * POST /api/admin/tenants
 * Crée un nouveau tenant dans le master Supabase.
 * Si managerEmail fourni → invite + crée dans tenant_users.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = CreateTenantSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { slug, name, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, managerEmail } =
    parsed.data

  const master = createMasterAdminClient()

  // Vérifier que le slug n'est pas déjà pris
  const { data: existing } = await master
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Ce slug est déjà utilisé' }, { status: 409 })
  }

  // Créer le tenant dans le master
  const { data: tenant, error: tenantError } = await master.from('tenants').insert({
    slug,
    name,
    supabase_url: supabaseUrl,
    supabase_anon_key: supabaseAnonKey,
    supabase_service_role_key: supabaseServiceRoleKey,
    manager_email: managerEmail || null,
    is_active: true,
  }).select('id').single()

  if (tenantError || !tenant) {
    console.error('[admin/tenants] insert error:', tenantError)
    return NextResponse.json({ error: 'Erreur lors de la création du tenant' }, { status: 500 })
  }

  // Inviter le manager si email fourni
  if (managerEmail) {
    try {
      const tenantAdmin = createSupabaseAdmin(supabaseUrl, supabaseServiceRoleKey)

      const { data: invited, error: inviteError } = await tenantAdmin.auth.admin.inviteUserByEmail(
        managerEmail
      )

      if (inviteError) {
        console.error('[admin/tenants] invite manager error:', inviteError)
      } else {
        await tenantAdmin.from('tenant_users').insert({
          user_id: invited.user.id,
          role: 'manager',
        })
      }
    } catch (err) {
      console.error('[admin/tenants] manager invite failed:', err)
      // Non-bloquant — le tenant est créé, le manager peut être invité plus tard
    }
  }

  return NextResponse.json({ data: { id: tenant.id, slug } })
}
