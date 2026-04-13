import fs from 'fs'
import path from 'path'
import { setInterval } from 'timers'
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

let lastChecked = new Date().toISOString()

export function startSupabaseWatcher(): void {
  console.log('[supabase→radicale] Polling watcher active (30s interval)')

  setInterval(async () => {
    try {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .gte('updated_at', lastChecked)

      const now = new Date().toISOString()
      lastChecked = now

      if (!contacts || contacts.length === 0) return

      console.log(`[supabase→radicale] ${contacts.length} contact(s) updated, syncing...`)

      for (const contact of contacts) {
        await upsertVcf(contact as Contact)
      }
    } catch (err) {
      console.error('[supabase→radicale] Polling error:', err)
    }
  }, 30_000)
}

async function upsertVcf(contact: Contact): Promise<void> {
  const tenantSlug = await getTenantSlug(contact.tenant_id)
  const userId = contact.user_id
  const userEmail = await getUserEmail(userId)

  if (!userEmail) {
    console.warn(`[supabase→radicale] No email for user ${userId}, skipping`)
    return
  }

  const tuQuery = supabase.from('tenant_users').select('carddav_password').eq('user_id', userId)
  const { data: tu } = contact.tenant_id
    ? await tuQuery.eq('tenant_id', contact.tenant_id).single()
    : await tuQuery.is('tenant_id', null).single()

  const carddavPassword = tu?.carddav_password
  if (!carddavPassword) {
    console.warn(`[supabase→radicale] No carddav_password for user ${userId}, skipping`)
    return
  }

  const radicaleUrl = process.env.RADICALE_URL ?? 'http://radicale:5232'
  const url = `${radicaleUrl}/${encodeURIComponent(userEmail)}/${tenantSlug}-addressbook/${contact.id}.vcf`

  markRecentWrite(contact.id)

  const vcardBuffer = Buffer.from(contactToVCard(contact), 'utf-8')
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Length': vcardBuffer.length.toString(),
      'Authorization': 'Basic ' + Buffer.from(`${userEmail}:${carddavPassword}`).toString('base64'),
    },
    body: vcardBuffer,
  })

  if (!response.ok) {
    console.error(`[supabase→radicale] PUT ${url} returned ${response.status}`)
  } else {
    console.log(`[supabase→radicale] PUT ${url} — ${response.status}`)
  }
}

async function deleteVcf(contact: Partial<Contact>): Promise<void> {
  const contactId = contact.id
  if (!contactId) return

  const userId = contact.user_id
  if (!userId) {
    console.warn(`[supabase→radicale] No user_id in deleted contact ${contactId}, skipping`)
    return
  }

  const userEmail = await getUserEmail(userId)
  if (!userEmail) {
    console.warn(`[supabase→radicale] No email for user ${userId}, skipping delete`)
    return
  }

  const tenantSlug = await getTenantSlug(contact.tenant_id ?? null)

  const tuQuery = supabase.from('tenant_users').select('carddav_password').eq('user_id', userId)
  const { data: tu } = contact.tenant_id
    ? await tuQuery.eq('tenant_id', contact.tenant_id).single()
    : await tuQuery.is('tenant_id', null).single()

  const carddavPassword = tu?.carddav_password
  if (!carddavPassword) {
    console.warn(`[supabase→radicale] No carddav_password for user ${userId}, skipping delete`)
    return
  }

  const radicaleUrl = process.env.RADICALE_URL ?? 'http://radicale:5232'
  const url = `${radicaleUrl}/${encodeURIComponent(userEmail)}/${tenantSlug}-addressbook/${contactId}.vcf`

  markRecentWrite(contactId)

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${userEmail}:${carddavPassword}`).toString('base64'),
    },
  })

  if (!response.ok && response.status !== 404) {
    console.error(`[supabase→radicale] DELETE ${url} returned ${response.status}`)
  } else {
    console.log(`[supabase→radicale] DELETE ${url} — ${response.status}`)
  }
}

// ---------------------------------------------------------------------------
// RADICALE → SUPABASE
// ---------------------------------------------------------------------------

export function startFileWatcher(): void {
  const watcher = chokidar.watch(COLLECTIONS_PATH, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    ignored: [/\.Radicale\.cache/, /\.Radicale\.props/, /[/\\]history[/\\]/],
  })

  watcher
    .on('add', (filePath) => handleVcfChange(filePath))
    .on('change', (filePath) => handleVcfChange(filePath))
    .on('unlink', (filePath) => handleVcfDelete(filePath))

  console.log('[radicale→supabase] File watcher active on', COLLECTIONS_PATH)
}

async function handleVcfChange(filePath: string): Promise<void> {
  try {
    // Ignore non-.vcf files and Radicale internal files
    if (!filePath.endsWith('.vcf')) return
    if (filePath.includes('.Radicale.cache')) return
    if (filePath.includes('.Radicale.props')) return

    // Parse path: collection-root/{email}/{slug}-addressbook/{id}.vcf
    const rel = path.relative(COLLECTIONS_PATH, filePath)
    const parts = rel.split(path.sep)

    // Structure: collection-root / {email} / {slug}-addressbook / {id}.vcf
    if (parts[0] !== 'collection-root') return
    if (parts.length !== 4) return

    const userEmail = parts[1]
    const collectionName = parts[2]  // ex: aken-addressbook
    const tenantSlug = collectionName.replace('-addressbook', '')

    const uid = path.basename(filePath, '.vcf')
    if (isRecentWrite(uid)) return

    const vcf = fs.readFileSync(filePath, 'utf8')
    const parsed = vCardToContact(vcf)
    if (!parsed.id) {
      console.warn(`[radicale→supabase] No UID in ${filePath}, skipping`)
      return
    }

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
          address: parsed.address ?? null,
          city: parsed.city ?? null,
          postal_code: parsed.postal_code ?? null,
          country: parsed.country ?? null,
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
        address: parsed.address ?? null,
        city: parsed.city ?? null,
        postal_code: parsed.postal_code ?? null,
        country: parsed.country ?? null,
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
    if (!filePath.endsWith('.vcf')) return
    if (filePath.includes('.Radicale.cache')) return
    if (filePath.includes('.Radicale.props')) return

    // Only process files in collection-root
    const rel = path.relative(COLLECTIONS_PATH, filePath)
    const parts = rel.split(path.sep)
    if (parts[0] !== 'collection-root') return
    if (parts.length !== 4) return

    const uid = path.basename(filePath, '.vcf')
    if (isRecentWrite(uid)) return

    const { error } = await supabase.from('contacts').delete().eq('id', uid)
    if (error) console.error('[radicale→supabase] DELETE error:', error)
    else console.log(`[radicale→supabase] Deleted contact ${uid}`)
  } catch (err) {
    console.error('[radicale→supabase] Error deleting', filePath, err)
  }
}
