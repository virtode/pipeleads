import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { TENANT_SCHEMA_SQL } from '@/lib/admin/tenant-schema'

const InitSchemaSchema = z.object({
  supabase_url: z.string().url(),
  service_role_key: z.string().min(10),
})

/**
 * Exécute une requête SQL sur une instance Supabase via l'API postgres-meta
 * exposée par Kong sous /pg/query.
 *
 * Nécessite la service_role_key pour l'authentification.
 * Disponible en self-hosted (Kong) et sur les projets Supabase cloud.
 */
async function executeSql(
  supabaseUrl: string,
  serviceRoleKey: string,
  sql: string
): Promise<void> {
  const base = supabaseUrl.replace(/\/$/, '')
  const endpoint = `${base}/pg/query`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase Kong accepte les deux formes d'authentification
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(body)
  }

  const json = (await res.json()) as { error?: string }
  if (json.error) {
    throw new Error(json.error)
  }
}

/**
 * POST /api/admin/tenants/init-schema
 *
 * Applique le schéma PipeLeads complet sur l'instance Supabase d'un tenant.
 *
 * Body : { supabase_url: string, service_role_key: string }
 *
 * Réponse 200 : { data: { ok: true } }
 * Réponse 500 : { error: string }
 * Réponse 422 : { error: string }  — payload invalide
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = InitSchemaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 422 }
    )
  }

  const { supabase_url, service_role_key } = parsed.data

  try {
    await executeSql(supabase_url, service_role_key, TENANT_SCHEMA_SQL)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[init-schema] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
