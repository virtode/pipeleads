import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getTenantFromHeaders } from '@/lib/tenant/context'
import {
  buildContactProfilePrompt,
  buildCompanyNewsPrompt,
  extractFieldsFromReport,
} from '@/lib/ai/agent'
import { getLiteLLMConfig } from '@/lib/ai/client'
import { resolveAIConfig } from '@/lib/ai/config'

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

  // 5. Build prompt
  let prompt: string
  if (enrichType === 'contact_profile') {
    prompt = buildContactProfilePrompt(contact)
  } else {
    const company = contact.company?.trim()
    if (!company) {
      return NextResponse.json(
        { data: null, error: 'Ce contact n\'a pas d\'entreprise associée.' },
        { status: 400 }
      )
    }
    prompt = buildCompanyNewsPrompt(company)
  }

  // 6. Stream AI response — DB save + field extraction happen in the TransformStream flush
  const aiConfig = await resolveAIConfig(tenantId ?? undefined)
  const liteLLMConfig = getLiteLLMConfig(aiConfig.apiKey)
  const aiModel = aiConfig.model

  const llmResponse = await fetch(`${liteLLMConfig.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${liteLLMConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      stream: true,
      // TODO: Pass Anthropic webSearch tool once LiteLLM supports
      // anthropic-native built-in tools through its OpenAI-compatible endpoint.
      ...(tenantId !== null ? { user: tenantId } : {}),
    }),
  })

  if (!llmResponse.ok) {
    return NextResponse.json(
      { data: null, error: `Erreur du service IA (${llmResponse.status})` },
      { status: llmResponse.status }
    )
  }

  if (!llmResponse.body) {
    return NextResponse.json({ data: null, error: 'Réponse IA vide' }, { status: 502 })
  }

  // Pipe the SSE stream through a TransformStream that:
  // 1. Forwards every chunk to the client unchanged
  // 2. Accumulates the full text so we can save to DB and extract fields on flush
  let fullText = ''
  const sseDecoder = new TextDecoder()
  let sseBuffer = ''

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      sseBuffer += sseDecoder.decode(chunk, { stream: true })
      const lines = sseBuffer.split('\n')
      sseBuffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const content = parsed.choices?.[0]?.delta?.content
          if (content) fullText += content
        } catch {
          // ignore malformed SSE frames
        }
      }
      controller.enqueue(chunk)
    },
    async flush() {
      if (!fullText) return

      const { error: saveErr } = await supabase
        .from('ai_enrichments')
        .insert({
          contact_id: contactId,
          tenant_id: tenantId,
          type: enrichType,
          content: fullText,
          model: aiModel,
        })

      if (saveErr) return

      const fieldsToExtract: ('linkedin_url' | 'twitter_url' | 'email' | 'website')[] = []
      if (enrichType === 'contact_profile') {
        if (!contact.linkedin_url) fieldsToExtract.push('linkedin_url')
        if (!contact.twitter_url)  fieldsToExtract.push('twitter_url')
        if (!(contact.email as string[] | null)?.length) fieldsToExtract.push('email')
      } else {
        if (!contact.website) fieldsToExtract.push('website')
      }

      const extracted_fields = await extractFieldsFromReport(
        fullText,
        fieldsToExtract,
        tenantId ?? undefined
      )
      if (Object.keys(extracted_fields).length === 0) return

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
        // Silent failure — contact fields will stay empty if update fails
        await supabase
          .from('contacts')
          .update({ ...contactUpdates, updated_at: new Date().toISOString() })
          .eq('id', contactId)
      }
    },
  })

  return new Response(llmResponse.body.pipeThrough(transform), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
