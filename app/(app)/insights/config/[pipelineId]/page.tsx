'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Tag,
  Users,
  Sparkles,
  FileText,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePipelines } from '@/hooks/usePipelines'
import { useSupabaseClient } from '@/lib/supabase/context'
import { getAnalysisConfig } from '@/src/modules/insights/lib/data'
import type { AnalysisConfig } from '@/src/modules/insights/lib/data'
import type { PipelineStage } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtendedAnalysisConfig extends AnalysisConfig {
  pipeline_name?: string | null
  report_template?: string | null
  ttl_seconds?: number | null
  prompt_version?: number | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TTL_OPTIONS = [
  { label: '1 heure', value: 3600 },
  { label: '24 heures', value: 86400 },
  { label: '7 jours', value: 604800 },
  { label: '30 jours', value: 2592000 },
] as const

// ---------------------------------------------------------------------------
// StageCheckboxGroup
// ---------------------------------------------------------------------------

function StageCheckboxGroup({
  stages,
  selected,
  onToggle,
  groupId,
  loading,
}: {
  stages: PipelineStage[]
  selected: string[]
  onToggle: (id: string) => void
  groupId: string
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    )
  }
  if (stages.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Aucune étape disponible dans ce pipeline.
      </p>
    )
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-center gap-2.5">
          <Checkbox
            id={`${groupId}-${stage.id}`}
            checked={selected.includes(stage.id)}
            onCheckedChange={() => onToggle(stage.id)}
          />
          <Label
            htmlFor={`${groupId}-${stage.id}`}
            className="cursor-pointer font-normal leading-none"
          >
            {stage.name}
          </Label>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InsightsConfigPage() {
  const params = useParams<{ pipelineId: string }>()
  const pipelineId = params.pipelineId
  const router = useRouter()
  const supabase = useSupabaseClient()

  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines()
  const pipeline = pipelines?.find((p) => p.id === pipelineId)
  const stages = pipeline?.pipeline_stages ?? []

  // Config loading
  const [config, setConfig] = useState<ExtendedAnalysisConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)

  // Form state
  const [pipelineName, setPipelineName] = useState('')
  const [respondentStatuses, setRespondentStatuses] = useState<string[]>([])
  const [silentStatuses, setSilentStatuses] = useState<string[]>([])
  const [excludedStatuses, setExcludedStatuses] = useState<string[]>([])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [contextPrompt, setContextPrompt] = useState('')
  const [reportTemplate, setReportTemplate] = useState('default')
  const [ttlSeconds, setTtlSeconds] = useState(604800)
  const [saving, setSaving] = useState(false)

  const initialized = useRef(false)

  // Load config on mount
  useEffect(() => {
    setConfigLoading(true)
    getAnalysisConfig(supabase, pipelineId)
      .then((res) => {
        setConfig(res as ExtendedAnalysisConfig | null)
        setConfigLoading(false)
      })
      .catch(() => {
        setConfig(null)
        setConfigLoading(false)
      })
  }, [supabase, pipelineId])

  // Pre-fill form once both data sources are ready
  useEffect(() => {
    if (initialized.current) return
    if (configLoading || pipelinesLoading) return
    initialized.current = true

    if (config) {
      setPipelineName(config.pipeline_name ?? pipeline?.name ?? '')
      setRespondentStatuses(config.respondent_statuses)
      setSilentStatuses(config.silent_statuses)
      setExcludedStatuses(config.excluded_statuses)
      setSystemPrompt(config.system_prompt)
      setContextPrompt(config.context_prompt ?? '')
      setReportTemplate(config.report_template ?? 'default')
      setTtlSeconds(config.ttl_seconds ?? 604800)
    } else {
      setPipelineName(pipeline?.name ?? '')
    }
  }, [config, configLoading, pipeline, pipelinesLoading])

  // Toggle a stage ID in/out of a status array
  function toggle(id: string, current: string[], set: (v: string[]) => void) {
    set(current.includes(id) ? current.filter((s) => s !== id) : [...current, id])
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pipelineId) return
    setSaving(true)
    try {
      const res = await fetch('/api/insights/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId,
          pipelineName: pipelineName || pipeline?.name || '',
          respondentStatuses,
          silentStatuses,
          excludedStatuses,
          systemPrompt,
          contextPrompt: contextPrompt || null,
          reportTemplate,
          ttlSeconds,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? 'Erreur lors de la sauvegarde')
        return
      }
      toast.success('Configuration sauvegardée')
      router.push('/insights')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const dataLoading = configLoading || pipelinesLoading

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl w-full space-y-8 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" className="-ml-2 h-8" asChild>
        <Link href="/insights">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Retour aux Insights
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuration de l&apos;analyse</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pipelinesLoading ? '…' : (pipeline?.name ?? 'Pipeline introuvable')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Identification ───────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Identification</h2>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Nom de la configuration</CardTitle>
              <CardDescription>
                Étiquette interne pour identifier cette configuration dans les rapports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dataLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Input
                  id="pipeline-name"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  placeholder={pipeline?.name ?? 'Nom du pipeline'}
                />
              )}
              {!dataLoading && config?.prompt_version != null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Version du prompt :</span>
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {config.prompt_version}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Catégorisation des contacts ──────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Catégorisation des contacts</h2>
          </div>
          <Card>
            <CardContent className="pt-5 space-y-6">
              {/* Respondents */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Étapes répondants</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Contacts actifs ayant répondu positivement.
                  </p>
                </div>
                <StageCheckboxGroup
                  stages={stages}
                  selected={respondentStatuses}
                  onToggle={(id) => toggle(id, respondentStatuses, setRespondentStatuses)}
                  groupId="resp"
                  loading={dataLoading}
                />
              </div>

              <div className="border-t" />

              {/* Silents */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Étapes silencieux</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Contacts n&apos;ayant pas répondu ou inactifs.
                  </p>
                </div>
                <StageCheckboxGroup
                  stages={stages}
                  selected={silentStatuses}
                  onToggle={(id) => toggle(id, silentStatuses, setSilentStatuses)}
                  groupId="silent"
                  loading={dataLoading}
                />
              </div>

              <div className="border-t" />

              {/* Excluded */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Étapes exclues</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Contacts ignorés dans l&apos;analyse (ex. perdus, archivés).
                  </p>
                </div>
                <StageCheckboxGroup
                  stages={stages}
                  selected={excludedStatuses}
                  onToggle={(id) => toggle(id, excludedStatuses, setExcludedStatuses)}
                  groupId="excl"
                  loading={dataLoading}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Prompts IA ───────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Prompts IA</h2>
          </div>
          <Card>
            <CardContent className="pt-5 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="system-prompt">Prompt système</Label>
                <p className="text-xs text-muted-foreground">
                  Instructions principales envoyées à Claude. Définit le rôle et le cadre de l&apos;analyse.
                </p>
                {dataLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Textarea
                    id="system-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={8}
                    placeholder="Tu es un expert en analyse de pipeline de vente…"
                    required
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="context-prompt">Prompt contextuel</Label>
                <p className="text-xs text-muted-foreground">
                  Informations supplémentaires sur le contexte métier (optionnel).
                </p>
                {dataLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <Textarea
                    id="context-prompt"
                    value={contextPrompt}
                    onChange={(e) => setContextPrompt(e.target.value)}
                    rows={4}
                    placeholder="Notre produit est…, notre cycle de vente dure…"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Rapport ──────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Rapport</h2>
          </div>
          <Card>
            <CardContent className="pt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-template">Modèle de rapport</Label>
                <Select value={reportTemplate} onValueChange={setReportTemplate}>
                  <SelectTrigger id="report-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Par défaut</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ttl-seconds">Durée de validité par défaut</Label>
                <Select
                  value={String(ttlSeconds)}
                  onValueChange={(v) => setTtlSeconds(Number(v))}
                >
                  <SelectTrigger id="ttl-seconds">
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
            </CardContent>
          </Card>
        </section>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/insights">Annuler</Link>
          </Button>
          <Button
            type="submit"
            disabled={saving || dataLoading || !systemPrompt.trim()}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {config ? 'Mettre à jour' : 'Créer la configuration'}
          </Button>
        </div>
      </form>
    </div>
  )
}
