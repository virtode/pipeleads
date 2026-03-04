/**
 * AES-256-GCM encrypt/decrypt for the Notion integration token.
 * Key is derived from SUPABASE_SERVICE_ROLE_KEY (server-only).
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('[notion/crypto] SUPABASE_SERVICE_ROLE_KEY is not set')
}

const ALGORITHM = 'aes-256-gcm'
const IV_LEN = 12    // 96-bit nonce for GCM
const TAG_LEN = 16   // 128-bit auth tag

/** Derive a 32-byte key from the service role key. */
function deriveKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createHash('sha256').update(secret).digest()
}

/**
 * Encrypt plaintext string.
 * Returns a hex string: iv(12) + ciphertext + tag(16), all concatenated.
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, encrypted, tag]).toString('hex')
}

/**
 * Decrypt a hex-encoded ciphertext produced by encrypt().
 */
export function decrypt(hex: string): string {
  const key = deriveKey()
  const buf = Buffer.from(hex, 'hex')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(buf.length - TAG_LEN)
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}
