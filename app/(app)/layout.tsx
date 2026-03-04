import { Sidebar } from '@/components/shared/sidebar'
import { MobileSidebar } from '@/components/shared/mobile-sidebar'
import { MobileHeaderLogo } from '@/components/shared/MobileHeaderLogo'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { isAdmin } from '@/lib/admin/isAdmin'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await isAdmin()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop — fixe */}
      <aside className="hidden w-60 shrink-0 border-r bg-background md:flex md:flex-col">
        <Sidebar isAdmin={adminUser} />
      </aside>

      {/* Zone principale */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header — toujours visible */}
        <header className="flex h-14 shrink-0 items-center border-b bg-background px-4 gap-2">
          {/* Mobile: bouton menu */}
          <div className="md:hidden">
            <MobileSidebar isAdmin={adminUser} />
          </div>
          <div className="md:hidden">
            <MobileHeaderLogo />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Thème toggle — toujours visible */}
          <ThemeToggle />
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Palette de commandes (Cmd+K) */}
      <CommandPalette />
    </div>
  )
}
