import { Pool } from 'pg'

// ---------------------------------------------------------------------------
// Connection pool — reuse across requests in the same process
// ---------------------------------------------------------------------------

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.LITELLM_DB_URL
    if (!connectionString) throw new Error('LITELLM_DB_URL is not set')
    pool = new Pool({ connectionString })
  }
  return pool
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelBreakdown {
  model: string
  provider: string
  requests: number
  tokens: number
  spendUsd: number
}

export interface DayBreakdown {
  date: string
  requests: number
  tokens: number
  spendUsd: number
}

export interface SpendSummary {
  totalRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  totalSpendUsd: number
  byModel: ModelBreakdown[]
  byDay: DayBreakdown[]
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export async function getSpendSummary(options: {
  tenantId?: string
  startDate: Date
  endDate: Date
}): Promise<SpendSummary> {
  const { tenantId, startDate, endDate } = options
  const db = getPool()

  const tenantFilter = tenantId !== undefined
    ? `AND "end_user" = $3`
    : ''

  const baseParams: unknown[] = [startDate, endDate]
  if (tenantId !== undefined) baseParams.push(tenantId)

  const [totalsResult, byModelResult, byDayResult] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*)::int              AS "totalRequests",
         COALESCE(SUM(total_tokens), 0)::int      AS "totalTokens",
         COALESCE(SUM(prompt_tokens), 0)::int     AS "promptTokens",
         COALESCE(SUM(completion_tokens), 0)::int AS "completionTokens",
         COALESCE(SUM(spend), 0)::float8          AS "totalSpendUsd"
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" BETWEEN $1 AND $2 ${tenantFilter}`,
      baseParams,
    ),
    db.query(
      `SELECT
         model,
         custom_llm_provider         AS provider,
         COUNT(*)::int               AS requests,
         COALESCE(SUM(total_tokens), 0)::int AS tokens,
         COALESCE(SUM(spend), 0)::float8     AS "spendUsd"
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" BETWEEN $1 AND $2 ${tenantFilter}
       GROUP BY model, custom_llm_provider
       ORDER BY tokens DESC`,
      baseParams,
    ),
    db.query(
      `SELECT
         DATE("startTime")::text     AS date,
         COUNT(*)::int               AS requests,
         COALESCE(SUM(total_tokens), 0)::int AS tokens,
         COALESCE(SUM(spend), 0)::float8     AS "spendUsd"
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" BETWEEN $1 AND $2 ${tenantFilter}
       GROUP BY DATE("startTime")
       ORDER BY DATE("startTime") ASC`,
      baseParams,
    ),
  ])

  const totals = totalsResult.rows[0] as {
    totalRequests: number
    totalTokens: number
    promptTokens: number
    completionTokens: number
    totalSpendUsd: number
  }

  return {
    totalRequests: totals.totalRequests ?? 0,
    totalTokens: totals.totalTokens ?? 0,
    promptTokens: totals.promptTokens ?? 0,
    completionTokens: totals.completionTokens ?? 0,
    totalSpendUsd: totals.totalSpendUsd ?? 0,
    byModel: byModelResult.rows as ModelBreakdown[],
    byDay: byDayResult.rows as DayBreakdown[],
  }
}
