import Anthropic from '@anthropic-ai/sdk'
import type { Contact } from '@/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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
      const status = (err as { status?: number })?.status
      // Only retry on 529 (overloaded) or 529-like errors
      if (status !== 529) throw err
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
// Shared: extract final text from response content blocks
// ---------------------------------------------------------------------------

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

// ---------------------------------------------------------------------------
// Phase 2 — lean extraction call: parse URLs/email from the report text
// No web search, small token budget, returns plain JSON only.
// ---------------------------------------------------------------------------

type ExtractableField = keyof EnrichmentResult['extracted_fields']

const FIELD_DESCRIPTIONS: Record<ExtractableField, string> = {
  linkedin_url: 'URL du profil LinkedIn (doit commencer par https://linkedin.com/in/ ou https://www.linkedin.com/in/)',
  twitter_url:  'URL du profil Twitter ou X (doit commencer par https://twitter.com/ ou https://x.com/)',
  email:        'Adresse email professionnelle',
  website:      'URL du site web officiel de l\'entreprise (doit commencer par https:// ou http://)',
}

async function extractFieldsFromReport(
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

Réponds UNIQUEMENT avec un objet JSON valide, sans explication ni texte autour. Exemples valides :
{"linkedin_url": "https://linkedin.com/in/exemple", "email": "contact@exemple.com"}
{}

N'inclus un champ que si l'information est explicitement présente dans le texte ci-dessus.`

  try {
    const response = await withRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      })
    )
    const raw = extractText(response.content)
    // Extract the first JSON object found in the response
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(match[0]) as EnrichmentResult['extracted_fields']
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// enrichContactProfile
// ---------------------------------------------------------------------------

export async function enrichContactProfile(contact: Contact): Promise<EnrichmentResult> {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ')
  const context = [
    contact.job_title && `Titre : ${contact.job_title}`,
    contact.company && `Entreprise : ${contact.company}`,
    contact.linkedin_url && `LinkedIn : ${contact.linkedin_url}`,
    contact.twitter_url && `Twitter/X : ${contact.twitter_url}`,
    contact.website && `Site web : ${contact.website}`,
    contact.city && `Localisation : ${contact.city}${contact.country ? ', ' + contact.country : ''}`,
  ].filter(Boolean).join('\n')

  const prompt = `Recherche des informations professionnelles sur **${name}**.

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

  // Phase 1: web search + report
  const response = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const }],
      messages: [{ role: 'user', content: prompt }],
    })
  )

  const summary = extractText(response.content)
  if (!summary) throw new Error('Aucun résultat généré par le modèle.')

  // Phase 2: extract structured fields from the report (only fields not already set)
  const fieldsToExtract: ExtractableField[] = []
  if (!contact.linkedin_url) fieldsToExtract.push('linkedin_url')
  if (!contact.twitter_url)  fieldsToExtract.push('twitter_url')
  if (!(contact.email as string[] | null)?.length) fieldsToExtract.push('email')

  const extracted_fields = await extractFieldsFromReport(summary, fieldsToExtract)

  return { summary, extracted_fields }
}

// ---------------------------------------------------------------------------
// enrichCompanyNews
// ---------------------------------------------------------------------------

export async function enrichCompanyNews(company: string, contact?: Contact): Promise<EnrichmentResult> {
  const prompt = `Recherche les dernières actualités sur l'entreprise **${company}**.

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

  // Phase 1: web search + report
  const response = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const }],
      messages: [{ role: 'user', content: prompt }],
    })
  )

  const summary = extractText(response.content)
  if (!summary) throw new Error('Aucun résultat généré par le modèle.')

  // Phase 2: extract website if not already set on the contact
  const fieldsToExtract: ExtractableField[] = []
  if (!contact?.website) fieldsToExtract.push('website')

  const extracted_fields = await extractFieldsFromReport(summary, fieldsToExtract)

  return { summary, extracted_fields }
}
