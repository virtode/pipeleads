'use client'

import { useState } from 'react'
import { UserPlus, Settings, Layers, ArrowUpRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { ContactSheet } from '@/components/contacts/ContactSheet'
import { ContactPicker } from '@/components/pipeline/ContactPicker'
import { usePipelines, useKanban, useAssignContactToPipeline } from '@/hooks/usePipelines'
import Link from 'next/link'

export default function LeadsPage() {
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines()
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [sheetContactId, setSheetContactId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [showReferrals, setShowReferrals] = useState(false)
  const [showWon, setShowWon] = useState(false)

  const assignContact = useAssignContactToPipeline()

  // Auto-select first pipeline
  const pipelineId =
    selectedPipelineId ??
    (pipelines && pipelines.length > 0 ? pipelines[0].id : null)

  const { data: kanban, isLoading: kanbanLoading } = useKanban(pipelineId)

  const selectedPipeline = pipelines?.find((p) => p.id === pipelineId)
  const hasReferralStages = selectedPipeline?.pipeline_stages?.some((s) => s.is_referral) ?? false
  const hasWonStages = selectedPipeline?.pipeline_stages?.some((s) => s.is_won) ?? false

  function handleCardOpen(contactId: string) {
    setSheetContactId(contactId)
    setIsSheetOpen(true)
  }

  async function handleAddContact(contactId: string, stageId: string | null) {
    if (!pipelineId) return
    await assignContact.mutateAsync({ contactId, pipelineId, stageId })
    setIsPickerOpen(false)
  }

  // No pipelines yet
  if (!pipelinesLoading && (!pipelines || pipelines.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Layers className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <p className="font-medium">Aucun pipeline configuré</p>
          <p className="text-sm text-muted-foreground">
            Crée un pipeline pour utiliser la vue Kanban.
          </p>
        </div>
        <Button asChild>
          <Link href="/pipelines">Gérer les pipelines</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden px-6 pt-6">
      {/* Toolbar */}
      <div className="shrink-0 flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {/* Pipeline selector */}
          {pipelinesLoading ? (
            <Skeleton className="h-9 w-full rounded-md md:w-52" />
          ) : (
            <Select
              value={pipelineId ?? ''}
              onValueChange={(v) => setSelectedPipelineId(v)}
            >
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Choisir un pipeline" />
              </SelectTrigger>
              <SelectContent>
                {(pipelines ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
            {/* Add contact */}
            <Button
              size="sm"
              variant="outline"
              className="w-full md:w-auto"
              onClick={() => setIsPickerOpen(true)}
              disabled={!pipelineId}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              Ajouter un contact
            </Button>

            {/* Referral filter — shown only when the pipeline has referral stages */}
            {hasReferralStages && (
              <Button
                size="sm"
                variant={showReferrals ? 'secondary' : 'outline'}
                className="w-full md:w-auto"
                onClick={() => setShowReferrals((v) => !v)}
              >
                <ArrowUpRight className="mr-1.5 h-4 w-4" />
                {showReferrals ? 'Masquer referrals' : 'Afficher referrals'}
              </Button>
            )}

            {/* Won filter — shown only when the pipeline has won stages */}
            {hasWonStages && (
              <Button
                size="sm"
                variant={showWon ? 'secondary' : 'outline'}
                className="w-full md:w-auto"
                onClick={() => setShowWon((v) => !v)}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                {showWon ? 'Masquer clôtures positives' : 'Afficher clôtures positives'}
              </Button>
            )}

            {/* Manage pipelines */}
            <Button size="sm" variant="ghost" className="hidden md:inline-flex" asChild>
              <Link href="/pipelines">
                <Settings className="mr-1.5 h-4 w-4" />
                Gérer
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban */}
      {kanban ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <KanbanBoard
            data={kanban}
            onCardOpen={handleCardOpen}
            isLoading={kanbanLoading}
            showReferrals={showReferrals}
            showWon={showWon}
          />
        </div>
      ) : kanbanLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex w-72 shrink-0 flex-col gap-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              <div className="min-h-40 rounded-lg bg-muted/30" />
            </div>
          ))}
        </div>
      ) : pipelineId && !kanbanLoading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Pipeline vide — ajoute des contacts pour commencer.
          </p>
          <Button variant="outline" size="sm" onClick={() => setIsPickerOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Ajouter un contact
          </Button>
        </div>
      ) : null}

      {/* Contact sheet */}
      <ContactSheet
        contactId={sheetContactId}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onDeleted={() => setSheetContactId(null)}
      />

      {/* Contact picker dialog */}
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un contact au pipeline</DialogTitle>
            <DialogDescription>
              Sélectionne un contact et optionnellement une étape de départ.
            </DialogDescription>
          </DialogHeader>
          {pipelineId && selectedPipeline && (
            <ContactPicker
              pipeline={selectedPipeline}
              existingContactIds={
                kanban
                  ? [
                      ...kanban.columns.flatMap((c) => c.cards.map((card) => card.contact_id)),
                      ...kanban.unassigned.map((c) => c.contact_id),
                    ]
                  : []
              }
              onSelect={handleAddContact}
              onCancel={() => setIsPickerOpen(false)}
              isLoading={assignContact.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
