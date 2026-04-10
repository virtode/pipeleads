import crypto from 'crypto'

/**
 * Generates a deterministic CardDAV password for a given email.
 * Uses HMAC-SHA256 with CARDDAV_PASSWORD_SECRET so the password can
 * always be recomputed from the email alone (no storage needed for display).
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
