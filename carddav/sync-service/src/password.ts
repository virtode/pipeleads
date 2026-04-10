import crypto from 'crypto'

/**
 * Generates a deterministic CardDAV password for a given email.
 * Must stay in sync with lib/carddav/password.ts in the Next.js app.
 */
export function generateCarddavPassword(email: string): string {
  const secret = process.env.CARDDAV_PASSWORD_SECRET
  if (!secret) throw new Error('CARDDAV_PASSWORD_SECRET is not set')
  return crypto
    .createHmac('sha256', secret)
    .update(email)
    .digest('base64')
    .slice(0, 16)
    .replace(/[+/=]/g, 'x')
}
