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
// enrichContactProfile
// ---------------------------------------------------------------------------

export async function enrichContactProfile(contact: Contact): Promise<string> {
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

  const response = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const }],
      messages: [{ role: 'user', content: prompt }],
    })
  )

  const text = extractText(response.content)
  if (!text) throw new Error('Aucun résultat généré par le modèle.')
  return text
}

// ---------------------------------------------------------------------------
// enrichCompanyNews
// ---------------------------------------------------------------------------

export async function enrichCompanyNews(company: string): Promise<string> {
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

  const response = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const }],
      messages: [{ role: 'user', content: prompt }],
    })
  )

  const text = extractText(response.content)
  if (!text) throw new Error('Aucun résultat généré par le modèle.')
  return text
}
