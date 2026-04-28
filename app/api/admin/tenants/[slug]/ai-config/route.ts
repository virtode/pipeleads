import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createMasterAdminClient } from '@/lib/admin/auth'
import { encrypt } from '@/lib/crypto/encryption'

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
  const { data: raw } = await supabase
    .from('ai_config_tenant')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!raw) return NextResponse.json({ config: null })

  const { encrypted_api_key, ...rest } = raw
  return NextResponse.json({ config: { ...rest, hasCustomApiKey: encrypted_api_key !== null } })
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

  if (updates.encrypted_api_key !== undefined && updates.encrypted_api_key !== null) {
    try {
      updates.encrypted_api_key = encrypt(String(updates.encrypted_api_key))
    } catch (e) {
      console.error('[admin/tenants/ai-config] encrypt error:', e)
      return NextResponse.json({ error: 'Erreur de chiffrement de la clé API' }, { status: 500 })
    }
  }

  updates.updated_at = new Date().toISOString()

  const supabase = createServiceClient()
  const { data: savedConfig, error } = await supabase
    .from('ai_config_tenant')
    .upsert(updates, { onConflict: 'tenant_id' })
    .select('*')
    .single()

  if (error || !savedConfig) {
    console.error('[admin/tenants/ai-config] upsert error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  const { encrypted_api_key: _key, ...configWithoutKey } = savedConfig
  return NextResponse.json({ config: { ...configWithoutKey, hasCustomApiKey: _key !== null } })
}
