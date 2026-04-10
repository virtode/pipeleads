import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) return NextResponse.json({ error: 'no session' })

  const jwt = session.access_token
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())

  return NextResponse.json({
    user_id: user?.id,
    jwt_claims: payload
  })
}
