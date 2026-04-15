'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { ArrowUpRight, CheckCircle } from 'lucide-react'
import { KanbanCard, KanbanCardOverlay } from './KanbanCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMoveContactStage, type KanbanData, type KanbanCardData } from '@/hooks/usePipelines'
import { useQueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Column (droppable)
// ---------------------------------------------------------------------------

interface KanbanColumnProps {
  id: string
  label: string
  color: string
  cards: KanbanCardData[]
  onCardOpen: (contactId: string) => void
  isReferral?: boolean
  isWon?: boolean
}

function KanbanColumn({ id, label, color, cards, onCardOpen, isReferral, isWon }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  const headerBg = isWon ? '#22c55e18' : isReferral ? '#f9731618' : color + '18'
  const bodyBg = isWon ? 'bg-green-500/5' : isReferral ? 'bg-orange-500/5' : 'bg-muted/30'

  return (
    <div className="flex flex-col w-72 shrink-0 h-full gap-2">
      {/* Header */}
      <div
        className="shrink-0 sticky top-0 z-10 flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ backgroundColor: headerBg }}
      >
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="flex-1 text-sm font-medium truncate">{label}</span>
        {isReferral && (
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-orange-500" />
        )}
        {isWon && (
          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />
        )}
        <span className="text-xs text-muted-foreground tabular-nums">{cards.length}</span>
      </div>

      {/* Cards drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto space-y-2 rounded-lg p-1.5 pb-4 transition-colors ${
          isOver ? 'bg-primary/5 ring-2 ring-primary/20' : bodyBg
        }`}
      >
        <SortableContext items={cards.map((c) => c.cp_id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard key={card.cp_id} card={card} onOpen={onCardOpen} dimmed={isReferral || isWon} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Aucun contact</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------

interface KanbanBoardProps {
  data: KanbanData
  onCardOpen: (contactId: string) => void
  isLoading?: boolean
  showReferrals?: boolean
  showWon?: boolean
}

export function KanbanBoard({ data, onCardOpen, isLoading, showReferrals = false, showWon = false }: KanbanBoardProps) {
  const queryClient = useQueryClient()
  const moveContact = useMoveContactStage()
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null)

  // Local optimistic state: map cpId → stageId
  const [optimisticStages, setOptimisticStages] = useState<Map<string, string | null>>(new Map())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Resolve the current stageId for a card (local override or DB)
  function resolveStageId(card: KanbanCardData): string | null {
    return optimisticStages.has(card.cp_id)
      ? optimisticStages.get(card.cp_id)!
      : card.stage_id
  }

  // Build columns with optimistic overrides applied, filtered by showReferrals / showWon
  const columns = data.columns
    .filter((col) => (!col.stage.is_referral || showReferrals) && (!col.stage.is_won || showWon))
    .map((col) => ({
      ...col,
      cards: [
        ...col.cards.filter((c) => {
          const resolved = resolveStageId(c)
          return resolved === col.stage.id
        }),
        // Also include cards from other columns that were moved here
        ...data.columns
          .filter((other) => other.stage.id !== col.stage.id)
          .flatMap((other) => other.cards)
          .filter((c) => resolveStageId(c) === col.stage.id),
        ...data.unassigned.filter((c) => resolveStageId(c) === col.stage.id),
      ],
    }))

  const unassigned = [
    ...data.unassigned.filter((c) => {
      const resolved = resolveStageId(c)
      return resolved === null && !optimisticStages.has(c.cp_id)
    }),
    ...data.columns.flatMap((col) => col.cards).filter((c) => {
      const resolved = resolveStageId(c)
      return resolved === null
    }),
  ]

  function handleDragStart(event: DragStartEvent) {
    const card = findCard(String(event.active.id))
    setActiveCard(card ?? null)
  }

  function findCard(cpId: string): KanbanCardData | undefined {
    return [
      ...data.columns.flatMap((c) => c.cards),
      ...data.unassigned,
    ].find((c) => c.cp_id === cpId)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)

    if (!over) return

    const card = findCard(String(active.id))
    if (!card) return

    const fromStageId = card.stage_id
    // over.id can be a column id (stage id) or a card's cp_id
    let toStageId: string | null = null

    // Check if dropped onto a column (droppable id = stage.id)
    const isColumn = data.columns.some((col) => col.stage.id === String(over.id))
    if (isColumn) {
      toStageId = String(over.id)
    } else if (String(over.id) === 'unassigned') {
      toStageId = null
    } else {
      // Dropped on another card — find that card's column
      const overCard = findCard(String(over.id))
      if (overCard) {
        toStageId = resolveStageId(overCard)
      }
    }

    if (fromStageId === toStageId) return

    // Optimistic update
    setOptimisticStages((prev) => new Map(prev).set(card.cp_id, toStageId))

    moveContact.mutate(
      {
        cpId: card.cp_id,
        contactId: card.contact_id,
        pipelineId: data.pipeline.id,
        fromStageId,
        toStageId,
      },
      {
        onSuccess: () => {
          setOptimisticStages((prev) => {
            const next = new Map(prev)
            next.delete(card.cp_id)
            return next
          })
          queryClient.invalidateQueries({ queryKey: ['kanban', data.pipeline.id] })
        },
        onError: () => {
          // Revert optimistic
          setOptimisticStages((prev) => {
            const next = new Map(prev)
            next.delete(card.cp_id)
            return next
          })
        },
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full gap-4 overflow-x-auto overflow-y-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex w-72 shrink-0 flex-col gap-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <div className="min-h-40 space-y-2 rounded-lg bg-muted/30 p-2">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto overflow-y-hidden">
        {/* Stage columns */}
        {columns.map((col) => (
          <KanbanColumn
            key={col.stage.id}
            id={col.stage.id}
            label={col.stage.name}
            color={col.stage.color}
            cards={col.cards}
            onCardOpen={onCardOpen}
            isReferral={col.stage.is_referral}
            isWon={col.stage.is_won}
          />
        ))}

        {/* Unassigned column */}
        {unassigned.length > 0 && (
          <KanbanColumn
            id="unassigned"
            label="Sans étape"
            color="#94a3b8"
            cards={unassigned}
            onCardOpen={onCardOpen}
          />
        )}
      </div>

      <DragOverlay>
        {activeCard && <KanbanCardOverlay card={activeCard} />}
      </DragOverlay>
    </DndContext>
  )
}
