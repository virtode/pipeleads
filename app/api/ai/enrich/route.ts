import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { enrichContactProfile, enrichCompanyNews } from '@/lib/ai/agent'
import type { ApiResponse } from '@/types'

// ---------------------------------------------------------------------------
// Session verification (Stytch JWT — decode without library)
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // base64url → base64 → JSON
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(
      parts[1].length + ((4 - (parts[1].length % 4)) % 4), '='
    )
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

  // Check expiry
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null

  return payload.sub ?? null
}

// ---------------------------------------------------------------------------
// Rate limiter — in-memory, per contactId (max 1 req / 10 s)
// ---------------------------------------------------------------------------

const RATE_LIMIT_MS = 10_000
const lastRequestAt = new Map<string, number>()

function checkRateLimit(contactId: string): boolean {
  const last = lastRequestAt.get(contactId)
  const now = Date.now()
  if (last && now - last < RATE_LIMIT_MS) return false
  lastRequestAt.set(contactId, now)
  return true
}

// ---------------------------------------------------------------------------
// POST /api/ai/enrich
// ---------------------------------------------------------------------------

interface EnrichBody {
  contactId: string
  type: 'contact_profile' | 'company_news'
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ id: string; content: string; created_at: string }>>> {
  // 1. Auth
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }

  // 2. Parse body
  let body: EnrichBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { contactId, type } = body
  if (!contactId || !type || !['contact_profile', 'company_news'].includes(type)) {
    return NextResponse.json({ data: null, error: 'Paramètres manquants ou invalides' }, { status: 400 })
  }

  // 3. Rate limit
  const rateLimitKey = `${contactId}:${type}`
  if (!checkRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { data: null, error: 'Trop de requêtes — attends 10 secondes avant de relancer.' },
      { status: 429 }
    )
  }

  // 4. Fetch contact (verify ownership)
  const supabase = await createClient()
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single()

  if (contactErr || !contact) {
    return NextResponse.json({ data: null, error: 'Contact introuvable' }, { status: 404 })
  }

  // 5. Run AI enrichment
  let content: string
  try {
    if (type === 'contact_profile') {
      content = await enrichContactProfile(contact)
    } else {
      const company = contact.company ?? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
      if (!company) {
        return NextResponse.json(
          { data: null, error: 'Ce contact n\'a pas d\'entreprise associée.' },
          { status: 400 }
        )
      }
      content = await enrichCompanyNews(company)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = (err as { status?: number })?.status

    console.error('[AI Enrich] Agent error — status:', status, '— message:', message, err)

    if (status === 401 || message.toLowerCase().includes('auth') || message.toLowerCase().includes('api key') || message.toLowerCase().includes('apikey')) {
      return NextResponse.json(
        { data: null, error: 'Clé API Anthropic invalide ou manquante dans les variables d\'environnement.' },
        { status: 500 }
      )
    }
    if (status === 529 || message.toLowerCase().includes('overloaded')) {
      return NextResponse.json(
        { data: null, error: 'L\'API Anthropic est surchargée. Réessaie dans quelques instants.' },
        { status: 503 }
      )
    }
    if (status === 429 || message.toLowerCase().includes('rate')) {
      return NextResponse.json(
        { data: null, error: 'Limite de requêtes Anthropic atteinte. Réessaie dans une minute.' },
        { status: 429 }
      )
    }
    if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('etimedout')) {
      return NextResponse.json(
        { data: null, error: 'La recherche a pris trop de temps. Réessaie.' },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { data: null, error: `Erreur IA : ${message}` },
      { status: 500 }
    )
  }

  // 6. Save to ai_enrichments
  const { data: enrichment, error: saveErr } = await supabase
    .from('ai_enrichments')
    .insert({
      contact_id: contactId,
      type,
      content,
      model: 'claude-sonnet-4-6',
    })
    .select('id, content, created_at')
    .single()

  if (saveErr || !enrichment) {
    console.error('[AI Enrich] Save error:', saveErr)
    return NextResponse.json({ data: null, error: 'Erreur lors de la sauvegarde.' }, { status: 500 })
  }

  return NextResponse.json({ data: enrichment, error: null }, { status: 200 })
}
