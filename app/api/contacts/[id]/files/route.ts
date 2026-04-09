import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CONTACT_FILES_BUCKET,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  ensureContactFilesBucket,
} from '@/lib/supabase/storage'
import { randomUUID } from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contacts/[id]/files
// Liste les fichiers d'un contact avec signed URLs (60 min)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contactId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }

  // Vérifie que le contact appartient à l'utilisateur (via RLS)
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .single()

  if (contactErr || !contact) {
    return NextResponse.json({ data: null, error: 'Contact introuvable' }, { status: 404 })
  }

  // Récupère les métadonnées des fichiers
  const { data: files, error: filesErr } = await supabase
    .from('contact_files')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (filesErr) {
    return NextResponse.json({ data: null, error: 'Erreur lors de la récupération des fichiers' }, { status: 500 })
  }

  // Génère les signed URLs via le client admin
  const adminClient = await createAdminClient()
  const filesWithUrls = await Promise.all(
    (files ?? []).map(async (file) => {
      const { data: signed } = await adminClient.storage
        .from(CONTACT_FILES_BUCKET)
        .createSignedUrl(file.file_path, 60 * 60) // 60 minutes
      return { ...file, signed_url: signed?.signedUrl ?? null }
    })
  )

  return NextResponse.json({ data: filesWithUrls })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contacts/[id]/files
// Upload d'un fichier pour un contact (multipart/form-data)
// Champs : file (File), name? (string), description? (string)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contactId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }

  // Vérifie que le contact appartient à l'utilisateur (via RLS)
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .single()

  if (contactErr || !contact) {
    return NextResponse.json({ data: null, error: 'Contact introuvable' }, { status: 404 })
  }

  // Parse le formulaire multipart
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ data: null, error: 'Corps de requête invalide' }, { status: 400 })
  }

  const fileField = formData.get('file')
  if (!(fileField instanceof File)) {
    return NextResponse.json({ data: null, error: 'Fichier manquant' }, { status: 400 })
  }

  const file = fileField
  const displayName = (formData.get('name') as string | null)?.trim() || file.name
  const description = (formData.get('description') as string | null)?.trim() || null

  // Vérifications côté serveur
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { data: null, error: 'Fichier trop volumineux (maximum 20 Mo)' },
      { status: 400 }
    )
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { data: null, error: 'Type de fichier non autorisé' },
      { status: 400 }
    )
  }

  // Crée le bucket si nécessaire
  await ensureContactFilesBucket()

  // Chemin : contact-files/{contactId}/{uuid}_{filename}
  const uuid = randomUUID()
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${contactId}/${uuid}_${safeFileName}`

  const adminClient = await createAdminClient()

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await adminClient.storage
    .from(CONTACT_FILES_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    console.error('[contact-files] upload error:', uploadErr.message)
    return NextResponse.json({ data: null, error: 'Erreur lors de l\'upload du fichier' }, { status: 500 })
  }

  // Insère les métadonnées dans contact_files
  const { data: inserted, error: insertErr } = await supabase
    .from('contact_files')
    .insert({
      contact_id: contactId,
      name: displayName,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      description,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (insertErr) {
    // Rollback : supprime le fichier uploadé
    await adminClient.storage.from(CONTACT_FILES_BUCKET).remove([filePath])
    console.error('[contact-files] insert error:', insertErr.message)
    return NextResponse.json({ data: null, error: 'Erreur lors de l\'enregistrement des métadonnées' }, { status: 500 })
  }

  return NextResponse.json({ data: inserted }, { status: 201 })
}
