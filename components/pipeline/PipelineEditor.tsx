'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
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
import { KeyboardSensor } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  onNameChange: (v: string) => void
  onColorChange: (v: string) => void
  onIsLostChange: (v: boolean) => void
  onDelete: () => void
  canDelete: boolean
}

function StageRow({ id, name, color, isLost, onNameChange, onColorChange, onIsLostChange, onDelete, canDelete }: StageRowProps) {
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
              onClick={() => onColorChange(c)}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>

        {/* Name */}
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Nom de l'étape"
          className={`h-8 flex-1 text-sm ${isLost ? 'border-red-300 dark:border-red-800' : ''}`}
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

      {/* is_lost toggle */}
      <div className="ml-6 flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={isLost}
          onClick={() => onIsLostChange(!isLost)}
          className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isLost ? 'bg-red-500' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
              isLost ? 'translate-x-3' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-xs ${isLost ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
          Étape de clôture négative
          {isLost && (
            <span className="ml-1 text-muted-foreground font-normal">
              — exclue de l&apos;entonnoir
            </span>
          )}
        </span>
      </div>
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
      for (const dbId of stagesToDelete) {
        await deleteStage.mutateAsync({ id: dbId, pipelineId })
      }

      // 3. Upsert stages (insert new, update existing)
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i]
        const payload = { name: s.name || 'Étape', color: s.color, position: i, is_lost: s.isLost }

        if (s.dbId) {
          // Update existing — uses mutation so tenant_id and cache invalidation are handled
          await updateStage.mutateAsync({ id: s.dbId, pipelineId, data: payload })
        } else {
          // Insert new — uses mutation so tenant_id is injected and cache is invalidated
          await createStage.mutateAsync({ ...payload, pipeline_id: pipelineId })
        }
      }

      // Invalidate kanban separately (useCreateStage onSuccess doesn't cover it)
      queryClient.invalidateQueries({ queryKey: ['kanban', pipelineId] })

      onSuccess()
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
                  onNameChange={(v) =>
                    setStages((prev) =>
                      prev.map((s) => (s.localId === stage.localId ? { ...s, name: v } : s))
                    )
                  }
                  onColorChange={(v) =>
                    setStages((prev) =>
                      prev.map((s) => (s.localId === stage.localId ? { ...s, color: v } : s))
                    )
                  }
                  onIsLostChange={(v) =>
                    setStages((prev) =>
                      prev.map((s) => (s.localId === stage.localId ? { ...s, isLost: v } : s))
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
