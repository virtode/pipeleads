import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createMasterAdminClient } from '@/lib/admin/auth'

const ALLOWED_UPDATE_FIELDS = new Set([
  'use_global',
  'provider',
  'model',
  'encrypted_api_key',
  'budget_usd',
])

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function resolveTenantId(slug: string): Promise<string | null> {
  const master = createMasterAdminClient()
  const { data } = await master.from('tenants').select('id').eq('slug', slug).single()
  return data?.id ?? null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const tenantId = await resolveTenantId(slug)

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from('ai_config_tenant')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  return NextResponse.json({ config: config ?? null })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const tenantId = await resolveTenantId(slug)
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { tenant_id: tenantId }
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) {
      updates[key] = value
    }
  }
  updates.updated_at = new Date().toISOString()

  const supabase = createServiceClient()
  const { data: config, error } = await supabase
    .from('ai_config_tenant')
    .upsert(updates, { onConflict: 'tenant_id' })
    .select('*')
    .single()

  if (error || !config) {
    console.error('[admin/tenants/ai-config] upsert error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  return NextResponse.json({ config })
}
