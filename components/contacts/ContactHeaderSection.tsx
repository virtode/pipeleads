'use client'

import { Loader2, Pencil, Trash2, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { getInitials, getFullName } from '@/lib/utils'

interface ContactHeaderSectionProps {
  contact: {
    first_name: string
    last_name: string | null
    photo_url: string | null
    job_title: string | null
    company: string | null
  }
  mode: 'view' | 'edit'
  isDeletePending: boolean
  onEdit: () => void
  onClose: () => void
  onDelete: () => Promise<void>
}

export function ContactHeaderSection({
  contact,
  mode,
  isDeletePending,
  onEdit,
  onClose,
  onDelete,
}: ContactHeaderSectionProps) {
  if (mode === 'edit') {
    return (
      <div className="shrink-0 border-b px-4 py-2 flex items-center justify-between">
        <h2 className="pl-2 text-base font-semibold">Modifier le contact</h2>
        <button
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-b px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 shrink-0">
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
        {/* Actions header */}
        <div className="flex items-center shrink-0">
          <button
            onClick={onEdit}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Modifier"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted transition-colors text-destructive disabled:opacity-50"
                disabled={isDeletePending}
                aria-label="Supprimer"
              >
                {isDeletePending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
              </button>
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
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
