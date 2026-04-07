import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { TENANT_SCHEMA_SQL } from '@/lib/admin/tenant-schema'

const InitSchemaSchema = z.object({
  supabaseUrl: z.string().url('URL Supabase invalide'),
  supabaseServiceRoleKey: z.string().min(10, 'Service role key invalide'),
})

/**
 * Extrait le project ref depuis une URL Supabase.
 * https://abcdefgh.supabase.co → abcdefgh
 */
function extractProjectRef(supabaseUrl: string): string {
  const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
  if (!match?.[1]) throw new Error('Format de Supabase URL invalide')
  return match[1]
}

/**
 * POST /api/admin/tenants/init-schema
 * Applique le schéma PipeLeads sur un projet Supabase tenant.
 * Utilise la Supabase Management API (SUPABASE_MANAGEMENT_API_KEY).
 * Réservé aux admins (route protégée par le layout admin).
 */
export async function POST(req: NextRequest) {
  const mgmtKey = process.env.SUPABASE_MANAGEMENT_API_KEY
  if (!mgmtKey) {
    return NextResponse.json(
      { error: 'SUPABASE_MANAGEMENT_API_KEY non configuré sur le serveur' },
      { status: 500 }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = InitSchemaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { supabaseUrl } = parsed.data

  let projectRef: string
  try {
    projectRef = extractProjectRef(supabaseUrl)
  } catch {
    return NextResponse.json({ error: 'URL Supabase invalide' }, { status: 422 })
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mgmtKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: TENANT_SCHEMA_SQL }),
    }
  )

  if (!response.ok) {
    const text = await response.text().catch(() => `HTTP ${response.status}`)
    console.error('[init-schema] Management API error:', response.status, text)
    return NextResponse.json(
      { error: `Erreur API Supabase (${response.status}) : ${text}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: { success: true } })
}
