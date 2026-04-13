import type { Contact } from '@/types'

function fold(line: string): string {
  // RFC 6350: fold lines longer than 75 octets
  const maxLen = 75
  if (line.length <= maxLen) return line

  const chunks: string[] = []
  chunks.push(line.slice(0, maxLen))
  let i = maxLen
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + maxLen - 1))
    i += maxLen - 1
  }
  return chunks.join('\r\n')
}

function escapeVcfValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

function contactToVCard(contact: Contact): string {
  const lines: string[] = []
  lines.push('BEGIN:VCARD')
  lines.push('VERSION:3.0')

  // FN (formatted name) — required
  const fn = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Sans nom'
  lines.push(fold(`FN:${escapeVcfValue(fn)}`))

  // N: last;first;;;
  lines.push(
    fold(
      `N:${escapeVcfValue(contact.last_name ?? '')};${escapeVcfValue(contact.first_name ?? '')};;;`
    )
  )

  // ORG
  if (contact.company) {
    lines.push(fold(`ORG:${escapeVcfValue(contact.company)}`))
  }

  // TITLE
  if (contact.job_title) {
    lines.push(fold(`TITLE:${escapeVcfValue(contact.job_title)}`))
  }

  // EMAIL
  for (const email of contact.email ?? []) {
    if (email) lines.push(fold(`EMAIL;TYPE=INTERNET:${escapeVcfValue(email)}`))
  }

  // TEL
  for (const phone of contact.phone ?? []) {
    if (phone) lines.push(fold(`TEL;TYPE=VOICE:${escapeVcfValue(phone)}`))
  }

  // ADR — poBox;ext;street;city;region;postalCode;country
  if (contact.address || contact.city || contact.postal_code || contact.country) {
    const street  = escapeVcfValue(contact.address ?? '')
    const city    = escapeVcfValue(contact.city ?? '')
    const postal  = escapeVcfValue(contact.postal_code ?? '')
    const country = escapeVcfValue(contact.country ?? '')
    lines.push(fold(`ADR;TYPE=HOME:;;${street};${city};;${postal};${country}`))
  }

  // URL (website)
  if (contact.website) {
    lines.push(fold(`URL:${escapeVcfValue(contact.website)}`))
  }

  // X-SOCIALPROFILE or custom properties for social
  if (contact.linkedin_url) {
    lines.push(fold(`X-SOCIALPROFILE;TYPE=linkedin:${escapeVcfValue(contact.linkedin_url)}`))
  }
  if (contact.twitter_url) {
    lines.push(fold(`X-SOCIALPROFILE;TYPE=twitter:${escapeVcfValue(contact.twitter_url)}`))
  }

  // CATEGORIES (tags)
  if (contact.tags && contact.tags.length > 0) {
    lines.push(fold(`CATEGORIES:${contact.tags.map(escapeVcfValue).join(',')}`))
  }

  // NOTE
  if (contact.notes) {
    lines.push(fold(`NOTE:${escapeVcfValue(contact.notes)}`))
  }

  // PHOTO
  if (contact.photo_url) {
    lines.push(fold(`PHOTO;VALUE=URI:${escapeVcfValue(contact.photo_url)}`))
  }

  // REV — revision date
  if (contact.updated_at) {
    const rev = new Date(contact.updated_at).toISOString().replace(/\.\d+Z$/, 'Z')
    lines.push(`REV:${rev}`)
  }

  lines.push('END:VCARD')

  return lines.join('\r\n')
}

export function exportContactsToVCF(contacts: Contact[]): void {
  const vcfContent = contacts.map(contactToVCard).join('\r\n')
  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' })

  const date = new Date().toISOString().slice(0, 10)
  const filename = contacts.length === 1
    ? `${contacts[0].first_name ?? 'contact'}_${contacts[0].last_name ?? ''}_${date}.vcf`.replace(/\s+/g, '_')
    : `contacts_${date}.vcf`

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
