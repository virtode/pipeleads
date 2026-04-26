import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'analysis-reports'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new NextResponse('Non authentifié', { status: 401 })
  }

  const { reportId } = await params

  const { data, error } = await supabase
    .from('analysis_reports')
    .select('storage_path, expires_at, revoked_at')
    .eq('id', reportId)
    .single()

  if (error || !data) {
    return new NextResponse('Rapport introuvable', { status: 404 })
  }

  const row = data as { storage_path: string; expires_at: string; revoked_at: string | null }

  if (row.revoked_at !== null) {
    return new NextResponse('Rapport révoqué', { status: 410 })
  }
  if (new Date(row.expires_at) < new Date()) {
    return new NextResponse('Rapport expiré', { status: 410 })
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(row.storage_path)

  if (downloadError || !blob) {
    return new NextResponse('Erreur lors du téléchargement', { status: 500 })
  }

  return new NextResponse(await blob.text(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
