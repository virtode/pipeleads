'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { addDays, endOfDay, endOfMonth, endOfWeek, startOfDay } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { useAgendaReminders, type AgendaReminder } from '@/hooks/useAgendaReminders'
import { useUpdateInteraction } from '@/hooks/useInteractions'
import { useProfile } from '@/hooks/useProfile'
import type { ActionTemplate } from '@/lib/types/interactions'
import { ActionTemplateLabels } from '@/lib/types/interactions'

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

interface Groups {
  overdue:   AgendaReminder[]
  today:     AgendaReminder[]
  thisWeek:  AgendaReminder[]
  thisMonth: AgendaReminder[]
  later:     AgendaReminder[]
}

function groupByUrgency(reminders: AgendaReminder[], timezone: string): Groups {
  const now       = new Date()
  const zonedNow  = toZonedTime(now, timezone)

  const startOfTodayUtc = fromZonedTime(startOfDay(zonedNow), timezone)
  const endOfTodayUtc   = fromZonedTime(endOfDay(zonedNow), timezone)
  // Week ending Sunday (weekStartsOn:1 → Monday start, Sunday end)
  const endOfWeekUtc    = fromZonedTime(endOfWeek(zonedNow, { weekStartsOn: 1 }), timezone)
  const endOfMonthUtc   = fromZonedTime(endOfMonth(zonedNow), timezone)

  const groups: Groups = { overdue: [], today: [], thisWeek: [], thisMonth: [], later: [] }

  for (const r of reminders) {
    const d = new Date(r.date)
    if      (d < startOfTodayUtc)  groups.overdue.push(r)
    else if (d <= endOfTodayUtc)   groups.today.push(r)
    else if (d <= endOfWeekUtc)    groups.thisWeek.push(r)
    else if (d <= endOfMonthUtc)   groups.thisMonth.push(r)
    else                           groups.later.push(r)
  }

  return groups
}

const GROUP_META = [
  { key: 'overdue',   label: '🔴 En retard' },
  { key: 'today',     label: '🟠 Aujourd\'hui' },
  { key: 'thisWeek',  label: '🟡 Cette semaine' },
  { key: 'thisMonth', label: '⚪ Ce mois-ci' },
  { key: 'later',     label: '🔵 Plus tard' },
] as const

// ---------------------------------------------------------------------------
// Template icons (emoji fallback)
// ---------------------------------------------------------------------------

const TEMPLATE_EMOJI: Record<ActionTemplate, string> = {
  email_followup:   '📧',
  call:             '📞',
  linkedin_message: '💼',
  propose_meeting:  '☕',
  send_document:    '📄',
  other:            '✍️',
}

// ---------------------------------------------------------------------------
// SwipeableRow
// ---------------------------------------------------------------------------

const COMMIT_THRESHOLD = 80   // px to trigger action
const REVEAL_WIDTH     = 64   // px of background hint

interface SwipeableRowProps {
  reminder: AgendaReminder
  timezone: string
  onMarkDone:  (r: AgendaReminder) => void
  onPostpone:  (r: AgendaReminder) => void
  onTap:       (r: AgendaReminder) => void
}

function SwipeableRow({ reminder, timezone, onMarkDone, onPostpone, onTap }: SwipeableRowProps) {
  const rowRef   = useRef<HTMLDivElement>(null)
  const [offset, setOffset]       = useState(0)
  const [swiping, setSwiping]     = useState(false)
  const [snapping, setSnapping]   = useState(false)

  useEffect(() => {
    const el = rowRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let currentOffset = 0
    let committed = false
    let didSwipe = false

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      currentOffset = 0
      committed = false
      didSwipe = false
      setSnapping(false)
    }

    const onMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY

      if (!committed) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        if (Math.abs(dy) >= Math.abs(dx)) return // vertical — let page scroll
        committed = true
        setSwiping(true)
      }

      e.preventDefault()
      didSwipe = true
      currentOffset = dx
      setOffset(dx)
    }

    const onEnd = () => {
      setSwiping(false)
      if (!committed) return

      if (currentOffset > COMMIT_THRESHOLD) {
        onMarkDone(reminder)
      } else if (currentOffset < -COMMIT_THRESHOLD) {
        onPostpone(reminder)
      }

      setSnapping(true)
      setOffset(0)
      committed = false
    }

    const onClick = (e: MouseEvent) => {
      if (didSwipe) { didSwipe = false; e.stopPropagation() }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove',  onMove,  { passive: false })
    el.addEventListener('touchend',   onEnd,   { passive: true })
    el.addEventListener('click',      onClick, { capture: true })

    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove',  onMove)
      el.removeEventListener('touchend',   onEnd)
      el.removeEventListener('click',      onClick, true)
    }
  }, [reminder, onMarkDone, onPostpone])

  const contactName = reminder.contact
    ? `${reminder.contact.first_name}${reminder.contact.last_name ? ` ${reminder.contact.last_name}` : ''}`
    : '—'

  const excerpt = reminder.content.length > 80
    ? reminder.content.slice(0, 80) + '…'
    : reminder.content

  const templateKey = reminder.action_template as ActionTemplate | null
  const emoji = templateKey ? TEMPLATE_EMOJI[templateKey] : '🔔'
  const templateLabel = templateKey ? ActionTemplateLabels[templateKey] : null

  const dateStr = formatInTimeZone(new Date(reminder.date), timezone, 'd MMM', { locale: fr })

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Background hint — green (right) / blue (left) */}
      <div
        className="absolute inset-0 flex items-center justify-between px-4 rounded-lg pointer-events-none"
        aria-hidden
      >
        <span className={[
          'text-xs font-semibold text-white transition-opacity',
          offset > 20 ? 'opacity-100' : 'opacity-0',
        ].join(' ')}>
          ✓ Fait
        </span>
        <span className={[
          'text-xs font-semibold text-white transition-opacity',
          offset < -20 ? 'opacity-100' : 'opacity-0',
        ].join(' ')}>
          +1 sem. →
        </span>
      </div>
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background: offset > 0
            ? `rgba(34,197,94,${Math.min(offset / 120, 0.7)})`
            : offset < 0
            ? `rgba(59,130,246,${Math.min(-offset / 120, 0.7)})`
            : 'transparent',
        }}
      />

      {/* Row content */}
      <div
        ref={rowRef}
        onClick={() => onTap(reminder)}
        style={{
          transform: `translateX(${offset}px)`,
          transition: snapping ? 'transform 0.25s ease' : swiping ? 'none' : undefined,
        }}
        className="relative flex flex-col gap-0.5 bg-background rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/40 active:bg-muted/60 select-none"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-base leading-none shrink-0">{emoji}</span>
          <span className="text-xs text-muted-foreground shrink-0 font-medium">{dateStr}</span>
          <span className="font-medium truncate">{contactName}</span>
        </div>
        <p className="text-xs text-muted-foreground pl-7 truncate">
          {templateLabel ? `${templateLabel} — ` : ''}{excerpt}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AgendaView
// ---------------------------------------------------------------------------

export function AgendaView() {
  const router = useRouter()
  const { data: reminders = [], isLoading } = useAgendaReminders()
  const { data: profile } = useProfile()
  const timezone = profile?.timezone ?? 'Europe/Paris'
  const updateInteraction = useUpdateInteraction()

  const handleMarkDone = useCallback((r: AgendaReminder) => {
    const originalStatus      = r.status
    const originalCompletedAt = r.completed_at

    updateInteraction.mutate({
      id: r.id,
      contactId: r.contact_id,
      data: { status: 'done', completed_at: new Date().toISOString() },
    })

    toast.success('Rappel marqué fait', {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          updateInteraction.mutate({
            id: r.id,
            contactId: r.contact_id,
            data: { status: originalStatus as 'pending' | 'done', completed_at: originalCompletedAt },
          })
        },
      },
    })
  }, [updateInteraction])

  const handlePostpone = useCallback((r: AgendaReminder) => {
    const originalDate = r.date
    const newDate = addDays(new Date(r.date), 7).toISOString()

    updateInteraction.mutate({
      id: r.id,
      contactId: r.contact_id,
      data: { date: newDate },
    })

    toast.info('Rappel reporté d\'une semaine', {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          updateInteraction.mutate({
            id: r.id,
            contactId: r.contact_id,
            data: { date: originalDate },
          })
        },
      },
    })
  }, [updateInteraction])

  const handleTap = useCallback((r: AgendaReminder) => {
    router.push(`/contacts?id=${r.contact_id}`)
  }, [router])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Chargement…
      </div>
    )
  }

  if (reminders.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <CalendarClock className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Aucun rappel en cours. Tu peux en créer depuis la fiche de n&apos;importe quel contact.
        </p>
      </div>
    )
  }

  const groups = groupByUrgency(reminders, timezone)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 max-w-2xl mx-auto w-full">
      {GROUP_META.map(({ key, label }) => {
        const items = groups[key]
        if (items.length === 0) return null

        return (
          <section key={key} className="space-y-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {label} <span className="font-normal">({items.length})</span>
            </h2>
            <div className="space-y-1">
              {items.map((r) => (
                <SwipeableRow
                  key={r.id}
                  reminder={r}
                  timezone={timezone}
                  onMarkDone={handleMarkDone}
                  onPostpone={handlePostpone}
                  onTap={handleTap}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
