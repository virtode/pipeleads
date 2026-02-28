import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import {
  buildContactProfilePrompt,
  buildCompanyNewsPrompt,
  extractFieldsFromReport,
} from '@/lib/ai/agent'

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

  // 2. Parse body (useCompletion sends { prompt, ...body })
  let body: { contactId?: string; type?: string; prompt?: string }
  try {
    body = await request.json()
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

  // 5. Build prompt
  let prompt: string
  if (enrichType === 'contact_profile') {
    prompt = buildContactProfilePrompt(contact)
  } else {
    const company = contact.company ?? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    if (!company) {
      return NextResponse.json(
        { data: null, error: 'Ce contact n\'a pas d\'entreprise associée.' },
        { status: 400 }
      )
    }
    prompt = buildCompanyNewsPrompt(company)
  }

  // 6. Stream AI response — DB save + field extraction happen in onFinish
  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    maxOutputTokens: 4096,
    tools: {
      web_search: anthropic.tools.webSearch_20250305(),
    },
    prompt,
    onFinish: async ({ text: summary }) => {
      if (!summary) return

      // Save summary to ai_enrichments
      const { error: saveErr } = await supabase
        .from('ai_enrichments')
        .insert({
          contact_id: contactId,
          type: enrichType,
          content: summary,
          model: 'claude-sonnet-4-6',
        })

      if (saveErr) {
        console.error('[AI Enrich] Save error:', saveErr)
        return
      }

      // Determine which fields are missing on the contact
      const fieldsToExtract: ('linkedin_url' | 'twitter_url' | 'email' | 'website')[] = []
      if (enrichType === 'contact_profile') {
        if (!contact.linkedin_url) fieldsToExtract.push('linkedin_url')
        if (!contact.twitter_url)  fieldsToExtract.push('twitter_url')
        if (!(contact.email as string[] | null)?.length) fieldsToExtract.push('email')
      } else {
        if (!contact.website) fieldsToExtract.push('website')
      }

      const extracted_fields = await extractFieldsFromReport(summary, fieldsToExtract)
      if (Object.keys(extracted_fields).length === 0) return

      // Apply validated fields to contact (only empty ones)
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
        const { error: updateErr } = await supabase
          .from('contacts')
          .update({ ...contactUpdates, updated_at: new Date().toISOString() })
          .eq('id', contactId)

        if (updateErr) console.error('[AI Enrich] Contact update error:', updateErr)
      }
    },
  })

  return result.toTextStreamResponse()
}
