'use client'

import { GitBranch, Plus, X, ArrowUpRight, CheckCircle, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAssignContactToPipeline, useRemoveContactFromPipeline } from '@/hooks/usePipelines'
import type { PipelineWithStages } from '@/hooks/usePipelines'
import type { PipelineStage } from '@/types'

export type ContactPipelineEntry = {
  pipeline: { id: string; name: string } | null
  stage: { id: string; name: string; color: string } | null
}

interface ContactPipelineSectionProps {
  contactId: string
  contactPipelines: ContactPipelineEntry[]
  allPipelines: PipelineWithStages[] | undefined
  availablePipelines: PipelineWithStages[]
  addingPipelineId: string | null
  setAddingPipelineId: (id: string | null) => void
  onReferralPending: (pending: { stageId: string; pipelineId: string; stages: PipelineStage[] }) => void
}

export function ContactPipelineSection({
  contactId,
  contactPipelines,
  allPipelines,
  availablePipelines,
  addingPipelineId,
  setAddingPipelineId,
  onReferralPending,
}: ContactPipelineSectionProps) {
  const assignContact = useAssignContactToPipeline()
  const removeContact = useRemoveContactFromPipeline()

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <GitBranch className="h-3.5 w-3.5" /> Pipelines
        </p>
        {availablePipelines.length > 0 && (
          <button
            onClick={() => setAddingPipelineId(availablePipelines[0].id)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> Ajouter
          </button>
        )}
      </div>

      {/* Existing pipeline entries */}
      {contactPipelines.map((cp, i) => {
        const pipeline = allPipelines?.find((p) => p.id === cp.pipeline?.id)
        const stages = pipeline?.pipeline_stages ?? []
        return (
          <div key={i} className="rounded-md border px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{cp.pipeline?.name}</span>
              <button
                onClick={async () => {
                  if (!contactId || !cp.pipeline?.id) return
                  await removeContact.mutateAsync({ contactId, pipelineId: cp.pipeline.id })
                }}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Retirer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {stages.length > 0 && (
              <Select
                value={cp.stage?.id ?? '__none__'}
                onValueChange={async (v) => {
                  if (!contactId || !cp.pipeline?.id) return
                  const stageId = v === '__none__' ? null : v
                  const selectedStage = stages.find((s) => s.id === stageId)
                  if (selectedStage?.is_referral) {
                    onReferralPending({
                      stageId: stageId!,
                      pipelineId: cp.pipeline.id,
                      stages,
                    })
                    return
                  }
                  await assignContact.mutateAsync({
                    contactId,
                    pipelineId: cp.pipeline.id,
                    stageId,
                  })
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Sans étape" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sans étape</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.is_referral && (
                          <ArrowUpRight className="h-3 w-3 text-orange-500 shrink-0" />
                        )}
                        {s.is_won && (
                          <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                        )}
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {stages.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {cp.stage ? (
                  <Badge style={{ backgroundColor: cp.stage.color + '22', color: cp.stage.color }} className="border-0 text-xs">
                    {cp.stage.name}
                  </Badge>
                ) : 'Sans étape'}
              </span>
            )}
          </div>
        )
      })}

      {/* Add to new pipeline */}
      {addingPipelineId && (
        <div className="rounded-md border border-primary/30 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <Select value={addingPipelineId} onValueChange={setAddingPipelineId}>
              <SelectTrigger className="h-7 text-sm flex-1 mr-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availablePipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={() => setAddingPipelineId(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {(() => {
            const pipe = allPipelines?.find((p) => p.id === addingPipelineId)
            const stages = pipe?.pipeline_stages ?? []
            return (
              <div className="flex items-center gap-2">
                {stages.length > 0 && (
                  <Select
                    defaultValue="__none__"
                    onValueChange={async (v) => {
                      if (!contactId || !addingPipelineId) return
                      const stageId = v === '__none__' ? null : v
                      await assignContact.mutateAsync({ contactId, pipelineId: addingPipelineId, stageId })
                      setAddingPipelineId(null)
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Choisir une étape" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sans étape</SelectItem>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {stages.length === 0 && (
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={async () => {
                      if (!contactId || !addingPipelineId) return
                      await assignContact.mutateAsync({ contactId, pipelineId: addingPipelineId, stageId: null })
                      setAddingPipelineId(null)
                    }}
                    disabled={assignContact.isPending}
                  >
                    {assignContact.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmer'}
                  </Button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {contactPipelines.length === 0 && !addingPipelineId && (
        <p className="text-xs text-muted-foreground italic">
          Pas encore dans un pipeline.
        </p>
      )}
    </>
  )
}
