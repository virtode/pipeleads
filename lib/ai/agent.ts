import { generateText, generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { Contact } from '@/types'

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
      // Vercel AI SDK wraps API errors — check both statusCode and status
      const code =
        (err as { statusCode?: number })?.statusCode ??
        (err as { status?: number })?.status
      // Only retry on 529 (overloaded) errors
      if (code !== 529) throw err
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) // 2s, 4s, 8s
        console.warn(`[AI] Overloaded (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delay}ms…`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

const MODEL = 'claude-sonnet-4-6'
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
// Zod schema for generateObject() field extraction
// ---------------------------------------------------------------------------

const extractedFieldsSchema = z.object({
  linkedin_url: z.string().url().optional(),
  twitter_url:  z.string().url().optional(),
  email:        z.string().email().optional(),
  website:      z.string().url().optional(),
})

// ---------------------------------------------------------------------------
// Phase 2 — lean extraction call using generateObject()
// No web search, small token budget, returns structured fields directly.
// ---------------------------------------------------------------------------

type ExtractableField = keyof EnrichmentResult['extracted_fields']

const FIELD_DESCRIPTIONS: Record<ExtractableField, string> = {
  linkedin_url: 'URL du profil LinkedIn (doit commencer par https://linkedin.com/in/ ou https://www.linkedin.com/in/)',
  twitter_url:  'URL du profil Twitter ou X (doit commencer par https://twitter.com/ ou https://x.com/)',
  email:        'Adresse email professionnelle',
  website:      'URL du site web officiel de l\'entreprise (doit commencer par https:// ou http://)',
}

export async function extractFieldsFromReport(
  reportText: string,
  fields: ExtractableField[]
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
    const { object } = await withRetry(() =>
      generateObject({
        model: anthropic(MODEL),
        schema: extractedFieldsSchema,
        prompt,
        maxOutputTokens: 256,
      })
    )
    // Return only the requested fields that have a value
    return Object.fromEntries(
      fields
        .filter((f) => object[f] !== undefined)
        .map((f) => [f, object[f]])
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
// enrichContactProfile — public interface (unchanged)
// ---------------------------------------------------------------------------

export async function enrichContactProfile(contact: Contact): Promise<EnrichmentResult> {
  const { text: summary } = await withRetry(() =>
    generateText({
      model: anthropic(MODEL),
      maxOutputTokens: 4096,
      tools: {
        web_search: anthropic.tools.webSearch_20250305(),
      },
      prompt: buildContactProfilePrompt(contact),
    })
  )

  if (!summary) throw new Error('Aucun résultat généré par le modèle.')

  // Phase 2: extract structured fields (only missing ones)
  const fieldsToExtract: ExtractableField[] = []
  if (!contact.linkedin_url) fieldsToExtract.push('linkedin_url')
  if (!contact.twitter_url)  fieldsToExtract.push('twitter_url')
  if (!(contact.email as string[] | null)?.length) fieldsToExtract.push('email')

  const extracted_fields = await extractFieldsFromReport(summary, fieldsToExtract)

  return { summary, extracted_fields }
}

// ---------------------------------------------------------------------------
// enrichCompanyNews — public interface (unchanged)
// ---------------------------------------------------------------------------

export async function enrichCompanyNews(company: string, contact?: Contact): Promise<EnrichmentResult> {
  const { text: summary } = await withRetry(() =>
    generateText({
      model: anthropic(MODEL),
      maxOutputTokens: 4096,
      tools: {
        web_search: anthropic.tools.webSearch_20250305(),
      },
      prompt: buildCompanyNewsPrompt(company),
    })
  )

  if (!summary) throw new Error('Aucun résultat généré par le modèle.')

  // Phase 2: extract website if not already on contact
  const fieldsToExtract: ExtractableField[] = []
  if (!contact?.website) fieldsToExtract.push('website')

  const extracted_fields = await extractFieldsFromReport(summary, fieldsToExtract)

  return { summary, extracted_fields }
}
