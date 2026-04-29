import { NextRequest, NextResponse } from 'next/server'
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
  const { searchParams } = request.nextUrl
  const period = searchParams.get('period')
  const tenantId = searchParams.get('tenantId') ?? undefined

  const { startDate, endDate } = parsePeriod(period)

  try {
    const summary = await getSpendSummary({ tenantId, startDate, endDate })
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[admin/ai-consumption] getSpendSummary error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données de consommation' },
      { status: 500 },
    )
  }
}
