'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import { PipelineEditor } from '@/components/pipeline/PipelineEditor'
import { usePipelines, useDeletePipeline, type PipelineWithStages } from '@/hooks/usePipelines'

export default function PipelinesPage() {
  const { data: pipelines, isLoading } = usePipelines()
  const deletePipeline = useDeletePipeline()

  const [editTarget, setEditTarget] = useState<PipelineWithStages | null | 'new'>(null)
  const [deleteTarget, setDeleteTarget] = useState<PipelineWithStages | null>(null)

  const isOpen = editTarget !== null

  return (
    <div className="space-y-6 flex-1 overflow-y-auto px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-sm text-muted-foreground">
            Gère les étapes de tes processus de vente et de suivi.
          </p>
        </div>
        <Button size="sm" className="w-full md:w-auto" onClick={() => setEditTarget('new')}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nouveau pipeline
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : pipelines?.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">Aucun pipeline</p>
            <p className="text-sm text-muted-foreground">
              Crée ton premier pipeline pour commencer à suivre tes leads.
            </p>
          </div>
          <Button onClick={() => setEditTarget('new')}>
            <Plus className="mr-1.5 h-4 w-4" />
            Créer un pipeline
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(pipelines ?? []).map((pipeline) => (
            <Card key={pipeline.id} className="flex flex-col gap-2">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{pipeline.name}</CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditTarget(pipeline)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(pipeline)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {pipeline.description && (
                  <CardDescription className="line-clamp-2">{pipeline.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 pt-2">
                {pipeline.pipeline_stages.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucune étape</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pipeline.pipeline_stages.map((stage) => (
                      <Badge
                        key={stage.id}
                        style={
                          stage.is_lost
                            ? { backgroundColor: '#94a3b822', color: '#64748b' }
                            : stage.is_won
                            ? { backgroundColor: '#22c55e22', color: '#16a34a' }
                            : { backgroundColor: stage.color + '22', color: stage.color }
                        }
                        className="border-0 text-xs"
                        title={
                          stage.is_lost ? 'Étape de clôture négative' :
                          stage.is_won ? 'Étape de clôture positive' : undefined
                        }
                      >
                        {stage.is_lost && <span className="mr-1 opacity-60">✕</span>}
                        {stage.is_won && <span className="mr-1 opacity-80">✓</span>}
                        {stage.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editTarget === 'new' ? 'Nouveau pipeline' : 'Modifier le pipeline'}
            </DialogTitle>
          </DialogHeader>
          {isOpen && (
            <PipelineEditor
              pipeline={editTarget === 'new' ? null : editTarget}
              onSuccess={() => setEditTarget(null)}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleteTarget?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les étapes et l&apos;historique associé seront définitivement supprimés.
              Les contacts ne seront pas affectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) {
                  await deletePipeline.mutateAsync(deleteTarget.id)
                  setDeleteTarget(null)
                }
              }}
              disabled={deletePipeline.isPending}
            >
              {deletePipeline.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
