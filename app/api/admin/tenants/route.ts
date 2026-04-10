import { NextRequest, NextResponse } from 'next/server'
import { createMasterAdminClient } from '@/lib/admin/auth'
import { z } from 'zod'
import { sendEmail, buildInviteEmailHtml } from '@/lib/email/send'
import { autoProvisionCardDav } from '@/lib/carddav/provision'

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

  // Associer le manager si email fourni
  let inviteLink: string | null = null
  let emailSent = false

  if (managerEmail) {
    try {
      // Cherche l'utilisateur dans auth.users du master
      const { data: usersData } = await master.auth.admin.listUsers()
      const existingManager = usersData?.users.find((u) => u.email === managerEmail)

      if (existingManager) {
        // Utilisateur déjà existant → upsert dans tenant_users avec le tenant_id
        const { data: upsertedTu, error: upsertError } = await master.from('tenant_users').upsert(
          {
            user_id: existingManager.id,
            tenant_id: tenant.id,
            role: 'manager',
          },
          { onConflict: 'user_id,tenant_id' }
        ).select('id').single()
        if (upsertError) {
          console.error('[admin/tenants] upsert tenant_users error:', upsertError)
        } else {
          // Auto-provision CardDAV (non-bloquant)
          const carddavPassword = await autoProvisionCardDav(managerEmail, slug)
          if (carddavPassword && upsertedTu) {
            await master.from('tenant_users')
              .update({ carddav_password: carddavPassword })
              .eq('id', upsertedTu.id)
          }
        }
      } else {
        // Utilisateur inexistant → créer le compte et insérer dans tenant_users
        const { data: newUser, error: createError } = await master.auth.admin.createUser({
          email: managerEmail,
          email_confirm: true,
        })

        if (createError || !newUser?.user) {
          console.error('[admin/tenants] create manager error:', createError)
        } else {
          const { data: insertedTu, error: insertError } = await master.from('tenant_users').insert({
            user_id: newUser.user.id,
            tenant_id: tenant.id,
            role: 'manager',
          }).select('id').single()
          if (insertError) {
            console.error('[admin/tenants] insert tenant_users error:', insertError)
          } else {
            // Auto-provision CardDAV (non-bloquant)
            const carddavPassword = await autoProvisionCardDav(managerEmail, slug)
            if (carddavPassword && insertedTu) {
              await master.from('tenant_users')
                .update({ carddav_password: carddavPassword })
                .eq('id', insertedTu.id)
            }
          }

          // Générer un magic link d'invitation
          const { data: linkData, error: linkError } =
            await master.auth.admin.generateLink({
              type: 'magiclink',
              email: managerEmail,
              options: { redirectTo: `https://${slug}.pipeleads.app` },
            })

          if (linkError) {
            console.error('[admin/tenants] generate link error:', linkError)
          } else {
            inviteLink = linkData?.properties?.action_link ?? null
            console.log('[admin/tenants] invite link generated:', inviteLink)
          }
        }
      }
    } catch (err) {
      console.error('[admin/tenants] manager setup failed:', err)
      // Non-bloquant — le tenant est créé, le manager peut être invité plus tard
    }

    // Envoyer l'email d'invitation (non-bloquant)
    if (inviteLink) {
      try {
        await sendEmail({
          to: managerEmail,
          subject: `Vous êtes invité à rejoindre ${name} sur PipeLeads`,
          html: buildInviteEmailHtml({ tenantName: name, inviteLink }),
        })
        emailSent = true
        console.log('[admin/tenants] invite email sent to:', managerEmail)
      } catch (emailErr) {
        console.error('[admin/tenants] invite email failed:', emailErr)
        // Non-bloquant — le lien reste disponible pour un envoi manuel
      }
    }
  }

  return NextResponse.json({ data: { id: tenant.id, slug, inviteLink, emailSent } })
}
