'use client'

import { createStytchClient } from '@stytch/nextjs'

export const stytch = createStytchClient(
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN!
)
