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
// Parse the last ```json block in the text and split summary / extracted_fields
// ---------------------------------------------------------------------------

function parseResult(content: Anthropic.Messages.ContentBlock[]): EnrichmentResult {
  const fullText = extractText(content)

  // Find the last ```json … ``` block
  const jsonStart = fullText.lastIndexOf('```json')
  if (jsonStart === -1) return { summary: fullText, extracted_fields: {} }

  const jsonEnd = fullText.indexOf('```', jsonStart + 7)
  if (jsonEnd === -1) return { summary: fullText, extracted_fields: {} }

  const jsonStr = fullText.slice(jsonStart + 7, jsonEnd).trim()
  const summary = fullText.slice(0, jsonStart).trim()

  try {
    const parsed = JSON.parse(jsonStr) as { extracted_fields?: Record<string, string> }
    return { summary, extracted_fields: parsed.extracted_fields ?? {} }
  } catch {
    // Malformed JSON — keep full text as summary
    return { summary: fullText, extracted_fields: {} }
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

Si tu ne trouves pas d'informations suffisantes, indique-le clairement et précise ce qui manque pour une meilleure recherche.

---

Après ton rapport, ajoute exactement un bloc JSON contenant uniquement les champs que tu as trouvés avec haute certitude (URL vérifiée ou email confirmé). N'inclus jamais un champ incertain ou deviné.

\`\`\`json
{"extracted_fields": {"linkedin_url": "https://linkedin.com/in/...", "twitter_url": "https://twitter.com/...", "email": "prenom.nom@entreprise.com"}}
\`\`\`

Omets tout champ non trouvé avec certitude. Si aucun champ n'est certain, retourne \`{"extracted_fields": {}}\`.`

  const response = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const }],
      messages: [{ role: 'user', content: prompt }],
    })
  )

  const result = parseResult(response.content)
  if (!result.summary) throw new Error('Aucun résultat généré par le modèle.')
  return result
}

// ---------------------------------------------------------------------------
// enrichCompanyNews
// ---------------------------------------------------------------------------

export async function enrichCompanyNews(company: string): Promise<EnrichmentResult> {
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

Si l'entreprise est peu connue ou que les informations sont limitées, indique-le et partage ce que tu as trouvé.

---

Après ton rapport, ajoute exactement un bloc JSON contenant le site web officiel de l'entreprise si tu l'as trouvé avec certitude (URL vérifiée). N'inclus pas le champ si tu n'es pas certain.

\`\`\`json
{"extracted_fields": {"website": "https://www.entreprise.com"}}
\`\`\`

Si le site n'est pas trouvé avec certitude, retourne \`{"extracted_fields": {}}\`.`

  const response = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const }],
      messages: [{ role: 'user', content: prompt }],
    })
  )

  const result = parseResult(response.content)
  if (!result.summary) throw new Error('Aucun résultat généré par le modèle.')
  return result
}
