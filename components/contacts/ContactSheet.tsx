'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { FileText, Pencil, Paperclip } from 'lucide-react'
import type { PipelineStage } from '@/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContactForm, type ContactFormHandle } from './ContactForm'
import { AIEnrichmentPanel } from './AIEnrichmentPanel'
import { ContactFiles } from './ContactFiles'
import { ReferralContactModal } from './ReferralContactModal'
import { ContactTimeline } from './ContactTimeline'
import { ContactHeaderSection } from './ContactHeaderSection'
import { ContactInfoSection } from './ContactInfoSection'
import { ContactPipelineSection } from './ContactPipelineSection'
import { useContact, useDeleteContact } from '@/hooks/useContacts'
import { usePipelines } from '@/hooks/usePipelines'
import { useInteractionCount } from '@/hooks/useInteractions'
import { useContactFiles } from '@/hooks/useContactFiles'

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

const CLOSE_THRESHOLD = 120

const noSwipe = {
  onTouchStart: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onTouchMove: (e: { stopPropagation: () => void }) => e.stopPropagation(),
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

interface ContactSheetProps {
  contactId: string | null
  isOpen: boolean
  onClose: () => void
  onDeleted: () => void
}

export function ContactSheet({ contactId, isOpen, onClose, onDeleted }: ContactSheetProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [activeTab, setActiveTab] = useState('info')
  const defaultTabSetRef = useRef(false)
  const focusTimelineRef = useRef(false)
  const [addingPipelineId, setAddingPipelineId] = useState<string | null>(null)

  const [referralPending, setReferralPending] = useState<{
    stageId: string
    pipelineId: string
    stages: PipelineStage[]
  } | null>(null)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [mounted, setMounted] = useState(false)
  const formRef = useRef<ContactFormHandle>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      const scrollY = window.scrollY
      document.body.style.top = `-${scrollY}px`

      setTimeout(() => setMounted(true), 10)

      return () => {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.width = ''
        const top = document.body.style.top
        document.body.style.top = ''
        window.scrollTo(0, parseInt(top || '0') * -1)
      }
    } else {
      setMounted(false)
    }
  }, [isOpen])

  // Native listeners with { passive: false } so we can call e.preventDefault()
  // on horizontal swipes, preventing iOS from routing them to the table scroll context.
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet || !isOpen) return

    let startX = 0
    let startY = 0
    let currentDragX = 0
    let committed = false
    let noClose = false

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      currentDragX = 0
      committed = false
      // Touch originated inside the tab bar — let it scroll natively, don't intercept
      noClose = !!(tabBarRef.current && tabBarRef.current.contains(e.target as Node))
    }

    const onMove = (e: TouchEvent) => {
      if (noClose) return // tab bar is handling this scroll
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY

      if (!committed) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return // not enough movement yet
        if (Math.abs(dy) >= Math.abs(dx)) return // vertical dominant — let content scroll
        if (dx <= 0) return // leftward only — not a close gesture
        committed = true
        setIsDragging(true)
      }

      e.preventDefault() // prevent iOS from routing this touch to a scroll context
      currentDragX = dx < 0 ? dx * 0.3 : dx
      setDragX(currentDragX)
    }

    const onEnd = () => {
      const wasDragging = committed
      committed = false
      setIsDragging(false)
      if (!wasDragging) return
      if (currentDragX > CLOSE_THRESHOLD) {
        setDragX(window.innerWidth)
        setTimeout(() => {
          onCloseRef.current()
          setDragX(0)
          setMounted(false)
        }, 250)
      } else {
        setDragX(0)
      }
    }

    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd, { passive: true })

    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
    }
  }, [isOpen])

  const { data: contact, isLoading } = useContact(contactId)
  const { data: interactionCount } = useInteractionCount(contactId)
  const deleteMutation = useDeleteContact()
  const { data: allPipelines } = usePipelines()

  // Repasse en mode vue quand on change de contact + reset onglet par défaut
  useEffect(() => {
    setMode('view')
    setAddingPipelineId(null)
    defaultTabSetRef.current = false
    setActiveTab('info')
  }, [contactId])

  // Onglet par défaut conditionnel : Timeline si interactions ≥ 1
  useEffect(() => {
    if (defaultTabSetRef.current || interactionCount === undefined) return
    defaultTabSetRef.current = true
    setActiveTab(interactionCount > 0 ? 'timeline' : 'info')
  }, [interactionCount])

  // pipelines already containing this contact
  const contactPipelines = ('contact_pipeline' in (contact ?? {}) && Array.isArray((contact as { contact_pipeline?: unknown[] }).contact_pipeline))
    ? (contact as { contact_pipeline: { pipeline: { id: string; name: string } | null; stage: { id: string; name: string; color: string } | null }[] }).contact_pipeline
    : []

  const { data: contactFiles } = useContactFiles(contactId, isOpen)
  const fileCount = contactFiles?.length ?? 0

  const assignedPipelineIds = contactPipelines.map((cp) => cp.pipeline?.id).filter(Boolean) as string[]
  const availablePipelines = (allPipelines ?? []).filter((p) => !assignedPipelineIds.includes(p.id))

  const enrichments = (contact && 'ai_enrichments' in contact && Array.isArray(contact.ai_enrichments))
    ? (contact.ai_enrichments as Array<{
        id: string
        type: 'contact_profile' | 'company_news'
        content: string
        model: string | null
        created_at: string
      }>)
    : []

  async function handleDelete() {
    if (!contactId) return
    await deleteMutation.mutateAsync(contactId)
    onDeleted()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Referral contact modal */}
      {referralPending && contact && (
        <Suspense fallback={null}>
          <ReferralContactModal
            isOpen={true}
            onClose={() => setReferralPending(null)}
            sourceContact={{
              id: contact.id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              company: contact.company,
              notes: contact.notes ?? null,
            }}
            pipelineId={referralPending.pipelineId}
            referralStageId={referralPending.stageId}
            firstStage={
              referralPending.stages.find((s) => !s.is_referral && !s.is_lost) ?? null
            }
            onSuccess={() => setReferralPending(null)}
          />
        </Suspense>
      )}

      {/* Overlay / backdrop */}
      <div
        className="fixed top-0 left-0 right-0 bottom-0 h-[100dvh] z-40 bg-black/50"
        style={{
          opacity: Math.max(0, 1 - dragX / 300),
          transition: isDragging ? 'none' : 'opacity 0.3s ease',
        }}
        onClick={onClose}
      />

      {/* Panneau de la fiche */}
      <div
        ref={sheetRef}
        className="fixed top-0 right-0 h-[100dvh] z-50 w-full sm:max-w-[480px] bg-background shadow-xl flex flex-col"
        style={{
          transform: mounted ? `translateX(${dragX}px)` : 'translateX(100%)',
          transition: isDragging
            ? 'none'
            : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >

        {isLoading || !contact ? (
          <div className="flex flex-1 flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Header */}
            <ContactHeaderSection
              contact={contact}
              mode={mode}
              isDeletePending={deleteMutation.isPending}
              onEdit={() => setMode('edit')}
              onClose={onClose}
              onDelete={handleDelete}
            />

            {/* Edit form */}
            {mode === 'edit' && (
              <div
                className="flex-1 overflow-y-auto px-6 py-4"
                {...noSwipe}
              >
                <ContactForm
                  ref={formRef}
                  hideActions={true}
                  contact={contact}
                  onSuccess={() => setMode('view')}
                  onCancel={() => setMode('view')}
                />
              </div>
            )}

            {/* Tabbed content (view mode only) */}
            {mode === 'view' && <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0 gap-0">
              <div
                ref={tabBarRef}
                className="shrink-0 overflow-x-auto scrollbar-hide touch-pan-x overscroll-x-contain border-b pb-[3px]"
              >
                <TabsList
                  variant="line"
                  className="min-w-max w-full justify-start rounded-none border-0 px-2 !h-auto py-0"
                >
                  <TabsTrigger value="info" className="relative rounded-none pb-3 pt-2.5 px-4 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    Informations
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="relative rounded-none pb-3 pt-2.5 px-4 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    <span className="relative">
                      Timeline
                      {(interactionCount ?? 0) > 0 && (
                        <span className="absolute -top-0.5 -right-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="pipelines" className="relative rounded-none pb-3 pt-2.5 px-4 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    Pipelines
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="relative rounded-none pb-3 pt-2.5 px-4 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    IA
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="relative rounded-none pb-3 pt-2.5 px-4 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    <span className="relative">
                      Notes
                      {contact.notes && (
                        <span className="absolute -top-0.5 -right-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="relative rounded-none pb-3 pt-2.5 px-4 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    <Paperclip className="mr-1 h-3.5 w-3.5" />
                    Documents{fileCount > 0 && ` (${fileCount})`}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden min-h-0 flex flex-col">

              {/* Informations */}
              <TabsContent
                value="info"
                className="overflow-y-auto h-full space-y-5 px-6 py-5"
                {...noSwipe}
              >
                <ContactInfoSection
                  contact={contact}
                  interactionCount={interactionCount}
                  onAddInteraction={() => {
                    setActiveTab('timeline')
                    focusTimelineRef.current = true
                  }}
                />
              </TabsContent>

              {/* Timeline */}
              <TabsContent
                value="timeline"
                className="h-full overflow-hidden flex flex-col"
                {...noSwipe}
              >
                <ContactTimeline
                  contactId={contact.id}
                  autoFocus={focusTimelineRef.current}
                  onFocused={() => { focusTimelineRef.current = false }}
                />
              </TabsContent>

              {/* Pipelines */}
              <TabsContent
                value="pipelines"
                className="overflow-y-auto h-full px-6 py-5 space-y-2"
                {...noSwipe}
              >
                {contactId && (
                  <ContactPipelineSection
                    contactId={contactId}
                    contactPipelines={contactPipelines}
                    allPipelines={allPipelines}
                    availablePipelines={availablePipelines}
                    addingPipelineId={addingPipelineId}
                    setAddingPipelineId={setAddingPipelineId}
                    onReferralPending={setReferralPending}
                  />
                )}
              </TabsContent>

              {/* Enrichissements IA — tous, sans limite */}
              <TabsContent
                value="ai"
                className="overflow-y-auto h-full px-6 py-5"
                {...noSwipe}
              >
                <AIEnrichmentPanel
                  contactId={contact.id}
                  hasCompany={!!contact.company}
                  enrichments={enrichments}
                />
              </TabsContent>

              {/* Notes */}
              <TabsContent
                value="notes"
                className="overflow-y-auto h-full px-6 py-5 space-y-3"
                {...noSwipe}
              >
                {contact.notes ? (
                  <>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMode('edit')}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Modifier
                      </Button>
                    </div>
                    <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                      {contact.notes}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Aucune note</p>
                  </div>
                )}
              </TabsContent>

              {/* Documents */}
              <TabsContent
                value="documents"
                className="overflow-y-auto h-full px-6 py-5"
                {...noSwipe}
              >
                <ContactFiles contactId={contact.id} />
              </TabsContent>

              </div>
            </Tabs>}

            {/* Barre d'actions — mode édition uniquement */}
            {mode === 'edit' && (
              <div className="shrink-0 border-t bg-background p-4 flex gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setMode('view')}>
                  Annuler
                </Button>
                <Button type="button" className="flex-1 h-12" onClick={() => formRef.current?.submit()}>
                  Enregistrer
                </Button>
              </div>
            )}
          </>
        )}

      </div>
    </>
  )
}
