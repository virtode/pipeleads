import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { getFullName } from '@/lib/utils'
import type { ActionTemplate } from '@/lib/types/interactions'
import { ActionTemplateLabels } from '@/lib/types/interactions'

// GET /api/ical/[token]/calendar.ics
// Flux iCal public — authentification par token uniquement.

// ---------------------------------------------------------------------------
// iCal helpers
// ---------------------------------------------------------------------------

function escapeText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

// RFC 5545 §3.1 — fold lines > 75 octets
function foldLine(line: string): string {
  const MAX = 75
  if (line.length <= MAX) return line
  const chunks: string[] = [line.slice(0, MAX)]
  let pos = MAX
  while (pos < line.length) {
    chunks.push(line.slice(pos, pos + MAX - 1))
    pos += MAX - 1
  }
  return chunks.join('\r\n ')
}

function buildIcs(
  reminders: Array<{
    id: string
    contact_id: string
    content: string
    action_template: string | null
    date: string
    contact: { first_name: string; last_name: string | null } | null
  }>,
  timezone: string,
  appUrl: string,
): string {
  const dtstamp = formatInTimeZone(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'")

  const events = reminders.map((r) => {
    const tpl         = r.action_template as ActionTemplate | null
    const label       = tpl ? ActionTemplateLabels[tpl] : 'Rappel'
    const contactName = r.contact
      ? getFullName(r.contact.first_name, r.contact.last_name)
      : 'Contact inconnu'

    const summary     = `[PipeLeads] ${label} — ${contactName}`
    const link        = `${appUrl}/contacts?id=${r.contact_id}`
    const descRaw     = `${r.content}\n\n${link}`
    const description = escapeText(descRaw)

    const dtDate  = new Date(r.date)
    const dtstart = formatInTimeZone(dtDate, timezone, 'yyyyMMdd')
    const dtend   = formatInTimeZone(addDays(dtDate, 1), timezone, 'yyyyMMdd')

    return [
      'BEGIN:VEVENT',
      foldLine(`UID:reminder-${r.id}@pipeleads.app`),
      foldLine(`SUMMARY:${escapeText(summary)}`),
      foldLine(`DESCRIPTION:${description}`),
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `DTSTAMP:${dtstamp}`,
      'END:VEVENT',
    ].join('\r\n')
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PipeLeads//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PipeLeads \u2014 Rappels',
    'REFRESH-INTERVAL;VALUE=DURATION:PT30M',
    'X-PUBLISHED-TTL:PT30M',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const admin = createAdminClient()

  // Resolve user from token (never log the token value)
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, timezone')
    .eq('ical_token', token)
    .maybeSingle()

  if (profileErr || !profile) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const timezone = profile.timezone ?? 'Europe/Paris'
  const appUrl   = `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'pipeleads.app'}`

  // Fetch pending reminders for this user's contacts
  const { data: contacts, error: contactsErr } = await admin
    .from('contacts')
    .select('id')
    .eq('user_id', profile.id)

  if (contactsErr) {
    console.error('[ical] contacts query error:', contactsErr.message)
    return new NextResponse('Internal Server Error', { status: 500 })
  }

  const contactIds = (contacts ?? []).map((c) => c.id)

  let reminders: Parameters<typeof buildIcs>[0] = []
  if (contactIds.length > 0) {
    const { data, error: remindersErr } = await admin
      .from('interactions')
      .select('id, contact_id, content, action_template, date, contact:contacts(first_name, last_name)')
      .in('contact_id', contactIds)
      .eq('status', 'pending')
      .order('date', { ascending: true })

    if (remindersErr) {
      console.error('[ical] interactions query error:', remindersErr.message)
      return new NextResponse('Internal Server Error', { status: 500 })
    }
    reminders = (data ?? []) as Parameters<typeof buildIcs>[0]
  }

  const ics = buildIcs(reminders, timezone, appUrl)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Cache-Control':       'max-age=1800, public',
      'Content-Disposition': 'attachment; filename="pipeleads.ics"',
    },
  })
}
