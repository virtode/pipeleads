import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/tenant/roles'
import { getSpendSummary } from '@/lib/litellm/db'

type Period = '7d' | '30d' | '3m'

function parsePeriod(raw: string | null): { startDate: Date; endDate: Date } {
  const end = new Date()
  const start = new Date(end)

  const period = (raw ?? '30d') as Period
  if (period === '7d') {
    start.setDate(start.getDate() - 7)
  } else if (period === '3m') {
    start.setMonth(start.getMonth() - 3)
  } else {
    start.setDate(start.getDate() - 30)
  }

  return { startDate: start, endDate: end }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    await requireManager(supabase, user.id)
  } catch {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const headerStore = await headers()
  const tenantId = headerStore.get('x-tenant-id')

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 })
  }

  const { searchParams } = request.nextUrl
  const period = searchParams.get('period')
  const { startDate, endDate } = parsePeriod(period)

  try {
    const summary = await getSpendSummary({ tenantId, startDate, endDate })
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[tenant/ai-consumption] getSpendSummary error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données de consommation' },
      { status: 500 },
    )
  }
}
