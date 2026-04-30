'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Download, Upload, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const EMPTY_FILTERS: Filters = { search: '', tags: [] }

interface ContactsPageClientProps {
  initialId: string | null
  openNew: boolean
  openImportCSV: boolean
  openExport: boolean
}

export function ContactsPageClient({
  initialId,
  openNew,
  openImportCSV,
  openExport,
}: ContactsPageClientProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window === 'undefined') return 50
    const saved = localStorage.getItem('contacts_page_size')
    return saved ? Number(saved) : 50
  })
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ContactSortField>({
    field: 'last_name',
    direction: 'asc',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false)
  const [isImportVCFOpen, setIsImportVCFOpen] = useState(false)
  const [exportPreselected, setExportPreselected] = useState<Contact[]>([])

  // Handle props from Server Component (URL params resolved server-side)
  useEffect(() => {
    if (initialId) {
      setSelectedId(initialId)
      setIsSheetOpen(true)
      router.replace('/contacts')
    } else if (openNew) {
      setIsCreateOpen(true)
      router.replace('/contacts')
    } else if (openImportCSV) {
      setIsImportCSVOpen(true)
      router.replace('/contacts')
    } else if (openExport) {
      setIsExportOpen(true)
      router.replace('/contacts')
    }
  }, [initialId, openNew, openImportCSV, openExport, router])

  const isFiltered =
    !!filters.search || (filters.tags?.length ?? 0) > 0

  useEffect(() => {
    localStorage.setItem('contacts_page_size', String(pageSize))
  }, [pageSize])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setPage(0)
  }, [])

  const debouncedFilters = useDebounce(filters, 300)

  const { data, isFetching: isLoading } = useContacts({ page, pageSize, filters: debouncedFilters, sort })
  const bulkDeleteMutation = useDeleteContacts()

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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden p-3 md:p-6">
      {/* En-tête */}
      <div className="shrink-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} contact{(data?.total ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          {/* Import + Export — masqués sur mobile */}
          <div className="hidden md:flex md:gap-2">
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
      <div className="shrink-0 pb-3">
        <ContactFilters
          filters={filters}
          onChange={handleFiltersChange}
        />
      </div>

      {/* Table */}
      <div className={`flex-1 min-h-0 overflow-hidden flex flex-col${isSheetOpen ? ' pointer-events-none' : ''}`}>
        <ContactsTable
        contacts={data?.contacts ?? []}
        totalCount={data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        sort={sort}
        isLoading={isLoading}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
        onSortChange={handleSortChange}
        onRowClick={handleRowClick}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        isFiltered={isFiltered}
        onAddContact={() => setIsCreateOpen(true)}
        onImport={() => setIsImportCSVOpen(true)}
        onResetFilters={() => { setFilters(EMPTY_FILTERS); setPage(0) }}
        />
      </div>

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
            <DialogDescription className="sr-only">
              Formulaire de création d&apos;un nouveau contact
            </DialogDescription>
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
