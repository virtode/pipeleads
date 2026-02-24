'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2, Download, ChevronLeft, ChevronRight, Plus, Upload, Search, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CONTACTS_PAGE_SIZE } from '@/hooks/useContacts'
import type { Contact, ContactSortField } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(first: string, last?: string | null) {
  return `${first.charAt(0)}${last ? last.charAt(0) : ''}`.toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const col = createColumnHelper<Contact>()

function buildColumns(onRowClick: (id: string) => void) {
  return [
    col.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Tout sélectionner"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Sélectionner"
        />
      ),
      enableSorting: false,
    }),

    col.accessor((row) => `${row.first_name} ${row.last_name ?? ''}`.trim(), {
      id: 'first_name',
      header: 'Nom',
      cell: ({ row }) => {
        const c = row.original
        return (
          <button
            className="flex items-center gap-2.5 text-left hover:underline"
            onClick={() => onRowClick(c.id)}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={c.photo_url ?? undefined} alt={c.first_name} />
              <AvatarFallback className="text-xs">
                {getInitials(c.first_name, c.last_name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">
              {c.first_name} {c.last_name}
            </span>
          </button>
        )
      },
    }),

    col.accessor('company', {
      header: 'Entreprise',
      cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
    }),

    col.accessor((row) => row.email?.[0] ?? '', {
      id: 'email',
      header: 'Email',
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? (
          <a
            href={`mailto:${v}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {v}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
      enableSorting: false,
    }),

    col.accessor((row) => row.phone?.[0] ?? '', {
      id: 'phone',
      header: 'Téléphone',
      cell: ({ getValue }) =>
        getValue() || <span className="text-muted-foreground">—</span>,
      enableSorting: false,
    }),

    col.accessor('tags', {
      header: 'Tags',
      cell: ({ getValue }) => {
        const tags = getValue() ?? []
        if (tags.length === 0) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )
      },
      enableSorting: false,
    }),

    col.accessor('created_at', {
      header: 'Créé le',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{formatDate(getValue())}</span>
      ),
    }),
  ]
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

interface ContactsTableProps {
  contacts: Contact[]
  totalCount: number
  page: number
  sort: ContactSortField
  isLoading: boolean
  onPageChange: (page: number) => void
  onSortChange: (sort: ContactSortField) => void
  onRowClick: (id: string) => void
  onBulkDelete: (ids: string[]) => void
  onBulkExport: (contacts: Contact[]) => void
  /** True when any search/tag/company filter is active */
  isFiltered?: boolean
  onAddContact?: () => void
  onImport?: () => void
  onResetFilters?: () => void
}

export function ContactsTable({
  contacts,
  totalCount,
  page,
  sort,
  isLoading,
  onPageChange,
  onSortChange,
  onRowClick,
  onBulkDelete,
  onBulkExport,
  isFiltered = false,
  onAddContact,
  onImport,
  onResetFilters,
}: ContactsTableProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [sorting, setSorting] = useState<SortingState>([
    { id: sort.field, desc: sort.direction === 'desc' },
  ])

  const columns = buildColumns(onRowClick)

  const table = useReactTable({
    data: contacts,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      setSorting(next)
      if (next.length > 0) {
        const validFields: ContactSortField['field'][] = [
          'first_name', 'last_name', 'company', 'created_at', 'updated_at',
        ]
        const field = next[0].id as ContactSortField['field']
        if (validFields.includes(field)) {
          onSortChange({ field, direction: next[0].desc ? 'desc' : 'asc' })
        }
      }
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    rowCount: totalCount,
  })

  const selectedRows = table.getSelectedRowModel().rows
  const selectedIds = selectedRows.map((r) => r.original.id)
  const selectedContacts = selectedRows.map((r) => r.original)

  const totalPages = Math.ceil(totalCount / CONTACTS_PAGE_SIZE)

  function SortIcon({ columnId }: { columnId: string }) {
    const col = table.getColumn(columnId)
    if (!col?.getCanSort()) return null
    const sorted = col.getIsSorted()
    if (sorted === 'asc') return <ArrowUp className="ml-1 h-3.5 w-3.5" />
    if (sorted === 'desc') return <ArrowDown className="ml-1 h-3.5 w-3.5" />
    return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
  }

  return (
    <div className="space-y-2">
      {/* Barre d'actions en masse */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/60 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.length} contact{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { onBulkExport(selectedContacts); setRowSelection({}) }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Exporter
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { onBulkDelete(selectedIds); setRowSelection({}) }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Supprimer
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                  >
                    <div className="flex items-center">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon columnId={header.id} />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 text-center">
                  {!isFiltered ? (
                    /* No contacts at all */
                    <div className="flex flex-col items-center justify-center gap-4 py-6">
                      <div className="rounded-full bg-muted p-4">
                        <Users className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Aucun contact</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Commence par ajouter un contact ou importer une liste.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {onAddContact && (
                          <Button size="sm" onClick={onAddContact}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Ajouter votre premier contact
                          </Button>
                        )}
                        {onImport && (
                          <Button size="sm" variant="outline" onClick={onImport}>
                            <Upload className="mr-1.5 h-4 w-4" />
                            Importer
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* No results from search / filters */
                    <div className="flex flex-col items-center justify-center gap-3 py-6">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                      <div>
                        <p className="font-medium">Aucun résultat</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Aucun contact ne correspond à cette recherche.
                        </p>
                      </div>
                      {onResetFilters && (
                        <Button size="sm" variant="outline" onClick={onResetFilters}>
                          Réinitialiser les filtres
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={() => onRowClick(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1 py-1 text-sm text-muted-foreground">
        <span>
          {totalCount === 0
            ? 'Aucun résultat'
            : `${page * CONTACTS_PAGE_SIZE + 1}–${Math.min(
                (page + 1) * CONTACTS_PAGE_SIZE,
                totalCount
              )} sur ${totalCount}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs">
            Page {page + 1} / {Math.max(totalPages, 1)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1 || isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
