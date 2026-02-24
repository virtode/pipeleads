import type { InsertDto } from '@/lib/supabase/types'

export type ImportContactDto = Omit<InsertDto<'contacts'>, 'user_id'>

// ---------------------------------------------------------------------------
// VCF / vCard parser — supports 2.1, 3.0, 4.0
// ---------------------------------------------------------------------------

/** Unfold RFC 6350 folded lines (lines starting with SPACE or TAB are continuations) */
function unfoldLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const unfolded = normalized.replace(/\n[ \t]/g, '')
  return unfolded.split('\n')
}

/** Decode QUOTED-PRINTABLE (vCard 2.1) */
function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/g, '') // soft line break
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/** Unescape vCard 3.0/4.0 special chars */
function unescapeValue(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

interface VCardProperty {
  name: string
  params: Record<string, string>
  value: string
}

function parseProperty(line: string): VCardProperty | null {
  // Split name+params from value on first unescaped ':'
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null

  const namePart = line.slice(0, colonIdx)
  let rawValue = line.slice(colonIdx + 1)

  // Parse name and parameters: NAME;PARAM1=val1;PARAM2=val2
  const parts = namePart.split(';')
  const name = parts[0].toUpperCase().trim()
  const params: Record<string, string> = {}

  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=')
    if (eq !== -1) {
      params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1)
    } else {
      // vCard 2.1 bare params like TYPE=WORK or just ENCODING=QUOTED-PRINTABLE
      params[parts[i].toUpperCase()] = 'true'
    }
  }

  // Handle QUOTED-PRINTABLE encoding
  if (params['ENCODING'] === 'QUOTED-PRINTABLE') {
    rawValue = decodeQuotedPrintable(rawValue)
  }

  // Handle CHARSET (basic: ignore non-UTF8, assume UTF-8)
  const value = unescapeValue(rawValue)

  return { name, params, value }
}

/** Split a vCard value on unescaped semicolons */
function splitSemicolon(value: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      current += value[i + 1]
      i++
    } else if (value[i] === ';') {
      parts.push(current)
      current = ''
    } else {
      current += value[i]
    }
  }
  parts.push(current)
  return parts
}

/** Split a vCard value on unescaped commas */
function splitComma(value: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      current += value[i + 1]
      i++
    } else if (value[i] === ',') {
      parts.push(current)
      current = ''
    } else {
      current += value[i]
    }
  }
  parts.push(current)
  return parts
}

function parseVCard(block: string[]): ImportContactDto | null {
  const props: VCardProperty[] = []
  for (const line of block) {
    if (!line.trim()) continue
    const prop = parseProperty(line)
    if (prop) props.push(prop)
  }

  // Extract values by property name
  const get = (name: string) => props.filter((p) => p.name === name)
  const getFirst = (name: string) => props.find((p) => p.name === name)?.value ?? ''

  // N: familyName;givenName;additionalNames;honorificPrefix;honorificSuffix
  const nProp = getFirst('N')
  const nParts = splitSemicolon(nProp)
  const lastName  = (nParts[0] ?? '').trim()
  const firstName = (nParts[1] ?? '').trim()

  // FN fallback
  const fn = getFirst('FN').trim()

  // If N is empty, try to parse FN
  let resolvedFirst = firstName
  let resolvedLast  = lastName
  if (!resolvedFirst && !resolvedLast && fn) {
    const fnParts = fn.trim().split(/\s+/)
    resolvedFirst = fnParts[0] ?? ''
    resolvedLast  = fnParts.slice(1).join(' ')
  }

  if (!resolvedFirst && !resolvedLast && !fn) return null

  // ORG: company;department
  const orgParts = splitSemicolon(getFirst('ORG'))
  const company = orgParts[0]?.trim() || null

  // TITLE
  const jobTitle = getFirst('TITLE').trim() || null

  // EMAILs
  const emails = get('EMAIL')
    .map((p) => p.value.trim())
    .filter(Boolean)

  // TELs
  const phones = get('TEL')
    .map((p) => p.value.trim())
    .filter(Boolean)

  // ADR: poBox;ext;street;city;region;postalCode;country
  const adrProp = getFirst('ADR')
  let address: string | null = null
  let city: string | null = null
  let country: string | null = null
  if (adrProp) {
    const adrParts = splitSemicolon(adrProp)
    address = [adrParts[2], adrParts[3] ? '' : ''].filter(Boolean).join(', ').trim() || null
    // Use street only
    address = adrParts[2]?.trim() || null
    city    = adrParts[3]?.trim() || null
    country = adrParts[6]?.trim() || null
  }

  // URL
  const website = getFirst('URL').trim() || null

  // CATEGORIES / tags
  const categoriesRaw = getFirst('CATEGORIES')
  const tags = categoriesRaw
    ? splitComma(categoriesRaw).map((t) => t.trim()).filter(Boolean)
    : null

  // NOTE
  const notes = getFirst('NOTE').trim() || null

  // PHOTO
  const photoProp = getFirst('PHOTO')
  let photoUrl: string | null = null
  if (photoProp) {
    const photoProps = props.find((p) => p.name === 'PHOTO')
    if (photoProps?.params['VALUE'] === 'URI' || photoProp.startsWith('http')) {
      photoUrl = photoProp.trim()
    }
  }

  // Social profiles
  let linkedinUrl: string | null = null
  let twitterUrl: string | null = null
  for (const p of props) {
    if (p.name === 'X-SOCIALPROFILE') {
      const type = (p.params['TYPE'] ?? '').toLowerCase()
      if (type === 'linkedin') linkedinUrl = p.value.trim()
      else if (type === 'twitter') twitterUrl = p.value.trim()
    }
  }

  return {
    first_name:   resolvedFirst || fn || 'Inconnu',
    last_name:    resolvedLast  || null,
    email:        emails.length > 0 ? emails : null,
    phone:        phones.length > 0 ? phones : null,
    company,
    job_title:    jobTitle,
    address,
    city,
    country,
    tags,
    notes,
    photo_url:    photoUrl,
    linkedin_url: linkedinUrl,
    twitter_url:  twitterUrl,
    website,
  }
}

export function parseVCF(fileContent: string): ImportContactDto[] {
  const lines = unfoldLines(fileContent)

  const contacts: ImportContactDto[] = []
  let currentBlock: string[] = []
  let inCard = false

  for (const line of lines) {
    const upper = line.toUpperCase().trim()
    if (upper === 'BEGIN:VCARD') {
      inCard = true
      currentBlock = []
    } else if (upper === 'END:VCARD') {
      if (inCard) {
        const contact = parseVCard(currentBlock)
        if (contact) contacts.push(contact)
      }
      inCard = false
      currentBlock = []
    } else if (inCard) {
      currentBlock.push(line)
    }
  }

  return contacts
}
