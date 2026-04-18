import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { buildDailyDigestHtml, type DigestItem } from '@/lib/email/digest'
import { endOfDay, startOfDay } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'

// ---------------------------------------------------------------------------
// Cron setup (Coolify / external scheduler)
//
// Since this project runs on Coolify/VPS (not Vercel), configure an external
// cron job to POST to this endpoint every hour:
//
//   curl -X POST https://pipeleads.app/api/cron/daily-digest \
//        -H "Authorization: Bearer $CRON_SECRET"
//
// Options:
//   - System cron (crontab):  0 * * * * curl ...
//   - cron-job.org (free, reliable, HTTPS support)
//   - Coolify scheduled task (if supported in your version)
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10

// ---------------------------------------------------------------------------
// POST /api/cron/daily-digest
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[digest] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const stats = { sent: 0, skipped: 0, errors: 0 }

  // ── Fetch enabled profiles ───────────────────────────────────────────────
  const { data: profiles, error: profilesErr } = await admin
    .from('profiles')
    .select('id, timezone, daily_digest_enabled')
    .eq('daily_digest_enabled', true)

  if (profilesErr || !profiles) {
    console.error('[digest] profiles fetch error:', profilesErr)
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }

  // ── Fetch user emails via auth admin ────────────────────────────────────
  const { data: { users }, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (usersErr) {
    console.error('[digest] users fetch error:', usersErr)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
  const emailMap = new Map(users.map((u) => [u.id, u.email ?? '']))

  console.log(`[digest] Processing ${profiles.length} users with digest enabled`)

  // ── Process in batches of BATCH_SIZE ────────────────────────────────────
  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (profile) => {
        const email = emailMap.get(profile.id) ?? ''
        try {
          await processUser(
            admin,
            { id: profile.id, timezone: profile.timezone },
            email,
            stats,
          )
        } catch (err) {
          console.error(`[digest] unhandled error for ${email}:`, err)
          stats.errors++
        }
      }),
    )
  }

  console.log(
    `[digest] Done — sent:${stats.sent} skipped:${stats.skipped} errors:${stats.errors}`,
  )
  return NextResponse.json({ ok: true, ...stats })
}

// ---------------------------------------------------------------------------
// Per-user logic
// ---------------------------------------------------------------------------

async function processUser(
  admin: ReturnType<typeof createAdminClient>,
  profile: { id: string; timezone: string | null },
  email: string,
  stats: { sent: number; skipped: number; errors: number },
) {
  const tz  = profile.timezone ?? 'Europe/Paris'
  const now = new Date()

  // ── 1. Check local hour [7:00–7:59] ─────────────────────────────────────
  const localHour = parseInt(formatInTimeZone(now, tz, 'HH'), 10)
  if (localHour !== 7) {
    stats.skipped++
    console.log(`[digest] skip ${email} — local hour ${localHour} (${tz})`)
    return
  }

  // ── 2. Compute today's local date string (YYYY-MM-DD) for idempotency ──
  const localDateStr = formatInTimeZone(now, tz, 'yyyy-MM-dd')

  // ── 3. Idempotency check ────────────────────────────────────────────────
  const { data: alreadySent } = await admin
    .from('digest_sent')
    .select('id')
    .eq('user_id', profile.id)
    .eq('local_date', localDateStr)
    .maybeSingle()

  if (alreadySent) {
    stats.skipped++
    console.log(`[digest] skip ${email} — already sent (${localDateStr})`)
    return
  }

  // ── 4. Timezone boundaries ──────────────────────────────────────────────
  const zonedNow       = toZonedTime(now, tz)
  const startOfTodayUtc = fromZonedTime(startOfDay(zonedNow), tz)
  const endOfTodayUtc   = fromZonedTime(endOfDay(zonedNow), tz)

  // ── 5. Get contact IDs for this user ────────────────────────────────────
  const { data: contacts } = await admin
    .from('contacts')
    .select('id')
    .eq('user_id', profile.id)

  if (!contacts || contacts.length === 0) {
    stats.skipped++
    console.log(`[digest] skip ${email} — no contacts`)
    return
  }

  const contactIds = contacts.map((c) => c.id)

  // ── 6. Fetch pending interactions ≤ end of today ────────────────────────
  const { data: rows, error: interErr } = await admin
    .from('interactions')
    .select('id, contact_id, content, action_template, date, contact:contacts(id, first_name, last_name)')
    .in('contact_id', contactIds)
    .eq('status', 'pending')
    .lte('date', endOfTodayUtc.toISOString())
    .order('date', { ascending: true })

  if (interErr) {
    console.error(`[digest] interactions fetch error for ${email}:`, interErr)
    stats.errors++
    return
  }

  const interactions = (rows ?? []) as unknown as DigestItem[]

  if (interactions.length === 0) {
    stats.skipped++
    console.log(`[digest] skip ${email} — no pending reminders today`)
    return
  }

  // ── 7. Split overdue / today ────────────────────────────────────────────
  const overdueItems = interactions.filter((i) => new Date(i.date) < startOfTodayUtc)
  const todayItems   = interactions.filter((i) => new Date(i.date) >= startOfTodayUtc)

  // ── 8. Build + send email ────────────────────────────────────────────────
  if (!email) {
    stats.skipped++
    console.log(`[digest] skip ${profile.id} — no email address`)
    return
  }

  const appUrl = `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'pipeleads.app'}`
  const total  = interactions.length

  const html = buildDailyDigestHtml({ overdueItems, todayItems, appUrl })

  await sendEmail({
    to: email,
    subject: `PipeLeads — ${total} rappel${total > 1 ? 's' : ''} aujourd'hui`,
    html,
  })

  // ── 9. Record in digest_sent ─────────────────────────────────────────────
  await admin
    .from('digest_sent')
    .insert({ user_id: profile.id, local_date: localDateStr })

  stats.sent++
  console.log(
    `[digest] sent to ${email} — ${total} reminders (overdue:${overdueItems.length} today:${todayItems.length})`,
  )
}
