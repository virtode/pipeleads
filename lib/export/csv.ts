import type { Contact } from '@/types'

export interface CsvExportField {
  key: string
  label: string
  getValue: (c: Contact) => string
}

export const CSV_EXPORT_FIELDS: CsvExportField[] = [
  { key: 'first_name',   label: 'Prénom',         getValue: (c) => c.first_name ?? '' },
  { key: 'last_name',    label: 'Nom',             getValue: (c) => c.last_name ?? '' },
  { key: 'email',        label: 'Email(s)',         getValue: (c) => (c.email ?? []).join(' | ') },
  { key: 'phone',        label: 'Téléphone(s)',     getValue: (c) => (c.phone ?? []).join(' | ') },
  { key: 'company',      label: 'Entreprise',       getValue: (c) => c.company ?? '' },
  { key: 'job_title',    label: 'Poste',            getValue: (c) => c.job_title ?? '' },
  { key: 'address',      label: 'Adresse',          getValue: (c) => c.address ?? '' },
  { key: 'city',         label: 'Ville',            getValue: (c) => c.city ?? '' },
  { key: 'country',      label: 'Pays',             getValue: (c) => c.country ?? '' },
  { key: 'tags',         label: 'Tags',             getValue: (c) => (c.tags ?? []).join(' | ') },
  { key: 'linkedin_url', label: 'LinkedIn',         getValue: (c) => c.linkedin_url ?? '' },
  { key: 'twitter_url',  label: 'Twitter/X',        getValue: (c) => c.twitter_url ?? '' },
  { key: 'website',      label: 'Site web',         getValue: (c) => c.website ?? '' },
  { key: 'notes',        label: 'Notes',            getValue: (c) => c.notes ?? '' },
  { key: 'created_at',   label: 'Créé le',          getValue: (c) => c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '' },
]

function escapeCsvCell(value: string): string {
  // Always quote if contains comma, semicolon, newline, or double-quote
  if (value.includes('"') || value.includes(',') || value.includes(';') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function exportContactsToCSV(
  contacts: Contact[],
  selectedFieldKeys: string[] = CSV_EXPORT_FIELDS.map((f) => f.key)
): void {
  const fields = CSV_EXPORT_FIELDS.filter((f) => selectedFieldKeys.includes(f.key))

  const header = fields.map((f) => escapeCsvCell(f.label)).join(',')
  const rows = contacts.map((contact) =>
    fields.map((f) => escapeCsvCell(f.getValue(contact))).join(',')
  )

  const csvContent = [header, ...rows].join('\r\n')

  // UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })

  const date = new Date().toISOString().slice(0, 10)
  const filename = `contacts_${date}.csv`

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
