import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONTACT_FILES_BUCKET } from '@/lib/supabase/storage'

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/contacts/[id]/files/[fileId]
// Supprime un fichier du Storage et sa ligne dans contact_files
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: contactId, fileId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 })
  }

  // Récupère les métadonnées du fichier
  // La policy RLS vérifie que le fichier appartient bien à un contact de l'utilisateur
  const { data: file, error: fileErr } = await supabase
    .from('contact_files')
    .select('id, file_path, contact_id')
    .eq('id', fileId)
    .eq('contact_id', contactId)
    .single()

  if (fileErr || !file) {
    return NextResponse.json({ data: null, error: 'Fichier introuvable' }, { status: 404 })
  }

  // Supprime le fichier du Storage
  const adminClient = createAdminClient()
  const { error: storageErr } = await adminClient.storage
    .from(CONTACT_FILES_BUCKET)
    .remove([file.file_path])

  if (storageErr) {
    console.error('[contact-files] storage delete error:', storageErr.message)
    // On continue quand même pour supprimer les métadonnées
  }

  // Supprime la ligne dans contact_files
  const { error: deleteErr } = await supabase
    .from('contact_files')
    .delete()
    .eq('id', fileId)

  if (deleteErr) {
    console.error('[contact-files] db delete error:', deleteErr.message)
    return NextResponse.json({ data: null, error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ data: { id: fileId } })
}
