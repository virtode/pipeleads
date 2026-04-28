import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/tenant/roles'
import { encrypt } from '@/lib/crypto/encryption'

const GLOBAL_ID = '00000000-0000-0000-0000-000000000001'

const ALLOWED_UPDATE_FIELDS = new Set([
  'use_global',
  'provider',
  'model',
  'encrypted_api_key',
  'budget_usd',
])

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function fetchLiteLLMModels(): Promise<string[]> {
  const base = process.env.LITELLM_URL ?? 'http://litellm:4000'
  const key = process.env.LITELLM_MASTER_KEY ?? ''
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: Array<{ id: string }> }
    return json.data?.map((m) => m.id) ?? []
  } catch {
    return []
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const headerStore = await headers()
  const tenantId = headerStore.get('x-tenant-id')

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 })
  }

  const svc = createServiceClient()

  const [globalResult, tenantResult, models] = await Promise.all([
    svc.from('ai_config_global').select('*').eq('id', GLOBAL_ID).single(),
    svc.from('ai_config_tenant').select('*').eq('tenant_id', tenantId).maybeSingle(),
    fetchLiteLLMModels(),
  ])

  if (globalResult.error || !globalResult.data) {
    return NextResponse.json({ error: 'Configuration globale introuvable' }, { status: 500 })
  }

  const raw = tenantResult.data
  const tenantConfig = raw
    ? (() => {
        const { encrypted_api_key, ...rest } = raw
        return { ...rest, hasCustomApiKey: encrypted_api_key !== null }
      })()
    : null

  return NextResponse.json({
    tenantConfig,
    globalConfig: globalResult.data,
    models,
  })
}

export async function PATCH(req: NextRequest) {
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

  const headerStore = await headers()
  const tenantId = headerStore.get('x-tenant-id')

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
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
      console.error('[tenant/ai-config] encrypt error:', e)
      return NextResponse.json({ error: 'Erreur de chiffrement de la clé API' }, { status: 500 })
    }
  }

  updates.updated_at = new Date().toISOString()

  const svc = createServiceClient()
  const { data: savedConfig, error } = await svc
    .from('ai_config_tenant')
    .upsert(updates, { onConflict: 'tenant_id' })
    .select('*')
    .single()

  if (error || !savedConfig) {
    console.error('[tenant/ai-config] upsert error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  const { encrypted_api_key: _key, ...configWithoutKey } = savedConfig
  return NextResponse.json({ config: { ...configWithoutKey, hasCustomApiKey: _key !== null } })
}
