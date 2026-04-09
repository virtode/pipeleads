'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Download, Upload, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContactFilters } from '@/components/contacts/ContactFilters'
import { ContactsTable } from '@/components/contacts/ContactsTable'
import { ContactSheet } from '@/components/contacts/ContactSheet'
import { ContactForm } from '@/components/contacts/ContactForm'
import { ExportDialog } from '@/components/contacts/ExportDialog'
import { ImportCSVDialog } from '@/components/contacts/ImportCSVDialog'
import { ImportVCFDialog } from '@/components/contacts/ImportVCFDialog'
import { useContacts, useDeleteContacts } from '@/hooks/useContacts'
import { useDebounce } from '@/hooks/useDebounce'
import { useSupabaseClient } from '@/lib/supabase/context'
import type { Contact, ContactFilters as Filters, ContactSortField } from '@/types'

const EMPTY_FILTERS: Filters = { search: '', tags: [], company: '' }

function ContactsPageContent() {
  const supabase = useSupabaseClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ContactSortField>({
    field: 'created_at',
    direction: 'desc',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false)
  const [isImportVCFOpen, setIsImportVCFOpen] = useState(false)
  // Contacts pre-selected when opening export from bulk action bar
  const [exportPreselected, setExportPreselected] = useState<Contact[]>([])

  // Handle URL params from command palette (Cmd+N, import, export)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setIsCreateOpen(true)
      router.replace('/contacts')
    } else if (searchParams.get('import') === 'csv') {
      setIsImportCSVOpen(true)
      router.replace('/contacts')
    } else if (searchParams.get('export') === '1') {
      setIsExportOpen(true)
      router.replace('/contacts')
    }
  }, [searchParams, router])

  const isFiltered =
    !!filters.search || (filters.tags?.length ?? 0) > 0 || !!filters.company

  const debouncedFilters = useDebounce(filters, 300)

  const { data, isLoading } = useContacts({ page, filters: debouncedFilters, sort })
  const bulkDeleteMutation = useDeleteContacts()

  // Fetch all contacts (no pagination) — enabled only when export dialog is open
  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts-all-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('last_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Contact[]
    },
    enabled: isExportOpen,
    staleTime: 60_000,
  })

  function handleFiltersChange(next: Filters) {
    setFilters(next)
    setPage(0)
  }

  function handleSortChange(next: ContactSortField) {
    setSort(next)
    setPage(0)
  }

  function handleRowClick(id: string) {
    setSelectedId(id)
    setIsSheetOpen(true)
  }

  async function handleBulkDelete(ids: string[]) {
    await bulkDeleteMutation.mutateAsync(ids)
  }

  function handleBulkExport(contacts: Contact[]) {
    setExportPreselected(contacts)
    setIsExportOpen(true)
  }

  function openExportAll() {
    setExportPreselected([])
    setIsExportOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} contact{(data?.total ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          {/* Import + Export sur la même ligne en mobile */}
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
            {/* Import dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full md:w-auto">
                  <Upload className="mr-1.5 h-4 w-4" />
                  Importer
                  <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsImportCSVOpen(true)}>
                  Fichier CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsImportVCFOpen(true)}>
                  Fichier VCF / vCard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" className="w-full md:w-auto" onClick={openExportAll}>
              <Download className="mr-1.5 h-4 w-4" />
              Exporter
            </Button>
          </div>

          <Button size="sm" className="w-full md:w-auto" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nouveau contact
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <ContactFilters
        filters={filters}
        onChange={handleFiltersChange}
        onReset={() => { setFilters(EMPTY_FILTERS); setPage(0) }}
      />

      {/* Table */}
      <ContactsTable
        contacts={data?.contacts ?? []}
        totalCount={data?.total ?? 0}
        page={page}
        sort={sort}
        isLoading={isLoading}
        onPageChange={setPage}
        onSortChange={handleSortChange}
        onRowClick={handleRowClick}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        isFiltered={isFiltered}
        onAddContact={() => setIsCreateOpen(true)}
        onImport={() => setIsImportCSVOpen(true)}
        onResetFilters={() => { setFilters(EMPTY_FILTERS); setPage(0) }}
      />

      {/* Sheet contact */}
      <ContactSheet
        contactId={selectedId}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onDeleted={() => setSelectedId(null)}
      />

      {/* Dialog création */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            onSuccess={() => setIsCreateOpen(false)}
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Export */}
      <ExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        allContacts={allContacts}
        selectedContacts={exportPreselected}
      />

      {/* Import CSV */}
      <ImportCSVDialog
        open={isImportCSVOpen}
        onOpenChange={setIsImportCSVOpen}
      />

      {/* Import VCF */}
      <ImportVCFDialog
        open={isImportVCFOpen}
        onOpenChange={setIsImportVCFOpen}
      />
    </div>
  )
}

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsPageContent />
    </Suspense>
  )
}
