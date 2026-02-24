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
          style={{ backgroundColor: item.stageColor }}
        />
        <span className="font-medium">{item.stageName}</span>
      </div>
      <p className="mt-1 text-muted-foreground">
        {item.count} contact{item.count !== 1 ? 's' : ''}
      </p>
    </div>
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

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="stageName"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={data.length > 5 ? -30 : 0}
          textAnchor={data.length > 5 ? 'end' : 'middle'}
          height={data.length > 5 ? 48 : 24}
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
            <Cell key={i} fill={item.stageColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
