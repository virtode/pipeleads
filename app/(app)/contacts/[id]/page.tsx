'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Globe,
  Linkedin, Twitter, Tag, FileText, Pencil, Trash2,
  Sparkles, History, Loader2, ExternalLink,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ContactForm } from '@/components/contacts/ContactForm'
import { AIEnrichmentPanel } from '@/components/contacts/AIEnrichmentPanel'
import { useContact, useDeleteContact } from '@/hooks/useContacts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(first: string, last?: string | null) {
  return `${first.charAt(0)}${last ? last.charAt(0) : ''}`.toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function InfoItem({ icon: Icon, label, children }: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ContactDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [isEditOpen, setIsEditOpen] = useState(false)

  const { data: contact, isLoading } = useContact(id)
  const deleteMutation = useDeleteContact()

  async function handleDelete() {
    await deleteMutation.mutateAsync(id)
    router.push('/contacts')
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">Contact introuvable.</p>
        <Button asChild variant="outline">
          <Link href="/contacts">Retour aux contacts</Link>
        </Button>
      </div>
    )
  }

  const pipelines = 'contact_pipeline' in contact
    ? (contact.contact_pipeline as Array<{
        value: number | null
        pipeline: { id: string; name: string } | null
        stage: { name: string; color: string } | null
      }>)
    : []

  const enrichments = 'ai_enrichments' in contact
    ? (contact.ai_enrichments as Array<{
        id: string
        type: 'contact_profile' | 'company_news'
        content: string
        model: string | null
        created_at: string
      }>)
    : []

  return (
    <div className="mx-auto max-w-4xl space-y-6">

      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/contacts">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Contacts
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Modifier
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleteMutation.isPending}>
                {deleteMutation.isPending
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {contact.first_name} {contact.last_name} sera définitivement supprimé.
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
        </div>
      </div>

      {/* En-tête contact */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={contact.photo_url ?? undefined} />
          <AvatarFallback className="text-lg">
            {getInitials(contact.first_name, contact.last_name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">
            {contact.first_name} {contact.last_name}
          </h1>
          {(contact.job_title || contact.company) && (
            <p className="text-muted-foreground">
              {[contact.job_title, contact.company].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            Créé le {formatDate(contact.created_at)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="pipeline">
            Pipelines {pipelines.length > 0 && `(${pipelines.length})`}
          </TabsTrigger>
          <TabsTrigger value="ai">
            Enrichissements IA {enrichments.length > 0 && `(${enrichments.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Onglet Informations */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">

            {/* Coordonnées */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Coordonnées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(contact.email ?? []).map((e) => (
                  <InfoItem key={e} icon={Mail} label="Email">
                    <a href={`mailto:${e}`} className="text-primary hover:underline">{e}</a>
                  </InfoItem>
                ))}
                {(contact.phone ?? []).map((p) => (
                  <InfoItem key={p} icon={Phone} label="Téléphone">
                    <a href={`tel:${p}`} className="hover:underline">{p}</a>
                  </InfoItem>
                ))}
                {!contact.email?.length && !contact.phone?.length && (
                  <p className="text-sm text-muted-foreground">Aucune coordonnée</p>
                )}
              </CardContent>
            </Card>

            {/* Adresse */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Adresse & Web</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(contact.address || contact.city || contact.country) && (
                  <InfoItem icon={MapPin} label="Adresse">
                    {[contact.address, contact.city, contact.country]
                      .filter(Boolean)
                      .join(', ')}
                  </InfoItem>
                )}
                {contact.linkedin_url && (
                  <InfoItem icon={Linkedin} label="LinkedIn">
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline">
                      Voir le profil <ExternalLink className="h-3 w-3" />
                    </a>
                  </InfoItem>
                )}
                {contact.twitter_url && (
                  <InfoItem icon={Twitter} label="Twitter / X">
                    <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline">
                      Voir le profil <ExternalLink className="h-3 w-3" />
                    </a>
                  </InfoItem>
                )}
                {contact.website && (
                  <InfoItem icon={Globe} label="Site web">
                    <a href={contact.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline">
                      {contact.website} <ExternalLink className="h-3 w-3" />
                    </a>
                  </InfoItem>
                )}
                {!contact.address && !contact.city && !contact.linkedin_url && !contact.website && (
                  <p className="text-sm text-muted-foreground">Aucune info</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tags */}
          {(contact.tags ?? []).length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <InfoItem icon={Tag} label="Tags">
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {contact.tags!.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                </InfoItem>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {contact.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{contact.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Onglet Pipeline */}
        <TabsContent value="pipeline" className="mt-4">
          {pipelines.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Ce contact n'est dans aucun pipeline.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pipelines.map((cp, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{cp.pipeline?.name}</p>
                        {cp.value != null && (
                          <p className="text-xs text-muted-foreground">
                            Valeur : {cp.value.toLocaleString('fr-FR')} €
                          </p>
                        )}
                      </div>
                    </div>
                    {cp.stage ? (
                      <Badge
                        style={{ backgroundColor: cp.stage.color + '22', color: cp.stage.color }}
                        className="border-0"
                      >
                        {cp.stage.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sans étape</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Onglet IA */}
        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardContent className="pt-5">
              <AIEnrichmentPanel
                contactId={id}
                hasCompany={!!contact.company}
                enrichments={enrichments}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog édition */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            contact={contact}
            onSuccess={() => setIsEditOpen(false)}
            onCancel={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
