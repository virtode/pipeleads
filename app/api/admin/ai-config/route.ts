import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GLOBAL_ID = '00000000-0000-0000-0000-000000000001'

const ALLOWED_UPDATE_FIELDS = new Set([
  'provider',
  'model',
  'budget_usd',
  'alert_threshold',
  'fallback_provider',
  'fallback_model',
  'allowed_providers',
  'allow_byok',
])

function createServiceClient() {
  return createClient(
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
  const supabase = createServiceClient()

  const { data: config, error } = await supabase
    .from('ai_config_global')
    .select('*')
    .eq('id', GLOBAL_ID)
    .single()

  if (error || !config) {
    return NextResponse.json({ error: 'Configuration introuvable' }, { status: 404 })
  }

  const models = await fetchLiteLLMModels()

  return NextResponse.json({ config, models })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) {
      updates[key] = value
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucun champ valide fourni' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const supabase = createServiceClient()

  const { data: config, error } = await supabase
    .from('ai_config_global')
    .update(updates)
    .eq('id', GLOBAL_ID)
    .select('*')
    .single()

  if (error || !config) {
    console.error('[admin/ai-config] update error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  return NextResponse.json({ config })
}
