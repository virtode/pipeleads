'use client'

import {
  Clock, CheckCircle2, FileText, MoreHorizontal, Pencil, Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Interaction, ActionTemplate } from '@/lib/types/interactions'
import { ActionTemplateLabels } from '@/lib/types/interactions'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatDate(dateStr: string, timezone: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const todayInTz  = formatInTimeZone(now, timezone, 'yyyy-MM-dd')
  const dateInTz   = formatInTimeZone(d,   timezone, 'yyyy-MM-dd')
  const thisYear   = formatInTimeZone(now, timezone, 'yyyy')
  const dateYear   = formatInTimeZone(d,   timezone, 'yyyy')

  if (dateInTz === todayInTz) {
    return formatInTimeZone(d, timezone, "'Aujourd'hui à' HH:mm", { locale: fr })
  }
  if (thisYear === dateYear) {
    return formatInTimeZone(d, timezone, "d MMM 'à' HH:mm", { locale: fr })
  }
  return formatInTimeZone(d, timezone, "d MMM yyyy 'à' HH:mm", { locale: fr })
}

export function isPendingReminder(i: Interaction): boolean {
  return i.type === 'reminder' && i.status === 'pending'
}

// ---------------------------------------------------------------------------
// InteractionItem
// ---------------------------------------------------------------------------

export interface InteractionItemProps {
  interaction: Interaction
  timezone: string
  isEditing: boolean
  onEdit: () => void
  onMarkDone: () => void
  onPostpone: () => void
  onDelete: () => void
}

export function InteractionItem({
  interaction: i,
  timezone,
  isEditing,
  onEdit,
  onMarkDone,
  onPostpone,
  onDelete,
}: InteractionItemProps) {
  const pending = isPendingReminder(i)
  const done    = i.type === 'reminder' && i.status === 'done'

  return (
    <div
      className={[
        'group relative rounded-lg px-3 py-2.5 transition-colors',
        pending ? 'border-l-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-900/10' : 'hover:bg-muted/40',
        done    ? 'opacity-50' : '',
        isEditing ? 'ring-1 ring-primary/30 bg-primary/5' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div className="mt-0.5 shrink-0">
          {pending && <Clock className="h-3.5 w-3.5 text-amber-500" />}
          {done    && <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
          {i.type === 'note' && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm whitespace-pre-wrap break-words">{i.content}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {formatDate(i.date, timezone)}
            </span>
            {i.action_template && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {ActionTemplateLabels[i.action_template as ActionTemplate]}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 flex h-6 w-6 items-center justify-center rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            {pending && (
              <>
                <DropdownMenuItem onClick={onMarkDone}>
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-green-500" />
                  Fait
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPostpone}>
                  <Clock className="mr-2 h-3.5 w-3.5" />
                  Reporter +1 semaine
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
