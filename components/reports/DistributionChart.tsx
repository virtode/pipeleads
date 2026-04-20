'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import type { StageDistributionItem } from '@/hooks/useReports'

const STAGE_COLORS = {
  lost:       'hsl(var(--muted-foreground))',
  won:        '#22c55e',
  unassigned: 'hsl(var(--muted-foreground))',
}

function getBarColor(item: StageDistributionItem): string {
  if (item.isLost) return STAGE_COLORS.lost
  if (item.isWon)  return STAGE_COLORS.won
  return item.stageColor || STAGE_COLORS.unassigned
}

interface DistributionChartProps {
  data: StageDistributionItem[]
  isLoading?: boolean
}

interface TooltipPayload {
  payload: StageDistributionItem
  value: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: getBarColor(item) }}
        />
        <span className="font-medium">{item.stageName}</span>
        {item.isLost && (
          <span className="text-xs text-muted-foreground">(clôture négative)</span>
        )}
        {item.isReferral && (
          <span className="text-xs text-orange-500">(referral)</span>
        )}
        {item.isWon && (
          <span className="text-xs text-green-600 dark:text-green-400">(gagné)</span>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        {item.count} contact{item.count !== 1 ? 's' : ''}
        {item.countByCompany && item.companyCount !== undefined && item.companyCount !== item.count && (
          <span className="ml-1 text-xs"> · {item.companyCount} entreprise{item.companyCount !== 1 ? 's' : ''}</span>
        )}
      </p>
    </div>
  )
}

interface CustomTickProps {
  x?: number
  y?: number
  payload?: { value: string }
}

function CustomTick({ x = 0, y = 0, payload }: CustomTickProps) {
  if (!payload) return null
  const words = payload.value.split(' ')
  return (
    <g transform={`translate(${x},${y})`}>
      {words.map((word, i) => (
        <text
          key={i}
          x={0}
          y={0}
          dy={14 + i * 12}
          textAnchor="middle"
          fontSize={11}
          fill="hsl(var(--muted-foreground))"
        >
          {word}
        </text>
      ))}
    </g>
  )
}

export function DistributionChart({ data, isLoading }: DistributionChartProps) {
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

  const maxWords = Math.max(...data.map((d) => d.stageName.split(' ').length))
  const bottomMargin = maxWords > 1 ? 40 + (maxWords - 1) * 12 : 16

  return (
    <ResponsiveContainer width="100%" height={210 + bottomMargin - 16}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: bottomMargin }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="stageName"
          tick={<CustomTick />}
          tickLine={false}
          axisLine={false}
          interval={0}
          height={bottomMargin}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((item, i) => (
            <Cell
              key={i}
              fill={getBarColor(item)}
              opacity={item.isLost ? 0.6 : item.isReferral || item.isWon ? 0.75 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
