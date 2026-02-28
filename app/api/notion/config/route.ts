import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/notion/crypto'
import type { ApiResponse } from '@/types'

// ---------------------------------------------------------------------------
// GET /api/notion/config
// Returns the current Notion config (without the raw token)
// ---------------------------------------------------------------------------

export async function GET(): Promise<
  NextResponse<ApiResponse<{
    database_id: string
    field_mapping: Record<string, string>
    last_sync_at: string | null
    has_token: boolean
  } | null>>
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('notion_config')
    .select('database_id, encrypted_token, field_mapping, last_sync_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[Notion Config GET]', error)
    return NextResponse.json({ data: null, error: 'Erreur serveur' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ data: null, error: null }, { status: 200 })
  }

  return NextResponse.json({
    data: {
      database_id: data.database_id,
      field_mapping: (data.field_mapping as Record<string, string>) ?? {},
      last_sync_at: data.last_sync_at,
      has_token: !!data.encrypted_token,
    },
    error: null,
  })
}

// ---------------------------------------------------------------------------
// POST /api/notion/config
// Save (upsert) Notion config. Token is encrypted before storage.
// ---------------------------------------------------------------------------

interface ConfigBody {
  token?: string
  database_id: string
  field_mapping: Record<string, string>
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ ok: true }>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }

  let body: ConfigBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { token, database_id, field_mapping } = body

  if (!database_id || typeof field_mapping !== 'object') {
    return NextResponse.json(
      { data: null, error: 'Paramètres manquants (database_id, field_mapping requis)' },
      { status: 400 },
    )
  }

  // Fetch existing row to decide whether to update the token
  const { data: existing } = await supabase
    .from('notion_config')
    .select('id, encrypted_token')
    .eq('user_id', user.id)
    .maybeSingle()

  // Encrypt new token if provided; keep existing one otherwise
  let encryptedToken: string | null = existing?.encrypted_token ?? null
  if (token && token.trim()) {
    try {
      encryptedToken = encrypt(token.trim())
    } catch (err) {
      console.error('[Notion Config] Encrypt error:', err)
      return NextResponse.json(
        { data: null, error: 'Erreur lors du chiffrement du token' },
        { status: 500 },
      )
    }
  }

  const upsertData = {
    user_id: user.id,
    database_id,
    encrypted_token: encryptedToken,
    field_mapping,
  }

  const { error: upsertErr } = await supabase
    .from('notion_config')
    .upsert(upsertData, { onConflict: 'user_id' })

  if (upsertErr) {
    console.error('[Notion Config POST]', upsertErr)
    return NextResponse.json({ data: null, error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true }, error: null })
}
