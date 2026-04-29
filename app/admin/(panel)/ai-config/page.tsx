'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIConsumptionDashboard } from '@/components/admin/AIConsumptionDashboard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIConfigGlobal {
  id: string
  provider: string
  model: string
  budget_usd: number | null
  alert_threshold: number
  fallback_provider: string | null
  fallback_model: string | null
  allowed_providers: string[]
  allow_byok: boolean
  updated_at: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
] as const

const NO_FALLBACK = '__none__'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AIConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allModels, setAllModels] = useState<string[]>([])

  // Form state
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('')
  const [budgetUsd, setBudgetUsd] = useState('')
  const [alertThreshold, setAlertThreshold] = useState('80')
  const [fallbackProvider, setFallbackProvider] = useState(NO_FALLBACK)
  const [fallbackModel, setFallbackModel] = useState(NO_FALLBACK)
  const [allowedProviders, setAllowedProviders] = useState<string[]>(['anthropic'])
  const [allowByok, setAllowByok] = useState(true)

  // Derived model lists — include current value even if LiteLLM is down
  const providerModels = useMemo(() => {
    const prefix = `${provider}/`
    const list = allModels.filter((m) => m.startsWith(prefix))
    if (model && model.startsWith(prefix) && !list.includes(model)) return [model, ...list]
    return list
  }, [allModels, provider, model])

  const fallbackModels = useMemo(() => {
    if (fallbackProvider === NO_FALLBACK) return []
    const prefix = `${fallbackProvider}/`
    const list = allModels.filter((m) => m.startsWith(prefix))
    if (fallbackModel && fallbackModel !== NO_FALLBACK && fallbackModel.startsWith(prefix) && !list.includes(fallbackModel)) {
      return [fallbackModel, ...list]
    }
    return list
  }, [allModels, fallbackProvider, fallbackModel])

  useEffect(() => {
    fetch('/api/admin/ai-config')
      .then((r) => r.json())
      .then((data: { config: AIConfigGlobal; models: string[] }) => {
        const c = data.config
        setAllModels(data.models ?? [])
        setProvider(c.provider)
        setModel(c.model)
        setBudgetUsd(c.budget_usd != null ? String(c.budget_usd) : '')
        setAlertThreshold(String(c.alert_threshold))
        setFallbackProvider(c.fallback_provider ?? NO_FALLBACK)
        setFallbackModel(c.fallback_model ?? NO_FALLBACK)
        setAllowedProviders(c.allowed_providers)
        setAllowByok(c.allow_byok)
      })
      .catch(() => toast.error('Erreur lors du chargement de la configuration'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          budget_usd: budgetUsd !== '' ? parseFloat(budgetUsd) : null,
          alert_threshold: parseInt(alertThreshold, 10) || 80,
          fallback_provider: fallbackProvider !== NO_FALLBACK ? fallbackProvider : null,
          fallback_model: fallbackModel !== NO_FALLBACK ? fallbackModel : null,
          allowed_providers: allowedProviders,
          allow_byok: allowByok,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur lors de la sauvegarde')
        return
      }
      toast.success('Configuration sauvegardée')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  function toggleAllowedProvider(value: string, checked: boolean) {
    if (!checked && allowedProviders.length <= 1) return
    setAllowedProviders((prev) =>
      checked ? [...prev, value] : prev.filter((p) => p !== value)
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Configuration IA</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paramètres globaux de l&apos;IA appliqués à tous les tenants par défaut.
        </p>
      </div>

      <Tabs defaultValue="configuration">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="consumption">Consommation</TabsTrigger>
        </TabsList>

        <TabsContent value="consumption" className="mt-6">
          <AIConsumptionDashboard />
        </TabsContent>

        <TabsContent value="configuration" className="mt-6 space-y-8">

      {/* Modèle par défaut */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Modèle par défaut</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fournisseur</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v)
                setModel('')
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            {allModels.length === 0 && (
              <p className="text-xs text-amber-600">
                LiteLLM inaccessible — les modèles disponibles ne peuvent pas être listés.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget & Alertes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Budget & Alertes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="budget">Budget mensuel global</Label>
            <div className="relative">
              <Input
                id="budget"
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

          <div className="space-y-1.5">
            <Label htmlFor="threshold">Alerte à</Label>
            <div className="relative">
              <Input
                id="threshold"
                type="number"
                min="1"
                max="100"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                %
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fallback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fallback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fournisseur fallback</Label>
            <Select
              value={fallbackProvider}
              onValueChange={(v) => {
                setFallbackProvider(v)
                setFallbackModel(NO_FALLBACK)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FALLBACK}>Aucun</SelectItem>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fallbackProvider !== NO_FALLBACK && (
            <div className="space-y-1.5">
              <Label>Modèle fallback</Label>
              <Select
                value={fallbackModel}
                onValueChange={setFallbackModel}
                disabled={fallbackModels.length === 0}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FALLBACK}>Aucun</SelectItem>
                  {fallbackModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissions tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Permissions tenants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Fournisseurs autorisés</Label>
            {PROVIDERS.map((p) => {
              const checked = allowedProviders.includes(p.value)
              const isLast = allowedProviders.length <= 1 && checked
              return (
                <div key={p.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`allowed-${p.value}`}
                    checked={checked}
                    disabled={isLast}
                    onCheckedChange={(v) => toggleAllowedProvider(p.value, v === true)}
                  />
                  <Label
                    htmlFor={`allowed-${p.value}`}
                    className={`cursor-pointer font-normal ${isLast ? 'text-zinc-400' : ''}`}
                  >
                    {p.label}
                  </Label>
                </div>
              )
            })}
            <p className="text-xs text-zinc-400">Au moins un fournisseur doit rester activé.</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Clé API personnalisée (BYOK)</p>
              <p className="text-xs text-zinc-500">
                Les tenants peuvent utiliser leur propre clé API
              </p>
            </div>
            <Switch checked={allowByok} onCheckedChange={setAllowByok} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Sauvegarder
      </Button>

        </TabsContent>
      </Tabs>
    </div>
  )
}
