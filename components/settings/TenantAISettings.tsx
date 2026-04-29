'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

interface ModelBreakdown {
  model: string
  provider: string
  requests: number
  tokens: number
  spendUsd: number
}

interface SpendSummary {
  totalRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  totalSpendUsd: number
  byModel: ModelBreakdown[]
}

type Period = '7d' | '30d' | '3m'

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
  hasCustomApiKey: boolean
  budget_usd: number | null
}

interface ConfigPayload {
  tenantConfig: AIConfigTenant | null
  globalConfig: AIConfigGlobal
  models: string[]
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

export function TenantAISettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [globalConfig, setGlobalConfig] = useState<AIConfigGlobal | null>(null)
  const [allModels, setAllModels] = useState<string[]>([])
  const [liteLLMUnavailable, setLiteLLMUnavailable] = useState(false)

  const [useGlobal, setUseGlobal] = useState(true)
  const [provider, setProvider] = useState(NO_VALUE)
  const [model, setModel] = useState(NO_VALUE)
  const [apiKey, setApiKey] = useState('')
  const [hasCustomApiKey, setHasCustomApiKey] = useState(false)
  const [budgetUsd, setBudgetUsd] = useState('')

  const [consumptionPeriod, setConsumptionPeriod] = useState<Period>('30d')
  const [consumptionLoading, setConsumptionLoading] = useState(false)
  const [consumptionData, setConsumptionData] = useState<SpendSummary | null>(null)

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
    fetch('/api/tenant/ai-config')
      .then((r) => r.json())
      .then((data: ConfigPayload) => {
        setGlobalConfig(data.globalConfig)

        if (data.models.length === 0) {
          setLiteLLMUnavailable(true)
        }
        setAllModels(data.models)

        const tc = data.tenantConfig
        if (tc) {
          setUseGlobal(tc.use_global)
          setProvider(tc.provider ?? NO_VALUE)
          setModel(tc.model ?? NO_VALUE)
          setHasCustomApiKey(tc.hasCustomApiKey)
          setBudgetUsd(tc.budget_usd != null ? String(tc.budget_usd) : '')
        }
      })
      .catch(() => toast.error('Erreur lors du chargement de la configuration IA'))
      .finally(() => setLoading(false))
  }, [])

  const fetchConsumption = useCallback(async () => {
    setConsumptionLoading(true)
    try {
      const res = await fetch(`/api/tenant/ai-consumption?period=${consumptionPeriod}`)
      if (!res.ok) return
      const json = await res.json() as SpendSummary
      setConsumptionData(json)
    } catch {
      // silent — consumption is non-critical
    } finally {
      setConsumptionLoading(false)
    }
  }, [consumptionPeriod])

  useEffect(() => { void fetchConsumption() }, [fetchConsumption])

  async function handleDeleteApiKey() {
    setSaving(true)
    try {
      const res = await fetch('/api/tenant/ai-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted_api_key: null }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur lors de la suppression')
        return
      }
      setHasCustomApiKey(false)
      setApiKey('')
      toast.success('Clé API supprimée')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { use_global: useGlobal }

      if (!useGlobal) {
        body.provider = provider !== NO_VALUE ? provider : null
        body.model = model !== NO_VALUE ? model : null
        body.budget_usd = budgetUsd !== '' ? parseFloat(budgetUsd) : null
        if (apiKey !== '') body.encrypted_api_key = apiKey
        // If apiKey is empty and hasCustomApiKey, we don't touch encrypted_api_key
      }

      const res = await fetch('/api/tenant/ai-config', {
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

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return String(n)
  }

  function formatUsd(n: number): string {
    return `$${n.toFixed(4)}`
  }

  const PERIOD_LABELS: Record<Period, string> = {
    '7d': '7 jours',
    '30d': '30 jours',
    '3m': '3 mois',
  }

  const avgTokensPerRequest = consumptionData && consumptionData.totalRequests > 0
    ? Math.round(consumptionData.totalTokens / consumptionData.totalRequests)
    : 0

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Configuration IA</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Modèle d&apos;intelligence artificielle</CardTitle>
          <CardDescription>
            Personnalisez le modèle d&apos;IA utilisé par votre espace.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : (
            <>
              {/* Toggle: use global */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Utiliser la configuration globale</p>
                  <p className="text-xs text-muted-foreground">
                    Hérite des paramètres IA définis par l&apos;administrateur
                  </p>
                </div>
                <Switch checked={useGlobal} onCheckedChange={setUseGlobal} />
              </div>

              {/* Global info when use_global is on */}
              {useGlobal && globalConfig && (
                <p className="text-sm text-muted-foreground">
                  Votre espace utilise actuellement :{' '}
                  <span className="font-mono font-medium text-foreground">
                    {globalConfig.model}
                  </span>
                </p>
              )}

              {/* Override fields */}
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
                    {liteLLMUnavailable && model !== NO_VALUE && (
                      <p className="text-xs text-amber-600">
                        Le proxy LiteLLM est inaccessible — seul le modèle actuel est disponible.
                      </p>
                    )}
                    <Select
                      value={model}
                      onValueChange={setModel}
                      disabled={provider === NO_VALUE || providerModels.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            provider === NO_VALUE
                              ? 'Choisir un fournisseur d\'abord'
                              : providerModels.length === 0
                              ? 'Aucun modèle disponible'
                              : 'Sélectionner...'
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
                      <Label htmlFor="tenant-api-key">Clé API personnalisée (BYOK)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="tenant-api-key"
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={hasCustomApiKey ? '••••••••' : 'sk-...'}
                          autoComplete="off"
                          className="flex-1"
                        />
                        {hasCustomApiKey && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDeleteApiKey}
                            disabled={saving}
                          >
                            Supprimer la clé
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {hasCustomApiKey
                          ? 'Une clé API personnalisée est déjà configurée. Saisissez une nouvelle valeur pour la remplacer.'
                          : 'Votre clé API sera utilisée à la place de la clé globale.'}
                      </p>
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
                        placeholder="Laissez vide pour utiliser la limite globale."
                        className="pr-8"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Consommation IA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Consommation IA</CardTitle>
          <CardDescription>Utilisation de l&apos;IA par votre espace sur la période sélectionnée.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period selector */}
          <div className="flex gap-2">
            {(['7d', '30d', '3m'] as Period[]).map((p) => (
              <Button
                key={p}
                variant={consumptionPeriod === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setConsumptionPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>

          {consumptionLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          )}

          {!consumptionLoading && consumptionData && (
            <>
              {/* Stat cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Requêtes</p>
                  <p className="text-xl font-bold mt-0.5">{formatNumber(consumptionData.totalRequests)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Tokens totaux</p>
                  <p className="text-xl font-bold mt-0.5">{formatNumber(consumptionData.totalTokens)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatNumber(consumptionData.promptTokens)} entrée · {formatNumber(consumptionData.completionTokens)} sortie
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Coût estimé</p>
                  <p className="text-xl font-bold mt-0.5">{formatUsd(consumptionData.totalSpendUsd)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Tokens / requête moy.</p>
                  <p className="text-xl font-bold mt-0.5">{formatNumber(avgTokensPerRequest)}</p>
                </div>
              </div>

              {/* By model table */}
              {consumptionData.byModel.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="py-2 text-left font-medium">Modèle</th>
                        <th className="py-2 text-left font-medium">Fournisseur</th>
                        <th className="py-2 text-right font-medium">Requêtes</th>
                        <th className="py-2 text-right font-medium">Tokens</th>
                        <th className="py-2 text-right font-medium">Coût</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumptionData.byModel.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-mono text-xs">{row.model}</td>
                          <td className="py-2">
                            <Badge variant="secondary" className="text-xs">{row.provider}</Badge>
                          </td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(row.requests)}</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(row.tokens)}</td>
                          <td className="py-2 text-right tabular-nums">{formatUsd(row.spendUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {consumptionData.totalRequests === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Aucune donnée de consommation sur cette période.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
