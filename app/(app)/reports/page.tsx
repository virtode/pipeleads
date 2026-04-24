'use client'

import { useState } from 'react'
import { Download, Users, TrendingUp, GitBranch, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import dynamic from 'next/dynamic'
import { ReportFilters } from '@/components/reports/ReportFilters'

const ChartSkeleton = () => <div className="h-52 w-full animate-pulse rounded-lg bg-muted" />

const DistributionChart = dynamic(
  () => import('@/components/reports/DistributionChart').then((m) => ({ default: m.DistributionChart })),
  { ssr: false, loading: ChartSkeleton }
)
const PipelineChart = dynamic(
  () => import('@/components/reports/PipelineChart').then((m) => ({ default: m.PipelineChart })),
  { ssr: false, loading: ChartSkeleton }
)
const TimelineChart = dynamic(
  () => import('@/components/reports/TimelineChart').then((m) => ({ default: m.TimelineChart })),
  { ssr: false, loading: ChartSkeleton }
)
const ConversionFunnel = dynamic(
  () => import('@/components/reports/ConversionFunnel').then((m) => ({ default: m.ConversionFunnel })),
  { ssr: false, loading: ChartSkeleton }
)
import {
  useKpis,
  useStageDistribution,
  useTimeline,
  useTagsDistribution,
  useInactiveContacts,
  useConversionFunnel,
  type ReportFilters as Filters,
} from '@/hooks/useReports'
import { exportToCSV } from '@/lib/export/csv'
import { getFullName } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaultFilters(): Filters {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setDate(start.getDate() - 29)
  start.setHours(0, 0, 0, 0)
  return { pipelineId: null, startDate: start, endDate: end }
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: number | undefined
  icon: React.ElementType
  description?: string
  isLoading: boolean
  accent?: string
}

function KpiCard({ title, value, icon: Icon, description, isLoading, accent = 'text-primary' }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className={`text-3xl font-bold tabular-nums ${accent}`}>{value ?? '—'}</p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className={`rounded-lg p-2 bg-muted/60 ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [filters, setFilters] = useState<Filters>(buildDefaultFilters)

  const { data: kpis, isLoading: kpisLoading } = useKpis()
  const { data: distribution, isLoading: distLoading } = useStageDistribution(filters.pipelineId)
  const { data: timeline, isLoading: timelineLoading } = useTimeline(filters)
  const { data: tags, isLoading: tagsLoading } = useTagsDistribution()
  const { data: inactive } = useInactiveContacts(30, filters.pipelineId)
  const { data: funnel, isLoading: funnelLoading } = useConversionFunnel(filters)

  // CSV exports per widget
  function exportDistribution() {
    if (!distribution) return
    exportToCSV(
      distribution.map((d) => ({ Étape: d.stageName, Contacts: d.count })),
      `distribution_${new Date().toISOString().slice(0, 10)}.csv`
    )
  }

  function exportTimeline() {
    if (!timeline) return
    exportToCSV(
      timeline.map((t) => ({ Date: t.date, Mouvements: t.count })),
      `mouvements_${new Date().toISOString().slice(0, 10)}.csv`
    )
  }

  function exportTags() {
    if (!tags) return
    exportToCSV(
      tags.map((t) => ({ Tag: t.tag, Contacts: t.count })),
      `tags_${new Date().toISOString().slice(0, 10)}.csv`
    )
  }

  function exportAll() {
    exportDistribution()
    exportTimeline()
    exportTags()
  }

  const dateLabel = `${filters.startDate.toLocaleDateString('fr-FR')} – ${filters.endDate.toLocaleDateString('fr-FR')}`

  return (
    <div className="space-y-6 flex-1 overflow-y-auto px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <Button variant="outline" size="sm" className="w-full md:w-auto" onClick={exportAll}>
          <Download className="mr-1.5 h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* Filters */}
      <ReportFilters filters={filters} onChange={setFilters} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total contacts"
          value={kpis?.totalContacts}
          icon={Users}
          isLoading={kpisLoading}
          accent="text-primary"
        />
        <KpiCard
          title="Ajoutés ce mois"
          value={kpis?.addedThisMonth}
          icon={TrendingUp}
          isLoading={kpisLoading}
          accent="text-green-600 dark:text-green-400"
        />
        <KpiCard
          title="Pipelines actifs"
          value={kpis?.activePipelines}
          icon={GitBranch}
          isLoading={kpisLoading}
          accent="text-violet-600 dark:text-violet-400"
        />
        <KpiCard
          title="Sans statut"
          value={kpis?.contactsWithoutStage}
          icon={AlertCircle}
          description="contacts dans un pipeline sans étape"
          isLoading={kpisLoading}
          accent="text-orange-500"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Distribution par étape */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Contacts par étape</CardTitle>
                <CardDescription>Distribution actuelle dans le pipeline</CardDescription>
              </div>
              {!distLoading && distribution && distribution.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportDistribution} title="Exporter">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!filters.pipelineId ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                Sélectionne un pipeline pour voir la distribution.
              </div>
            ) : (
              <DistributionChart data={distribution ?? []} isLoading={distLoading} />
            )}
          </CardContent>
        </Card>

        {/* Camembert pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Répartition pipeline</CardTitle>
            <CardDescription>Part de chaque étape dans le total</CardDescription>
          </CardHeader>
          <CardContent>
            {!filters.pipelineId ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                Sélectionne un pipeline pour voir la répartition.
              </div>
            ) : (
              <PipelineChart data={distribution ?? []} isLoading={distLoading} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Activité du pipeline</CardTitle>
                <CardDescription>Mouvements de contacts par jour</CardDescription>
              </div>
              {!timelineLoading && timeline && timeline.some((t) => t.count > 0) && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportTimeline} title="Exporter">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <TimelineChart data={timeline ?? []} isLoading={timelineLoading} />
          </CardContent>
        </Card>

        {/* Entonnoir de conversion */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Entonnoir de conversion</CardTitle>
            <CardDescription>Taux de passage entre étapes consécutives</CardDescription>
          </CardHeader>
          <CardContent>
            {!filters.pipelineId ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                Sélectionne un pipeline pour voir l&apos;entonnoir.
              </div>
            ) : (
              <ConversionFunnel data={funnel ?? []} isLoading={funnelLoading} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 3 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top tags */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Top 10 tags</CardTitle>
                <CardDescription>Tags les plus utilisés parmi les contacts</CardDescription>
              </div>
              {!tagsLoading && tags && tags.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportTags} title="Exporter">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {tagsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full rounded-md" />
                ))}
              </div>
            ) : !tags?.length ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Aucun tag sur les contacts
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map((t, i) => {
                  const maxCount = tags[0].count
                  const pct = Math.max((t.count / maxCount) * 100, 4)
                  return (
                    <div key={t.tag} className="flex items-center gap-3">
                      <span className="w-4 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                      <div className="flex-1 relative h-6 rounded-md bg-muted/50 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: 'hsl(var(--primary) / 0.3)' }}
                        />
                        <div className="relative flex items-center h-full px-2 gap-2">
                          <span className="text-xs font-medium truncate">{t.tag}</span>
                          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{t.count}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts inactifs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contacts sans activité</CardTitle>
            <CardDescription>Pas de mouvement pipeline depuis + de 30 jours</CardDescription>
          </CardHeader>
          <CardContent>
            {!inactive?.length ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Aucun contact inactif 🎉
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1">
                {inactive.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {getFullName(c.first_name, c.last_name)}
                      </p>
                      {c.company && (
                        <p className="truncate text-xs text-muted-foreground">{c.company}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.daysSinceLastActivity > 90
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : c.daysSinceLastActivity > 60
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
                      }`}
                    >
                      {c.daysSinceLastActivity}j
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
