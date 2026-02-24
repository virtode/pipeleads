'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type PieLabelRenderProps,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import type { StageDistributionItem } from '@/hooks/useReports'

interface PipelineChartProps {
  data: StageDistributionItem[]
  isLoading?: boolean
}

interface TooltipPayload {
  payload: StageDistributionItem & { percent: number }
  value: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  const pct = (item.percent * 100).toFixed(1)
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.stageColor }} />
        <span className="font-medium">{item.stageName}</span>
      </div>
      <p className="mt-1 text-muted-foreground">
        {item.count} contact{item.count !== 1 ? 's' : ''} · {pct}%
      </p>
    </div>
  )
}

function renderCustomLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props
  if (
    cx == null || cy == null || midAngle == null ||
    innerRadius == null || outerRadius == null || percent == null
  ) return null
  if ((percent as number) < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = (innerRadius as number) + ((outerRadius as number) - (innerRadius as number)) * 0.5
  const x = (cx as number) + r * Math.cos(-(midAngle as number) * RADIAN)
  const y = (cy as number) + r * Math.sin(-(midAngle as number) * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${((percent as number) * 100).toFixed(0)}%`}
    </text>
  )
}

export function PipelineChart({ data, isLoading }: PipelineChartProps) {
  if (isLoading) {
    return <Skeleton className="h-52 w-full rounded-lg" />
  }

  const filtered = data.filter((d) => d.count > 0)

  if (!filtered.length) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée disponible
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={210}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="count"
          nameKey="stageName"
          cx="50%"
          cy="50%"
          outerRadius={80}
          labelLine={false}
          label={renderCustomLabel}
        >
          {filtered.map((item, i) => (
            <Cell key={i} fill={item.stageColor} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => <span className="text-foreground">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
