export interface Contact {
  id: string
  first_name: string
  last_name: string | null
  email: string[] | null
  phone: string[] | null
  company: string | null
  job_title: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  notes: string | null
  updated_at: string
  tenant_id: string | null
  user_id: string
}

export function contactToVCard(contact: Contact): string {
  const lines: string[] = []
  lines.push('BEGIN:VCARD')
  lines.push('VERSION:4.0')
  lines.push(`UID:${contact.id}`)
  lines.push(`FN:${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}`)
  lines.push(`N:${contact.last_name ?? ''};${contact.first_name};;;`)

  if (contact.email && contact.email.length > 0) {
    for (const em of contact.email) {
      lines.push(`EMAIL:${em}`)
    }
  }

  if (contact.phone && contact.phone.length > 0) {
    for (const tel of contact.phone) {
      lines.push(`TEL:${tel}`)
    }
  }

  if (contact.company) {
    lines.push(`ORG:${contact.company}`)
  }

  if (contact.job_title) {
    lines.push(`TITLE:${contact.job_title}`)
  }

  if (contact.address || contact.city || contact.postal_code || contact.country) {
    const street  = (contact.address ?? '').replace(/[,;\\]/g, (c) => '\\' + c)
    const city    = (contact.city ?? '').replace(/[,;\\]/g, (c) => '\\' + c)
    const postal  = (contact.postal_code ?? '').replace(/[,;\\]/g, (c) => '\\' + c)
    const country = (contact.country ?? '').replace(/[,;\\]/g, (c) => '\\' + c)
    lines.push(`ADR;TYPE=HOME:;;${street};${city};;${postal};${country}`)
  }

  if (contact.notes) {
    // Escape newlines in NOTE per RFC 6350
    const escaped = contact.notes.replace(/\n/g, '\\n').replace(/\r/g, '')
    lines.push(`NOTE:${escaped}`)
  }

  lines.push(`REV:${new Date(contact.updated_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`)
  lines.push('END:VCARD')

  return lines.join('\r\n') + '\r\n'
}

export function vCardToContact(vcf: string): Partial<Contact> {
  const result: Partial<Contact> = {}
  const emails: string[] = []
  const phones: string[] = []

  for (const rawLine of vcf.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const field = line.slice(0, colonIdx).toUpperCase()
    const value = line.slice(colonIdx + 1)

    if (field === 'UID') {
      result.id = value
    } else if (field === 'N') {
      // N:last;first;;;
      const parts = value.split(';')
      result.last_name = parts[0] || null
      result.first_name = parts[1] || ''
    } else if (field === 'EMAIL' || field.startsWith('EMAIL;')) {
      if (value) emails.push(value)
    } else if (field === 'TEL' || field.startsWith('TEL;')) {
      if (value) phones.push(value)
    } else if (field === 'ORG') {
      result.company = value || null
    } else if (field === 'TITLE') {
      result.job_title = value || null
    } else if (field === 'ADR' || field.startsWith('ADR;')) {
      // ADR: poBox;ext;street;city;region;postalCode;country
      const parts = value.split(';')
      result.address     = parts[2]?.trim().replace(/\\,/g, ',') || null
      result.city        = parts[3]?.trim().replace(/\\,/g, ',') || null
      result.postal_code = parts[5]?.trim() || null
      result.country     = parts[6]?.trim().replace(/\\,/g, ',') || null
    } else if (field === 'NOTE') {
      result.notes = value.replace(/\\n/g, '\n') || null
    }
  }

  if (emails.length > 0) result.email = emails
  if (phones.length > 0) result.phone = phones

  return result
}
