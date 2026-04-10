import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import { supabase } from './supabase'
import { contactToVCard, vCardToContact, type Contact } from './vcard'

const DATA_PATH = process.env.CARDDAV_DATA_PATH ?? '/data'
const COLLECTIONS_PATH = path.join(DATA_PATH, 'collections')

// Anti-loop: track UIDs recently written by Supabase→Radicale direction
const recentWrites = new Map<string, ReturnType<typeof setTimeout>>()

function markRecentWrite(uid: string): void {
  const existing = recentWrites.get(uid)
  if (existing) clearTimeout(existing)
  recentWrites.set(
    uid,
    setTimeout(() => recentWrites.delete(uid), 5000)
  )
}

function isRecentWrite(uid: string): boolean {
  return recentWrites.has(uid)
}

// Resolve tenant slug → tenant_id
async function getTenantId(slug: string): Promise<string | null> {
  if (slug === 'master') return null
  const { data } = await supabase.from('tenants').select('id').eq('slug', slug).single()
  return data?.id ?? null
}

// Resolve user email → user_id
async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data: { users } } = await supabase.auth.admin.listUsers()
  return users.find((u) => u.email === email)?.id ?? null
}

// Resolve tenant_id → tenant slug
async function getTenantSlug(tenantId: string | null): Promise<string> {
  if (!tenantId) return 'master'
  const { data } = await supabase.from('tenants').select('slug').eq('id', tenantId).single()
  return data?.slug ?? 'master'
}

// Resolve user_id → email
async function getUserEmail(userId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.admin.getUserById(userId)
  return user?.email ?? null
}

// ---------------------------------------------------------------------------
// SUPABASE → RADICALE
// ---------------------------------------------------------------------------

export function startSupabaseWatcher(): void {
  const channel = supabase
    .channel('contacts-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contacts' },
      async (payload) => {
        try {
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as Partial<Contact>
            if (!oldRecord.id) return
            await deleteVcf(oldRecord.id)
          } else {
            const record = payload.new as Contact
            await upsertVcf(record)
          }
        } catch (err) {
          console.error('[supabase→radicale] Error handling change:', err)
        }
      }
    )
    .subscribe()

  console.log('[supabase→radicale] Realtime subscription active')
  void channel
}

async function upsertVcf(contact: Contact): Promise<void> {
  const tenantSlug = await getTenantSlug(contact.tenant_id)
  const userId = contact.user_id
  const userEmail = await getUserEmail(userId)

  if (!userEmail) {
    console.warn(`[supabase→radicale] No email for user ${userId}, skipping`)
    return
  }

  const dir = path.join(COLLECTIONS_PATH, userEmail, `${tenantSlug}-addressbook`)
  fs.mkdirSync(dir, { recursive: true })

  const vcfPath = path.join(dir, `${contact.id}.vcf`)
  markRecentWrite(contact.id)
  fs.writeFileSync(vcfPath, contactToVCard(contact), 'utf8')
  console.log(`[supabase→radicale] Wrote ${vcfPath}`)
}

async function deleteVcf(contactId: string): Promise<void> {
  // Search across all tenant directories
  const pattern = path.join(COLLECTIONS_PATH, '**', `${contactId}.vcf`)
  // Use a glob-like scan: iterate collections subdirs
  if (!fs.existsSync(COLLECTIONS_PATH)) return

  for (const userDir of fs.readdirSync(COLLECTIONS_PATH)) {
    const userPath = path.join(COLLECTIONS_PATH, userDir)
    if (!fs.statSync(userPath).isDirectory()) continue
    for (const tenantDir of fs.readdirSync(userPath)) {
      const vcfPath = path.join(userPath, tenantDir, `${contactId}.vcf`)
      if (fs.existsSync(vcfPath)) {
        markRecentWrite(contactId)
        fs.unlinkSync(vcfPath)
        console.log(`[supabase→radicale] Deleted ${vcfPath}`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// RADICALE → SUPABASE
// ---------------------------------------------------------------------------

export function startFileWatcher(): void {
  const watcher = chokidar.watch(path.join(COLLECTIONS_PATH, '**/*.vcf'), {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  })

  watcher
    .on('add', (filePath) => handleVcfChange(filePath))
    .on('change', (filePath) => handleVcfChange(filePath))
    .on('unlink', (filePath) => handleVcfDelete(filePath))

  console.log('[radicale→supabase] File watcher active on', COLLECTIONS_PATH)
}

async function handleVcfChange(filePath: string): Promise<void> {
  try {
    const uid = path.basename(filePath, '.vcf')
    if (isRecentWrite(uid)) return

    const vcf = fs.readFileSync(filePath, 'utf8')
    const parsed = vCardToContact(vcf)
    if (!parsed.id) {
      console.warn(`[radicale→supabase] No UID in ${filePath}, skipping`)
      return
    }

    // Extract userEmail and tenantSlug from path:
    // .../collections/{email}/{slug}-addressbook/{uid}.vcf
    const parts = filePath.replace(COLLECTIONS_PATH + path.sep, '').split(path.sep)
    const userEmail = parts[0] ?? ''
    const tenantSlug = (parts[1] ?? 'master-addressbook').replace(/-addressbook$/, '')

    const tenantId = await getTenantId(tenantSlug)
    const userId = await getUserIdByEmail(userEmail)

    if (!userId) {
      console.warn(`[radicale→supabase] No user for email ${userEmail}, skipping`)
      return
    }

    // Check if contact exists
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', parsed.id)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('contacts')
        .update({
          first_name: parsed.first_name ?? '',
          last_name: parsed.last_name ?? null,
          email: parsed.email ?? null,
          phone: parsed.phone ?? null,
          company: parsed.company ?? null,
          job_title: parsed.job_title ?? null,
          notes: parsed.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.id)

      if (error) console.error('[radicale→supabase] UPDATE error:', error)
      else console.log(`[radicale→supabase] Updated contact ${parsed.id}`)
    } else {
      const { error } = await supabase.from('contacts').insert({
        id: parsed.id,
        user_id: userId,
        tenant_id: tenantId,
        first_name: parsed.first_name ?? '',
        last_name: parsed.last_name ?? null,
        email: parsed.email ?? null,
        phone: parsed.phone ?? null,
        company: parsed.company ?? null,
        job_title: parsed.job_title ?? null,
        notes: parsed.notes ?? null,
      })

      if (error) console.error('[radicale→supabase] INSERT error:', error)
      else console.log(`[radicale→supabase] Inserted contact ${parsed.id}`)
    }
  } catch (err) {
    console.error('[radicale→supabase] Error processing', filePath, err)
  }
}

async function handleVcfDelete(filePath: string): Promise<void> {
  try {
    const uid = path.basename(filePath, '.vcf')
    if (isRecentWrite(uid)) return

    const { error } = await supabase.from('contacts').delete().eq('id', uid)
    if (error) console.error('[radicale→supabase] DELETE error:', error)
    else console.log(`[radicale→supabase] Deleted contact ${uid}`)
  } catch (err) {
    console.error('[radicale→supabase] Error deleting', filePath, err)
  }
}
