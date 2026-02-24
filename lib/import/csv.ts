import type { InsertDto } from '@/lib/supabase/types'

export type CsvRow = Record<string, string>

export interface ParseCSVResult {
  headers: string[]
  rows: CsvRow[]
}

/** Detect separator from first line (comma, semicolon, tab) */
function detectSeparator(firstLine: string): string {
  const counts = {
    ',': (firstLine.match(/,/g) ?? []).length,
    ';': (firstLine.match(/;/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

/** Parse a single CSV line respecting quoted fields */
function parseLine(line: string, sep: string): string[] {
  const cells: string[] = []
  let inQuotes = false
  let current = ''
  let i = 0

  while (i < line.length) {
    const ch = line[i]

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 2
        continue
      }
      inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
    i++
  }

  cells.push(current.trim())
  return cells
}

export function parseCSV(file: string): ParseCSVResult {
  // Normalize line endings and strip BOM
  const text = file.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter((l) => l.trim() !== '')

  if (lines.length === 0) return { headers: [], rows: [] }

  const sep = detectSeparator(lines[0])
  const headers = parseLine(lines[0], sep)

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i], sep)
    const row: CsvRow = {}
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Mapping CSV → Contact
// ---------------------------------------------------------------------------

export type CsvContactMapping = {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  job_title?: string
  address?: string
  city?: string
  country?: string
  tags?: string
  linkedin_url?: string
  twitter_url?: string
  website?: string
  notes?: string
}

export const CSV_CONTACT_FIELDS: { key: keyof CsvContactMapping; label: string }[] = [
  { key: 'first_name',   label: 'Prénom' },
  { key: 'last_name',    label: 'Nom' },
  { key: 'email',        label: 'Email(s)' },
  { key: 'phone',        label: 'Téléphone(s)' },
  { key: 'company',      label: 'Entreprise' },
  { key: 'job_title',    label: 'Poste' },
  { key: 'address',      label: 'Adresse' },
  { key: 'city',         label: 'Ville' },
  { key: 'country',      label: 'Pays' },
  { key: 'tags',         label: 'Tags' },
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'twitter_url',  label: 'Twitter/X' },
  { key: 'website',      label: 'Site web' },
  { key: 'notes',        label: 'Notes' },
]

/** Split multi-value cells separated by ' | ' or newlines */
function splitMultiValue(value: string): string[] {
  return value
    .split(/\s*\|\s*|\n/)
    .map((v) => v.trim())
    .filter(Boolean)
}

/** Auto-detect mapping by comparing header names to known field labels/keys */
export function autoDetectMapping(headers: string[]): CsvContactMapping {
  const mapping: CsvContactMapping = {}

  const knownMappings: Record<string, keyof CsvContactMapping> = {
    // French labels
    'prénom': 'first_name', 'prenom': 'first_name', 'first name': 'first_name', 'firstname': 'first_name',
    'nom': 'last_name', 'last name': 'last_name', 'lastname': 'last_name', 'surname': 'last_name',
    'email': 'email', 'e-mail': 'email', 'courriel': 'email', 'email(s)': 'email',
    'téléphone': 'phone', 'telephone': 'phone', 'phone': 'phone', 'tel': 'phone', 'mobile': 'phone', 'téléphone(s)': 'phone',
    'entreprise': 'company', 'company': 'company', 'société': 'company', 'societe': 'company', 'organisation': 'company',
    'poste': 'job_title', 'job_title': 'job_title', 'job title': 'job_title', 'titre': 'job_title', 'fonction': 'job_title',
    'adresse': 'address', 'address': 'address', 'rue': 'address',
    'ville': 'city', 'city': 'city',
    'pays': 'country', 'country': 'country',
    'tags': 'tags', 'étiquettes': 'tags', 'etiquettes': 'tags', 'catégories': 'tags',
    'linkedin': 'linkedin_url', 'linkedin_url': 'linkedin_url',
    'twitter': 'twitter_url', 'twitter_url': 'twitter_url', 'twitter/x': 'twitter_url',
    'website': 'website', 'site web': 'website', 'site_web': 'website', 'url': 'website',
    'notes': 'notes', 'remarques': 'notes', 'commentaires': 'notes',
  }

  for (const header of headers) {
    const normalized = header.toLowerCase().trim()
    const field = knownMappings[normalized]
    if (field && !mapping[field]) {
      mapping[field] = header
    }
  }

  return mapping
}

export type ImportContactDto = Omit<InsertDto<'contacts'>, 'user_id'>

export function mapCSVToContacts(
  rows: CsvRow[],
  mapping: CsvContactMapping
): ImportContactDto[] {
  return rows
    .map((row): ImportContactDto | null => {
      const firstName = mapping.first_name ? (row[mapping.first_name] ?? '').trim() : ''
      const lastName  = mapping.last_name  ? (row[mapping.last_name]  ?? '').trim() : ''

      // Skip completely empty rows
      if (!firstName && !lastName) return null

      const emailRaw = mapping.email ? row[mapping.email] ?? '' : ''
      const phoneRaw = mapping.phone ? row[mapping.phone] ?? '' : ''
      const tagsRaw  = mapping.tags  ? row[mapping.tags]  ?? '' : ''

      return {
        first_name:   firstName || 'Inconnu',
        last_name:    lastName  || null,
        email:        emailRaw ? splitMultiValue(emailRaw) : null,
        phone:        phoneRaw ? splitMultiValue(phoneRaw) : null,
        company:      mapping.company      ? (row[mapping.company]      ?? '').trim() || null : null,
        job_title:    mapping.job_title    ? (row[mapping.job_title]    ?? '').trim() || null : null,
        address:      mapping.address      ? (row[mapping.address]      ?? '').trim() || null : null,
        city:         mapping.city         ? (row[mapping.city]         ?? '').trim() || null : null,
        country:      mapping.country      ? (row[mapping.country]      ?? '').trim() || null : null,
        tags:         tagsRaw ? splitMultiValue(tagsRaw) : null,
        linkedin_url: mapping.linkedin_url ? (row[mapping.linkedin_url] ?? '').trim() || null : null,
        twitter_url:  mapping.twitter_url  ? (row[mapping.twitter_url]  ?? '').trim() || null : null,
        website:      mapping.website      ? (row[mapping.website]      ?? '').trim() || null : null,
        notes:        mapping.notes        ? (row[mapping.notes]        ?? '').trim() || null : null,
        photo_url:    null,
      }
    })
    .filter((c): c is ImportContactDto => c !== null)
}
