'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { Loader2 } from 'lucide-react'
import { useCreateContact } from '@/hooks/useContacts'
import { useAssignContactToPipeline } from '@/hooks/usePipelines'
import { getFullName } from '@/lib/utils'
import type { PipelineStage } from '@/types'

// ---------------------------------------------------------------------------
// Schema
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
  const createContact = useCreateContact()
  const assignContact = useAssignContactToPipeline()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: '', last_name: '', company: '', email: '', phone: '' },
  })

  const isPending = createContact.isPending || assignContact.isPending

  const sourceFullName = getFullName(sourceContact.first_name, sourceContact.last_name)

  async function handleSubmit(values: FormValues) {
    const notesRef = `Referral de ${sourceFullName}${
      sourceContact.company ? ` (${sourceContact.company})` : ''
    }`

    // 1. Create the new follow-up contact
    const newContact = await createContact.mutateAsync({
      first_name: values.first_name,
      last_name: values.last_name || null,
      company: values.company || null,
      email: values.email ? [values.email] : null,
      phone: values.phone ? [values.phone] : null,
      notes: notesRef,
    })

    // Assign both contacts simultaneously — independent rows, no data dependency
    await Promise.all([
      assignContact.mutateAsync({ contactId: sourceContact.id, pipelineId, stageId: referralStageId }),
      assignContact.mutateAsync({ contactId: newContact.id, pipelineId, stageId: firstStage?.id ?? null }),
    ])

    form.reset()
    onSuccess()
  }

  function handleOpenChange(open: boolean) {
    if (!open && !isPending) {
      form.reset()
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Créer le contact de suivi (referral de {sourceFullName})
          </DialogTitle>
          <DialogDescription>
            Renseigne les informations du nouveau contact à prospecter.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
          {/* Referral de (lecture seule) */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Referral de</Label>
            <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {sourceFullName}
              {sourceContact.company ? ` (${sourceContact.company})` : ''}
            </div>
          </div>

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
      </DialogContent>
    </Dialog>
  )
}
