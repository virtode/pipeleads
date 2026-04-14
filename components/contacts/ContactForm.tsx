'use client'

import { useEffect, useImperativeHandle, forwardRef, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useCreateContact, useUpdateContact, useContactTags } from '@/hooks/useContacts'
import type { Contact } from '@/types'

// ---------------------------------------------------------------------------
// Schema Zod
// ---------------------------------------------------------------------------

const urlOrEmpty = z
  .string()
  .refine((v) => !v || /^https?:\/\/.+/.test(v), {
    message: 'URL invalide (doit commencer par http:// ou https://)',
  })

const contactFormSchema = z.object({
  first_name: z.string().min(1, { message: 'Le prénom est requis' }),
  last_name: z.string(),
  emails: z.array(z.object({ value: z.string().email({ message: 'Email invalide' }) })),
  phones: z.array(z.object({ value: z.string().min(1, { message: 'Numéro requis' }) })),
  company: z.string(),
  job_title: z.string(),
  address: z.string(),
  city: z.string(),
  postal_code: z.string(),
  country: z.string(),
  tags: z.array(z.object({ value: z.string().min(1, { message: 'Tag vide' }) })),
  notes: z.string(),
  linkedin_url: urlOrEmpty,
  twitter_url: urlOrEmpty,
  website: urlOrEmpty,
})

type ContactFormValues = z.infer<typeof contactFormSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFieldArray(arr: string[] | null | undefined) {
  return (arr ?? []).map((v) => ({ value: v }))
}

function getDefaultValues(contact?: Contact | null): ContactFormValues {
  return {
    first_name: contact?.first_name ?? '',
    last_name: contact?.last_name ?? '',
    emails: toFieldArray(contact?.email),
    phones: toFieldArray(contact?.phone),
    company: contact?.company ?? '',
    job_title: contact?.job_title ?? '',
    address: contact?.address ?? '',
    city: contact?.city ?? '',
    postal_code: contact?.postal_code ?? '',
    country: contact?.country ?? '',
    tags: toFieldArray(contact?.tags),
    notes: contact?.notes ?? '',
    linkedin_url: contact?.linkedin_url ?? '',
    twitter_url: contact?.twitter_url ?? '',
    website: contact?.website ?? '',
  }
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export interface ContactFormHandle {
  submit: () => void
}

interface ContactFormProps {
  contact?: Contact | null
  onSuccess: () => void
  onCancel: () => void
  hideActions?: boolean
}

export const ContactForm = forwardRef<ContactFormHandle, ContactFormProps>(
function ContactForm({ contact, onSuccess, onCancel, hideActions }, ref) {
  const createMutation = useCreateContact()
  const updateMutation = useUpdateContact()
  const isPending = createMutation.isPending || updateMutation.isPending
  const { data: allTags = [] } = useContactTags()
  const [hiddenTags, setHiddenTags] = useState<string[]>([])

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: getDefaultValues(contact),
  })

  // Reset form when contact changes (edit → new)
  useEffect(() => {
    form.reset(getDefaultValues(contact))
  }, [contact?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const emailFields = useFieldArray({ control: form.control, name: 'emails' })
  const phoneFields = useFieldArray({ control: form.control, name: 'phones' })
  const tagFields = useFieldArray({ control: form.control, name: 'tags' })

  useImperativeHandle(ref, () => ({
    submit: () => { form.handleSubmit(onSubmit)() },
  }))

  const currentTagValues = form.watch('tags').map((t) => t.value)
  const tagSuggestions = allTags.filter(
    (tag) => !hiddenTags.includes(tag) && !currentTagValues.includes(tag)
  )

  async function onSubmit(values: ContactFormValues) {
    const payload = {
      first_name: values.first_name,
      last_name: values.last_name || null,
      email: values.emails.map((e) => e.value).filter(Boolean),
      phone: values.phones.map((p) => p.value).filter(Boolean),
      company: values.company || null,
      job_title: values.job_title || null,
      address: values.address || null,
      city: values.city || null,
      postal_code: values.postal_code || null,
      country: values.country || null,
      tags: values.tags.map((t) => t.value).filter(Boolean),
      notes: values.notes || null,
      linkedin_url: values.linkedin_url || null,
      twitter_url: values.twitter_url || null,
      website: values.website || null,
    }

    if (contact) {
      await updateMutation.mutateAsync({ id: contact.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

      {/* Identité */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Identité
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="first_name">Prénom *</Label>
            <Input id="first_name" {...form.register('first_name')} />
            {form.formState.errors.first_name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.first_name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last_name">Nom</Label>
            <Input id="last_name" {...form.register('last_name')} />
          </div>
        </div>
      </section>

      <Separator />

      {/* Coordonnées */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Coordonnées
        </h3>

        {/* Emails */}
        <div className="space-y-2">
          <Label>Email(s)</Label>
          {emailFields.fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <Input
                {...form.register(`emails.${index}.value`)}
                type="email"
                placeholder="email@exemple.com"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => emailFields.remove(index)}
                className="shrink-0 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
              {form.formState.errors.emails?.[index]?.value && (
                <p className="col-span-2 text-xs text-destructive">
                  {form.formState.errors.emails[index].value?.message}
                </p>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => emailFields.append({ value: '' })}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter un email
          </Button>
        </div>

        {/* Téléphones */}
        <div className="space-y-2">
          <Label>Téléphone(s)</Label>
          {phoneFields.fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <Input
                {...form.register(`phones.${index}.value`)}
                type="tel"
                placeholder="+33 6 12 34 56 78"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => phoneFields.remove(index)}
                className="shrink-0 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => phoneFields.append({ value: '' })}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter un téléphone
          </Button>
        </div>
      </section>

      <Separator />

      {/* Entreprise */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Entreprise
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="company">Société</Label>
            <Input id="company" {...form.register('company')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job_title">Poste</Label>
            <Input id="job_title" {...form.register('job_title')} />
          </div>
        </div>
      </section>

      <Separator />

      {/* Adresse */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Adresse
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="address">Adresse</Label>
          <Input id="address" {...form.register('address')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" {...form.register('city')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="postal_code">Code postal</Label>
            <Input id="postal_code" {...form.register('postal_code')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Pays</Label>
          <Input id="country" {...form.register('country')} />
        </div>
      </section>

      <Separator />

      {/* Réseaux sociaux */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Réseaux & Web
        </h3>
        <div className="space-y-2">
          {[
            { name: 'linkedin_url' as const, label: 'LinkedIn', placeholder: 'https://linkedin.com/in/…' },
            { name: 'twitter_url' as const, label: 'Twitter / X', placeholder: 'https://x.com/…' },
            { name: 'website' as const, label: 'Site web', placeholder: 'https://…' },
          ].map(({ name, label, placeholder }) => (
            <div key={name} className="space-y-1.5">
              <Label htmlFor={name}>{label}</Label>
              <Input id={name} {...form.register(name)} placeholder={placeholder} />
              {form.formState.errors[name] && (
                <p className="text-xs text-destructive">
                  {form.formState.errors[name]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Tags */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Tags
        </h3>
        {/* Tags sélectionnés */}
        <div className="flex flex-wrap gap-1.5">
          {tagFields.fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-sm">
              <Input
                {...form.register(`tags.${index}.value`)}
                className="h-auto border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                style={{ width: `${(form.watch(`tags.${index}.value`) || 'tag').length + 1}ch` }}
              />
              <button type="button" onClick={() => tagFields.remove(index)}>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => tagFields.append({ value: '' })}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Suggestions */}
        {tagSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tagSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                className="flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground"
                onClick={() => tagFields.append({ value: tag })}
              >
                {tag}
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded-full hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setHiddenTags((prev) => [...prev, tag]) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setHiddenTags((prev) => [...prev, tag]) } }}
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Notes */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Notes
        </h3>
        <Textarea
          {...form.register('notes')}
          placeholder="Notes libres sur ce contact…"
          rows={4}
        />
      </section>

      {/* Actions */}
      {!hideActions && (
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Annuler
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {contact ? 'Enregistrer' : 'Créer le contact'}
          </Button>
        </div>
      )}
    </form>
  )
})
