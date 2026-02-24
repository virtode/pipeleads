'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useContacts } from '@/hooks/useContacts'
import { useDebounce } from '@/hooks/useDebounce'
import type { PipelineWithStages } from '@/hooks/usePipelines'
import type { Contact } from '@/types'

const NO_STAGE = '__none__'

interface ContactPickerProps {
  pipeline: PipelineWithStages
  existingContactIds: string[]
  onSelect: (contactId: string, stageId: string | null) => void
  onCancel: () => void
  isLoading?: boolean
}

function getInitials(first: string, last?: string | null) {
  return `${first.charAt(0)}${last ? last.charAt(0) : ''}`.toUpperCase()
}

export function ContactPicker({
  pipeline,
  existingContactIds,
  onSelect,
  onCancel,
  isLoading,
}: ContactPickerProps) {
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [selectedStageId, setSelectedStageId] = useState<string>(NO_STAGE)

  const debouncedSearch = useDebounce(search, 250)

  const { data } = useContacts({
    filters: { search: debouncedSearch },
    page: 0,
  })

  const contacts = (data?.contacts ?? []).filter(
    (c) => !existingContactIds.includes(c.id)
  )

  function handleConfirm() {
    if (!selectedContact) return
    const stageId = selectedStageId === NO_STAGE ? null : selectedStageId
    onSelect(selectedContact.id, stageId)
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un contact…"
          className="pl-9"
          autoFocus
        />
      </div>

      {/* Contact list */}
      <ScrollArea className="h-52 rounded-md border">
        {contacts.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
            {search ? 'Aucun résultat' : 'Tous les contacts sont déjà dans ce pipeline'}
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => setSelectedContact(contact)}
                className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted ${
                  selectedContact?.id === contact.id ? 'bg-primary/10 ring-1 ring-primary/20' : ''
                }`}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={contact.photo_url ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(contact.first_name, contact.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {contact.first_name} {contact.last_name}
                  </p>
                  {contact.company && (
                    <p className="truncate text-xs text-muted-foreground">{contact.company}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Stage selector */}
      {pipeline.pipeline_stages.length > 0 && (
        <div className="space-y-1.5">
          <Label>Étape de départ</Label>
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_STAGE}>— Sans étape —</SelectItem>
              {pipeline.pipeline_stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button onClick={handleConfirm} disabled={!selectedContact || isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Ajouter
        </Button>
      </div>
    </div>
  )
}
