'use client'

import { useState } from 'react'
import { useCompletion } from '@ai-sdk/react'
import { Sparkles, Building2, User, RefreshCw, ChevronDown, Clock, AlertCircle, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSupabaseClient } from '@/lib/supabase/context'
import { formatDateTime } from '@/lib/utils'
import { renderMarkdown } from '@/lib/utils/markdown'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Enrichment {
  id: string
  type: 'contact_profile' | 'company_news'
  content: string
  model: string | null
  created_at: string
}

interface AIEnrichmentPanelProps {
  contactId: string
  hasCompany: boolean
  enrichments: Enrichment[]
  /** compact mode for ContactSheet (fewer enrichments shown) */
  compact?: boolean
}

type EnrichType = 'contact_profile' | 'company_news'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIEnrichmentPanel({
  contactId,
  hasCompany,
  enrichments,
  compact = false,
}: AIEnrichmentPanelProps) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()
  const [activeType, setActiveType] = useState<EnrichType | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)

  const { completion, complete, isLoading, setCompletion } = useCompletion({
    api: '/api/ai/enrich',
    streamProtocol: 'text',
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      toast.success(
        activeType === 'contact_profile' ? 'Profil enrichi avec succès' : 'Actualités récupérées'
      )
    },
    onError: (err) => {
      let message = 'Erreur lors de l\'enrichissement IA'
      try {
        const parsed = JSON.parse(err.message) as { error?: string }
        if (parsed.error) message = parsed.error
      } catch {
        if (err.message) message = err.message
      }
      setCompletionError(message)
      toast.error('Erreur lors de l\'enrichissement IA')
    },
  })

  const deleteEnrichment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ai_enrichments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      toast.success('Recherche supprimée')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression')
    },
  })

  const maxHistory = compact ? 2 : 5
  const history = enrichments.slice(0, maxHistory)

  function handleEnrich(type: EnrichType) {
    setCompletion('')
    setActiveType(type)
    setCompletionError(null)
    complete('', { body: { contactId, type } })
  }

  const latestByType = {
    contact_profile: enrichments.find((e) => e.type === 'contact_profile'),
    company_news: enrichments.find((e) => e.type === 'company_news'),
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEnrich('contact_profile')}
          disabled={isLoading}
          className="gap-1.5"
        >
          {isLoading && activeType === 'contact_profile' ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Analyse en cours…
            </>
          ) : (
            <>
              <User className="h-3.5 w-3.5" />
              Profil contact
              {latestByType.contact_profile && (
                <span className="ml-1 text-xs text-muted-foreground">↺</span>
              )}
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEnrich('company_news')}
          disabled={isLoading || !hasCompany}
          className="gap-1.5"
          title={!hasCompany ? 'Ce contact n\'a pas d\'entreprise associée' : undefined}
        >
          {isLoading && activeType === 'company_news' ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Recherche en cours…
            </>
          ) : (
            <>
              <Building2 className="h-3.5 w-3.5" />
              Actualités entreprise
              {latestByType.company_news && (
                <span className="ml-1 text-xs text-muted-foreground">↺</span>
              )}
            </>
          )}
        </Button>
      </div>

      {/* Initial loading (web search in progress, no tokens yet) */}
      {isLoading && !completion && (
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse text-violet-500" />
            <span>
              {activeType === 'contact_profile'
                ? 'Analyse du profil en cours…'
                : 'Recherche d\'actualités en cours…'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Claude effectue une recherche web. Cela peut prendre 15–30 secondes.
          </p>
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      )}

      {/* Error */}
      {completionError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{completionError}</span>
        </div>
      )}

      {/* Streaming / fresh result — shown as soon as first tokens arrive */}
      {completion && (
        <div className="rounded-lg border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className={`h-4 w-4 text-violet-500 ${isLoading ? 'animate-pulse' : ''}`} />
              <Badge variant="secondary" className="gap-1">
                {activeType === 'contact_profile' ? 'Profil contact' : 'Actualités société'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {isLoading ? 'En cours…' : 'Nouveau'}
              </span>
            </div>
          </div>
          <div className="prose-sm text-foreground">
            {renderMarkdown(completion)}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Historique ({history.length})
          </p>
          <Accordion type="single" collapsible className="space-y-1">
            {history.map((e) => (
              <AccordionItem
                key={e.id}
                value={e.id}
                className="rounded-lg border last:!border-b px-3 data-[state=open]:bg-muted/30"
              >
                {/* Wrap trigger + delete button in a flex row — delete sits outside
                    the AccordionTrigger <button> to keep HTML valid (no button-in-button) */}
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <AccordionTrigger className="py-2.5 hover:no-underline">
                      <div className="flex items-center gap-2 text-left">
                        {e.type === 'contact_profile' ? (
                          <User className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        )}
                        <span className="text-xs font-medium">
                          {e.type === 'contact_profile' ? 'Profil contact' : 'Actualités société'}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto mr-2">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(e.created_at)}
                        </span>
                      </div>
                    </AccordionTrigger>
                  </div>
                  <button
                    className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => deleteEnrichment.mutate(e.id)}
                    disabled={deleteEnrichment.isPending && deleteEnrichment.variables === e.id}
                    title="Supprimer cette recherche"
                  >
                    {deleteEnrichment.isPending && deleteEnrichment.variables === e.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
                <AccordionContent className="pt-1 pb-3">
                  <div className="text-sm space-y-0.5">
                    {renderMarkdown(e.content)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {!isLoading && !completion && history.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Lance une analyse pour enrichir ce contact avec des données récentes.
          </p>
        </div>
      )}
    </div>
  )
}
