import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { revokeReport } from '@/src/modules/insights/lib/report-service'

// analysis_reports is not yet in lib/supabase/types.ts
type UntypedClient = SupabaseClient

type ReportRow = {
  id: string
  revoked_at: string | null
}

// ---------------------------------------------------------------------------
// POST /api/insights/revoke/[id]
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: reportId } = await params

  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const untyped = supabase as unknown as UntypedClient

  // 2. Fetch report — RLS guarantees tenant isolation
  const { data: report, error: fetchError } = await untyped
    .from('analysis_reports')
    .select('id, revoked_at')
    .eq('id', reportId)
    .maybeSingle()

  if (fetchError) {
    console.error('[insights/revoke] fetch error:', fetchError.message)
    return NextResponse.json({ error: 'Erreur lors de la récupération du rapport' }, { status: 500 })
  }

  if (!report) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })
  }

  // 3. Already revoked
  if ((report as ReportRow).revoked_at !== null) {
    return NextResponse.json({ error: 'Already revoked' }, { status: 400 })
  }

  // 4. Revoke (deletes from storage + marks revoked_at)
  try {
    await revokeReport(untyped, reportId)
  } catch (err) {
    console.error('[insights/revoke] revokeReport error:', err)
    return NextResponse.json({ error: 'Erreur lors de la révocation' }, { status: 500 })
  }

  // 5. Done
  return NextResponse.json({ success: true })
}
