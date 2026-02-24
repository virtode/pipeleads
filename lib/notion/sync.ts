/**
 * Notion integration — unidirectional sync CRM → Notion.
 *
 * Field mapping convention stored in DB:
 *   { [crmFieldKey]: notionPropertyName }
 * e.g. { first_name: "Name", email: "Email", company: "Société" }
 */

import { Client, isFullPage } from '@notionhq/client'
import type {
  DataSourceObjectResponse,
  PageObjectResponse,
  CreatePageParameters,
  UpdatePageParameters,
} from '@notionhq/client'
import type { Contact } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RATE_LIMIT_MS = 350 // ≤ 3 req/s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createClient(token: string): Client {
  return new Client({ auth: token })
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('authentication')) {
    return 'Token Notion invalide ou révoqué'
  }
  if (msg.includes('404') || msg.toLowerCase().includes('not_found')) {
    return "Base de données introuvable — vérifie l'ID et les permissions de l'intégration"
  }
  if (msg.toLowerCase().includes('rate') || msg.includes('429')) {
    return 'Rate limit Notion atteint — réessaie dans quelques secondes'
  }
  if (msg.toLowerCase().includes('validation') || msg.toLowerCase().includes('property')) {
    return `Propriété incompatible : ${msg}`
  }
  return msg
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface NotionPropertySchema {
  id: string
  name: string
  type: string
}

/** Retrieve the list of properties from a Notion data source (database). */
export async function getNotionDatabaseSchema(
  token: string,
  databaseId: string,
): Promise<NotionPropertySchema[]> {
  const client = createClient(token)

  try {
    const response = await client.dataSources.retrieve({ data_source_id: databaseId })

    if (response.object !== 'data_source') {
      throw new Error('Base de données introuvable')
    }

    const ds = response as DataSourceObjectResponse
    return Object.entries(ds.properties).map(([name, prop]) => ({
      id: (prop as { id: string }).id,
      name,
      type: (prop as { type: string }).type,
    }))
  } catch (err) {
    throw new Error(friendlyError(err))
  }
}

// ---------------------------------------------------------------------------
// Connection test
// ---------------------------------------------------------------------------

/** Validate a token + database id pair. Returns the database title on success. */
export async function connectNotion(
  token: string,
  databaseId: string,
): Promise<{ title: string; propertyCount: number }> {
  const client = createClient(token)

  try {
    const response = await client.dataSources.retrieve({ data_source_id: databaseId })

    if (response.object !== 'data_source') {
      throw new Error("Base de données introuvable — vérifie l'ID et les permissions")
    }

    const ds = response as DataSourceObjectResponse
    const title =
      ds.title.map((t) => ('plain_text' in t ? t.plain_text : '')).join('') || 'Sans titre'
    const propertyCount = Object.keys(ds.properties).length

    return { title, propertyCount }
  } catch (err) {
    throw new Error(friendlyError(err))
  }
}

// ---------------------------------------------------------------------------
// Build Notion page properties from a contact
// ---------------------------------------------------------------------------

type PageProperties = NonNullable<CreatePageParameters['properties']>

function getCrmValue(contact: Contact, crmField: string): unknown {
  switch (crmField) {
    case 'full_name':
      return [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    case 'first_name':
      return contact.first_name
    case 'last_name':
      return contact.last_name ?? ''
    case 'email':
      return contact.email?.[0] ?? null
    case 'phone':
      return contact.phone?.[0] ?? null
    case 'company':
      return contact.company ?? null
    case 'job_title':
      return contact.job_title ?? null
    case 'address':
      return contact.address ?? null
    case 'city':
      return contact.city ?? null
    case 'country':
      return contact.country ?? null
    case 'tags':
      return contact.tags ?? []
    case 'notes':
      return contact.notes ?? null
    case 'linkedin_url':
      return contact.linkedin_url ?? null
    case 'twitter_url':
      return contact.twitter_url ?? null
    case 'website':
      return contact.website ?? null
    default:
      return null
  }
}

function buildPropertyValue(type: string, value: unknown): unknown {
  // Null / empty — let Notion clear the field
  if (value === null || value === undefined || value === '') {
    switch (type) {
      case 'title':
        return { title: [] }
      case 'rich_text':
        return { rich_text: [] }
      case 'email':
        return { email: null }
      case 'phone_number':
        return { phone_number: null }
      case 'url':
        return { url: null }
      case 'select':
        return { select: null }
      case 'multi_select':
        return { multi_select: [] }
      case 'number':
        return { number: null }
      case 'date':
        return { date: null }
      default:
        return { rich_text: [] }
    }
  }

  const str = String(value)

  switch (type) {
    case 'title':
      return { title: [{ text: { content: str.slice(0, 2000) } }] }
    case 'rich_text':
      return { rich_text: [{ text: { content: str.slice(0, 2000) } }] }
    case 'email':
      return { email: str }
    case 'phone_number':
      return { phone_number: str }
    case 'url':
      return { url: str }
    case 'select':
      return { select: { name: str } }
    case 'multi_select':
      if (Array.isArray(value)) {
        return { multi_select: (value as string[]).map((v) => ({ name: String(v) })) }
      }
      return { multi_select: str ? [{ name: str }] : [] }
    case 'number': {
      const n = parseFloat(str)
      return { number: isNaN(n) ? null : n }
    }
    case 'checkbox':
      return { checkbox: Boolean(value) }
    case 'date':
      return { date: { start: str } }
    default:
      // Best-effort: store as rich_text
      return { rich_text: [{ text: { content: str.slice(0, 2000) } }] }
  }
}

function buildProperties(
  contact: Contact,
  /** { [crmField]: notionPropertyName } */
  fieldMapping: Record<string, string>,
  schema: NotionPropertySchema[],
): PageProperties {
  const schemaByName = Object.fromEntries(schema.map((p) => [p.name, p]))
  const props: Record<string, unknown> = {}

  for (const [crmField, notionPropName] of Object.entries(fieldMapping)) {
    if (!notionPropName) continue
    const propSchema = schemaByName[notionPropName]
    if (!propSchema) continue

    const value = getCrmValue(contact, crmField)
    try {
      props[notionPropName] = buildPropertyValue(propSchema.type, value)
    } catch {
      // Skip property that cannot be cast
    }
  }

  return props as PageProperties
}

// ---------------------------------------------------------------------------
// Paginated query helper
// ---------------------------------------------------------------------------

async function* paginateDataSource(
  client: Client,
  databaseId: string,
): AsyncGenerator<PageObjectResponse> {
  let cursor: string | undefined

  do {
    await sleep(RATE_LIMIT_MS)

    const page = await client.dataSources.query({
      data_source_id: databaseId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    })

    for (const result of page.results) {
      if (isFullPage(result)) {
        yield result
      }
    }

    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
  } while (cursor)
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export interface SyncReport {
  total: number
  created: number
  updated: number
  errors: Array<{ contactId: string; name: string; error: string }>
}

/**
 * Sync all contacts to Notion.
 *
 * Matching strategy: if the email CRM field is mapped, look for an existing
 * Notion page with the same email and update it; otherwise create a new page.
 */
export async function syncAllContacts(
  token: string,
  databaseId: string,
  /** { [crmField]: notionPropertyName } */
  fieldMapping: Record<string, string>,
  contacts: Contact[],
  onProgress?: (done: number, total: number) => void,
): Promise<SyncReport> {
  const client = createClient(token)
  const schema = await getNotionDatabaseSchema(token, databaseId)

  // Resolve the Notion property name for the email field (if mapped)
  const emailNotionProp = fieldMapping['email']

  // Build email → pageId map for deduplication
  const existingByEmail = new Map<string, string>()

  if (emailNotionProp) {
    for await (const page of paginateDataSource(client, databaseId)) {
      const emailProp = page.properties[emailNotionProp]
      if (!emailProp) continue

      let email: string | null = null
      if (emailProp.type === 'email' && emailProp.email) {
        email = emailProp.email
      } else if (emailProp.type === 'rich_text' && emailProp.rich_text[0]?.plain_text) {
        email = emailProp.rich_text[0].plain_text
      } else if (emailProp.type === 'title' && emailProp.title[0]?.plain_text) {
        email = emailProp.title[0].plain_text
      }

      if (email) existingByEmail.set(email.toLowerCase(), page.id)
    }
  }

  const report: SyncReport = { total: contacts.length, created: 0, updated: 0, errors: [] }

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i]
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ')

    try {
      const properties = buildProperties(contact, fieldMapping, schema)
      const email = contact.email?.[0]?.toLowerCase()
      const existingPageId = email ? existingByEmail.get(email) : undefined

      await sleep(RATE_LIMIT_MS)

      if (existingPageId) {
        const updateArgs: UpdatePageParameters = { page_id: existingPageId, properties }
        await client.pages.update(updateArgs)
        report.updated++
      } else {
        const createArgs: CreatePageParameters = {
          parent: { data_source_id: databaseId, type: 'data_source_id' },
          properties,
        }
        await client.pages.create(createArgs)
        report.created++
      }
    } catch (err) {
      report.errors.push({
        contactId: contact.id,
        name: fullName,
        error: friendlyError(err),
      })
    }

    onProgress?.(i + 1, contacts.length)
  }

  return report
}
