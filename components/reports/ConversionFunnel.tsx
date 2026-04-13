'use client'

import { Skeleton } from '@/components/ui/skeleton'
import type { ConversionStep } from '@/hooks/useReports'

interface ConversionFunnelProps {
  data: ConversionStep[]
  isLoading?: boolean
}

export function ConversionFunnel({ data, isLoading }: ConversionFunnelProps) {
  if (isLoading) {
    return <Skeleton className="h-52 w-full rounded-lg" />
  }

  if (!data.length) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée disponible
      </div>
    )
  }

  const normalSteps = data.filter((s) => !s.isLost)
  const lostSteps = data.filter((s) => s.isLost)

  const maxNormalCount = Math.max(...normalSteps.map((s) => s.count), 1)

  return (
    <div className="flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: '13rem' }}>
      {/* Normal funnel */}
      {normalSteps.map((step, i) => {
        const widthPct = maxNormalCount > 0 ? Math.max((step.count / maxNormalCount) * 100, 4) : 4

        return (
          <div key={step.stageId} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>

            <div className="flex-1 relative h-7 rounded-md bg-muted/50 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: step.stageColor + 'cc',
                }}
              />
              <div className="relative flex items-center h-full px-2 gap-2">
                <span className="text-xs font-medium truncate">{step.stageName}</span>
                <span className="ml-auto text-xs font-semibold tabular-nums shrink-0">
                  {step.count}
                </span>
              </div>
            </div>

            <div className="w-12 shrink-0 text-right">
              {i === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    step.rate >= 70
                      ? 'text-green-600 dark:text-green-400'
                      : step.rate >= 40
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-500'
                  }`}
                >
                  {step.rate}%
                </span>
              )}
            </div>
          </div>
        )
      })}

      {normalSteps.length > 1 && (
        <p className="text-right text-xs text-muted-foreground">
          Taux cumulatif
        </p>
      )}

      {/* Lost stages — Sorties */}
      {lostSteps.length > 0 && (
        <>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">Sorties</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {lostSteps.map((step) => (
            <div key={step.stageId} className="flex items-center gap-3">
              <span className="w-4 shrink-0" />

              <div className="flex-1 relative h-7 rounded-md bg-red-50 dark:bg-red-950/30 overflow-hidden border border-red-200 dark:border-red-900">
                <div
                  className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                  style={{
                    width: `${Math.max(step.count > 0 ? (step.count / maxNormalCount) * 100 : 0, step.count > 0 ? 4 : 0)}%`,
                    backgroundColor: '#ef444466',
                  }}
                />
                <div className="relative flex items-center h-full px-2 gap-2">
                  <span className="text-xs font-medium truncate text-red-700 dark:text-red-400">
                    {step.stageName}
                  </span>
                  <span className="ml-auto text-xs font-semibold tabular-nums shrink-0 text-red-700 dark:text-red-400">
                    {step.count}
                  </span>
                </div>
              </div>

              <div className="w-12 shrink-0 text-right">
                <span className="text-xs font-semibold tabular-nums text-red-500">
                  {step.rate}%
                </span>
              </div>
            </div>
          ))}

          <p className="text-right text-xs text-muted-foreground">
            Taux de perte
          </p>
        </>
      )}
    </div>
  )
}
