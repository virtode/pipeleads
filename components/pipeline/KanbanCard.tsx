'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { KanbanCardData } from '@/hooks/usePipelines'
import { getFullName } from '@/lib/utils'

interface KanbanCardProps {
  card: KanbanCardData
  onOpen: (contactId: string) => void
  dimmed?: boolean
}

function getInitials(first: string, last?: string | null) {
  return `${first.charAt(0)}${last ? last.charAt(0) : ''}`.toUpperCase()
}

export function KanbanCard({ card, onOpen, dimmed }: KanbanCardProps) {
  const { contact } = card

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.cp_id,
    data: { type: 'card', card },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : dimmed ? 0.5 : 1,
    zIndex: isDragging ? 999 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-lg border bg-card px-3 py-2.5 shadow-sm active:cursor-grabbing hover:shadow-md transition-shadow"
      onClick={() => onOpen(contact.id)}
      aria-label={getFullName(contact.first_name, contact.last_name)}
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarImage src={contact.photo_url ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(contact.first_name, contact.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">
            {getFullName(contact.first_name, contact.last_name)}
          </p>
          {contact.company && (
            <p className="truncate text-xs text-muted-foreground mt-0.5">{contact.company}</p>
          )}
          {(contact.tags ?? []).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(contact.tags ?? []).slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Overlay version for DragOverlay (no sortable, just visual)
export function KanbanCardOverlay({ card }: { card: KanbanCardData }) {
  const { contact } = card

  return (
    <div className="cursor-grabbing rounded-lg border bg-card px-3 py-2.5 shadow-xl rotate-1">
      <div className="flex items-start gap-2.5">
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarImage src={contact.photo_url ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(contact.first_name, contact.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">
            {getFullName(contact.first_name, contact.last_name)}
          </p>
          {contact.company && (
            <p className="truncate text-xs text-muted-foreground mt-0.5">{contact.company}</p>
          )}
        </div>
      </div>
    </div>
  )
}
