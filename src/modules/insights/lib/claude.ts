import { getAIModel } from '@/lib/ai/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TypeBreakdown {
  type: string
  pct: number
}

export interface RespondentProfile {
  dominant_type: string
  type_breakdown: TypeBreakdown[]
  key_traits: string[]
  insight: string
}

export interface FollowUpContact {
  contact_id: string
  priority: number
  score: number
  reason: string
  tags: string[]
  specific_angle: string
}

export interface DoNotFollowUpContact {
  contact_id: string
  reason: string
}

export interface AnalysisResult {
  respondent_profile: RespondentProfile
  to_follow_up: FollowUpContact[]
  do_not_follow_up: DoNotFollowUpContact[]
  key_insight: string
  generated_at: string
  model: string
}

// ---------------------------------------------------------------------------
// Core call
// ---------------------------------------------------------------------------

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
): Promise<AnalysisResult> {
  const apiKey = process.env.LITELLM_MASTER_KEY
  if (!apiKey) throw new Error('LITELLM_MASTER_KEY is not set')

  const model = getAIModel()
  const baseUrl = process.env.LITELLM_URL ?? 'http://litellm:4000'

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LiteLLM API error ${response.status}: ${body}`)
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const raw = data.choices[0].message.content

  const parsed = parseJson(raw)

  return {
    ...parsed,
    generated_at: new Date().toISOString(),
    model,
  }
}

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------

export async function callClaudeWithRetry(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 2,
): Promise<AnalysisResult> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callClaude(systemPrompt, userPrompt)
    } catch (err) {
      if (err instanceof SyntaxError) {
        lastError = err
        continue
      }
      throw err
    }
  }

  throw new Error(
    `Claude returned invalid JSON after ${maxRetries + 1} attempt${maxRetries > 0 ? 's' : ''}: ${String(lastError)}`,
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}

function parseJson(raw: string): Omit<AnalysisResult, 'generated_at' | 'model'> {
  const cleaned = stripMarkdownFences(raw)
  return JSON.parse(cleaned) as Omit<AnalysisResult, 'generated_at' | 'model'>
}
