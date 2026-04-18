'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Clock, CheckCircle2, FileText, Bell, MoreHorizontal,
  Pencil, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useInteractions,
  useCreateInteraction,
  useUpdateInteraction,
  useDeleteInteraction,
} from '@/hooks/useInteractions'
import { useProfile } from '@/hooks/useProfile'
import type { Interaction, ActionTemplate } from '@/lib/types/interactions'
import { ActionTemplateLabels } from '@/lib/types/interactions'
import { addDays, addMonths, format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const QUICK_PICKS: { label: string; compute: () => Date }[] = [
  { label: '+3j',    compute: () => addDays(new Date(), 3) },
  { label: '+1sem',  compute: () => addDays(new Date(), 7) },
  { label: '+1mois', compute: () => addMonths(new Date(), 1) },
  { label: '+3mois', compute: () => addMonths(new Date(), 3) },
  { label: '+6mois', compute: () => addMonths(new Date(), 6) },
]

const TEMPLATES: { key: ActionTemplate; emoji: string }[] = [
  { key: 'email_followup',   emoji: '📧' },
  { key: 'call',             emoji: '📞' },
  { key: 'linkedin_message', emoji: '💼' },
  { key: 'propose_meeting',  emoji: '☕' },
  { key: 'send_document',    emoji: '📄' },
  { key: 'other',            emoji: '✍️' },
]

function formatDate(dateStr: string, timezone: string): string {
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

function isPendingReminder(i: Interaction): boolean {
  return i.type === 'reminder' && i.status === 'pending'
}

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

  const createInteraction = useCreateInteraction()
  const updateInteraction = useUpdateInteraction()
  const deleteInteraction = useDeleteInteraction()

  // Form state
  const [content, setContent]       = useState('')
  const [isReminder, setIsReminder] = useState(false)
  const [pickedQuick, setPickedQuick] = useState<string | null>(null)
  const [showCustom, setShowCustom]   = useState(false)
  const [customDateVal, setCustomDateVal] = useState('')
  const [selectedDate, setSelectedDate]   = useState<Date | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const quickPicksRef  = useRef<HTMLDivElement>(null)
  const templatesRef   = useRef<HTMLDivElement>(null)

  // Auto-focus when parent requests it
  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus()
      onFocused?.()
    }
  }, [autoFocus, onFocused])

  // Reset form
  const resetForm = useCallback(() => {
    setContent('')
    setIsReminder(false)
    setPickedQuick(null)
    setShowCustom(false)
    setCustomDateVal('')
    setSelectedDate(null)
    setSelectedTemplate(null)
    setEditingId(null)
  }, [])

  // Native horizontal-swipe guard — stops ContactSheet's swipe-to-close native listener
  // when the user is swiping the chip rows horizontally.
  useEffect(() => {
    function attach(el: HTMLDivElement | null) {
      if (!el) return () => {}
      let startX = 0, startY = 0, dir: 'h' | 'v' | null = null
      const onStart = (e: TouchEvent) => {
        startX = e.touches[0].clientX
        startY = e.touches[0].clientY
        dir = null
      }
      const onMove = (e: TouchEvent) => {
        if (dir === null) {
          const dx = Math.abs(e.touches[0].clientX - startX)
          const dy = Math.abs(e.touches[0].clientY - startY)
          if (dx < 5 && dy < 5) return
          dir = dx >= dy ? 'h' : 'v'
        }
        if (dir === 'h') e.stopPropagation()
      }
      el.addEventListener('touchstart', onStart, { passive: true })
      el.addEventListener('touchmove',  onMove,  { passive: true })
      return () => {
        el.removeEventListener('touchstart', onStart)
        el.removeEventListener('touchmove',  onMove)
      }
    }
    const q = attach(quickPicksRef.current)
    const t = attach(templatesRef.current)
    return () => { q(); t() }
  }, [isReminder])

  // Fill form for editing
  function startEdit(i: Interaction) {
    setEditingId(i.id)
    setContent(i.content)
    const isRem = i.type === 'reminder'
    setIsReminder(isRem)
    setSelectedDate(isRem ? new Date(i.date) : null)
    setPickedQuick(null)
    setShowCustom(isRem)
    setCustomDateVal(isRem ? format(new Date(i.date), 'yyyy-MM-dd') : '')
    setSelectedTemplate((i.action_template as ActionTemplate | null) ?? null)
    textareaRef.current?.focus()
  }

  function pickQuick(label: string, compute: () => Date) {
    const d = compute()
    setSelectedDate(d)
    setPickedQuick(label)
    setShowCustom(false)
    setCustomDateVal('')
  }

  function pickCustom() {
    setPickedQuick(null)
    setShowCustom(true)
    setSelectedDate(null)
  }

  function handleCustomDateChange(val: string) {
    setCustomDateVal(val)
    if (val) {
      // Treat the date as noon UTC to avoid off-by-one issues
      setSelectedDate(new Date(val + 'T12:00:00.000Z'))
    } else {
      setSelectedDate(null)
    }
  }

  const canSubmit =
    content.trim().length > 0 &&
    (!isReminder || selectedDate !== null)

  async function handleSubmit() {
    if (!canSubmit) return
    const payload = {
      contact_id:      contactId,
      type:            (isReminder ? 'reminder' : 'note') as 'note' | 'reminder',
      date:            isReminder ? selectedDate!.toISOString() : new Date().toISOString(),
      content:         content.trim(),
      action_template: isReminder ? selectedTemplate : null,
      status:          isReminder ? ('pending' as const) : null,
      completed_at:    null,
    }

    if (editingId) {
      await updateInteraction.mutateAsync({ id: editingId, contactId, data: payload })
    } else {
      await createInteraction.mutateAsync(payload)
    }
    resetForm()
  }

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

  const isPending = createInteraction.isPending || updateInteraction.isPending

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">

      {/* ── Bloc de saisie ─────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b space-y-3">

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Note, compte-rendu ou pensée à propos de ce contact…"
          className="min-h-[72px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          }}
        />

        {/* Toggle rappel */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsReminder(!isReminder)
              if (isReminder) {
                setSelectedDate(null)
                setPickedQuick(null)
                setShowCustom(false)
                setSelectedTemplate(null)
              }
            }}
            className={[
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              isReminder
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            ].join(' ')}
          >
            <Bell className="h-3 w-3" />
            Rappel
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto"
            >
              <X className="h-3 w-3" /> Annuler
            </button>
          )}
        </div>

        {/* Quick picks + templates */}
        {isReminder && (
          <div className="space-y-2">
            {/* Date picks — scroll horizontal on mobile */}
            <div
              ref={quickPicksRef}
              className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5"
            >
              {QUICK_PICKS.map(({ label, compute }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => pickQuick(label, compute)}
                  className={[
                    'shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                    pickedQuick === label
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={pickCustom}
                className={[
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                  showCustom
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:border-primary/50',
                ].join(' ')}
              >
                📅 Autre
              </button>
            </div>

            {/* Custom date input */}
            {showCustom && (
              <input
                type="date"
                value={customDateVal}
                onChange={(e) => handleCustomDateChange(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            )}

            {/* Template chips — scroll horizontal on mobile */}
            <div
              ref={templatesRef}
              className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5"
            >
              {TEMPLATES.map(({ key, emoji }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedTemplate(selectedTemplate === key ? null : key)}
                  className={[
                    'shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
                    selectedTemplate === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50',
                  ].join(' ')}
                >
                  {emoji} {ActionTemplateLabels[key]}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="w-full h-9"
          disabled={!canSubmit || isPending}
          onClick={handleSubmit}
        >
          {isPending
            ? 'Enregistrement…'
            : editingId ? 'Modifier' : 'Ajouter'}
        </Button>
      </div>

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

        {interactions.map((interaction, idx) => (
          <InteractionItem
            key={interaction.id}
            interaction={interaction}
            timezone={timezone}
            isEditing={editingId === interaction.id}
            onEdit={() => startEdit(interaction)}
            onMarkDone={() => markDone(interaction)}
            onPostpone={() => postpone(interaction)}
            onDelete={() => handleDelete(interaction)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InteractionItem
// ---------------------------------------------------------------------------

interface InteractionItemProps {
  interaction: Interaction
  timezone: string
  isEditing: boolean
  onEdit: () => void
  onMarkDone: () => void
  onPostpone: () => void
  onDelete: () => void
}

function InteractionItem({
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
