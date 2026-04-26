'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Trash2,
  Layers,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { usePipelines } from '@/hooks/usePipelines'
import { useSupabaseClient, useTenantId } from '@/lib/supabase/context'
import { getAnalysisConfig } from '@/src/modules/insights/lib/data'
import type { AnalysisConfig } from '@/src/modules/insights/lib/data'
import type { ReportSummary } from '@/src/modules/insights/lib/report-service'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TTL_OPTIONS = [
  { label: '1 heure', value: 3600 },
  { label: '24 heures', value: 86400 },
  { label: '7 jours', value: 604800 },
  { label: '30 jours', value: 2592000 },
] as const

const PROGRESS_LABELS = [
  'Lecture des contacts…',
  'Analyse IA…',
  'Génération du rapport…',
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function formatTtlRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expiré'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  if (d > 0) return `${d}j ${h}h`
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type ReportWithUrl = ReportSummary & { signedUrl?: string }

function ReportStatusBadge({ report }: { report: ReportWithUrl }) {
  if (report.isRevoked) {
    return <Badge variant="destructive">Révoqué</Badge>
  }
  if (report.isExpired) {
    return <Badge variant="secondary">Expiré</Badge>
  }
  return (
    <Badge className="border-0 bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
      Actif
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error'

interface AnalyzeResult {
  signedUrl?: string
  reportId?: string
  analysis?: unknown
  meta?: { respondentCount: number; silentCount: number }
}

export default function InsightsPage() {
  const supabase = useSupabaseClient()
  const tenantId = useTenantId()
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines()

  // ── Pipeline selection ────────────────────────────────────────────────────
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const pipelineId =
    selectedPipelineId ?? (pipelines && pipelines.length > 0 ? pipelines[0].id : null)
  const selectedPipeline = pipelines?.find((p) => p.id === pipelineId)

  // ── Config state ──────────────────────────────────────────────────────────
  const [config, setConfig] = useState<AnalysisConfig | null | undefined>(undefined)
  const [configLoading, setConfigLoading] = useState(false)

  // ── Analysis state ────────────────────────────────────────────────────────
  const [ttlSeconds, setTtlSeconds] = useState(604800)
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>('idle')
  const [progressStep, setProgressStep] = useState(0)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  // ── Reports state ─────────────────────────────────────────────────────────
  const [reports, setReports] = useState<ReportWithUrl[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ReportWithUrl | null>(null)
  const [revoking, setRevoking] = useState(false)

  // ── Load config when pipeline changes ────────────────────────────────────
  useEffect(() => {
    if (!pipelineId) {
      setConfig(undefined)
      setConfigLoading(false)
      return
    }
    setConfigLoading(true)
    setConfig(undefined)
    getAnalysisConfig(supabase, pipelineId)
      .then((res) => {
        setConfig(res)
        setConfigLoading(false)
      })
      .catch(() => {
        setConfig(null)
        setConfigLoading(false)
      })
  }, [pipelineId, supabase])

  // ── Load reports when pipeline changes ───────────────────────────────────
  const loadReports = useCallback(async () => {
    if (!pipelineId) {
      setReports([])
      return
    }
    setReportsLoading(true)
    try {
      const res = await fetch(`/api/insights/reports?pipelineId=${pipelineId}`)
      if (!res.ok) {
        setReports([])
        return
      }
      const data = await res.json()
      setReports((data.reports as ReportWithUrl[]) ?? [])
    } catch {
      setReports([])
    } finally {
      setReportsLoading(false)
    }
  }, [pipelineId])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  // ── Progress simulation ───────────────────────────────────────────────────
  useEffect(() => {
    if (analyzeStatus !== 'loading') {
      setProgressStep(0)
      return
    }
    const t1 = setTimeout(() => setProgressStep(1), 3000)
    const t2 = setTimeout(() => setProgressStep(2), 8000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [analyzeStatus])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!pipelineId || !tenantId) return
    setAnalyzeStatus('loading')
    setProgressStep(0)
    setAnalyzeResult(null)
    setAnalyzeError(null)

    try {
      const res = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineId, tenantId, ttlSeconds }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnalyzeStatus('error')
        setAnalyzeError((data as { error?: string }).error ?? 'Une erreur est survenue')
        return
      }
      setAnalyzeResult(data as AnalyzeResult)
      setAnalyzeStatus('success')
      void loadReports()
    } catch {
      setAnalyzeStatus('error')
      setAnalyzeError('Une erreur réseau est survenue')
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      const res = await fetch(`/api/insights/revoke/${revokeTarget.id}`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('Rapport révoqué')
      setRevokeTarget(null)
      void loadReports()
    } catch {
      toast.error('Erreur lors de la révocation')
    } finally {
      setRevoking(false)
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copié !')
    } catch {
      toast.error('Impossible de copier')
    }
  }

  function stageLabel(stageId: string): string {
    return selectedPipeline?.pipeline_stages.find((s) => s.id === stageId)?.name ?? stageId
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!pipelinesLoading && (!pipelines || pipelines.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Layers className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <p className="font-medium">Aucun pipeline configuré</p>
          <p className="text-sm text-muted-foreground">
            Crée un pipeline pour utiliser les Insights.
          </p>
        </div>
        <Button asChild>
          <Link href="/pipelines">Gérer les pipelines</Link>
        </Button>
      </div>
    )
  }

  const canAnalyze =
    !!pipelineId && !!tenantId && !!config && analyzeStatus !== 'loading'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 flex-1 overflow-y-auto px-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Lance une analyse IA de tes contacts pipeline et consulte les rapports générés.
        </p>
      </div>

      {/* ── ZONE A — Déclencher une analyse ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-4 w-4" />
            Déclencher une analyse
          </CardTitle>
          <CardDescription>
            Sélectionne un pipeline, configure la durée de validité et lance l&apos;analyse IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selectors row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Pipeline à analyser
              </label>
              {pipelinesLoading ? (
                <Skeleton className="h-9 w-full sm:w-56" />
              ) : (
                <Select
                  value={pipelineId ?? ''}
                  onValueChange={(v) => {
                    setSelectedPipelineId(v)
                    setAnalyzeStatus('idle')
                    setAnalyzeResult(null)
                    setAnalyzeError(null)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Choisir un pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {(pipelines ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Select
              value={String(ttlSeconds)}
              onValueChange={(v) => setTtlSeconds(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Config status */}
          {pipelineId && (
            <div className="rounded-md border px-4 py-3">
              {configLoading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-52" />
                </div>
              ) : config ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Configuration active</span>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/insights/config/${pipelineId}`}>
                        <Settings className="mr-1.5 h-3.5 w-3.5" />
                        Modifier la configuration
                      </Link>
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground">Répondants :</span>{' '}
                      {config.respondent_statuses.length === 0
                        ? 'aucun'
                        : config.respondent_statuses.map(stageLabel).join(', ')}
                    </span>
                    <span>
                      <span className="font-medium text-foreground">Silencieux :</span>{' '}
                      {config.silent_statuses.length === 0
                        ? 'aucun'
                        : config.silent_statuses.map(stageLabel).join(', ')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Aucune configuration d&apos;analyse
                    </span>
                    <Badge variant="outline">Non configuré</Badge>
                  </div>
                  <Button variant="default" size="sm" asChild>
                    <Link href={`/insights/config/${pipelineId}`}>
                      Configurer ce pipeline
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Launch button */}
          <Button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="w-full sm:w-auto"
          >
            {analyzeStatus === 'loading' && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Lancer l&apos;analyse
          </Button>

          {/* Progress indicator */}
          {analyzeStatus === 'loading' && (
            <div className="flex items-center gap-3 rounded-md bg-muted/40 px-4 py-3">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {PROGRESS_LABELS[progressStep]}
              </span>
            </div>
          )}

          {/* Success result */}
          {analyzeStatus === 'success' && analyzeResult && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Analyse terminée
                    {analyzeResult.meta && (
                      <span className="ml-1 font-normal text-green-600/80 dark:text-green-500/80">
                        — {analyzeResult.meta.respondentCount} répondants,{' '}
                        {analyzeResult.meta.silentCount} silencieux
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  {analyzeResult.signedUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(analyzeResult.signedUrl, '_blank')}
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Voir le rapport
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(analyzeResult.signedUrl ?? '')}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copier
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {analyzeStatus === 'error' && analyzeError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span className="text-sm text-destructive">{analyzeError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ZONE B — Rapports générés ───────────────────────────────────────── */}
      {pipelineId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Rapports générés
            </CardTitle>
            <CardDescription>Historique des analyses pour ce pipeline.</CardDescription>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <BarChart2 className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Aucun rapport pour ce pipeline.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-0.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatDate(report.createdAt)}</span>
                        <ReportStatusBadge report={report} />
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{report.contactCount} contacts</span>
                        {!report.isExpired && !report.isRevoked && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTtlRemaining(report.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {!report.isRevoked && !report.isExpired && report.signedUrl && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(report.signedUrl, '_blank')}
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Voir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(report.signedUrl!)}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copier
                          </Button>
                        </>
                      )}
                      {!report.isRevoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setRevokeTarget(report)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Revoke confirmation */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer ce rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le lien partagé sera immédiatement invalidé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
