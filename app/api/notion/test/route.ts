import { NextRequest, NextResponse } from 'next/server'
import { connectNotion } from '@/lib/notion/sync'
import { decrypt } from '@/lib/notion/crypto'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

// ---------------------------------------------------------------------------
// POST /api/notion/test
// Test connectivity with the given token + database_id.
// Accepts either a plain token (for first-time test before save) or reads
// the stored encrypted token if no token is provided in the body.
// ---------------------------------------------------------------------------

interface TestBody {
  token?: string       // plain token for pre-save test
  database_id: string
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ title: string; propertyCount: number }>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }

  let body: TestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { token: plainToken, database_id } = body

  if (!database_id) {
    return NextResponse.json({ data: null, error: 'database_id requis' }, { status: 400 })
  }

  // Resolve the token to use
  let tokenToUse: string | null = plainToken?.trim() ?? null

  if (!tokenToUse) {
    // Fall back to stored encrypted token
    const { data } = await supabase
      .from('notion_config')
      .select('encrypted_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data?.encrypted_token) {
      try {
        tokenToUse = decrypt(data.encrypted_token)
      } catch {
        return NextResponse.json(
          { data: null, error: 'Impossible de déchiffrer le token stocké' },
          { status: 500 },
        )
      }
    }
  }

  if (!tokenToUse) {
    return NextResponse.json(
      { data: null, error: 'Aucun token disponible — configure ton intégration Notion' },
      { status: 400 },
    )
  }

  try {
    const result = await connectNotion(tokenToUse, database_id)
    return NextResponse.json({ data: result, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur de connexion Notion'
    return NextResponse.json({ data: null, error: message }, { status: 400 })
  }
}
