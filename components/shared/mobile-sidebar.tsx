'use client'

import { useState, useRef, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Sidebar } from '@/components/shared/sidebar'

interface MobileSidebarProps {
  isAdmin?: boolean
}

export function MobileSidebar({ isAdmin = false }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || !open) return

    let startX = 0
    let startY = 0
    let committed = false

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      committed = false
    }

    const onMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY

      if (!committed) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
        if (Math.abs(dy) >= Math.abs(dx)) return
        committed = true
      }

      if (dx < 0) e.preventDefault()
    }

    const onEnd = (e: TouchEvent) => {
      if (!committed) return
      const dx = e.changedTouches[0].clientX - startX
      if (dx < -60) setOpen(false)
    }

    panel.addEventListener('touchstart', onStart, { passive: true })
    panel.addEventListener('touchmove', onMove, { passive: false })
    panel.addEventListener('touchend', onEnd, { passive: true })

    return () => {
      panel.removeEventListener('touchstart', onStart)
      panel.removeEventListener('touchmove', onMove)
      panel.removeEventListener('touchend', onEnd)
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
          <div ref={panelRef} className="h-full">
            <Sidebar onNavigate={() => setOpen(false)} isAdmin={isAdmin} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
