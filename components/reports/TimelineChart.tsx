'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import type { TimelinePoint } from '@/hooks/useReports'
import { formatDateFrShort as formatDate } from '@/lib/utils/date'

interface TimelineChartProps {
  data: TimelinePoint[]
  isLoading?: boolean
}

interface TooltipPayload {
  payload: TimelinePoint
  value: number
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  const count = payload[0].value
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{label ? formatDate(label) : ''}</p>
      <p className="mt-1 text-muted-foreground">
        {count} mouvement{count !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

// Thin out ticks for dense date ranges
function buildTicks(data: TimelinePoint[]): string[] {
  if (data.length <= 14) return data.map((d) => d.date)
  const step = Math.ceil(data.length / 10)
  return data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d) => d.date)
}

export function TimelineChart({ data, isLoading }: TimelineChartProps) {
  if (isLoading) {
    return <Skeleton className="h-52 w-full rounded-lg" />
  }

  const hasData = data.some((d) => d.count > 0)

  if (!data.length || !hasData) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        Aucun mouvement sur cette période
      </div>
    )
  }

  const ticks = buildTicks(data)

  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorMoves" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          ticks={ticks}
          tickFormatter={formatDate}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#colorMoves)"
          dot={false}
          activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
