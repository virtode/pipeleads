import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { supabase } from './supabase'
import { contactToVCard, type Contact } from './vcard'

const DATA_PATH = process.env.CARDDAV_DATA_PATH ?? '/data'
const HTPASSWD_FILE = path.join(DATA_PATH, 'users')

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

export async function provisionTenantUser(
  userEmail: string,
  carddavPassword: string,
  tenantSlug: string
): Promise<void> {
  // 1. Hash password and upsert into htpasswd
  const hash = await bcrypt.hash(carddavPassword, 10)
  const map = readHtpasswd()
  map.set(userEmail, hash)
  writeHtpasswd(map)

  // 2. Create addressbook directory
  const collectionPath = path.join(
    DATA_PATH,
    'collections',
    userEmail,
    tenantSlug,
    'addressbook'
  )
  fs.mkdirSync(collectionPath, { recursive: true })

  // 3. Write addressbook.props (Radicale collection metadata)
  const propsPath = path.join(collectionPath, '.Radicale.props')
  if (!fs.existsSync(propsPath)) {
    const props = JSON.stringify({
      'D:displayname': `PipeLeads - ${tenantSlug}`,
      'CR:addressbook-description': `PipeLeads CardDAV for ${tenantSlug}`,
      'tag': 'VADDRESSBOOK',
    })
    fs.writeFileSync(propsPath, props, 'utf8')
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

  // Get all contacts with their associated user email
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*, tenant_users!inner(user_id)')

  if (contactsError) {
    console.error('[initialSync] Failed to fetch contacts:', contactsError)
    return
  }

  // Get all tenant_users to resolve emails
  const { data: tenantUsers } = await supabase
    .from('tenant_users')
    .select('user_id, tenant_id')

  // Get user emails from auth
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const userEmailMap = new Map(users.map((u) => [u.id, u.email ?? '']))

  for (const contact of contacts ?? []) {
    const tenantSlug = contact.tenant_id ? (tenantMap.get(contact.tenant_id) ?? 'master') : 'master'

    // Find the user associated with this contact's tenant
    const tenantUser = (tenantUsers ?? []).find(
      (tu: { user_id: string; tenant_id: string | null }) =>
        tu.tenant_id === contact.tenant_id
    )
    if (!tenantUser) continue

    const userEmail = userEmailMap.get(tenantUser.user_id)
    if (!userEmail) continue

    const collectionPath = path.join(
      DATA_PATH,
      'collections',
      userEmail,
      tenantSlug,
      'addressbook'
    )
    fs.mkdirSync(collectionPath, { recursive: true })

    const vcfPath = path.join(collectionPath, `${contact.id}.vcf`)
    fs.writeFileSync(vcfPath, contactToVCard(contact as Contact), 'utf8')
  }

  console.log(`[initialSync] Done. Synced ${(contacts ?? []).length} contacts.`)
}
