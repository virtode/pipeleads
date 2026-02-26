import { useRef } from 'react'

interface UseSwipeToCloseProps {
  onClose: () => void
  threshold?: number // distance minimale en px pour déclencher (défaut: 80)
}

export function useSwipeToClose({ onClose, threshold = 80 }: UseSwipeToCloseProps) {
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return

    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)

    // Déclenche seulement si le mouvement est majoritairement horizontal
    // et dans le sens gauche → droite
    if (deltaX > threshold && deltaY < 60) {
      onClose()
    }

    touchStartX.current = null
    touchStartY.current = null
  }

  return { onTouchStart, onTouchEnd }
}
