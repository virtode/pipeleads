'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelBreakdown {
  model: string
  provider: string
  requests: number
  tokens: number
  spendUsd: number
}

interface DayBreakdown {
  date: string
  requests: number
  tokens: number
  spendUsd: number
}

interface SpendSummary {
  totalRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  totalSpendUsd: number
  byModel: ModelBreakdown[]
  byDay: DayBreakdown[]
}

type Period = '7d' | '30d' | '3m'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AIConsumptionDashboardProps {
  tenantId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIConsumptionDashboard({ tenantId }: AIConsumptionDashboardProps) {
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SpendSummary | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ period })
      if (tenantId) params.set('tenantId', tenantId)
      const res = await fetch(`/api/admin/ai-consumption?${params.toString()}`)
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? `Erreur ${res.status}`)
      }
      const json = await res.json() as SpendSummary
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [period, tenantId])

  useEffect(() => { void fetchData() }, [fetchData])

  const avgTokensPerRequest = data && data.totalRequests > 0
    ? Math.round(data.totalTokens / data.totalRequests)
    : 0

  const maxDayTokens = data
    ? Math.max(...data.byDay.map((d) => d.tokens), 1)
    : 1

  const PERIOD_LABELS: Record<Period, string> = {
    '7d': '7 jours',
    '30d': '30 jours',
    '3m': '3 mois',
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {(['7d', '30d', '3m'] as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && data && (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-zinc-500">Requêtes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatNumber(data.totalRequests)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-zinc-500">Tokens totaux</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatNumber(data.totalTokens)}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {formatNumber(data.promptTokens)} entrée · {formatNumber(data.completionTokens)} sortie
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-zinc-500">Coût estimé</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatUsd(data.totalSpendUsd)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-zinc-500">Tokens / requête moy.</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatNumber(avgTokensPerRequest)}</p>
              </CardContent>
            </Card>
          </div>

          {/* By model table */}
          {data.byModel.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Par modèle</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-zinc-500">
                      <th className="px-4 py-2 text-left font-medium">Modèle</th>
                      <th className="px-4 py-2 text-left font-medium">Fournisseur</th>
                      <th className="px-4 py-2 text-right font-medium">Requêtes</th>
                      <th className="px-4 py-2 text-right font-medium">Tokens</th>
                      <th className="px-4 py-2 text-right font-medium">Coût</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byModel.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-2 font-mono text-xs">{row.model}</td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary" className="text-xs">{row.provider}</Badge>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatNumber(row.requests)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatNumber(row.tokens)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatUsd(row.spendUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Bar chart by day (CSS only) */}
          {data.byDay.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Par jour — Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
                  {data.byDay.map((day) => {
                    const heightPct = Math.max(2, Math.round((day.tokens / maxDayTokens) * 100))
                    return (
                      <div
                        key={day.date}
                        className="flex flex-col items-center gap-1 flex-shrink-0"
                        style={{ minWidth: '28px' }}
                        title={`${day.date} — ${formatNumber(day.tokens)} tokens`}
                      >
                        <div
                          className="w-full rounded-t bg-blue-500 dark:bg-blue-400 transition-all"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[9px] text-zinc-400 rotate-45 origin-left whitespace-nowrap">
                          {day.date.slice(5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {data.totalRequests === 0 && (
            <p className="text-sm text-zinc-500 text-center py-4">
              Aucune donnée de consommation sur cette période.
            </p>
          )}
        </>
      )}
    </div>
  )
}
