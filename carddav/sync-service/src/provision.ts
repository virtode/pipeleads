import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { supabase } from './supabase'
import { contactToVCard, type Contact } from './vcard'
import { generateCarddavPassword } from './password'

const DATA_PATH = process.env.CARDDAV_DATA_PATH ?? '/data'
const HTPASSWD_FILE = path.join(DATA_PATH, 'users')
const RADICALE_URL = process.env.RADICALE_URL ?? 'http://radicale:5232'
const CARDDAV_BASE_URL = process.env.CARDDAV_BASE_URL ?? 'https://carddav.pipeleads.app'

function readHtpasswd(): Map<string, string> {
  const map = new Map<string, string>()
  if (!fs.existsSync(HTPASSWD_FILE)) return map

  for (const line of fs.readFileSync(HTPASSWD_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const idx = trimmed.indexOf(':')
    if (idx === -1) continue
    map.set(trimmed.slice(0, idx), trimmed.slice(idx + 1))
  }
  return map
}

function writeHtpasswd(map: Map<string, string>): void {
  const content = [...map.entries()].map(([u, h]) => `${u}:${h}`).join('\n') + '\n'
  fs.mkdirSync(path.dirname(HTPASSWD_FILE), { recursive: true })
  fs.writeFileSync(HTPASSWD_FILE, content, 'utf8')
}

export interface ProvisionResult {
  server: string
  username: string
  path: string
}

export async function provisionTenantUser(
  userEmail: string,
  carddavPassword: string,
  tenantSlug: string
): Promise<ProvisionResult> {
  // 1. Hash password and upsert into htpasswd
  const hash = await bcrypt.hash(carddavPassword, 10)
  const map = readHtpasswd()
  map.set(userEmail, hash)
  writeHtpasswd(map)

  // 2. Create addressbook collection via MKCOL — let Radicale manage its own structure
  const collectionPath = `/${encodeURIComponent(userEmail)}/${tenantSlug}-addressbook/`
  const response = await fetch(`${RADICALE_URL}${collectionPath}`, {
    method: 'MKCOL',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${userEmail}:${carddavPassword}`).toString('base64'),
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
      <d:mkcol xmlns:d="DAV:" xmlns:cr="urn:ietf:params:xml:ns:carddav">
        <d:set><d:prop>
          <d:resourcetype><d:collection/><cr:addressbook/></d:resourcetype>
          <d:displayname>PipeLeads - ${tenantSlug}</d:displayname>
        </d:prop></d:set>
      </d:mkcol>`,
  })

  // 405 means the collection already exists — that's acceptable
  if (!response.ok && response.status !== 405) {
    console.warn(`[provision] MKCOL returned ${response.status} for ${collectionPath}`)
  }

  return {
    server: CARDDAV_BASE_URL,
    username: userEmail,
    path: collectionPath,
  }
}

export async function initialSync(): Promise<void> {
  console.log('[initialSync] Starting initial sync...')

  // Get all active tenants
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('is_active', true)

  if (tenantsError) {
    console.error('[initialSync] Failed to fetch tenants:', tenantsError)
    return
  }

  const tenantMap = new Map<string, string>(
    (tenants ?? []).map((t: { id: string; slug: string }) => [t.id, t.slug])
  )

  // Get all tenant_users that have a carddav_password set
  const { data: tenantUsers, error: tuError } = await supabase
    .from('tenant_users')
    .select('user_id, tenant_id, carddav_password')

  if (tuError) {
    console.error('[initialSync] Failed to fetch tenant_users:', tuError)
    return
  }

  // Get user emails from auth
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const userEmailMap = new Map(users.map((u) => [u.id, u.email ?? '']))

  let totalSynced = 0

  for (const tu of tenantUsers ?? []) {
    const tenantSlug = tu.tenant_id ? (tenantMap.get(tu.tenant_id) ?? 'master') : 'master'

    const userEmail = userEmailMap.get(tu.user_id)
    if (!userEmail) {
      console.warn(`[initialSync] No email for user ${tu.user_id}, skipping`)
      continue
    }

    let carddavPassword = tu.carddav_password
    if (!carddavPassword) {
      // Auto-generate and persist the password so future restarts don't re-provision
      try {
        carddavPassword = generateCarddavPassword(userEmail)
        await supabase
          .from('tenant_users')
          .update({ carddav_password: carddavPassword })
          .eq('user_id', tu.user_id)
          .eq('tenant_id', tu.tenant_id)
        console.log(`[initialSync] Auto-generated CardDAV password for ${userEmail} in ${tenantSlug}`)
      } catch (genErr) {
        console.error(`[initialSync] Failed to generate password for ${userEmail}:`, genErr)
        continue
      }
    }

    try {
      // Ensure htpasswd entry and collection exist
      await provisionTenantUser(userEmail, carddavPassword, tenantSlug)

      // Fetch and write contacts for this specific user
      const { synced, errors } = await writeTenantContacts(userEmail, carddavPassword, tenantSlug, tu.tenant_id, tu.user_id)
      totalSynced += synced
      console.log(`[initialSync] Tenant ${tenantSlug}: synced ${synced} contacts, ${errors} errors`)
    } catch (err) {
      console.error(`[initialSync] Error syncing tenant ${tenantSlug}:`, err)
    }
  }

  console.log(`[initialSync] Done. Total synced: ${totalSynced} contacts.`)
}

/**
 * Fetch contacts for a specific user within a tenant and PUT them via Radicale HTTP API.
 * Returns counts of synced and errored contacts.
 */
async function writeTenantContacts(
  userEmail: string,
  carddavPassword: string,
  tenantSlug: string,
  tenantId: string | null,
  userId: string
): Promise<{ synced: number; errors: number }> {
  const baseQuery = supabase.from('contacts').select('*').eq('user_id', userId)
  const query = tenantId ? baseQuery.eq('tenant_id', tenantId) : baseQuery.is('tenant_id', null)

  const { data: contacts, error } = await query
  if (error) {
    console.error(`[writeTenantContacts] Failed to fetch contacts for ${tenantSlug}:`, error)
    return { synced: 0, errors: 1 }
  }

  const encodedEmail = encodeURIComponent(userEmail)
  const authHeader = 'Basic ' + Buffer.from(`${userEmail}:${carddavPassword}`).toString('base64')

  let synced = 0
  let errors = 0

  for (const contact of contacts ?? []) {
    const url = `${RADICALE_URL}/${encodedEmail}/${tenantSlug}-addressbook/${contact.id}.vcf`
    const vcardBuffer = Buffer.from(contactToVCard(contact as Contact), 'utf-8')
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Length': vcardBuffer.length.toString(),
        'Authorization': authHeader,
      },
      body: vcardBuffer,
    })

    if (!response.ok) {
      console.error(`[writeTenantContacts] PUT ${url} returned ${response.status}`)
      errors++
    } else {
      synced++
    }
  }

  return { synced, errors }
}

/**
 * Sync all contacts for a specific tenant slug.
 * Called by POST /sync/:tenantSlug.
 */
export async function syncTenant(tenantSlug: string): Promise<{ synced: number; errors: number }> {
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', tenantSlug)
    .single()

  if (tenantError || !tenant) {
    throw new Error(`Tenant "${tenantSlug}" not found`)
  }

  const { data: tenantUsers } = await supabase
    .from('tenant_users')
    .select('user_id, carddav_password')
    .eq('tenant_id', tenant.id)

  const { data: { users } } = await supabase.auth.admin.listUsers()
  const userEmailMap = new Map(users.map((u) => [u.id, u.email ?? '']))

  let synced = 0
  let errors = 0

  for (const tu of tenantUsers ?? []) {
    if (!tu.carddav_password) continue

    const userEmail = userEmailMap.get(tu.user_id)
    if (!userEmail) continue

    try {
      await provisionTenantUser(userEmail, tu.carddav_password, tenantSlug)
      const result = await writeTenantContacts(userEmail, tu.carddav_password, tenantSlug, tenant.id, tu.user_id)
      synced += result.synced
      errors += result.errors
    } catch (err) {
      console.error(`[syncTenant] Error for ${tenantSlug}/${userEmail}:`, err)
      errors++
    }
  }

  return { synced, errors }
}
