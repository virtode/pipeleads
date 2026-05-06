import { z } from 'zod'
import type { Contact } from '@/types'
import { getLiteLLMConfig, getAIModel, isAnthropicProvider } from './client'

// ---------------------------------------------------------------------------
// Retry with exponential backoff (for 529 overloaded errors)
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 2000
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const code =
        (err as { statusCode?: number })?.statusCode ??
        (err as { status?: number })?.status
      if (code !== 529) throw err
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) // 2s, 4s, 8s
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

const TODAY = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

// ---------------------------------------------------------------------------
// Result type — summary (markdown) + structured extracted fields
// ---------------------------------------------------------------------------

export interface EnrichmentResult {
  summary: string
  extracted_fields: Partial<{
    linkedin_url: string
    twitter_url: string
    email: string
    website: string
  }>
}

// ---------------------------------------------------------------------------
// Zod schema for field extraction
// ---------------------------------------------------------------------------

const extractedFieldsSchema = z.object({
  linkedin_url: z.string().url().optional(),
  twitter_url:  z.string().url().optional(),
  email:        z.string().email().optional(),
  website:      z.string().url().optional(),
})

type ExtractableField = keyof EnrichmentResult['extracted_fields']

const FIELD_DESCRIPTIONS: Record<ExtractableField, string> = {
  linkedin_url: 'URL du profil LinkedIn (doit commencer par https://linkedin.com/in/ ou https://www.linkedin.com/in/)',
  twitter_url:  'URL du profil Twitter ou X (doit commencer par https://twitter.com/ ou https://x.com/)',
  email:        'Adresse email professionnelle',
  website:      'URL du site web officiel de l\'entreprise (doit commencer par https:// ou http://)',
}

// ---------------------------------------------------------------------------
// Helper: POST to LiteLLM /v1/chat/completions
// ---------------------------------------------------------------------------

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>
}

interface LiteLLMError extends Error {
  status: number
}

async function liteLLMFetch(
  config: { baseURL: string; apiKey: string },
  body: Record<string, unknown>,
  tenantId?: string,
): Promise<ChatCompletionResponse> {
  const res = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      ...body,
      ...(tenantId !== undefined ? { user: tenantId } : {}),
    }),
  })
  if (!res.ok) {
    const err = new Error(`LiteLLM error ${res.status}`) as LiteLLMError
    err.status = res.status
    throw err
  }
  return res.json() as Promise<ChatCompletionResponse>
}

// ---------------------------------------------------------------------------
// Phase 2 — lean extraction call using json_object mode + Zod
// ---------------------------------------------------------------------------

export async function extractFieldsFromReport(
  reportText: string,
  fields: ExtractableField[],
  tenantId?: string
): Promise<EnrichmentResult['extracted_fields']> {
  if (!reportText.trim() || fields.length === 0) return {}

  const requested = fields
    .map((f) => `- "${f}" : ${FIELD_DESCRIPTIONS[f]}`)
    .join('\n')

  const prompt = `Voici un rapport de recherche :

---
${reportText}
---

Extrais uniquement les informations suivantes si elles apparaissent clairement dans ce texte (ne devine rien) :
${requested}

N'inclus un champ que si l'information est explicitement présente dans le texte ci-dessus.
Si une information n'est pas trouvée, omet simplement ce champ.`

  try {
    const config = getLiteLLMConfig()
    const model = await getAIModel(tenantId)
    const data = await withRetry(() =>
      liteLLMFetch(config, {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }, tenantId)
    )
    const content = data.choices[0]?.message?.content ?? '{}'
    const validated = extractedFieldsSchema.safeParse(JSON.parse(content))
    if (!validated.success) return {}
    return Object.fromEntries(
      fields
        .filter((f) => validated.data[f] !== undefined)
        .map((f) => [f, validated.data[f]])
    ) as EnrichmentResult['extracted_fields']
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Prompt builders — exported for use in the streaming route
// ---------------------------------------------------------------------------

export function buildContactProfilePrompt(contact: Contact): string {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ')
  const context = [
    contact.job_title && `Titre : ${contact.job_title}`,
    contact.company && `Entreprise : ${contact.company}`,
    contact.linkedin_url && `LinkedIn : ${contact.linkedin_url}`,
    contact.twitter_url && `Twitter/X : ${contact.twitter_url}`,
    contact.website && `Site web : ${contact.website}`,
    contact.city && `Localisation : ${contact.city}${contact.country ? ', ' + contact.country : ''}`,
  ].filter(Boolean).join('\n')

  return `Recherche des informations professionnelles sur **${name}**.

Contexte disponible :
${context || '(aucun contexte supplémentaire)'}

Fournis un rapport structuré en français comprenant :

## Profil professionnel
Poste actuel, parcours, compétences clés, domaines d'expertise.

## Présence en ligne
Profil LinkedIn, articles publiés, conférences, prises de parole publiques.

## Actualités récentes
Projets récents, nominations, activités publiques des 12 derniers mois.

## Sources
Liste des sources consultées (URLs).

**Date de recherche : ${TODAY()}**

Si tu ne trouves pas d'informations suffisantes, indique-le clairement et précise ce qui manque pour une meilleure recherche.`
}

export function buildCompanyNewsPrompt(company: string): string {
  return `Recherche les dernières actualités sur l'entreprise **${company}**.

Fournis un rapport de veille structuré en français comprenant :

## Actualités récentes
Dernières nouvelles, communiqués de presse, événements importants.

## Levées de fonds & financement
Tours de financement récents (6–18 derniers mois), valorisation si connue, investisseurs.

## Nominations & équipe dirigeante
Nouveaux dirigeants, départs notables, réorganisations.

## Stratégie & développement
Nouvelles offres, produits lancés, partenariats, expansions géographiques, acquisitions.

## Sources
Liste des sources consultées (URLs).

**Date de recherche : ${TODAY()}**

Si l'entreprise est peu connue ou que les informations sont limitées, indique-le et partage ce que tu as trouvé.`
}

// ---------------------------------------------------------------------------
// enrichContactProfile — public interface
// ---------------------------------------------------------------------------

export async function enrichContactProfile(contact: Contact, tenantId?: string): Promise<EnrichmentResult> {
  const config = getLiteLLMConfig()
  const model = await getAIModel(tenantId)

  const data = await withRetry(() =>
    liteLLMFetch(config, {
      model,
      messages: [{ role: 'user', content: buildContactProfilePrompt(contact) }],
      max_tokens: 4096,
      ...(isAnthropicProvider(model) ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] } : {}),
    }, tenantId)
  )

  const summary = data.choices[0]?.message?.content ?? ''
  if (!summary) throw new Error('Aucun résultat généré par le modèle.')

  const fieldsToExtract: ExtractableField[] = []
  if (!contact.linkedin_url) fieldsToExtract.push('linkedin_url')
  if (!contact.twitter_url)  fieldsToExtract.push('twitter_url')
  if (!(contact.email as string[] | null)?.length) fieldsToExtract.push('email')

  const extracted_fields = await extractFieldsFromReport(summary, fieldsToExtract, tenantId)
  return { summary, extracted_fields }
}

// ---------------------------------------------------------------------------
// enrichCompanyNews — public interface
// ---------------------------------------------------------------------------

export async function enrichCompanyNews(company: string, contact?: Contact, tenantId?: string): Promise<EnrichmentResult> {
  const config = getLiteLLMConfig()
  const model = await getAIModel(tenantId)

  const data = await withRetry(() =>
    liteLLMFetch(config, {
      model,
      messages: [{ role: 'user', content: buildCompanyNewsPrompt(company) }],
      max_tokens: 4096,
      ...(isAnthropicProvider(model) ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] } : {}),
    }, tenantId)
  )

  const summary = data.choices[0]?.message?.content ?? ''
  if (!summary) throw new Error('Aucun résultat généré par le modèle.')

  const fieldsToExtract: ExtractableField[] = []
  if (!contact?.website) fieldsToExtract.push('website')

  const extracted_fields = await extractFieldsFromReport(summary, fieldsToExtract, tenantId)
  return { summary, extracted_fields }
}
