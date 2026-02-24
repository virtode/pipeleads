'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

/**
 * Returns the Stytch session JWT from the browser cookie.
 * Stytch sets `stytch_session_jwt` as a non-HttpOnly cookie specifically
 * so it can be forwarded to third-party services like Supabase.
 */
function getStytchJwt(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie.match(/stytch_session_jwt=([^;]+)/)?.[1]
}

export function createClient() {
  const jwt = getStytchJwt()
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    jwt
      ? { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      : undefined
  )
}
