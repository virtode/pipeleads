'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Kanban, GitBranch, BarChart2, Settings,
  Plus, Download, Upload, Zap,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

// ---------------------------------------------------------------------------
// Command items
// ---------------------------------------------------------------------------

const NAV_COMMANDS = [
  { label: 'Contacts', href: '/contacts', icon: Users },
  { label: 'Leads (Kanban)', href: '/leads', icon: Kanban },
  { label: 'Pipelines', href: '/pipelines', icon: GitBranch },
  { label: 'Rapports', href: '/reports', icon: BarChart2 },
  { label: 'Paramètres', href: '/settings', icon: Settings },
]

const ACTION_COMMANDS = [
  {
    label: 'Nouveau contact',
    href: '/contacts?new=1',
    icon: Plus,
    shortcut: '⌘N',
  },
  {
    label: 'Importer des contacts (CSV)',
    href: '/contacts?import=csv',
    icon: Upload,
  },
  {
    label: 'Exporter les contacts',
    href: '/contacts?export=1',
    icon: Download,
  },
  {
    label: 'Nouveau pipeline',
    href: '/pipelines?new=1',
    icon: GitBranch,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Cmd+K → open; Cmd+N → new contact
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }

      if (meta && e.key === 'n') {
        e.preventDefault()
        setOpen(false)
        router.push('/contacts?new=1')
        return
      }
    },
    [router],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function runCommand(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher une page ou une action…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {NAV_COMMANDS.map(({ label, href, icon: Icon }) => (
            <CommandItem key={href} onSelect={() => runCommand(href)}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions rapides">
          {ACTION_COMMANDS.map(({ label, href, icon: Icon, shortcut }) => (
            <CommandItem key={href} onSelect={() => runCommand(href)}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
              {shortcut && (
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
                  {shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
