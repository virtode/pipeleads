import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/notion/crypto'
import type { ApiResponse } from '@/types'

// ---------------------------------------------------------------------------
// Auth helper (shared with /api/ai/enrich)
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const padded = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const jwt =
    cookieStore.get('stytch_session_jwt')?.value ||
    cookieStore.get('stytch_session')?.value
  if (!jwt) return null
  const payload = decodeJwtPayload(jwt)
  if (!payload) return null
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload.sub ?? null
}

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
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notion_config')
    .select('database_id, encrypted_token, field_mapping, last_sync_at')
    .eq('user_id', userId)
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
  const userId = await getSessionUserId()
  if (!userId) {
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

  const supabase = await createClient()

  // Fetch existing row to decide whether to update the token
  const { data: existing } = await supabase
    .from('notion_config')
    .select('id, encrypted_token')
    .eq('user_id', userId)
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
    user_id: userId,
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
