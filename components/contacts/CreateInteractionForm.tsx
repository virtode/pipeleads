'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bell, X } from 'lucide-react'
import { TemplateIcon } from '@/lib/utils/interaction-icons'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useCreateInteraction, useUpdateInteraction } from '@/hooks/useInteractions'
import type { Interaction, ActionTemplate } from '@/lib/types/interactions'
import { ActionTemplateLabels } from '@/lib/types/interactions'
import { addDays, addMonths, format } from 'date-fns'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_PICKS: { label: string; compute: () => Date }[] = [
  { label: '+3j',    compute: () => addDays(new Date(), 3) },
  { label: '+1sem',  compute: () => addDays(new Date(), 7) },
  { label: '+1mois', compute: () => addMonths(new Date(), 1) },
  { label: '+3mois', compute: () => addMonths(new Date(), 3) },
  { label: '+6mois', compute: () => addMonths(new Date(), 6) },
]

const TEMPLATES: ActionTemplate[] = [
  'email_followup', 'call', 'linkedin_message', 'propose_meeting', 'send_document', 'other',
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateInteractionFormProps {
  contactId: string
  autoFocus: boolean
  onFocused?: () => void
  editingInteraction: Interaction | null
  onCancelEdit: () => void
  onSubmitSuccess: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateInteractionForm({
  contactId,
  autoFocus,
  onFocused,
  editingInteraction,
  onCancelEdit,
  onSubmitSuccess,
}: CreateInteractionFormProps) {
  const createInteraction = useCreateInteraction()
  const updateInteraction = useUpdateInteraction()

  const [content, setContent] = useState('')
  const [isReminder, setIsReminder] = useState(false)
  const [pickedQuick, setPickedQuick] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customDateVal, setCustomDateVal] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null)

  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const quickPicksRef = useRef<HTMLDivElement>(null)
  const templatesRef  = useRef<HTMLDivElement>(null)

  // Auto-focus when parent requests it
  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus()
      onFocused?.()
    }
  }, [autoFocus, onFocused])

  // Fill form when editing interaction changes
  useEffect(() => {
    if (!editingInteraction) return
    setContent(editingInteraction.content)
    const isRem = editingInteraction.type === 'reminder'
    setIsReminder(isRem)
    setSelectedDate(isRem ? new Date(editingInteraction.date) : null)
    setPickedQuick(null)
    setShowCustom(isRem)
    setCustomDateVal(isRem ? format(new Date(editingInteraction.date), 'yyyy-MM-dd') : '')
    setSelectedTemplate((editingInteraction.action_template as ActionTemplate | null) ?? null)
    textareaRef.current?.focus()
  }, [editingInteraction])

  const resetForm = useCallback(() => {
    setContent('')
    setIsReminder(false)
    setPickedQuick(null)
    setShowCustom(false)
    setCustomDateVal('')
    setSelectedDate(null)
    setSelectedTemplate(null)
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

  const isPending = createInteraction.isPending || updateInteraction.isPending

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

    if (editingInteraction) {
      await updateInteraction.mutateAsync({ id: editingInteraction.id, contactId, data: payload })
    } else {
      await createInteraction.mutateAsync(payload)
    }
    resetForm()
    onSubmitSuccess()
  }

  return (
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

        {editingInteraction && (
          <button
            type="button"
            onClick={() => { resetForm(); onCancelEdit() }}
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
            {TEMPLATES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedTemplate(selectedTemplate === key ? null : key)}
                className={[
                  'shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
                  selectedTemplate === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:border-primary/50',
                ].join(' ')}
              >
                <TemplateIcon template={key} size={12} />
                {ActionTemplateLabels[key]}
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
          : editingInteraction ? 'Modifier' : 'Ajouter'}
      </Button>
    </div>
  )
}
