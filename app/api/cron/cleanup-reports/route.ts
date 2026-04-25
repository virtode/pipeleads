import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteReport } from '@/src/modules/insights/lib/storage'

// analysis_reports is not yet in lib/supabase/types.ts — cast to untyped client for those queries
type UntypedClient = SupabaseClient

// ---------------------------------------------------------------------------
// Cron setup (Coolify / external scheduler)
//
// POST /api/cron/cleanup-reports
//   Authorization: Bearer $CRON_SECRET
//
// Recommended schedule : daily at 02:00 UTC
//   0 2 * * * curl -X POST https://pipeleads.app/api/cron/cleanup-reports \
//                   -H "Authorization: Bearer $CRON_SECRET"
// ---------------------------------------------------------------------------

type ReportRow = {
  id: string
  storage_path: string
}

// ---------------------------------------------------------------------------
// POST /api/cron/cleanup-reports
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cleanup-reports] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('Authorization')?.trim() !== `Bearer ${cronSecret.trim()}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient() as unknown as UntypedClient
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const nowIso = now.toISOString()

  const stats = { cleaned: 0, errors: 0, deletedRows: 0 }

  // ── 1. Fetch candidates for Storage cleanup ───────────────────────────────
  //   a) expired and not yet cleaned
  //   b) revoked 30+ days ago and not yet cleaned

  const [expiredResult, revokedResult] = await Promise.all([
    admin
      .from('analysis_reports')
      .select('id, storage_path')
      .lt('expires_at', nowIso)
      .is('storage_cleaned_at', null),
    admin
      .from('analysis_reports')
      .select('id, storage_path')
      .not('revoked_at', 'is', null)
      .lt('revoked_at', thirtyDaysAgo)
      .is('storage_cleaned_at', null),
  ])

  if (expiredResult.error) {
    console.error('[cleanup-reports] fetch expired error:', expiredResult.error.message)
    return NextResponse.json({ error: 'Failed to fetch expired reports' }, { status: 500 })
  }
  if (revokedResult.error) {
    console.error('[cleanup-reports] fetch revoked error:', revokedResult.error.message)
    return NextResponse.json({ error: 'Failed to fetch revoked reports' }, { status: 500 })
  }

  // Deduplicate (a report can match both conditions)
  const seen = new Set<string>()
  const toClean: ReportRow[] = []
  for (const row of [...(expiredResult.data ?? []), ...(revokedResult.data ?? [])]) {
    const r = row as ReportRow
    if (!seen.has(r.id)) {
      seen.add(r.id)
      toClean.push(r)
    }
  }

  console.log(`[cleanup-reports] ${toClean.length} report(s) to clean from Storage`)

  // ── 2. Delete from Storage, mark storage_cleaned_at on success ───────────

  for (const report of toClean) {
    try {
      await deleteReport(admin, report.storage_path)

      const { error: markErr } = await admin
        .from('analysis_reports')
        .update({ storage_cleaned_at: nowIso })
        .eq('id', report.id)

      if (markErr) throw new Error(markErr.message)

      stats.cleaned++
      console.log(`[cleanup-reports] cleaned ${report.id} (${report.storage_path})`)
    } catch (err) {
      stats.errors++
      console.error(`[cleanup-reports] error cleaning ${report.id}:`, err instanceof Error ? err.message : err)
    }
  }

  // ── 3. Hard-delete rows whose storage is confirmed cleaned ────────────────
  //   - expired rows with 1-day grace past expiry
  //   - revoked rows 30+ days after revocation

  const { error: deleteErr, count } = await admin
    .from('analysis_reports')
    .delete({ count: 'exact' })
    .not('storage_cleaned_at', 'is', null)
    .or(`expires_at.lt.${oneDayAgo},revoked_at.lt.${thirtyDaysAgo}`)

  if (deleteErr) {
    console.error('[cleanup-reports] hard-delete error:', deleteErr.message)
  } else {
    stats.deletedRows = count ?? 0
    console.log(`[cleanup-reports] hard-deleted ${stats.deletedRows} row(s) from DB`)
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  console.log(
    `[cleanup-reports] done — cleaned:${stats.cleaned} errors:${stats.errors} deletedRows:${stats.deletedRows}`,
  )
  return NextResponse.json({ ok: true, ...stats })
}
