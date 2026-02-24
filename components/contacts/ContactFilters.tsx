'use client'

import { useState } from 'react'
import { Search, X, Tags, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { useContactTags } from '@/hooks/useContacts'
import type { ContactFilters as Filters } from '@/types'

interface ContactFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
  onReset: () => void
}

export function ContactFilters({ filters, onChange, onReset }: ContactFiltersProps) {
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const { data: availableTags = [] } = useContactTags()

  const hasActiveFilters =
    !!filters.search || (filters.tags?.length ?? 0) > 0 || !!filters.company

  function toggleTag(tag: string) {
    const current = filters.tags ?? []
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag]
    onChange({ ...filters, tags: next })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Recherche globale */}
      <div className="relative min-w-[240px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un contact…"
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filtre entreprise */}
      <div className="relative">
        <Input
          placeholder="Entreprise"
          value={filters.company ?? ''}
          onChange={(e) => onChange({ ...filters, company: e.target.value })}
          className="w-40"
        />
        {filters.company && (
          <button
            onClick={() => onChange({ ...filters, company: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filtre tags */}
      <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Tags className="h-3.5 w-3.5" />
            Tags
            {(filters.tags?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                {filters.tags!.length}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="start">
          <Command>
            <CommandInput placeholder="Chercher un tag…" />
            <CommandList>
              <CommandEmpty>Aucun tag trouvé.</CommandEmpty>
              <CommandGroup>
                {availableTags.map((tag) => (
                  <CommandItem
                    key={tag}
                    onSelect={() => toggleTag(tag)}
                    className="gap-2"
                  >
                    <Checkbox
                      checked={(filters.tags ?? []).includes(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                    />
                    {tag}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Tags actifs */}
      {(filters.tags ?? []).map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1">
          {tag}
          <button onClick={() => toggleTag(tag)}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Reset */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
          <X className="mr-1.5 h-3.5 w-3.5" />
          Réinitialiser
        </Button>
      )}
    </div>
  )
}
