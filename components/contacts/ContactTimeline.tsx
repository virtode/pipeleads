'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import {
  useInteractions,
  useUpdateInteraction,
  useDeleteInteraction,
} from '@/hooks/useInteractions'
import { useProfile } from '@/hooks/useProfile'
import type { Interaction } from '@/lib/types/interactions'
import { addDays } from 'date-fns'
import { CreateInteractionForm } from './CreateInteractionForm'
import { InteractionItem } from './InteractionItem'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContactTimelineProps {
  contactId: string
  autoFocus?: boolean
  onFocused?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContactTimeline({ contactId, autoFocus, onFocused }: ContactTimelineProps) {
  const { data: interactions = [], isLoading } = useInteractions(contactId)
  const { data: profile } = useProfile()
  const timezone = profile?.timezone ?? 'Europe/Paris'

  const updateInteraction = useUpdateInteraction()
  const deleteInteraction = useDeleteInteraction()

  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null)

  async function markDone(i: Interaction) {
    await updateInteraction.mutateAsync({
      id: i.id,
      contactId,
      data: { status: 'done', completed_at: new Date().toISOString() },
    })
  }

  async function postpone(i: Interaction) {
    await updateInteraction.mutateAsync({
      id: i.id,
      contactId,
      data: { date: addDays(new Date(i.date), 7).toISOString() },
    })
  }

  async function handleDelete(i: Interaction) {
    await deleteInteraction.mutateAsync({ id: i.id, contactId })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">

      {/* ── Bloc de saisie ─────────────────────────────────────── */}
      <CreateInteractionForm
        contactId={contactId}
        autoFocus={autoFocus ?? false}
        onFocused={onFocused}
        editingInteraction={editingInteraction}
        onCancelEdit={() => setEditingInteraction(null)}
        onSubmitSuccess={() => setEditingInteraction(null)}
      />

      {/* ── Fil chronologique ──────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <p className="text-xs text-muted-foreground py-4 text-center">Chargement…</p>
        )}

        {!isLoading && interactions.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Aucune interaction</p>
          </div>
        )}

        {interactions.map((interaction) => (
          <InteractionItem
            key={interaction.id}
            interaction={interaction}
            timezone={timezone}
            isEditing={editingInteraction?.id === interaction.id}
            onEdit={() => setEditingInteraction(interaction)}
            onMarkDone={() => markDone(interaction)}
            onPostpone={() => postpone(interaction)}
            onDelete={() => handleDelete(interaction)}
          />
        ))}
      </div>
    </div>
  )
}
