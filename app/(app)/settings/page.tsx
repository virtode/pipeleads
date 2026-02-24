'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Settings, Link2, RefreshCw, CheckCircle2, XCircle,
  AlertCircle, Loader2, LogOut, Database,
  ArrowRight, Info,
} from 'lucide-react'
import { useStytch, useStytchUser } from '@stytch/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ---------------------------------------------------------------------------
// CRM field options for mapping
// ---------------------------------------------------------------------------

const CRM_FIELDS = [
  { value: 'full_name', label: 'Nom complet' },
  { value: 'first_name', label: 'Prénom' },
  { value: 'last_name', label: 'Nom' },
  { value: 'email', label: 'Email (principal)' },
  { value: 'phone', label: 'Téléphone (principal)' },
  { value: 'company', label: 'Entreprise' },
  { value: 'job_title', label: 'Poste' },
  { value: 'address', label: 'Adresse' },
  { value: 'city', label: 'Ville' },
  { value: 'country', label: 'Pays' },
  { value: 'tags', label: 'Tags' },
  { value: 'notes', label: 'Notes' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'twitter_url', label: 'Twitter/X URL' },
  { value: 'website', label: 'Site web' },
] as const

interface StoredConfig {
  database_id: string
  field_mapping: Record<string, string>
  last_sync_at: string | null
  has_token: boolean
}

interface SyncReport {
  total: number
  created: number
  updated: number
  errors: Array<{ contactId: string; name: string; error: string }>
  duration_ms: number
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const router = useRouter()
  const stytch = useStytch()
  const { user } = useStytchUser()

  // --- Notion config state ---
  const [token, setToken] = useState('')
  const [databaseId, setDatabaseId] = useState('')
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [storedConfig, setStoredConfig] = useState<StoredConfig | null>(null)

  // --- UI state ---
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [logoutLoading, setLogoutLoading] = useState(false)

  // ---------------------------------------------------------------------------
  // Load stored config on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/notion/config')
        const json = await res.json()
        if (json.data) {
          const cfg: StoredConfig = json.data
          setStoredConfig(cfg)
          setDatabaseId(cfg.database_id ?? '')
          setFieldMapping(cfg.field_mapping ?? {})
        }
      } catch {
        // ignore
      } finally {
        setLoadingConfig(false)
      }
    }
    loadConfig()
  }, [])

  // ---------------------------------------------------------------------------
  // Test connection
  // ---------------------------------------------------------------------------

  async function handleTest() {
    if (!databaseId.trim()) {
      setTestStatus('error')
      setTestMessage("Remplis l'ID de la base de données")
      return
    }

    setTestStatus('loading')
    setTestMessage('')

    try {
      const res = await fetch('/api/notion/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim() || undefined,
          database_id: databaseId.trim(),
        }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setTestStatus('error')
        setTestMessage(json.error ?? 'Connexion échouée')
        return
      }

      setTestStatus('ok')
      setTestMessage(`Connexion OK — "${json.data.title}" (${json.data.propertyCount} propriétés)`)
    } catch {
      setTestStatus('error')
      setTestMessage('Erreur réseau')
    }
  }

  // ---------------------------------------------------------------------------
  // Save config
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!databaseId.trim()) return

    setSaveStatus('loading')

    try {
      const res = await fetch('/api/notion/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim() || undefined,
          database_id: databaseId.trim(),
          field_mapping: fieldMapping,
        }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setSaveStatus('error')
        return
      }

      setSaveStatus('ok')
      setToken('') // Clear token from UI after save
      setStoredConfig((prev) => ({
        database_id: databaseId.trim(),
        field_mapping: fieldMapping,
        last_sync_at: prev?.last_sync_at ?? null,
        has_token: true,
      }))
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    }
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  async function handleSync() {
    setSyncStatus('loading')
    setSyncReport(null)
    setSyncError(null)

    try {
      const res = await fetch('/api/notion/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setSyncStatus('error')
        setSyncError(json.error ?? 'Erreur lors de la synchronisation')
        return
      }

      setSyncStatus('ok')
      setSyncReport(json.data)
      setStoredConfig((prev) =>
        prev ? { ...prev, last_sync_at: new Date().toISOString() } : prev,
      )
      const r = json.data
      toast.success(
        `Sync Notion terminée — ${r.created} créé${r.created !== 1 ? 's' : ''}, ${r.updated} mis à jour` +
        (r.errors?.length > 0 ? ` (${r.errors.length} erreur${r.errors.length !== 1 ? 's' : ''})` : '')
      )
    } catch {
      setSyncStatus('error')
      setSyncError('Erreur réseau')
      toast.error('Erreur lors de la synchronisation Notion')
    }
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  async function handleLogout() {
    setLogoutLoading(true)
    try {
      await stytch.session.revoke()
      router.push('/login')
    } catch {
      setLogoutLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Field mapping helpers
  // ---------------------------------------------------------------------------

  function setMapping(crmField: string, notionProp: string) {
    setFieldMapping((prev) => {
      const next = { ...prev }
      if (notionProp === '__none__') {
        delete next[crmField]
      } else {
        next[crmField] = notionProp
      }
      return next
    })
  }

  const mappedCount = Object.values(fieldMapping).filter(Boolean).length

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loadingConfig) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure les intégrations et ton compte.
        </p>
      </div>

      {/* ================================================================ */}
      {/* Notion Integration                                                */}
      {/* ================================================================ */}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Intégration Notion</h2>
          {storedConfig?.has_token && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Configuré
            </Badge>
          )}
        </div>

        {/* Token + DB ID */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Connexion</CardTitle>
            <CardDescription>
              Crée une intégration sur{' '}
              <span className="font-medium">notion.so/my-integrations</span> et colle
              le token interne ci-dessous. Partage ensuite ta base de données avec l'intégration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notion-token">
                Token d'intégration
                {storedConfig?.has_token && (
                  <span className="ml-2 text-xs text-muted-foreground">(laisse vide pour conserver l'existant)</span>
                )}
              </Label>
              <Input
                id="notion-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={storedConfig?.has_token ? '••••••••••••••••' : 'secret_...'}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notion-db">ID de la base de données</Label>
              <Input
                id="notion-db"
                value={databaseId}
                onChange={(e) => setDatabaseId(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                L'ID se trouve dans l'URL de ta base Notion, entre le dernier
                <code className="mx-1 rounded bg-muted px-1">/</code>et
                <code className="ml-1 rounded bg-muted px-1">?v=…</code>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testStatus === 'loading' || (!token && !storedConfig?.has_token)}
                className="gap-1.5"
              >
                {testStatus === 'loading' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                Tester la connexion
              </Button>
            </div>

            {testStatus === 'ok' && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {testMessage}
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 shrink-0" />
                {testMessage}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Field mapping */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Correspondance des champs</CardTitle>
            <CardDescription>
              Associe chaque champ CRM à une propriété de ta base Notion.
              {mappedCount > 0 && (
                <span className="ml-1 text-foreground font-medium">
                  {mappedCount} champ{mappedCount > 1 ? 's' : ''} mappé{mappedCount > 1 ? 's' : ''}.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs font-medium text-muted-foreground pb-1">
              <span>Champ CRM</span>
              <span />
              <span>Propriété Notion</span>
            </div>

            {CRM_FIELDS.map(({ value: crmField, label }) => (
              <div
                key={crmField}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
              >
                <div className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm">
                  {label}
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={fieldMapping[crmField] ?? ''}
                  onChange={(e) => setMapping(crmField, e.target.value)}
                  placeholder="Nom de la propriété…"
                  className="h-8 text-sm"
                />
              </div>
            ))}

            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Saisis le nom exact de la propriété Notion (respecte la casse).
              Les champs non mappés sont ignorés lors de la synchronisation.
            </p>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saveStatus === 'loading' || !databaseId.trim()}
            className="gap-1.5"
          >
            {saveStatus === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saveStatus === 'ok' && <CheckCircle2 className="h-3.5 w-3.5" />}
            Sauvegarder la configuration
          </Button>

          {saveStatus === 'ok' && (
            <span className="text-sm text-green-600 dark:text-green-400">Configuration sauvegardée !</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-destructive">Erreur lors de la sauvegarde.</span>
          )}
        </div>
      </section>

      <Separator />

      {/* ================================================================ */}
      {/* Sync                                                              */}
      {/* ================================================================ */}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Synchronisation</h2>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Exporter les contacts vers Notion</CardTitle>
            <CardDescription>
              Lance une synchronisation manuelle de tous tes contacts vers la base Notion configurée.
              Les contacts existants (même email) seront mis à jour ; les autres seront créés.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {storedConfig?.last_sync_at && (
              <p className="text-xs text-muted-foreground">
                Dernière sync :{' '}
                {new Date(storedConfig.last_sync_at).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}

            <Button
              onClick={handleSync}
              disabled={syncStatus === 'loading' || !storedConfig?.has_token}
              className="gap-1.5"
            >
              {syncStatus === 'loading' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Synchronisation en cours…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Synchroniser maintenant
                </>
              )}
            </Button>

            {!storedConfig?.has_token && (
              <p className="text-xs text-muted-foreground">
                Configure et sauvegarde ton intégration Notion pour activer la synchronisation.
              </p>
            )}

            {/* Sync result */}
            {syncStatus === 'ok' && syncReport && (
              <div className="rounded-lg border bg-green-50/50 dark:bg-green-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Synchronisation terminée en {(syncReport.duration_ms / 1000).toFixed(1)}s
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="rounded-md border bg-background p-2 text-center">
                    <p className="text-lg font-bold">{syncReport.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="rounded-md border bg-background p-2 text-center">
                    <p className="text-lg font-bold text-green-600">{syncReport.created}</p>
                    <p className="text-xs text-muted-foreground">Créés</p>
                  </div>
                  <div className="rounded-md border bg-background p-2 text-center">
                    <p className="text-lg font-bold text-blue-600">{syncReport.updated}</p>
                    <p className="text-xs text-muted-foreground">Mis à jour</p>
                  </div>
                </div>
                {syncReport.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-destructive">
                      {syncReport.errors.length} erreur{syncReport.errors.length > 1 ? 's' : ''} :
                    </p>
                    {syncReport.errors.slice(0, 5).map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        • {e.name} — {e.error}
                      </p>
                    ))}
                    {syncReport.errors.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        … et {syncReport.errors.length - 5} autre(s)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {syncStatus === 'error' && syncError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {syncError}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ================================================================ */}
      {/* Account                                                           */}
      {/* ================================================================ */}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Compte</h2>
        </div>

        <Card>
          <CardContent className="pt-5 space-y-4">
            {user && (
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Utilisateur connecté</p>
                <p className="text-sm text-muted-foreground">
                  {user.emails?.[0]?.email ?? user.phone_numbers?.[0]?.phone_number ?? 'Inconnu'}
                </p>
              </div>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                  <LogOut className="h-3.5 w-3.5" />
                  Se déconnecter
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tu seras redirigé vers la page de connexion.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLogout}
                    disabled={logoutLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {logoutLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Se déconnecter
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
