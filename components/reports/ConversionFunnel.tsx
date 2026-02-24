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

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="flex h-52 flex-col justify-center gap-2 overflow-y-auto pr-1">
      {data.map((step, i) => {
        const widthPct = maxCount > 0 ? Math.max((step.count / maxCount) * 100, 4) : 4

        return (
          <div key={step.stageId} className="flex items-center gap-3">
            {/* Step number */}
            <span className="w-4 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>

            {/* Bar */}
            <div className="flex-1 relative h-7 rounded-md bg-muted/50 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-md flex items-center px-2 transition-all duration-500"
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

            {/* Conversion rate from previous */}
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

      {data.length > 1 && (
        <p className="mt-1 text-right text-xs text-muted-foreground">
          Taux étape→étape
        </p>
      )}
    </div>
  )
}
