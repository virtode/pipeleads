'use client'

import { useState, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Upload, CheckCircle2, XCircle, Loader2, User } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { parseVCF, type ImportContactDto } from '@/lib/import/vcf'
import { useSupabaseClient } from '@/lib/supabase/context'
import { useQueryClient } from '@tanstack/react-query'

type Step = 'upload' | 'preview' | 'importing' | 'done'

interface ImportResult {
  created: number
  errors: number
  errorMessages: string[]
}

interface ImportVCFDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Virtualized preview list
// ---------------------------------------------------------------------------

function VirtualContactList({ contacts }: { contacts: ImportContactDto[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  })

  return (
    <div
      ref={parentRef}
      className="max-h-64 overflow-auto rounded-md border"
    >
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
        className="p-2"
      >
        {virtualizer.getVirtualItems().map((vItem) => {
          const c = contacts[vItem.index]
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
          const detail = [c.company, c.email?.[0]].filter(Boolean).join(' · ')
          return (
            <div
              key={vItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vItem.start}px)`,
              }}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted/50"
            >
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                {detail && <p className="text-xs text-muted-foreground truncate">{detail}</p>}
              </div>
              {c.tags && c.tags.length > 0 && (
                <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
                  {c.tags.length} tag{c.tags.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export function ImportVCFDialog({ open, onOpenChange }: ImportVCFDialogProps) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<Step>('upload')
  const [contacts, setContacts] = useState<ImportContactDto[]>([])
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetState() {
    setStep('upload')
    setContacts([])
    setProgress(0)
    setResult(null)
  }

  function handleClose(open: boolean) {
    if (!open) resetState()
    onOpenChange(open)
  }

  function readFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseVCF(text)
      setContacts(parsed)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.vcf') || file.name.endsWith('.vcard'))) {
      readFile(file)
    }
  }, [])

  async function startImport() {
    setStep('importing')
    setProgress(0)

    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? ''
    const result: ImportResult = { created: 0, errors: 0, errorMessages: [] }

    for (let i = 0; i < contacts.length; i++) {
      try {
        const { error } = await supabase
          .from('contacts')
          .insert({ ...contacts[i], user_id: userId })

        if (error) throw error
        result.created++
      } catch (err) {
        result.errors++
        const msg = err instanceof Error ? err.message : String(err)
        if (result.errorMessages.length < 5) {
          const name = [contacts[i].first_name, contacts[i].last_name].filter(Boolean).join(' ')
          result.errorMessages.push(`${name || `Contact ${i + 1}`}: ${msg}`)
        }
      }

      setProgress(Math.round(((i + 1) / contacts.length) * 100))
    }

    queryClient.invalidateQueries({ queryKey: ['contacts'] })
    queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
    setResult(result)
    setStep('done')
    toast.success(
      `Import VCF terminé — ${result.created} contact${result.created !== 1 ? 's' : ''} importé${result.created !== 1 ? 's' : ''}` +
      (result.errors > 0 ? `, ${result.errors} erreur${result.errors !== 1 ? 's' : ''}` : '')
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {/* Step: upload */}
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle>Importer des contacts (VCF)</DialogTitle>
              <DialogDescription>
                Formats supportés : vCard 2.1, 3.0 et 4.0. Un fichier peut contenir plusieurs contacts.
              </DialogDescription>
            </DialogHeader>

            <div
              className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Glisse ton fichier VCF ici</p>
                <p className="text-xs text-muted-foreground mt-1">ou clique pour parcourir</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".vcf,.vcard"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Annuler
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step: preview */}
        {step === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle>Aperçu de l&apos;importation</DialogTitle>
              <DialogDescription>
                {contacts.length} contact{contacts.length > 1 ? 's' : ''} détecté{contacts.length > 1 ? 's' : ''} dans le fichier.
              </DialogDescription>
            </DialogHeader>

            {contacts.length === 0 ? (
              <div className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
                Aucun contact valide trouvé dans ce fichier.
              </div>
            ) : (
              <VirtualContactList contacts={contacts} />
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Retour
              </Button>
              <Button onClick={startImport} disabled={contacts.length === 0}>
                Importer {contacts.length} contact{contacts.length > 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step: importing */}
        {step === 'importing' && (
          <>
            <DialogHeader>
              <DialogTitle>Importation en cours…</DialogTitle>
              <DialogDescription>
                Veuillez patienter, ne fermez pas cette fenêtre.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <Progress value={progress} />
              <p className="text-center text-sm text-muted-foreground">{progress}%</p>
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            </div>
          </>
        )}

        {/* Step: done */}
        {step === 'done' && result && (
          <>
            <DialogHeader>
              <DialogTitle>Importation terminée</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <p className="text-sm font-medium">
                  {result.created} contact{result.created > 1 ? 's' : ''} importé{result.created > 1 ? 's' : ''}
                </p>
              </div>
              {result.errors > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    <p className="text-sm font-medium text-destructive">
                      {result.errors} erreur{result.errors > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="rounded-md bg-destructive/10 p-2 space-y-0.5">
                    {result.errorMessages.map((msg, i) => (
                      <p key={i} className="text-xs text-destructive">{msg}</p>
                    ))}
                    {result.errors > result.errorMessages.length && (
                      <p className="text-xs text-muted-foreground">
                        …et {result.errors - result.errorMessages.length} autre(s)
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Fermer</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
