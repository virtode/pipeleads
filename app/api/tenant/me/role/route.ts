import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TenantRole } from '@/lib/tenant/roles'

export async function GET(): Promise<NextResponse<{ role: TenantRole | null } | { error: string }>> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('tenant_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ role: (data?.role ?? null) as TenantRole | null })
}
