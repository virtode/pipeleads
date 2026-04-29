import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnalysisConfig, getContactsForAnalysis } from '@/src/modules/insights/lib/data'
import { buildSystemPrompt, buildUserPrompt } from '@/src/modules/insights/lib/prompt'
import { callClaudeWithRetry } from '@/src/modules/insights/lib/claude'
import { createReport } from '@/src/modules/insights/lib/report-service'

// TODO Sprint 3 : ajouter un rate limiter par tenantId (ex. 1 analyse / 60 s)

// ---------------------------------------------------------------------------
// POST /api/insights/analyze
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // 2. Parse body
  let body: { pipelineId?: unknown; tenantId?: unknown; ttlSeconds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { pipelineId, tenantId } = body
  const ttlSeconds = typeof body.ttlSeconds === 'number' ? body.ttlSeconds : 604800

  if (typeof pipelineId !== 'string' || !pipelineId) {
    return NextResponse.json({ error: 'pipelineId manquant ou invalide' }, { status: 400 })
  }
  if (typeof tenantId !== 'string' || !tenantId) {
    return NextResponse.json({ error: 'tenantId manquant ou invalide' }, { status: 400 })
  }

  // 3. Load pipeline name
  const { data: pipelineRow } = await supabase
    .from('pipelines')
    .select('name')
    .eq('id', pipelineId)
    .single()
  const pipelineName = (pipelineRow as { name: string } | null)?.name ?? pipelineId

  // 4. Load config
  let config
  try {
    config = await getAnalysisConfig(supabase, pipelineId)
  } catch (err) {
    console.error('[insights/analyze] getAnalysisConfig error:', err)
    return NextResponse.json({ error: 'Erreur lors du chargement de la configuration' }, { status: 500 })
  }

  if (!config) {
    return NextResponse.json({ error: 'No config found for this pipeline' }, { status: 404 })
  }

  // 5. Load contacts
  let payload
  try {
    payload = await getContactsForAnalysis(supabase, pipelineId, config)
  } catch (err) {
    console.error('[insights/analyze] getContactsForAnalysis error:', err)
    return NextResponse.json({ error: 'Erreur lors du chargement des contacts' }, { status: 500 })
  }

  const { respondents, silents } = payload

  if (respondents.length === 0) {
    return NextResponse.json({ error: 'No respondents found' }, { status: 400 })
  }
  if (silents.length === 0) {
    return NextResponse.json({ error: 'No silent contacts found' }, { status: 400 })
  }

  // 5. Build prompts
  const systemPrompt = buildSystemPrompt(config)
  const userPrompt = buildUserPrompt(payload)

  // 6. Call Claude
  let analysis
  try {
    analysis = await callClaudeWithRetry(systemPrompt, userPrompt, 2, tenantId)
  } catch (err) {
    console.error('[insights/analyze] callClaudeWithRetry error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de l\'appel à Claude' },
      { status: 500 },
    )
  }

  // 7. Persist report and generate signed URL
  let reportId: string
  let signedUrl: string
  try {
    const report = await createReport(supabase, {
      tenantId,
      createdBy: user.id,
      pipelineId,
      pipelineName,
      config,
      result: analysis,
      respondentCount: respondents.length,
      silentCount: silents.length,
      ttlSeconds,
    })
    reportId = report.reportId
    signedUrl = report.signedUrl
  } catch (err) {
    console.error('[insights/analyze] createReport error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de la création du rapport' },
      { status: 500 },
    )
  }

  // 8. Return result
  return NextResponse.json({
    success: true,
    analysis,
    signedUrl,
    reportId,
    meta: {
      respondentCount: respondents.length,
      silentCount: silents.length,
      pipelineId,
      configId: config.id,
    },
  })
}
