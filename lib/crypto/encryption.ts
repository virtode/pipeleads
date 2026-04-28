import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('ENCRYPTION_KEY manquante — définissez-la dans les variables d\'environnement')
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('ENCRYPTION_KEY invalide — attendu : 64 caractères hexadécimaux (32 octets)')
  }
  return Buffer.from(raw, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [
    iv.toString('base64'),
    ciphertext.toString('base64'),
    authTag.toString('base64'),
  ].join(':')
}

export function decrypt(encrypted: string): string {
  const key = getKey()
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Format de clé chiffrée invalide')
  }
  const [ivB64, ciphertextB64, tagB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error('Format de clé chiffrée invalide')
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}

// base64 segment: only A-Z a-z 0-9 + / = characters
const B64 = '[A-Za-z0-9+/=]+'

export function isEncrypted(value: string): boolean {
  return new RegExp(`^${B64}:${B64}:${B64}$`).test(value)
}
