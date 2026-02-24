'use client'

import { useState } from 'react'
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
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Lightweight inline markdown renderer
// (no extra dependency — handles bold, headers, bullets, links)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let listBuffer: string[] = []
  let key = 0

  function flushList() {
    if (listBuffer.length > 0) {
      nodes.push(
        <ul key={key++} className="my-1.5 space-y-0.5 pl-4">
          {listBuffer.map((item, i) => (
            <li key={i} className="flex gap-1.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      )
      listBuffer = []
    }
  }

  for (const line of lines) {
    // Heading ## or ###
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      nodes.push(
        <p key={key++} className={`mt-3 mb-1 font-semibold ${level === 2 ? 'text-sm' : 'text-xs uppercase tracking-wide text-muted-foreground'}`}>
          {inlineFormat(headingMatch[2])}
        </p>
      )
      continue
    }

    // Bullet item
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/)
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1])
      continue
    }

    flushList()

    if (line.trim() === '') {
      nodes.push(<div key={key++} className="h-1" />)
    } else {
      nodes.push(
        <p key={key++} className="text-sm leading-relaxed">{inlineFormat(line)}</p>
      )
    }
  }

  flushList()
  return nodes
}

function inlineFormat(text: string): React.ReactNode {
  // Split on **bold**, *italic*, and [link](url)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {linkMatch[1]}
        </a>
      )
    }
    return part
  })
}

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
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState<EnrichType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [freshResult, setFreshResult] = useState<Enrichment | null>(null)

  const deleteEnrichment = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
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

  async function handleEnrich(type: EnrichType) {
    setLoading(type)
    setError(null)
    setFreshResult(null)

    try {
      const res = await fetch('/api/ai/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, type }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error ?? 'Erreur inconnue')
        return
      }

      const result: Enrichment = {
        id: json.data.id,
        type,
        content: json.data.content,
        model: 'claude-sonnet-4-6',
        created_at: json.data.created_at,
      }
      setFreshResult(result)

      // Refresh contact data so the parent re-renders with the new enrichment
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
      toast.success(type === 'contact_profile' ? 'Profil enrichi avec succès' : 'Actualités récupérées')

      // Notify if fields were auto-filled
      const updatedFields: string[] = json.data.updated_fields ?? []
      if (updatedFields.length > 0) {
        const FIELD_LABELS: Record<string, string> = {
          linkedin_url: 'LinkedIn',
          twitter_url: 'Twitter/X',
          email: 'Email',
          website: 'Site web',
        }
        const labels = updatedFields.map((f) => FIELD_LABELS[f] ?? f)
        toast.info(
          `Fiche mise à jour : ${labels.join(', ')} ajouté${labels.length > 1 ? 's' : ''}`
        )
      }
    } catch {
      setError('Erreur réseau — vérifie ta connexion.')
      toast.error('Erreur lors de l\'enrichissement IA')
    } finally {
      setLoading(null)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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
          disabled={loading !== null}
          className="gap-1.5"
        >
          {loading === 'contact_profile' ? (
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
          disabled={loading !== null || !hasCompany}
          className="gap-1.5"
          title={!hasCompany ? 'Ce contact n\'a pas d\'entreprise associée' : undefined}
        >
          {loading === 'company_news' ? (
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

      {/* Loading indicator */}
      {loading && (
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse text-violet-500" />
            <span>
              {loading === 'contact_profile'
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
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Fresh result (just returned, shown prominently) */}
      {freshResult && (
        <div className="rounded-lg border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <Badge variant="secondary" className="gap-1">
                {freshResult.type === 'contact_profile' ? 'Profil contact' : 'Actualités société'}
              </Badge>
              <span className="text-xs text-muted-foreground">Nouveau</span>
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDate(freshResult.created_at)}
            </span>
          </div>
          <div className="prose-sm text-foreground">
            {renderMarkdown(freshResult.content)}
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
                      {formatDate(e.created_at)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-3">
                  <div className="text-sm space-y-0.5">
                    {renderMarkdown(e.content)}
                  </div>
                  <div className="mt-3 flex justify-end border-t pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteEnrichment.mutate(e.id)}
                      disabled={deleteEnrichment.isPending && deleteEnrichment.variables === e.id}
                    >
                      {deleteEnrichment.isPending && deleteEnrichment.variables === e.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                      Supprimer
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {!loading && !freshResult && history.length === 0 && (
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
