'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Copy, Check, Smartphone } from 'lucide-react'
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

interface CardDavProvisionProps {
  tenantSlug: string
}

export function CardDavProvision({ tenantSlug }: CardDavProvisionProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<CardDavConfig | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères')
      return
    }
    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    // Resolve user email from current admin session
    const meRes = await fetch('/api/admin/me').catch(() => null)
    let userEmail = ''
    if (meRes?.ok) {
      const meJson = await meRes.json().catch(() => null)
      userEmail = meJson?.data?.email ?? ''
    }

    if (!userEmail) {
      toast.error('Impossible de récupérer votre email admin')
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

      setConfig(json.data as CardDavConfig)
      toast.success('Synchronisation CardDAV activée')
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

  async function handleCopy() {
    if (!config) return
    await navigator.clipboard.writeText(buildConfigText(config))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Configuration copiée')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-zinc-500" />
        <h2 className="text-base font-semibold">Synchronisation CardDAV</h2>
      </div>

      {!config ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="carddav-password">Mot de passe CardDAV</Label>
            <Input
              id="carddav-password"
              type="password"
              placeholder="Minimum 8 caractères"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="carddav-confirm">Confirmer le mot de passe</Label>
            <Input
              id="carddav-confirm"
              type="password"
              placeholder="Répétez le mot de passe"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={loading} className="gap-1.5">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Activer la synchronisation CardDAV
          </Button>
        </form>
      ) : (
        <div className="rounded-lg border bg-zinc-50 dark:bg-zinc-900 p-4 space-y-3">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Configuration iOS
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Réglages → Contacts → Comptes → Ajouter → Autre → Compte CardDAV
          </p>

          <div className="rounded border divide-y text-sm">
            <ConfigRow label="Serveur" value={config.server} />
            <ConfigRow label="Identifiant" value={config.username} />
            <ConfigRow label="Mot de passe" value={config.password} secret />
            <ConfigRow label="Description" value={`PipeLeads - ${config.tenantName}`} />
          </div>

          <p className="text-xs text-zinc-400 font-mono">
            Chemin : {config.path}
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Copier la configuration
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfig(null)}
            className="ml-2 text-zinc-500"
          >
            Modifier le mot de passe
          </Button>
        </div>
      )}
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
