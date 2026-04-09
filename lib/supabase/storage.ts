import { createAdminClient } from './admin'

export const CONTACT_FILES_BUCKET = 'contact-files'
export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

/**
 * Crée le bucket `contact-files` s'il n'existe pas.
 * Bucket privé — accès uniquement via signed URLs (60 min).
 * Taille max : 20 MB par fichier.
 */
export async function ensureContactFilesBucket(): Promise<void> {
  const supabase = createAdminClient()

  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === CONTACT_FILES_BUCKET)

  if (!exists) {
    const { error } = await supabase.storage.createBucket(CONTACT_FILES_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
    })
    if (error && !error.message.includes('already exists')) {
      throw new Error(`Impossible de créer le bucket: ${error.message}`)
    }
  }
}
