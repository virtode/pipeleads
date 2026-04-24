'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, Loader2, XCircle, ArrowUpRight, CheckCircle2, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useCreatePipeline,
  useUpdatePipeline,
  useCreateStage,
  useUpdateStage,
  useDeleteStage,
  useReorderStages,
  type PipelineWithStages,
} from '@/hooks/usePipelines'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Palette de couleurs pour les étapes
// ---------------------------------------------------------------------------

const STAGE_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#64748b', // slate
]

// ---------------------------------------------------------------------------
// Stage row (sortable)
// ---------------------------------------------------------------------------

interface StageRowProps {
  id: string
  name: string
  color: string
  isLost: boolean
  isReferral: boolean
  isWon: boolean
  countByCompany: boolean
  onUpdate: (patch: Partial<Pick<DraftStage, 'name' | 'color' | 'isLost' | 'isReferral' | 'isWon' | 'countByCompany'>>) => void
  onDelete: () => void
  canDelete: boolean
}

function StageRow({ id, name, color, isLost, isReferral, isWon, countByCompany, onUpdate, onDelete, canDelete }: StageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Réordonner"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Color dot picker */}
        <div className="flex gap-1">
          {STAGE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`h-4 w-4 rounded-full transition-transform ${c === color ? 'scale-125 ring-2 ring-offset-1 ring-foreground/30' : 'hover:scale-110'}`}
              style={{ backgroundColor: c }}
              onClick={() => onUpdate({ color: c })}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>

        {/* Name */}
        <Input
          value={name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Nom de l'étape"
          className={`h-8 flex-1 text-sm ${isLost ? 'border-red-300 dark:border-red-800' : isReferral ? 'border-orange-300 dark:border-orange-800' : isWon ? 'border-green-300 dark:border-green-800' : ''}`}
        />

        {/* Delete */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Icon-toggle row */}
      <TooltipProvider>
        <div className="ml-6 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onUpdate({ isLost: !isLost })}
                className={`rounded-md p-1.5 transition-colors ${isLost ? 'text-destructive bg-destructive/10' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="Étape de clôture négative"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Étape de clôture négative</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onUpdate({ isReferral: !isReferral })}
                className={`rounded-md p-1.5 transition-colors ${isReferral ? 'text-orange-500 bg-orange-500/10' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="Étape de referral"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Étape de referral — génère un contact de suivi</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onUpdate({ isWon: !isWon })}
                className={`rounded-md p-1.5 transition-colors ${isWon ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="Étape de clôture positive"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Étape de clôture positive — objectif atteint</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onUpdate({ countByCompany: !countByCompany })}
                className={`rounded-md p-1.5 transition-colors ${countByCompany ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="Dédoublonner par entreprise"
              >
                <Building2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Dédoublonner par entreprise dans le reporting</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draft stage (local only, before saving)
// ---------------------------------------------------------------------------

interface DraftStage {
  localId: string      // temp id for DnD key
  dbId: string | null  // real DB id once saved
  name: string
  color: string
  position: number
  isLost: boolean
  isReferral: boolean
  isWon: boolean
  countByCompany: boolean
  isNew: boolean
}

function buildDrafts(stages: PipelineWithStages['pipeline_stages']): DraftStage[] {
  return stages.map((s) => ({
    localId: s.id,
    dbId: s.id,
    name: s.name,
    color: s.color,
    position: s.position,
    isLost: s.is_lost,
    isReferral: s.is_referral,
    isWon: s.is_won,
    countByCompany: s.count_by_company,
    isNew: false,
  }))
}

// ---------------------------------------------------------------------------
// PipelineEditor
// ---------------------------------------------------------------------------

interface PipelineEditorProps {
  pipeline?: PipelineWithStages | null
  onSuccess: () => void
  onCancel: () => void
}

export function PipelineEditor({ pipeline, onSuccess, onCancel }: PipelineEditorProps) {
  const queryClient = useQueryClient()
  const createPipeline = useCreatePipeline()
  const updatePipeline = useUpdatePipeline()
  const createStage = useCreateStage()
  const updateStage = useUpdateStage()
  const deleteStage = useDeleteStage()
  const reorderStages = useReorderStages()

  const [name, setName] = useState(pipeline?.name ?? '')
  const [description, setDescription] = useState(pipeline?.description ?? '')
  const [stages, setStages] = useState<DraftStage[]>(
    pipeline ? buildDrafts(pipeline.pipeline_stages) : []
  )
  const [isSaving, setIsSaving] = useState(false)
  const [stagesToDelete, setStagesToDelete] = useState<string[]>([]) // dbIds to delete on save

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (pipeline) {
      setName(pipeline.name)
      setDescription(pipeline.description ?? '')
      setStages(buildDrafts(pipeline.pipeline_stages))
    }
  }, [pipeline?.id])

  function addStage() {
    const maxPos = stages.reduce((m, s) => Math.max(m, s.position), -1)
    const localId = `new-${crypto.randomUUID()}`
    setStages((prev) => [
      ...prev,
      {
        localId,
        dbId: null,
        name: '',
        color: STAGE_COLORS[stages.length % STAGE_COLORS.length],
        position: maxPos + 1,
        isLost: false,
        isReferral: false,
        isWon: false,
        countByCompany: false,
        isNew: true,
      },
    ])
  }

  function removeStage(localId: string) {
    const stage = stages.find((s) => s.localId === localId)
    if (stage?.dbId) {
      setStagesToDelete((prev) => [...prev, stage.dbId!])
    }
    setStages((prev) => prev.filter((s) => s.localId !== localId))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setStages((prev) => {
      const oldIdx = prev.findIndex((s) => s.localId === active.id)
      const newIdx = prev.findIndex((s) => s.localId === over.id)
      return arrayMove(prev, oldIdx, newIdx).map((s, i) => ({ ...s, position: i }))
    })
  }

  async function handleSave() {
    if (!name.trim()) return
    setIsSaving(true)

    try {
      let pipelineId = pipeline?.id ?? ''

      // 1. Create or update pipeline
      if (!pipeline) {
        const created = await createPipeline.mutateAsync({ name: name.trim(), description: description.trim() || null })
        pipelineId = created.id
      } else {
        await updatePipeline.mutateAsync({
          id: pipeline.id,
          data: { name: name.trim(), description: description.trim() || null },
        })
      }

      // 2. Delete removed stages
      await Promise.all(stagesToDelete.map((dbId) => deleteStage.mutateAsync({ id: dbId, pipelineId })))

      // 3. Upsert stages (insert new, update existing)
      // Pass 1: move all existing stages to temporary positions to avoid UNIQUE(pipeline_id, position)
      // collisions when positions are reordered (e.g. swapping stage at pos 0 with stage at pos 1).
      const existingStages = stages.filter((s) => s.dbId !== null)
      for (let i = 0; i < existingStages.length; i++) {
        const s = existingStages[i]
        await updateStage.mutateAsync({
          id: s.dbId!,
          pipelineId,
          data: { name: s.name || 'Étape', color: s.color, position: 10000 + i, is_lost: s.isLost, is_referral: s.isReferral, is_won: s.isWon, count_by_company: s.countByCompany },
        })
      }

      // Pass 2: write final positions and insert new stages
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i]
        const payload = { name: s.name || 'Étape', color: s.color, position: i, is_lost: s.isLost, is_referral: s.isReferral, is_won: s.isWon, count_by_company: s.countByCompany }

        if (s.dbId) {
          await updateStage.mutateAsync({ id: s.dbId, pipelineId, data: payload })
        } else {
          await createStage.mutateAsync({ ...payload, pipeline_id: pipelineId })
        }
      }

      // Invalidate kanban separately (useCreateStage onSuccess doesn't cover it)
      queryClient.invalidateQueries({ queryKey: ['kanban', pipelineId] })

      toast.success(pipeline ? 'Pipeline mis à jour' : 'Pipeline créé')
      onSuccess()
    } catch (err) {
      console.error('[PipelineEditor.handleSave]', err)
      const msg = (err as { message?: string }).message ?? 'Erreur inconnue'
      toast.error(`Erreur lors de la sauvegarde : ${msg}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Pipeline name */}
      <div className="space-y-1.5">
        <Label htmlFor="pipe-name">Nom du pipeline *</Label>
        <Input
          id="pipe-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex : Prospection commerciale"
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="pipe-desc">Description</Label>
        <Textarea
          id="pipe-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description optionnelle…"
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Stages */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Étapes</Label>
          <Button type="button" variant="outline" size="sm" onClick={addStage} className="h-7 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" /> Ajouter une étape
          </Button>
        </div>

        {stages.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Aucune étape — ajoute-en une pour organiser tes leads.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stages.map((s) => s.localId)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {stages.map((stage) => (
                <StageRow
                  key={stage.localId}
                  id={stage.localId}
                  name={stage.name}
                  color={stage.color}
                  isLost={stage.isLost}
                  isReferral={stage.isReferral}
                  isWon={stage.isWon}
                  countByCompany={stage.countByCompany}
                  onUpdate={(patch) =>
                    setStages((prev) =>
                      prev.map((s) => {
                        if (s.localId !== stage.localId) return s
                        const next = { ...s, ...patch }
                        if (patch.isLost && next.isLost) next.isWon = false
                        if (patch.isWon && next.isWon) next.isLost = false
                        return next
                      })
                    )
                  }
                  onDelete={() => removeStage(stage.localId)}
                  canDelete={stages.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pipeline ? 'Enregistrer' : 'Créer le pipeline'}
        </Button>
      </div>
    </div>
  )
}
