'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  parseCSV,
  autoDetectMapping,
  mapCSVToContacts,
  CSV_CONTACT_FIELDS,
  type CsvContactMapping,
  type CsvRow,
} from '@/lib/import/csv'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useStytchSession } from '@stytch/nextjs'
import { useQueryClient } from '@tanstack/react-query'

type Step = 'upload' | 'mapping' | 'options' | 'importing' | 'done'
type DuplicateStrategy = 'skip' | 'overwrite' | 'create'

interface ImportResult {
  created: number
  skipped: number
  errors: number
  errorMessages: string[]
}

interface ImportCSVDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NONE_VALUE = '__none__'

export function ImportCSVDialog({ open, onOpenChange }: ImportCSVDialogProps) {
  const { session } = useStytchSession()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<Step>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<CsvContactMapping>({})
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetState() {
    setStep('upload')
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setDuplicateStrategy('skip')
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
      const { headers, rows } = parseCSV(text)
      setCsvHeaders(headers)
      setCsvRows(rows)
      setMapping(autoDetectMapping(headers))
      setStep('mapping')
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
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      readFile(file)
    }
  }, [])

  function setMappingField(contactField: keyof CsvContactMapping, csvColumn: string) {
    setMapping((prev) => {
      const next = { ...prev }
      // Remove any existing mapping to this csv column for OTHER fields
      for (const k of Object.keys(next) as (keyof CsvContactMapping)[]) {
        if (next[k] === csvColumn && k !== contactField) {
          delete next[k]
        }
      }
      if (csvColumn === NONE_VALUE) {
        delete next[contactField]
      } else {
        next[contactField] = csvColumn
      }
      return next
    })
  }

  async function startImport() {
    if (!session) return
    setStep('importing')
    setProgress(0)

    const contacts = mapCSVToContacts(csvRows, mapping)
    const userId = session.user_id
    const supabase = createClient()

    const result: ImportResult = { created: 0, skipped: 0, errors: 0, errorMessages: [] }

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]

      try {
        if (duplicateStrategy !== 'create' && contact.email && contact.email.length > 0) {
          // Check for existing contact by email overlap
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', userId)
            .overlaps('email', contact.email)
            .maybeSingle()

          if (existing) {
            if (duplicateStrategy === 'skip') {
              result.skipped++
              setProgress(Math.round(((i + 1) / contacts.length) * 100))
              continue
            } else if (duplicateStrategy === 'overwrite') {
              const { error } = await supabase
                .from('contacts')
                .update({ ...contact, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
              if (error) throw error
              result.created++ // count as upsert
              setProgress(Math.round(((i + 1) / contacts.length) * 100))
              continue
            }
          }
        }

        const { error } = await supabase
          .from('contacts')
          .insert({ ...contact, user_id: userId })

        if (error) throw error
        result.created++
      } catch (err) {
        result.errors++
        const msg = err instanceof Error ? err.message : String(err)
        if (result.errorMessages.length < 5) {
          result.errorMessages.push(`Ligne ${i + 1}: ${msg}`)
        }
      }

      setProgress(Math.round(((i + 1) / contacts.length) * 100))
    }

    queryClient.invalidateQueries({ queryKey: ['contacts'] })
    queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
    setResult(result)
    setStep('done')
    toast.success(
      `Import terminé — ${result.created} créé${result.created !== 1 ? 's' : ''}` +
      (result.skipped > 0 ? `, ${result.skipped} ignoré${result.skipped !== 1 ? 's' : ''}` : '') +
      (result.errors > 0 ? `, ${result.errors} erreur${result.errors !== 1 ? 's' : ''}` : '')
    )
  }

  const mappedCount = Object.keys(mapping).length
  const previewRows = csvRows.slice(0, 3)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {/* Step: upload */}
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle>Importer des contacts (CSV)</DialogTitle>
              <DialogDescription>
                Formats acceptés : CSV séparé par virgule, point-virgule ou tabulation.
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
                <p className="text-sm font-medium">Glisse ton fichier CSV ici</p>
                <p className="text-xs text-muted-foreground mt-1">ou clique pour parcourir</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
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

        {/* Step: mapping */}
        {step === 'mapping' && (
          <>
            <DialogHeader>
              <DialogTitle>Associer les colonnes</DialogTitle>
              <DialogDescription>
                {csvRows.length} ligne{csvRows.length > 1 ? 's' : ''} détectée{csvRows.length > 1 ? 's' : ''} —
                associe chaque champ CRM à une colonne du fichier.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {CSV_CONTACT_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <Label className="w-32 shrink-0 text-sm">{label}</Label>
                  <Select
                    value={mapping[key] ?? NONE_VALUE}
                    onValueChange={(v) => setMappingField(key, v)}
                  >
                    <SelectTrigger className="flex-1 h-8 text-sm">
                      <SelectValue placeholder="— ignorer —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>— ignorer —</SelectItem>
                      {csvHeaders.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {previewRows.length > 0 && mapping.first_name && (
              <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
                <p className="font-medium text-muted-foreground mb-1">Aperçu ({previewRows.length} première{previewRows.length > 1 ? 's' : ''} ligne{previewRows.length > 1 ? 's' : ''})</p>
                {previewRows.map((row, i) => (
                  <p key={i} className="truncate">
                    {[
                      mapping.first_name && row[mapping.first_name],
                      mapping.last_name  && row[mapping.last_name],
                      mapping.email      && row[mapping.email],
                    ].filter(Boolean).join(' · ')}
                  </p>
                ))}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('upload')} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Retour
              </Button>
              <Button onClick={() => setStep('options')} disabled={mappedCount === 0} className="gap-1">
                Suivant <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step: options */}
        {step === 'options' && (
          <>
            <DialogHeader>
              <DialogTitle>Options d&apos;importation</DialogTitle>
              <DialogDescription>
                {csvRows.length} contact{csvRows.length > 1 ? 's' : ''} à importer — {mappedCount} champ{mappedCount > 1 ? 's' : ''} associé{mappedCount > 1 ? 's' : ''}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm font-medium">Gestion des doublons</p>
              <p className="text-xs text-muted-foreground">
                Un doublon est détecté lorsqu&apos;un contact existant partage au moins un email.
              </p>
              <RadioGroup
                value={duplicateStrategy}
                onValueChange={(v) => setDuplicateStrategy(v as DuplicateStrategy)}
                className="space-y-2"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="skip" id="dup-skip" className="mt-0.5" />
                  <div>
                    <Label htmlFor="dup-skip" className="font-normal cursor-pointer">Ignorer les doublons</Label>
                    <p className="text-xs text-muted-foreground">Les contacts existants ne sont pas modifiés.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="overwrite" id="dup-over" className="mt-0.5" />
                  <div>
                    <Label htmlFor="dup-over" className="font-normal cursor-pointer">Mettre à jour les doublons</Label>
                    <p className="text-xs text-muted-foreground">Les données importées écrasent les champs existants.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="create" id="dup-create" className="mt-0.5" />
                  <div>
                    <Label htmlFor="dup-create" className="font-normal cursor-pointer">Créer quand même</Label>
                    <p className="text-xs text-muted-foreground">Importe tous les contacts sans vérification.</p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('mapping')} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Retour
              </Button>
              <Button onClick={startImport} className="gap-1">
                Importer <ChevronRight className="h-4 w-4" />
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
              <p className="text-center text-sm text-muted-foreground">
                {progress}%
              </p>
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
                <div>
                  <p className="text-sm font-medium">{result.created} contact{result.created > 1 ? 's' : ''} importé{result.created > 1 ? 's' : ''}</p>
                </div>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{result.skipped} ignoré{result.skipped > 1 ? 's' : ''}</Badge>
                  <p className="text-sm text-muted-foreground">doublons détectés</p>
                </div>
              )}
              {result.errors > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    <p className="text-sm font-medium text-destructive">{result.errors} erreur{result.errors > 1 ? 's' : ''}</p>
                  </div>
                  <div className="rounded-md bg-destructive/10 p-2 space-y-0.5">
                    {result.errorMessages.map((msg, i) => (
                      <p key={i} className="text-xs text-destructive">{msg}</p>
                    ))}
                    {result.errors > result.errorMessages.length && (
                      <p className="text-xs text-muted-foreground">…et {result.errors - result.errorMessages.length} autre(s)</p>
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
