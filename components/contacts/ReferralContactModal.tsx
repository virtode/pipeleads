'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, Plus, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCreateContact, useUpdateContact, useContacts } from '@/hooks/useContacts'
import { useAssignContactToPipeline } from '@/hooks/usePipelines'
import { useDebounce } from '@/hooks/useDebounce'
import { useSupabaseClient } from '@/lib/supabase/context'
import { getFullName, getInitials } from '@/lib/utils'
import type { Contact, PipelineStage } from '@/types'

// ---------------------------------------------------------------------------
// Schema (Mode B — create)
// ---------------------------------------------------------------------------

const schema = z.object({
  first_name: z.string().min(1, 'Le prénom est obligatoire'),
  last_name: z.string().min(1, 'Le nom est obligatoire'),
  company: z.string().optional(),
  email: z
    .string()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, {
      message: 'Email invalide',
    })
    .optional(),
  phone: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReferralContactModalProps {
  isOpen: boolean
  onClose: () => void
  sourceContact: {
    id: string
    first_name: string
    last_name: string | null
    company: string | null
    notes: string | null
  }
  pipelineId: string
  referralStageId: string
  firstStage: PipelineStage | null
  onSuccess: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReferralContactModal({
  isOpen,
  onClose,
  sourceContact,
  pipelineId,
  referralStageId,
  firstStage,
  onSuccess,
}: ReferralContactModalProps) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const assignContact = useAssignContactToPipeline()

  const [mode, setMode] = useState<'search' | 'create'>('search')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: '', last_name: '', company: '', email: '', phone: '' },
  })

  const isPending = createContact.isPending || updateContact.isPending || assignContact.isPending

  const sourceFullName = getFullName(sourceContact.first_name, sourceContact.last_name)
  const notesRef = `Referral de ${sourceFullName}${
    sourceContact.company ? ` (${sourceContact.company})` : ''
  }`

  // ---------------------------------------------------------------------------
  // Add a "Renvoi vers …" note on the source contact (A) silently
  // ---------------------------------------------------------------------------

  async function addNoteToSource(targetFirstName: string, targetLastName: string | null | undefined, targetCompany: string | null | undefined) {
    const targetFullName = getFullName(targetFirstName, targetLastName ?? null)
    const date = new Date().toLocaleDateString('fr-FR')
    const line = `Renvoi vers ${targetFullName}${targetCompany ? ` (${targetCompany})` : ''} — ${date}`
    const updatedNotes = sourceContact.notes ? `${sourceContact.notes}\n${line}` : line

    // Align with useUpdateContact: filter by id only, let RLS handle tenant isolation.
    // Using .select().single() so a 0-row-affected update surfaces as an error instead
    // of silently returning { data: null, error: null }.
    const { error } = await supabase
      .from('contacts')
      .update({ notes: updatedNotes })
      .eq('id', sourceContact.id)
      .select()
      .single()

    if (error) {
      console.error('[addNoteToSource]', error)
      // Non-blocking — don't abort the whole flow for the source note
    }

    queryClient.invalidateQueries({ queryKey: ['contact', sourceContact.id] })
    queryClient.invalidateQueries({ queryKey: ['contacts'] })
  }

  // Search results — only shown when a query has been typed
  const { data: searchData, isFetching: isSearching } = useContacts({
    filters: { search: debouncedSearch },
    page: 0,
    pageSize: 5,
  })
  const results = debouncedSearch.trim() ? (searchData?.contacts ?? []) : []

  // ---------------------------------------------------------------------------
  // Shared cache flush — called on every success path
  // ---------------------------------------------------------------------------

  function flushCaches() {
    queryClient.invalidateQueries({ queryKey: ['contacts'] })
    queryClient.invalidateQueries({ queryKey: ['pipelines'] })
  }

  // ---------------------------------------------------------------------------
  // Mode transitions
  // ---------------------------------------------------------------------------

  function switchToCreate() {
    const trimmed = search.trim()
    if (trimmed) {
      const [first = '', ...rest] = trimmed.split(/\s+/)
      form.reset({ first_name: first, last_name: rest.join(' '), company: '', email: '', phone: '' })
    } else {
      form.reset({ first_name: '', last_name: '', company: '', email: '', phone: '' })
    }
    setMode('create')
  }

  function switchToSearch() {
    form.reset({ first_name: '', last_name: '', company: '', email: '', phone: '' })
    setMode('search')
  }

  function handleOpenChange(open: boolean) {
    if (!open && !isPending) {
      form.reset()
      setSearch('')
      setMode('search')
      onClose()
    }
  }

  // ---------------------------------------------------------------------------
  // Shared tail: note source + assign both contacts + cache flush
  // Returns false if assignment failed (caller should abort without calling onSuccess).
  // ---------------------------------------------------------------------------

  async function finishReferral(
    targetId: string,
    firstName: string,
    lastName: string | null | undefined,
    company: string | null | undefined,
  ): Promise<boolean> {
    if (!firstStage) {
      toast.warning('Ce pipeline n\'a pas d\'étape active — le contact sera ajouté sans étape.')
    }

    // Write source note first so it's committed before assignContact.onSuccess
    // triggers a cache refetch — avoids a race where the refetch races the write.
    await addNoteToSource(firstName, lastName, company)

    try {
      await Promise.all([
        assignContact.mutateAsync({ contactId: sourceContact.id, pipelineId, stageId: referralStageId }),
        assignContact.mutateAsync({ contactId: targetId, pipelineId, stageId: firstStage?.id ?? null }),
      ])
    } catch {
      // Assignment failed but note was saved — still flush so the note is visible
      flushCaches()
      return false
    }

    flushCaches()
    return true
  }

  // ---------------------------------------------------------------------------
  // Mode A — pick an existing contact
  // ---------------------------------------------------------------------------

  async function handlePickExisting(contact: Contact) {
    const updatedNotes = contact.notes ? `${contact.notes}\n${notesRef}` : notesRef

    try {
      await updateContact.mutateAsync({ id: contact.id, data: { notes: updatedNotes } })
    } catch {
      // useUpdateContact.onError already logs + shows a toast
      return
    }

    if (!await finishReferral(contact.id, contact.first_name, contact.last_name, contact.company)) return

    toast.success(`${getFullName(contact.first_name, contact.last_name)} ajouté comme referral`)
    onSuccess()
  }

  // ---------------------------------------------------------------------------
  // Mode B — create a new contact
  // ---------------------------------------------------------------------------

  async function handleCreate(values: FormValues) {
    let newContact: Awaited<ReturnType<typeof createContact.mutateAsync>>
    try {
      newContact = await createContact.mutateAsync({
        first_name: values.first_name,
        last_name: values.last_name || null,
        company: values.company || null,
        email: values.email ? [values.email] : null,
        phone: values.phone ? [values.phone] : null,
        notes: notesRef,
      })
    } catch {
      // useCreateContact.onError already logs + shows a toast
      return
    }

    if (!await finishReferral(newContact.id, values.first_name, values.last_name, values.company)) return

    form.reset()
    onSuccess()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'search' ? 'Ajouter un referral' : 'Créer un nouveau contact'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'search'
              ? 'Recherchez un contact existant ou créez-en un nouveau.'
              : 'Renseigne les informations du nouveau contact à prospecter.'}
          </DialogDescription>
        </DialogHeader>

        {/* Source contact — read-only, visible in both modes */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Referral de</Label>
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {sourceFullName}
            {sourceContact.company ? ` (${sourceContact.company})` : ''}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* MODE A — search                                                     */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'search' && (
          <div className="space-y-3">
            {/* Search input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {isSearching && debouncedSearch.trim() && (
                <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un contact existant..."
                className="pl-9 pr-8"
              />
            </div>

            {/* Results list */}
            {results.length > 0 && (
              <div className="divide-y overflow-hidden rounded-md border">
                {results.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => handlePickExisting(contact)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Avatar size="sm">
                      <AvatarImage src={contact.photo_url ?? undefined} />
                      <AvatarFallback>
                        {getInitials(contact.first_name, contact.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {contact.first_name} {contact.last_name}
                      </p>
                      {contact.company && (
                        <p className="truncate text-xs text-muted-foreground">{contact.company}</p>
                      )}
                    </div>
                    {isPending && (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Create CTA */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={switchToCreate}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Créer un nouveau contact
            </Button>

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Annuler
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODE B — create                                                     */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'create' && (
          <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-3">
            {/* Back link */}
            <button
              type="button"
              onClick={switchToSearch}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la recherche
            </button>

            {/* Prénom */}
            <div className="space-y-1">
              <Label htmlFor="ref-first-name">
                Prénom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ref-first-name"
                {...form.register('first_name')}
                placeholder="Prénom"
                autoFocus
              />
              {form.formState.errors.first_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.first_name.message}
                </p>
              )}
            </div>

            {/* Nom */}
            <div className="space-y-1">
              <Label htmlFor="ref-last-name">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ref-last-name"
                {...form.register('last_name')}
                placeholder="Nom"
              />
              {form.formState.errors.last_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.last_name.message}
                </p>
              )}
            </div>

            {/* Entreprise */}
            <div className="space-y-1">
              <Label htmlFor="ref-company">Entreprise</Label>
              <Input
                id="ref-company"
                {...form.register('company')}
                placeholder="Entreprise (optionnel)"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="ref-email">Email</Label>
              <Input
                id="ref-email"
                {...form.register('email')}
                type="email"
                placeholder="email@exemple.com (optionnel)"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Téléphone */}
            <div className="space-y-1">
              <Label htmlFor="ref-phone">Téléphone</Label>
              <Input
                id="ref-phone"
                {...form.register('phone')}
                type="tel"
                placeholder="+33 6 00 00 00 00 (optionnel)"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer le contact
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
