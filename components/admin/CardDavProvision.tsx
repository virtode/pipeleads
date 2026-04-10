'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Copy, Check, Smartphone, CheckCircle2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CardDavConfig {
  server: string
  username: string
  password: string
  path: string
  tenantName: string
}

interface TenantUserProp {
  email: string
  role: string
  userId: string
  hasCardDav: boolean
}

interface CardDavProvisionProps {
  tenantSlug: string
  tenantName: string
  users: TenantUserProp[]
}

type PanelMode = 'form' | 'config' | 'closed'

export function CardDavProvision({ tenantSlug, tenantName, users }: CardDavProvisionProps) {
  const [panelMode, setPanelMode] = useState<Record<string, PanelMode>>(() => {
    const init: Record<string, PanelMode> = {}
    users.forEach((u) => { init[u.email] = 'closed' })
    return init
  })
  const [configs, setConfigs] = useState<Record<string, CardDavConfig>>({})
  const [configuredSet, setConfiguredSet] = useState<Set<string>>(() => {
    return new Set(users.filter((u) => u.hasCardDav).map((u) => u.email))
  })

  // Shared form state — only one panel open at a time
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function openForm(email: string) {
    setPanelMode((prev) => {
      const next: Record<string, PanelMode> = {}
      Object.keys(prev).forEach((k) => { next[k] = 'closed' })
      next[email] = 'form'
      return next
    })
    setPassword('')
    setConfirm('')
  }

  function closePanel(email: string) {
    setPanelMode((prev) => ({ ...prev, [email]: 'closed' }))
    setPassword('')
    setConfirm('')
  }

  async function handleSubmit(e: React.FormEvent, userEmail: string) {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères')
      return
    }
    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/carddav/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, userEmail, carddavPassword: password }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur lors du provisioning')
        return
      }

      const newConfig = json.data as CardDavConfig
      setConfigs((prev) => ({ ...prev, [userEmail]: newConfig }))
      setConfiguredSet((prev) => new Set([...prev, userEmail]))
      setPanelMode((prev) => ({ ...prev, [userEmail]: 'config' }))
      toast.success('Synchronisation CardDAV activée')
      setPassword('')
      setConfirm('')

      // Trigger initial sync for this tenant
      fetch(`/api/carddav/sync/${encodeURIComponent(tenantSlug)}`, { method: 'POST' })
        .then((r) => r.json())
        .then((r) => {
          if (r.data) toast.success(`${r.data.synced} contact(s) synchronisé(s)`)
        })
        .catch(() => {})
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  function buildConfigText(cfg: CardDavConfig): string {
    return [
      'Configuration iOS :',
      'Réglages → Contacts → Comptes → Ajouter → Autre → Compte CardDAV',
      '',
      `Serveur      : ${cfg.server}`,
      `Identifiant  : ${cfg.username}`,
      `Mot de passe : ${cfg.password}`,
      `Description  : PipeLeads - ${cfg.tenantName}`,
    ].join('\n')
  }

  async function handleCopy(email: string) {
    const cfg = configs[email]
    if (!cfg) return
    await navigator.clipboard.writeText(buildConfigText(cfg))
    setCopied(email)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Configuration copiée')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-zinc-500" />
        <h2 className="text-base font-semibold">Synchronisation CardDAV</h2>
      </div>

      <div className="rounded-lg border divide-y text-sm">
        {users.length === 0 ? (
          <div className="py-6 text-center text-zinc-500 text-sm">
            Aucun utilisateur dans ce tenant
          </div>
        ) : (
          users.map((u) => {
            const isConfigured = configuredSet.has(u.email)
            const config = configs[u.email]
            const mode = panelMode[u.email] ?? 'closed'

            return (
              <div key={u.userId}>
                {/* User row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{u.email}</p>
                    <p className="text-xs text-zinc-500 capitalize">{u.role}</p>
                  </div>

                  <div className="shrink-0 w-28 text-right">
                    {isConfigured ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Activé
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">Non configuré</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {mode === 'config' && config && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(u.email)}
                        className="h-7 gap-1 text-xs"
                      >
                        {copied === u.email ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        Copier
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() =>
                        mode !== 'closed' ? closePanel(u.email) : openForm(u.email)
                      }
                    >
                      <Settings className="h-3 w-3" />
                      {mode !== 'closed'
                        ? 'Fermer'
                        : isConfigured
                        ? 'Reconfigurer'
                        : 'Configurer'}
                    </Button>
                  </div>
                </div>

                {/* Inline form */}
                {mode === 'form' && (
                  <div className="px-4 pb-4 pt-3 border-t bg-zinc-50 dark:bg-zinc-900">
                    <form onSubmit={(e) => handleSubmit(e, u.email)} className="space-y-3">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Configuration CardDAV pour{' '}
                        <span className="font-semibold">{u.email}</span>
                      </p>
                      <div className="space-y-1.5">
                        <Label htmlFor={`pwd-${u.userId}`}>Mot de passe CardDAV</Label>
                        <Input
                          id={`pwd-${u.userId}`}
                          type="password"
                          placeholder="Minimum 8 caractères"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`confirm-${u.userId}`}>Confirmer le mot de passe</Label>
                        <Input
                          id={`confirm-${u.userId}`}
                          type="password"
                          placeholder="Répétez le mot de passe"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
                          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Activer
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => closePanel(u.email)}
                        >
                          Annuler
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Inline iOS config (shown right after provisioning) */}
                {mode === 'config' && config && (
                  <div className="px-4 pb-4 pt-3 border-t bg-zinc-50 dark:bg-zinc-900 space-y-3">
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Configuration iOS
                    </p>
                    <p className="text-xs text-zinc-400">
                      Réglages → Contacts → Comptes → Ajouter → Autre → Compte CardDAV
                    </p>
                    <div className="rounded border divide-y text-sm bg-white dark:bg-zinc-800">
                      <ConfigRow label="Serveur" value={config.server} />
                      <ConfigRow label="Identifiant" value={config.username} />
                      <ConfigRow label="Mot de passe" value={config.password} secret />
                      <ConfigRow
                        label="Description"
                        value={`PipeLeads - ${config.tenantName}`}
                      />
                    </div>
                    <p className="text-xs text-zinc-400 font-mono">Chemin : {config.path}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-zinc-500 text-xs"
                      onClick={() => {
                        setConfigs((prev) => {
                          const next = { ...prev }
                          delete next[u.email]
                          return next
                        })
                        openForm(u.email)
                      }}
                    >
                      Changer le mot de passe CardDAV
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function ConfigRow({
  label,
  value,
  secret,
}: {
  label: string
  value: string
  secret?: boolean
}) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <span className="w-28 shrink-0 text-zinc-500">{label}</span>
      <span className="flex-1 font-mono text-xs truncate">
        {secret && !revealed ? '••••••••' : value}
      </span>
      {secret && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="text-xs text-zinc-400 hover:text-zinc-600 shrink-0"
        >
          {revealed ? 'Masquer' : 'Afficher'}
        </button>
      )}
    </div>
  )
}
