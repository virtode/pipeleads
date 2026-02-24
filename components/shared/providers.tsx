'use client'

import { useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { StytchProvider } from '@stytch/nextjs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { stytch } from '@/lib/stytch/client'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <StytchProvider stytch={stytch}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StytchProvider>
    </ThemeProvider>
  )
}
