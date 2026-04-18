import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'

// POST /api/settings/ical/regenerate
// Génère un nouveau token iCal pour l'utilisateur connecté.
// Le token est un secret — on ne le logue jamais.

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const token = randomBytes(32).toString('base64url')

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ical_token: token }, { onConflict: 'id' })

  if (error) {
    console.error('[ical/regenerate] upsert error:', error.message)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ token })
}
