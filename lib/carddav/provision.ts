import { generateCarddavPassword } from './password'

/**
 * Generates a CardDAV password for the given email, calls the sync-service
 * /provision endpoint, and returns the password.
 * Non-throwing — logs errors but does not crash the caller.
 */
export async function autoProvisionCardDav(
  userEmail: string,
  tenantSlug: string
): Promise<string | null> {
  const syncUrl = process.env.CARDDAV_SYNC_URL ?? 'http://localhost:3001'
  const internalSecret = process.env.CARDDAV_INTERNAL_SECRET

  if (!internalSecret) {
    console.error('[autoProvisionCardDav] CARDDAV_INTERNAL_SECRET not set')
    return null
  }

  let carddavPassword: string
  try {
    carddavPassword = generateCarddavPassword(userEmail)
  } catch (err) {
    console.error('[autoProvisionCardDav] generateCarddavPassword failed:', err)
    return null
  }

  try {
    const res = await fetch(`${syncUrl}/provision`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${internalSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail, carddavPassword, tenantSlug }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[autoProvisionCardDav] sync-service error ${res.status}:`, text)
      return null
    }
  } catch (err) {
    console.error('[autoProvisionCardDav] fetch failed:', err)
    return null
  }

  return carddavPassword
}
