import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateReportHtml } from './report-template'
import type { ReportMeta } from './report-template'
import { uploadReport, generateSignedUrl, deleteReport } from './storage'
import type { AnalysisResult } from './claude'
import type { AnalysisConfig } from './data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportSummary {
  id: string
  pipelineId: string
  createdBy: string | null
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  contactCount: number
  respondentCount: number
  isExpired: boolean
  isRevoked: boolean
}

const DEFAULT_TTL = 604_800 // 7 days

// ---------------------------------------------------------------------------
// createReport
// ---------------------------------------------------------------------------

export async function createReport(
  supabase: SupabaseClient,
  params: {
    tenantId: string
    createdBy: string
    pipelineId: string
    pipelineName: string
    config: AnalysisConfig
    result: AnalysisResult
    respondentCount: number
    silentCount: number
    ttlSeconds?: number
  },
): Promise<{ reportId: string; signedUrl: string; storagePath: string }> {
  const {
    tenantId, createdBy, pipelineId, pipelineName, config, result,
    respondentCount, silentCount, ttlSeconds = DEFAULT_TTL,
  } = params

  const reportId = randomUUID()
  const now = Date.now()
  const expiresAt = new Date(now + ttlSeconds * 1000)

  const meta: ReportMeta = {
    respondentCount,
    silentCount,
    pipelineId,
    pipelineName,
    generatedAt: result.generated_at,
  }

  const html = generateReportHtml(result, config, meta)
  const storagePath = await uploadReport(supabase, tenantId, reportId, html)

  try {
    const { error } = await supabase
      .from('analysis_reports')
      .insert({
        id: reportId,
        tenant_id: tenantId,
        config_id: config.id,
        pipeline_id: pipelineId,
        created_by: createdBy,
        storage_path: storagePath,
        ttl_seconds: ttlSeconds,
        expires_at: expiresAt.toISOString(),
        analysis_json: result as unknown as Record<string, unknown>,
        contact_count: respondentCount + silentCount,
        respondent_count: respondentCount,
      })

    if (error) {
      console.error('[report-service] INSERT analysis_reports error:', error)
      throw new Error(error.message)
    }

    return { reportId, signedUrl: `/api/insights/reports/${reportId}/html`, storagePath }
  } catch (err) {
    await deleteReport(supabase, storagePath).catch(() => {})
    throw err
  }
}

// ---------------------------------------------------------------------------
// revokeReport
// ---------------------------------------------------------------------------

export async function revokeReport(
  supabase: SupabaseClient,
  reportId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('analysis_reports')
    .select('storage_path')
    .eq('id', reportId)
    .single()

  if (error) throw new Error(error.message)

  const storagePath = (data as { storage_path: string }).storage_path
  await deleteReport(supabase, storagePath)

  const { error: updateError } = await supabase
    .from('analysis_reports')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', reportId)

  if (updateError) throw new Error(updateError.message)
}

// ---------------------------------------------------------------------------
// getSignedUrl
// ---------------------------------------------------------------------------

export async function getSignedUrl(
  supabase: SupabaseClient,
  reportId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('analysis_reports')
    .select('storage_path, expires_at, revoked_at, ttl_seconds')
    .eq('id', reportId)
    .single()

  if (error) throw new Error(error.message)

  const row = data as {
    storage_path: string
    expires_at: string
    revoked_at: string | null
    ttl_seconds: number
  }

  if (row.revoked_at !== null) throw new Error('Report has been revoked')

  const remainingMs = new Date(row.expires_at).getTime() - Date.now()
  if (remainingMs <= 0) throw new Error('Report has expired')

  const remainingSeconds = Math.floor(remainingMs / 1000)
  return generateSignedUrl(supabase, row.storage_path, remainingSeconds)
}

// ---------------------------------------------------------------------------
// listReports
// ---------------------------------------------------------------------------

export async function listReports(
  supabase: SupabaseClient,
  pipelineId: string,
): Promise<ReportSummary[]> {
  const { data, error } = await supabase
    .from('analysis_reports')
    .select('id, pipeline_id, created_by, created_at, expires_at, revoked_at, contact_count, respondent_count')
    .eq('pipeline_id', pipelineId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const now = new Date()

  return (data ?? []).map((row) => {
    const r = row as {
      id: string
      pipeline_id: string
      created_by: string | null
      created_at: string
      expires_at: string
      revoked_at: string | null
      contact_count: number
      respondent_count: number
    }
    return {
      id: r.id,
      pipelineId: r.pipeline_id,
      createdBy: r.created_by,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      contactCount: r.contact_count,
      respondentCount: r.respondent_count,
      isExpired: new Date(r.expires_at) < now,
      isRevoked: r.revoked_at !== null,
    }
  })
}
