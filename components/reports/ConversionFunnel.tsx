'use client'

import { Skeleton } from '@/components/ui/skeleton'
import type { ConversionStep } from '@/hooks/useReports'

const RATE_COLORS = {
  bad:    'hsl(var(--destructive) / 0.4)',
  medium: 'hsl(24 96% 53% / 0.4)',
  good:   'hsl(142 71% 45% / 0.4)',
}

function getRateStyle(rate: number): string {
  if (rate >= 70) return 'text-green-600 dark:text-green-400'
  if (rate >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-500'
}

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

  const normalSteps = data.filter((s) => !s.isLost && !s.isReferral && !s.isWon)
  const lostSteps = data.filter((s) => s.isLost)
  const referralSteps = data.filter((s) => s.isReferral)
  const wonSteps = data.filter((s) => s.isWon)

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
                <span className={`text-xs font-semibold tabular-nums ${getRateStyle(step.rate)}`}>
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
                    backgroundColor: RATE_COLORS.bad,
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

      {/* Referral stages — Sorties latérales positives */}
      {referralSteps.length > 0 && (
        <>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-orange-500">Referrals</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {referralSteps.map((step) => (
            <div key={step.stageId} className="flex items-center gap-3">
              <span className="w-4 shrink-0" />

              <div className="flex-1 relative h-7 rounded-md bg-orange-50 dark:bg-orange-950/30 overflow-hidden border border-orange-200 dark:border-orange-900">
                <div
                  className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                  style={{
                    width: `${Math.max(step.count > 0 ? (step.count / maxNormalCount) * 100 : 0, step.count > 0 ? 4 : 0)}%`,
                    backgroundColor: RATE_COLORS.medium,
                  }}
                />
                <div className="relative flex items-center h-full px-2 gap-2">
                  <span className="text-xs font-medium truncate text-orange-700 dark:text-orange-400">
                    {step.stageName}
                  </span>
                  <span className="ml-auto text-xs font-semibold tabular-nums shrink-0 text-orange-700 dark:text-orange-400">
                    {step.count}
                  </span>
                </div>
              </div>

              <div className="w-12 shrink-0 text-right">
                <span className="text-xs font-semibold tabular-nums text-orange-500">
                  {step.rate}%
                </span>
              </div>
            </div>
          ))}

          <p className="text-right text-xs text-muted-foreground">
            Taux de referral
          </p>
        </>
      )}

      {/* Won stages — Clôtures positives */}
      {wonSteps.length > 0 && (
        <>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-green-600 dark:text-green-400">Clôtures positives</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {wonSteps.map((step) => (
            <div key={step.stageId} className="flex items-center gap-3">
              <span className="w-4 shrink-0" />

              <div className="flex-1 relative h-7 rounded-md bg-green-50 dark:bg-green-950/30 overflow-hidden border border-green-200 dark:border-green-900">
                <div
                  className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                  style={{
                    width: `${Math.max(step.count > 0 ? (step.count / maxNormalCount) * 100 : 0, step.count > 0 ? 4 : 0)}%`,
                    backgroundColor: RATE_COLORS.good,
                  }}
                />
                <div className="relative flex items-center h-full px-2 gap-2">
                  <span className="text-xs font-medium truncate text-green-700 dark:text-green-400">
                    {step.stageName}
                  </span>
                  <span className="ml-auto text-xs font-semibold tabular-nums shrink-0 text-green-700 dark:text-green-400">
                    {step.count}
                  </span>
                </div>
              </div>

              <div className="w-12 shrink-0 text-right">
                <span className="text-xs font-semibold tabular-nums text-green-600 dark:text-green-400">
                  {step.rate}%
                </span>
              </div>
            </div>
          ))}

          <p className="text-right text-xs text-muted-foreground">
            Taux de conversion
          </p>
        </>
      )}
    </div>
  )
}
