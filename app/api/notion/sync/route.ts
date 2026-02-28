import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/notion/crypto'
import { syncAllContacts } from '@/lib/notion/sync'
import type { SyncReport } from '@/lib/notion/sync'
import type { ApiResponse } from '@/types'

// ---------------------------------------------------------------------------
// In-memory lock — prevent concurrent syncs
// ---------------------------------------------------------------------------

const syncInProgress = new Map<string, boolean>()

// ---------------------------------------------------------------------------
// POST /api/notion/sync
// Sync all contacts to Notion using the stored config.
// ---------------------------------------------------------------------------

interface SyncBody {
  pipeline_id?: string // optional: sync only contacts in this pipeline
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<SyncReport & { duration_ms: number }>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }
  const userId = user.id

  // Prevent concurrent syncs
  if (syncInProgress.get(userId)) {
    return NextResponse.json(
      { data: null, error: 'Une synchronisation est déjà en cours' },
      { status: 409 },
    )
  }

  let body: SyncBody = {}
  try {
    body = await request.json()
  } catch {
    // body is optional
  }

  // 1. Load config
  const { data: config, error: configErr } = await supabase
    .from('notion_config')
    .select('database_id, encrypted_token, field_mapping')
    .eq('user_id', userId)
    .maybeSingle()

  if (configErr) {
    console.error('[Notion Sync] Config load error:', configErr)
    return NextResponse.json({ data: null, error: 'Erreur serveur' }, { status: 500 })
  }

  if (!config) {
    return NextResponse.json(
      { data: null, error: "Notion n'est pas configuré. Configure ton intégration dans les paramètres." },
      { status: 400 },
    )
  }

  if (!config.encrypted_token) {
    return NextResponse.json(
      { data: null, error: "Token Notion manquant. Sauvegarde ta configuration d'abord." },
      { status: 400 },
    )
  }

  // 2. Decrypt token
  let token: string
  try {
    token = decrypt(config.encrypted_token)
  } catch (err) {
    console.error('[Notion Sync] Decrypt error:', err)
    return NextResponse.json(
      { data: null, error: 'Impossible de déchiffrer le token Notion' },
      { status: 500 },
    )
  }

  // 3. Load contacts
  let contactsQuery = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  // Filter by pipeline if requested
  if (body.pipeline_id) {
    const { data: cpRows } = await supabase
      .from('contact_pipeline')
      .select('contact_id')
      .eq('pipeline_id', body.pipeline_id)

    const ids = (cpRows ?? []).map((r) => r.contact_id)
    if (ids.length === 0) {
      return NextResponse.json({
        data: { total: 0, created: 0, updated: 0, errors: [], duration_ms: 0 },
        error: null,
      })
    }
    contactsQuery = contactsQuery.in('id', ids) as typeof contactsQuery
  }

  const { data: contacts, error: contactsErr } = await contactsQuery

  if (contactsErr) {
    console.error('[Notion Sync] Contacts load error:', contactsErr)
    return NextResponse.json({ data: null, error: 'Erreur lors du chargement des contacts' }, { status: 500 })
  }

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({
      data: { total: 0, created: 0, updated: 0, errors: [], duration_ms: 0 },
      error: null,
    })
  }

  // 4. Sync
  syncInProgress.set(userId, true)
  const startedAt = Date.now()

  try {
    const report = await syncAllContacts(
      token,
      config.database_id,
      (config.field_mapping as Record<string, string>) ?? {},
      contacts,
    )

    // 5. Update last_sync_at
    await supabase
      .from('notion_config')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', userId)

    const duration_ms = Date.now() - startedAt

    return NextResponse.json({ data: { ...report, duration_ms }, error: null })
  } catch (err) {
    console.error('[Notion Sync] Sync error:', err)
    const message = err instanceof Error ? err.message : 'Erreur lors de la synchronisation'
    return NextResponse.json({ data: null, error: message }, { status: 500 })
  } finally {
    syncInProgress.delete(userId)
  }
}
