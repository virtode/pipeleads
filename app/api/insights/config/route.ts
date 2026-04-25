// ---------------------------------------------------------------------------
// Migration à appliquer manuellement dans Supabase SQL Editor :
// ALTER TABLE public.analysis_configs
//   ADD CONSTRAINT analysis_configs_pipeline_id_key
//   UNIQUE (pipeline_id);
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// analysis_configs is not yet in lib/supabase/types.ts
type UntypedClient = SupabaseClient

type PipelineRow = { id: string; tenant_id: string | null }

// ---------------------------------------------------------------------------
// POST /api/insights/config
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // 2. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const {
    pipelineId,
    pipelineName,
    respondentStatuses,
    silentStatuses,
    excludedStatuses,
    systemPrompt,
    contextPrompt,
    reportTemplate,
    ttlSeconds,
  } = body

  // 3. Validate required fields
  if (typeof pipelineId !== 'string' || !pipelineId) {
    return NextResponse.json({ error: 'pipelineId manquant' }, { status: 400 })
  }
  if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
    return NextResponse.json({ error: 'systemPrompt requis' }, { status: 400 })
  }

  // 4. Verify pipeline belongs to tenant (RLS guarantees isolation)
  const untyped = supabase as unknown as UntypedClient

  const { data: pipeline, error: pipelineErr } = await untyped
    .from('pipelines')
    .select('id, tenant_id')
    .eq('id', pipelineId)
    .maybeSingle()

  if (pipelineErr || !pipeline) {
    return NextResponse.json({ error: 'Pipeline introuvable' }, { status: 404 })
  }

  const tenantId = (pipeline as PipelineRow).tenant_id

  // 5. Upsert analysis_config
  //    INSERT sets all fields including tenant_id.
  //    On conflict (pipeline_id): update config fields only —
  //    prompt_version is managed by a DB trigger, tenant_id and created_at are untouched.
  const { data, error } = await untyped
    .from('analysis_configs')
    .upsert(
      {
        pipeline_id: pipelineId,
        tenant_id: tenantId,
        pipeline_name: typeof pipelineName === 'string' ? pipelineName.trim() || null : null,
        respondent_statuses: Array.isArray(respondentStatuses) ? respondentStatuses : [],
        silent_statuses: Array.isArray(silentStatuses) ? silentStatuses : [],
        excluded_statuses: Array.isArray(excludedStatuses) ? excludedStatuses : [],
        system_prompt: (systemPrompt as string).trim(),
        context_prompt: typeof contextPrompt === 'string' ? contextPrompt.trim() || null : null,
        report_template: typeof reportTemplate === 'string' ? reportTemplate : 'default',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pipeline_id' },
    )
    .select('id')
    .single()

  if (error) {
    console.error('[insights/config] upsert error:', error.message)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }

  return NextResponse.json({ success: true, configId: (data as { id: string }).id })
}
