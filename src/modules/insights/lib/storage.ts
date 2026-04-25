import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'analysis-reports'

export async function uploadReport(
  supabase: SupabaseClient,
  tenantId: string,
  reportId: string,
  html: string,
): Promise<string> {
  const storagePath = `reports/${tenantId}/${reportId}.html`
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' })

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      contentType: 'text/html; charset=utf-8',
      upsert: false,
    })

  if (error) throw new Error(`storage error: ${error.message}`)

  return storagePath
}

export async function generateSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  ttlSeconds: number,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, ttlSeconds)

  if (error) throw new Error(`storage error: ${error.message}`)

  return data.signedUrl
}

export async function deleteReport(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath])

  if (error) throw new Error(`storage error: ${error.message}`)
}
