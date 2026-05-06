import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getTenantFromHeaders } from '@/lib/tenant/context'
import { enrichContactProfile, enrichCompanyNews } from '@/lib/ai/agent'
import { getAIModel } from '@/lib/ai/client'

// ---------------------------------------------------------------------------
// Rate limiter — in-memory, per contactId:type (max 1 req / 10 s)
// ---------------------------------------------------------------------------

const RATE_LIMIT_MS = 10_000
const lastRequestAt = new Map<string, number>()

function checkRateLimit(key: string): boolean {
  const last = lastRequestAt.get(key)
  const now = Date.now()
  if (last && now - last < RATE_LIMIT_MS) return false
  lastRequestAt.set(key, now)
  return true
}

// ---------------------------------------------------------------------------
// Zod validators for extracted fields
// ---------------------------------------------------------------------------

const urlSchema = z.string().url()
const emailSchema = z.string().email()

// ---------------------------------------------------------------------------
// POST /api/ai/enrich
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }

  const tenant = await getTenantFromHeaders()
  const tenantId = tenant?.tenantId ?? null

  // 2. Parse body
  let body: { contactId?: string; type?: string }
  try {
    body = await request.json() as { contactId?: string; type?: string }
  } catch {
    return NextResponse.json({ data: null, error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { contactId, type } = body
  if (!contactId || !type || !['contact_profile', 'company_news'].includes(type)) {
    return NextResponse.json({ data: null, error: 'Paramètres manquants ou invalides' }, { status: 400 })
  }

  const enrichType = type as 'contact_profile' | 'company_news'

  // 3. Rate limit
  const rateLimitKey = `${contactId}:${enrichType}`
  if (!checkRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { data: null, error: 'Trop de requêtes — attends 10 secondes avant de relancer.' },
      { status: 429 }
    )
  }

  // 4. Fetch contact (verify ownership via RLS)
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single()

  if (contactErr || !contact) {
    return NextResponse.json({ data: null, error: 'Contact introuvable' }, { status: 404 })
  }

  // 5. Validate company for company_news type
  let company: string | undefined
  if (enrichType === 'company_news') {
    company = contact.company?.trim()
    if (!company) {
      return NextResponse.json(
        { data: null, error: 'Ce contact n\'a pas d\'entreprise associée.' },
        { status: 400 }
      )
    }
  }

  // 6. Call the agentic enrichment function (handles webSearch multi-turn loop internally)
  let summary: string
  let extracted_fields: Partial<{
    linkedin_url: string
    twitter_url: string
    email: string
    website: string
  }>

  try {
    if (enrichType === 'contact_profile') {
      const result = await enrichContactProfile(contact, tenantId ?? undefined)
      summary = result.summary
      extracted_fields = result.extracted_fields
    } else {
      const result = await enrichCompanyNews(company!, contact, tenantId ?? undefined)
      summary = result.summary
      extracted_fields = result.extracted_fields
    }
  } catch (err) {
    const status = (err as { status?: number })?.status
    return NextResponse.json(
      { data: null, error: `Erreur du service IA${status ? ` (${status})` : ''}` },
      { status: status ?? 502 }
    )
  }

  // 7. Save to DB
  const aiModel = await getAIModel(tenantId ?? undefined)

  const { error: saveErr } = await supabase
    .from('ai_enrichments')
    .insert({
      contact_id: contactId,
      tenant_id: tenantId,
      type: enrichType,
      content: summary,
      model: aiModel,
    })

  if (!saveErr) {
    // 8. Validate extracted fields and update contact
    const contactUpdates: Record<string, unknown> = {}

    const urlFields = ['linkedin_url', 'twitter_url', 'website'] as const
    for (const field of urlFields) {
      const value = extracted_fields[field]
      if (value && !contact[field]) {
        const parsed = urlSchema.safeParse(value)
        if (parsed.success) contactUpdates[field] = parsed.data
      }
    }

    if (extracted_fields.email && !(contact.email as string[] | null)?.length) {
      const parsed = emailSchema.safeParse(extracted_fields.email)
      if (parsed.success) {
        const existing = (contact.email as string[] | null) ?? []
        if (!existing.includes(parsed.data)) {
          contactUpdates.email = [...existing, parsed.data]
        }
      }
    }

    if (Object.keys(contactUpdates).length > 0) {
      await supabase
        .from('contacts')
        .update({ ...contactUpdates, updated_at: new Date().toISOString() })
        .eq('id', contactId)
    }
  }

  // 9. Return as SSE for frontend compatibility
  const encoder = new TextEncoder()
  const sseBody = encoder.encode(
    `data: ${JSON.stringify({ content: summary })}\n\ndata: [DONE]\n\n`
  )

  return new Response(sseBody, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
