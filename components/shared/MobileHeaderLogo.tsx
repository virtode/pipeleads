'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import Image from 'next/image'

export function MobileHeaderLogo() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-8 w-8" />

  return (
    <Image
      src={resolvedTheme === 'dark' ? '/icon-dark.png' : '/icon-light.png'}
      alt="PipeLeads"
      width={32}
      height={32}
    />
  )
}
