'use client'

import { useState, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, FileImage, File, Loader2, Upload, Trash2,
  Download, AlertCircle, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatDate } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ContactFile {
  id: string
  contact_id: string
  name: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  description: string | null
  created_at: string
  signed_url: string | null
}

interface ContactFilesProps {
  contactId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp'
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  if (!mimeType) return <File className="h-5 w-5 shrink-0 text-muted-foreground" />
  if (mimeType.startsWith('image/'))
    return <FileImage className="h-5 w-5 shrink-0 text-blue-500" />
  if (mimeType === 'application/pdf')
    return <FileText className="h-5 w-5 shrink-0 text-red-500" />
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  )
    return <FileText className="h-5 w-5 shrink-0 text-green-600" />
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return <FileText className="h-5 w-5 shrink-0 text-orange-500" />
  return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function ContactFiles({ contactId }: ContactFilesProps) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [isMobile, setIsMobile] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])
  const [pendingDescription, setPendingDescription] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(false)

  // ── Fetch files ────────────────────────────────────────────────────────────

  const queryKey = ['contact-files', contactId]

  const { data: files, isLoading } = useQuery<ContactFile[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}/files`)
      if (!res.ok) throw new Error('Erreur lors du chargement des fichiers')
      const json = await res.json() as { data: ContactFile[] }
      return json.data
    },
  })

  // ── Delete mutation ────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/contacts/${contactId}/files/${fileId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? 'Erreur lors de la suppression')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  // ── Upload logic ───────────────────────────────────────────────────────────

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) return 'Fichier trop volumineux (maximum 20 Mo)'
    const allowed = ALLOWED_EXTENSIONS.split(',').map((e) => e.replace('.', ''))
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !allowed.includes(ext)) return 'Type de fichier non autorisé'
    return null
  }

  function selectFile(file: File) {
    const err = validateFile(file)
    if (err) {
      setUploadError(err)
      return
    }
    setUploadError(null)
    setPendingFile(file)
  }

  async function handleUpload() {
    if (!pendingFile) return
    setUploadProgress(true)
    setUploadError(null)

    try {
      const form = new FormData()
      form.append('file', pendingFile)
      form.append('name', pendingFile.name)
      if (pendingDescription.trim()) {
        form.append('description', pendingDescription.trim())
      }

      const res = await fetch(`/api/contacts/${contactId}/files`, {
        method: 'POST',
        body: form,
      })
      const json = await res.json() as { data?: ContactFile; error?: string }

      if (!res.ok || !json.data) {
        throw new Error(json.error ?? 'Erreur lors de l\'upload')
      }

      queryClient.invalidateQueries({ queryKey })
      setPendingFile(null)
      setPendingDescription('')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setUploadProgress(false)
    }
  }

  // ── Drag & drop handlers ───────────────────────────────────────────────────

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) selectFile(file)
  }, [])

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) selectFile(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Zone de drop */}
      <div
        onDragOver={!isMobile ? handleDragOver : undefined}
        onDragLeave={!isMobile ? handleDragLeave : undefined}
        onDrop={!isMobile ? handleDrop : undefined}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 text-center transition-colors',
          isMobile ? 'min-h-[120px] py-4' : 'py-6',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30',
        ].join(' ')}
      >
        <Upload className={isMobile ? 'h-5 w-5 text-muted-foreground' : 'h-6 w-6 text-muted-foreground'} />
        {isMobile ? (
          <p className="text-sm text-muted-foreground">
            <span className="text-primary underline">Appuyer pour choisir un fichier</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Glisser-déposer ou <span className="text-primary underline">choisir un fichier</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground/60">
          PDF, Word, Excel, PowerPoint, images — max 20 Mo
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* Aperçu avant upload */}
      {pendingFile && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileIcon mimeType={pendingFile.type} />
              <span className="text-sm truncate">{pendingFile.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatFileSize(pendingFile.size)}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setPendingFile(null); setUploadError(null) }}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Input
            placeholder="Description / note (optionnel)"
            value={pendingDescription}
            onChange={(e) => setPendingDescription(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="w-full h-8"
            onClick={handleUpload}
            disabled={uploadProgress}
          >
            {uploadProgress ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Upload en cours...</>
            ) : (
              <><Upload className="mr-1.5 h-3.5 w-3.5" /> Uploader</>
            )}
          </Button>
        </div>
      )}

      {/* Erreur */}
      {uploadError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Liste des fichiers */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : !files?.length ? (
        <p className="py-4 text-center text-sm text-muted-foreground italic">
          Aucun document associé
        </p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
            >
              <FileIcon mimeType={file.mime_type} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium max-w-[150px] sm:max-w-none">{file.name}</p>
                {file.description && (
                  <p className="truncate text-xs text-muted-foreground">{file.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.file_size)} · {formatDate(file.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {file.signed_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a href={file.signed_url} target="_blank" rel="noopener noreferrer" title="Télécharger">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        « {file.name} » sera définitivement supprimé.
                        Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(file.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
