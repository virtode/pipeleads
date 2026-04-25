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
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6'
const API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// ---------------------------------------------------------------------------
// Core call
// ---------------------------------------------------------------------------

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${body}`)
  }

  const data = await response.json() as { content: Array<{ text: string }> }
  const raw = data.content[0].text

  const parsed = parseJson(raw)

  return {
    ...parsed,
    generated_at: new Date().toISOString(),
    model: MODEL,
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
