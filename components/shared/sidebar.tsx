'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import {
  Users,
  Kanban,
  GitBranch,
  BarChart2,
  Settings,
  LogOut,
  Shield,
  CalendarClock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { useSupabaseClient } from '@/lib/supabase/context'
import { usePendingReminderCount } from '@/hooks/useAgendaReminders'
import { APP_VERSION } from '@/lib/version'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
}

const STATIC_NAV: Omit<NavItem, 'badge'>[] = [
  { label: 'Contacts', href: '/contacts', icon: Users },
  { label: 'Agenda',   href: '/agenda',   icon: CalendarClock },
  { label: 'Pipelines', href: '/pipelines', icon: GitBranch },
  { label: 'Leads', href: '/leads', icon: Kanban },
  { label: 'Rapports', href: '/reports', icon: BarChart2 },
  { label: 'Paramètres', href: '/settings', icon: Settings },
]

interface SidebarProps {
  onNavigate?: () => void
  isAdmin?: boolean
}

export function Sidebar({ onNavigate, isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const supabase = useSupabaseClient()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data: pendingCount } = usePendingReminderCount()

  const NAV_ITEMS: NavItem[] = STATIC_NAV.map((item) =>
    item.href === '/agenda' ? { ...item, badge: pendingCount } : item,
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Image
          src={mounted && resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo.png'}
          alt="PipeLeads"
          width={140}
          height={35}
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon, badge }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge != null && badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Lien admin — visible uniquement pour les super admins */}
      {isAdmin && (
        <div className="px-2 pb-1">
          <Link
            href="/admin/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Shield className="h-4 w-4 shrink-0" />
            Administration
          </Link>
        </div>
      )}

      {/* Déconnexion + thème */}
      <div className="border-t p-2 flex items-center gap-1">
        <Button
          variant="ghost"
          className="flex-1 justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">Déconnexion</span>
        </Button>
        <ThemeToggle />
      </div>
      <p className="px-4 pb-3 text-xs text-muted-foreground/60">v{APP_VERSION}</p>
    </div>
  )
}
