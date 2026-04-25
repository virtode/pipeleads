import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listReports, getSignedUrl } from '@/src/modules/insights/lib/report-service'

// ---------------------------------------------------------------------------
// GET /api/insights/reports?pipelineId=xxx
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // 2. Validate query param
  const pipelineId = request.nextUrl.searchParams.get('pipelineId')
  if (!pipelineId) {
    return NextResponse.json({ error: 'pipelineId manquant' }, { status: 400 })
  }

  // 3. List reports (RLS guarantees tenant isolation)
  let summaries
  try {
    summaries = await listReports(supabase as Parameters<typeof listReports>[0], pipelineId)
  } catch (err) {
    console.error('[insights/reports] listReports error:', err)
    return NextResponse.json({ error: 'Erreur lors du chargement des rapports' }, { status: 500 })
  }

  // 4. Generate fresh signed URLs for active reports (parallelised)
  const reports = await Promise.all(
    summaries.map(async (report) => {
      if (report.isExpired || report.isRevoked) {
        return { ...report, signedUrl: null }
      }
      try {
        const signedUrl = await getSignedUrl(
          supabase as Parameters<typeof getSignedUrl>[0],
          report.id,
        )
        return { ...report, signedUrl }
      } catch {
        return { ...report, signedUrl: null }
      }
    }),
  )

  // 5. Return
  return NextResponse.json({ reports })
}
