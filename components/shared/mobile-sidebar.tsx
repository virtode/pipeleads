'use client'

import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Sidebar } from '@/components/shared/sidebar'

interface MobileSidebarProps {
  isAdmin?: boolean
}

export function MobileSidebar({ isAdmin = false }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)

  // Swipe-to-close : listener sur document (pas panelRef) pour capturer les touch events
  // même quand le geste démarre dans le nav scrollable — pattern iOS { passive: false }
  useEffect(() => {
    if (!open) return

    let startX = 0
    let startY = 0
    let committed = false
    let tracking = false

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      committed = false
      tracking = true
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY

      if (!committed) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
        if (Math.abs(dy) >= Math.abs(dx)) { tracking = false; return }
        committed = true
      }

      if (dx < 0) e.preventDefault()
    }

    const onEnd = (e: TouchEvent) => {
      if (!tracking || !committed) return
      const dx = e.changedTouches[0].clientX - startX
      if (dx < -60) setOpen(false)
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [open])

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="h-full">
            <Sidebar onNavigate={() => setOpen(false)} isAdmin={isAdmin} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
