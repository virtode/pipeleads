'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Mail, Phone, MapPin, Globe, Linkedin, Twitter,
  Tag, FileText, Pencil, Trash2, ExternalLink, Loader2, GitBranch, Plus, X, Paperclip,
} from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ContactForm, type ContactFormHandle } from './ContactForm'
import { AIEnrichmentPanel } from './AIEnrichmentPanel'
import { ContactFiles } from './ContactFiles'
import { useQuery } from '@tanstack/react-query'
import { useContact, useDeleteContact } from '@/hooks/useContacts'
import { usePipelines, useAssignContactToPipeline, useRemoveContactFromPipeline } from '@/hooks/usePipelines'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'


function InfoRow({
  icon: Icon,
  children,
}: {
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1">{children}</span>
    </div>
  )
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
  const [addingPipelineId, setAddingPipelineId] = useState<string | null>(null)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [mounted, setMounted] = useState(false)
  const formRef = useRef<ContactFormHandle>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragStartY = useRef(0)
  const CLOSE_THRESHOLD = 120

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

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    dragStartX.current = e.touches[0].clientX
    dragStartY.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const deltaX = e.touches[0].clientX - dragStartX.current
    const deltaY = e.touches[0].clientY - dragStartY.current

    if (Math.abs(deltaY) > Math.abs(deltaX) && dragX === 0) {
      setIsDragging(false)
      return
    }

    if (deltaX < 0) {
      setDragX(deltaX * 0.3)
    } else {
      setDragX(deltaX)
    }
  }

  const handleSheetTouchEnd = () => {
    setIsDragging(false)
    if (dragX > CLOSE_THRESHOLD) {
      setDragX(window.innerWidth)
      setTimeout(() => {
        onClose()
        setDragX(0)
        setMounted(false)
      }, 250)
    } else {
      setDragX(0)
    }
  }

  const { data: contact, isLoading } = useContact(contactId)
  const deleteMutation = useDeleteContact()
  const { data: allPipelines } = usePipelines()
  const assignContact = useAssignContactToPipeline()
  const removeContact = useRemoveContactFromPipeline()

  // Repasse en mode vue quand on change de contact
  useEffect(() => {
    setMode('view')
    setAddingPipelineId(null)
  }, [contactId])

  // pipelines already containing this contact
  const contactPipelines = ('contact_pipeline' in (contact ?? {}) && Array.isArray((contact as { contact_pipeline?: unknown[] }).contact_pipeline))
    ? (contact as { contact_pipeline: { pipeline: { id: string; name: string } | null; stage: { id: string; name: string; color: string } | null }[] }).contact_pipeline
    : []

  const { data: contactFiles } = useQuery<{ id: string }[]>({
    queryKey: ['contact-files', contactId],
    queryFn: async () => {
      if (!contactId) return []
      const res = await fetch(`/api/contacts/${contactId}/files`)
      if (!res.ok) return []
      const json = await res.json() as { data: { id: string }[] }
      return json.data
    },
    enabled: !!contactId && isOpen,
  })
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
        onTouchStart={handleSheetTouchStart}
        onTouchMove={handleSheetTouchMove}
        onTouchEnd={handleSheetTouchEnd}
      >

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

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
            {mode === 'edit' ? (
              <div className="shrink-0 border-b px-6 py-4">
                <h2 className="text-base font-semibold">Modifier le contact</h2>
              </div>
            ) : (
              <div className="shrink-0 border-b px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={contact.photo_url ?? undefined} />
                    <AvatarFallback>
                      {getInitials(contact.first_name, contact.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold">
                      {contact.first_name} {contact.last_name}
                    </h2>
                    {(contact.job_title || contact.company) && (
                      <p className="truncate text-sm text-muted-foreground">
                        {[contact.job_title, contact.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Edit form */}
            {mode === 'edit' && (
              <div
                className="flex-1 overflow-y-auto px-6 py-4"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
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
                className="shrink-0 overflow-x-auto scrollbar-hide touch-pan-x overscroll-x-contain border-b pb-[3px]"
                onTouchStart={(e) => { e.stopPropagation() }}
                onTouchMove={(e) => { e.stopPropagation() }}
                onTouchEnd={(e) => { e.stopPropagation() }}
              >
                <TabsList
                  variant="line"
                  className="min-w-max w-full justify-start rounded-none border-0 px-6 gap-4 !h-auto py-0"
                >
                  <TabsTrigger value="info" className="relative rounded-none pb-3 pt-2.5 px-0 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    Informations
                  </TabsTrigger>
                  <TabsTrigger value="pipelines" className="relative rounded-none pb-3 pt-2.5 px-0 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    Pipelines{contactPipelines.length > 0 && ` (${contactPipelines.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="relative rounded-none pb-3 pt-2.5 px-0 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    IA{enrichments.length > 0 && ` (${enrichments.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="relative rounded-none pb-3 pt-2.5 px-0 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
                    <span className="relative">
                      Notes
                      {contact.notes && (
                        <span className="absolute -top-0.5 -right-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="relative rounded-none pb-3 pt-2.5 px-0 h-auto flex-shrink-0 whitespace-nowrap !border-b-[3px] border-transparent data-[state=active]:border-primary">
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
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >

                {/* Coordonnées */}
                <section className="space-y-2.5">
                  {(contact.email ?? []).map((e) => (
                    <InfoRow key={e} icon={Mail}>
                      <a href={`mailto:${e}`} className="text-primary hover:underline">{e}</a>
                    </InfoRow>
                  ))}
                  {(contact.phone ?? []).map((p) => (
                    <InfoRow key={p} icon={Phone}>
                      <a href={`tel:${p}`} className="hover:underline">{p}</a>
                    </InfoRow>
                  ))}

                  {(contact.city || contact.postal_code || contact.country) && (
                    <InfoRow icon={MapPin}>
                      {[
                        [contact.postal_code, contact.city].filter(Boolean).join(' ') || null,
                        contact.country,
                      ].filter(Boolean).join(', ')}
                    </InfoRow>
                  )}
                </section>

                {/* Réseaux */}
                {(contact.linkedin_url || contact.twitter_url || contact.website) && (
                  <section className="space-y-2">
                      {contact.linkedin_url && (
                        <InfoRow icon={Linkedin}>
                          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                            LinkedIn <ExternalLink className="h-3 w-3" />
                          </a>
                        </InfoRow>
                      )}
                      {contact.twitter_url && (
                        <InfoRow icon={Twitter}>
                          <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                            Twitter / X <ExternalLink className="h-3 w-3" />
                          </a>
                        </InfoRow>
                      )}
                      {contact.website && (
                        <InfoRow icon={Globe}>
                          <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                            Site web <ExternalLink className="h-3 w-3" />
                          </a>
                        </InfoRow>
                      )}
                  </section>
                )}

                {/* Tags */}
                {(contact.tags ?? []).length > 0 && (
                  <>
                    <section>
                      <InfoRow icon={Tag}>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags!.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </InfoRow>
                    </section>
                  </>
                )}

                {/* Notes */}
                {contact.notes && (
                  <>
                    <Separator />
                    <section>
                      <InfoRow icon={FileText}>
                        <p className="whitespace-pre-wrap text-sm">{contact.notes}</p>
                      </InfoRow>
                    </section>
                  </>
                )}
              </TabsContent>

              {/* Pipelines */}
              <TabsContent
                value="pipelines"
                className="overflow-y-auto h-full px-6 py-5 space-y-2"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <GitBranch className="h-3.5 w-3.5" /> Pipelines
                  </p>
                  {availablePipelines.length > 0 && (
                    <button
                      onClick={() => setAddingPipelineId(availablePipelines[0].id)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Ajouter
                    </button>
                  )}
                </div>

                {/* Existing pipeline entries */}
                {contactPipelines.map((cp, i) => {
                  const pipeline = allPipelines?.find((p) => p.id === cp.pipeline?.id)
                  const stages = pipeline?.pipeline_stages ?? []
                  return (
                    <div key={i} className="rounded-md border px-3 py-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{cp.pipeline?.name}</span>
                        <button
                          onClick={async () => {
                            if (!contactId || !cp.pipeline?.id) return
                            await removeContact.mutateAsync({ contactId, pipelineId: cp.pipeline.id })
                          }}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Retirer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {stages.length > 0 && (
                        <Select
                          value={cp.stage?.id ?? '__none__'}
                          onValueChange={async (v) => {
                            if (!contactId || !cp.pipeline?.id) return
                            const stageId = v === '__none__' ? null : v
                            await assignContact.mutateAsync({
                              contactId,
                              pipelineId: cp.pipeline.id,
                              stageId,
                            })
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Sans étape" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sans étape</SelectItem>
                            {stages.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ backgroundColor: s.color }}
                                  />
                                  {s.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {stages.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          {cp.stage ? (
                            <Badge style={{ backgroundColor: cp.stage.color + '22', color: cp.stage.color }} className="border-0 text-xs">
                              {cp.stage.name}
                            </Badge>
                          ) : 'Sans étape'}
                        </span>
                      )}
                    </div>
                  )
                })}

                {/* Add to new pipeline */}
                {addingPipelineId && (
                  <div className="rounded-md border border-primary/30 px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Select value={addingPipelineId} onValueChange={setAddingPipelineId}>
                        <SelectTrigger className="h-7 text-sm flex-1 mr-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePipelines.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button onClick={() => setAddingPipelineId(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {(() => {
                      const pipe = allPipelines?.find((p) => p.id === addingPipelineId)
                      const stages = pipe?.pipeline_stages ?? []
                      return (
                        <div className="flex items-center gap-2">
                          {stages.length > 0 && (
                            <Select
                              defaultValue="__none__"
                              onValueChange={async (v) => {
                                if (!contactId || !addingPipelineId) return
                                const stageId = v === '__none__' ? null : v
                                await assignContact.mutateAsync({ contactId, pipelineId: addingPipelineId, stageId })
                                setAddingPipelineId(null)
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="Choisir une étape" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sans étape</SelectItem>
                                {stages.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    <span className="flex items-center gap-1.5">
                                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                                      {s.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {stages.length === 0 && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={async () => {
                                if (!contactId || !addingPipelineId) return
                                await assignContact.mutateAsync({ contactId, pipelineId: addingPipelineId, stageId: null })
                                setAddingPipelineId(null)
                              }}
                              disabled={assignContact.isPending}
                            >
                              {assignContact.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmer'}
                            </Button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {contactPipelines.length === 0 && !addingPipelineId && (
                  <p className="text-xs text-muted-foreground italic">
                    Pas encore dans un pipeline.
                  </p>
                )}
              </TabsContent>

              {/* Enrichissements IA — tous, sans limite */}
              <TabsContent
                value="ai"
                className="overflow-y-auto h-full px-6 py-5"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
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
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
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
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <ContactFiles contactId={contact.id} />
              </TabsContent>

              </div>
            </Tabs>}

            {/* Barre d'actions sticky en bas */}
            <div className="shrink-0 border-t bg-background p-4 flex gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              {mode === 'edit' ? (
                <>
                  <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setMode('view')}>
                    Annuler
                  </Button>
                  <Button type="button" className="flex-1 h-12" onClick={() => formRef.current?.submit()}>
                    Enregistrer
                  </Button>
                </>
              ) : (
                <>
                  {/* Supprimer — à gauche, destructif */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="h-12 px-4" disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {contact.first_name} {contact.last_name} sera définitivement supprimé
                          avec tout son historique pipeline.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Modifier — au centre */}
                  <Button variant="outline" className="flex-1 h-12" onClick={() => setMode('edit')}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Modifier
                  </Button>

                  {/* Fermer — à droite */}
                  <Button className="flex-1 h-12" onClick={onClose}>Fermer</Button>
                </>
              )}
            </div>
          </>
        )}

      </div>
    </>
  )
}
