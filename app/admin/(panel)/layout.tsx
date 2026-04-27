import Link from 'next/link'
import { LayoutDashboard, Building2, Bot, LogOut, ArrowLeft } from 'lucide-react'
import { requireAdminAuth } from '@/lib/admin/auth'

/**
 * Layout du backoffice admin — pipeleads.app/admin
 * Style sobre, distinct de l'UI client.
 * Vérifie l'auth admin pour toutes les pages du panel.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAuth()
  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar admin */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        {/* Logo / titre */}
        <div className="flex h-14 items-center border-b border-zinc-200 px-5 dark:border-zinc-800">
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            PipeLeads <span className="text-xs font-normal text-zinc-400">Admin</span>
          </span>
        </div>

        {/* Retour à l'app */}
        <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            Retour à l&apos;app
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 p-2">
          <AdminNavLink href="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <AdminNavLink href="/admin/tenants" icon={Building2} label="Tenants" />
          <AdminNavLink href="/admin/ai-config" icon={Bot} label="Config IA" />
        </nav>

        {/* Déconnexion */}
        <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Contenu */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}

function AdminNavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ElementType
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}
