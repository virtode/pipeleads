'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { CSV_EXPORT_FIELDS, exportContactsToCSV } from '@/lib/export/csv'
import { exportContactsToVCF } from '@/lib/export/vcf'
import type { Contact } from '@/types'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allContacts: Contact[]
  selectedContacts: Contact[]
}

export function ExportDialog({
  open,
  onOpenChange,
  allContacts,
  selectedContacts,
}: ExportDialogProps) {
  const [scope, setScope] = useState<'all' | 'selected'>('all')
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(CSV_EXPORT_FIELDS.map((f) => f.key))
  )

  const hasSelection = selectedContacts.length > 0
  const contactsToExport = scope === 'selected' ? selectedContacts : allContacts

  function toggleField(key: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key) // keep at least 1
      } else {
        next.add(key)
      }
      return next
    })
  }

  function toggleAll() {
    if (selectedFields.size === CSV_EXPORT_FIELDS.length) {
      setSelectedFields(new Set([CSV_EXPORT_FIELDS[0].key]))
    } else {
      setSelectedFields(new Set(CSV_EXPORT_FIELDS.map((f) => f.key)))
    }
  }

  function handleCSV() {
    exportContactsToCSV(contactsToExport, [...selectedFields])
    onOpenChange(false)
    toast.success(`Export CSV — ${contactsToExport.length} contact${contactsToExport.length > 1 ? 's' : ''} téléchargés`)
  }

  function handleVCF() {
    exportContactsToVCF(contactsToExport)
    onOpenChange(false)
    toast.success(`Export VCF — ${contactsToExport.length} contact${contactsToExport.length > 1 ? 's' : ''} téléchargés`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exporter les contacts</DialogTitle>
          <DialogDescription>
            Choisis les contacts à exporter et le format souhaité.
          </DialogDescription>
        </DialogHeader>

        {/* Scope */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Contacts à exporter</p>
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as 'all' | 'selected')}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="scope-all" />
              <Label htmlFor="scope-all" className="font-normal cursor-pointer">
                Tous les contacts ({allContacts.length})
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="selected" id="scope-sel" disabled={!hasSelection} />
              <Label
                htmlFor="scope-sel"
                className={`font-normal cursor-pointer ${!hasSelection ? 'opacity-50' : ''}`}
              >
                Sélection ({selectedContacts.length})
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        {/* Fields — only relevant for CSV */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Colonnes CSV</p>
            <button
              onClick={toggleAll}
              className="text-xs text-primary underline underline-offset-2"
            >
              {selectedFields.size === CSV_EXPORT_FIELDS.length ? 'Tout décocher' : 'Tout cocher'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-52 overflow-y-auto pr-1">
            {CSV_EXPORT_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <Checkbox
                  id={`field-${field.key}`}
                  checked={selectedFields.has(field.key)}
                  onCheckedChange={() => toggleField(field.key)}
                />
                <Label htmlFor={`field-${field.key}`} className="font-normal cursor-pointer text-xs">
                  {field.label}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            La sélection de colonnes ne s&apos;applique qu&apos;au format CSV.
          </p>
        </div>

        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="outline" onClick={handleVCF} className="gap-2">
            <Download className="h-4 w-4" />
            VCF / vCard
          </Button>
          <Button onClick={handleCSV} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
