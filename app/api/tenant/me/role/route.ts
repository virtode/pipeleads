import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/tenant/roles'
import type { TenantRole } from '@/lib/tenant/roles'

export async function GET(): Promise<NextResponse<{ role: TenantRole | null } | { error: string }>> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const role = await getUserRole(supabase, user.id)
  return NextResponse.json({ role })
}
