'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIConfigGlobal {
  provider: string
  model: string
  allowed_providers: string[]
  allow_byok: boolean
}

interface AIConfigTenant {
  tenant_id: string
  use_global: boolean
  provider: string | null
  model: string | null
  encrypted_api_key: string | null
  budget_usd: number | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
}

const NO_VALUE = '__none__'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  slug: string
}

export function TenantAIConfigSection({ slug }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [globalConfig, setGlobalConfig] = useState<AIConfigGlobal | null>(null)
  const [allModels, setAllModels] = useState<string[]>([])

  // Form state
  const [useGlobal, setUseGlobal] = useState(true)
  const [provider, setProvider] = useState(NO_VALUE)
  const [model, setModel] = useState(NO_VALUE)
  const [apiKey, setApiKey] = useState('')
  const [budgetUsd, setBudgetUsd] = useState('')

  const allowedProviders = globalConfig?.allowed_providers ?? []

  const providerModels = useMemo(() => {
    if (provider === NO_VALUE) return []
    const prefix = `${provider}/`
    const list = allModels.filter((m) => m.startsWith(prefix))
    if (model && model !== NO_VALUE && model.startsWith(prefix) && !list.includes(model)) {
      return [model, ...list]
    }
    return list
  }, [allModels, provider, model])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/ai-config').then((r) => r.json()),
      fetch(`/api/admin/tenants/${slug}/ai-config`).then((r) => r.json()),
    ])
      .then(([globalData, tenantData]) => {
        const gc: AIConfigGlobal = globalData.config
        setGlobalConfig(gc)
        setAllModels(globalData.models ?? [])

        const tc: AIConfigTenant | null = tenantData.config
        if (tc) {
          setUseGlobal(tc.use_global)
          setProvider(tc.provider ?? NO_VALUE)
          setModel(tc.model ?? NO_VALUE)
          setApiKey('')
          setBudgetUsd(tc.budget_usd != null ? String(tc.budget_usd) : '')
        }
      })
      .catch(() => toast.error('Erreur lors du chargement de la configuration IA'))
      .finally(() => setLoading(false))
  }, [slug])

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        use_global: useGlobal,
      }

      if (!useGlobal) {
        body.provider = provider !== NO_VALUE ? provider : null
        body.model = model !== NO_VALUE ? model : null
        body.budget_usd = budgetUsd !== '' ? parseFloat(budgetUsd) : null
        if (apiKey !== '') body.encrypted_api_key = apiKey
      }

      const res = await fetch(`/api/admin/tenants/${slug}/ai-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur lors de la sauvegarde')
        return
      }
      toast.success('Configuration IA sauvegardée')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toggle: use global */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Utiliser la configuration globale</p>
          <p className="text-xs text-zinc-500">
            Hérite des paramètres IA définis par le super admin
          </p>
        </div>
        <Switch checked={useGlobal} onCheckedChange={setUseGlobal} />
      </div>

      {/* Per-tenant overrides */}
      {!useGlobal && (
        <div className="space-y-4 rounded-lg border p-4">
          {/* Provider */}
          <div className="space-y-1.5">
            <Label>Fournisseur</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v)
                setModel(NO_VALUE)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {allowedProviders.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PROVIDER_LABELS[p] ?? p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label>Modèle</Label>
            <Select
              value={model}
              onValueChange={setModel}
              disabled={providerModels.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    providerModels.length === 0 ? 'Aucun modèle disponible' : 'Sélectionner...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {providerModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* BYOK */}
          {globalConfig?.allow_byok && (
            <div className="space-y-1.5">
              <Label htmlFor="api-key">Clé API (BYOK)</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Laisser vide pour conserver la clé actuelle"
                autoComplete="off"
              />
            </div>
          )}

          {/* Budget */}
          <div className="space-y-1.5">
            <Label htmlFor="tenant-budget">Budget mensuel</Label>
            <div className="relative">
              <Input
                id="tenant-budget"
                type="number"
                min="0"
                step="0.01"
                value={budgetUsd}
                onChange={(e) => setBudgetUsd(e.target.value)}
                placeholder="Illimité"
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                $
              </span>
            </div>
          </div>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Sauvegarder
      </Button>
    </div>
  )
}
