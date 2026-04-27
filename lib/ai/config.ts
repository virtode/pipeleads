import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AIConfig {
  provider: string
  model: string
  apiKey?: string
  budgetUsd?: number
}

export async function resolveAIConfig(tenantId?: string): Promise<AIConfig> {
  const { data: global } = await supabaseAdmin
    .from('ai_config_global')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  const defaults: AIConfig = {
    provider: global?.provider ?? 'anthropic',
    model: global?.model ?? process.env.DEFAULT_AI_MODEL ?? 'anthropic/claude-sonnet-4-6',
    budgetUsd: global?.budget_usd ?? undefined,
  }

  if (!tenantId) return defaults

  const { data: tenant } = await supabaseAdmin
    .from('ai_config_tenant')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  if (!tenant || tenant.use_global) return defaults

  return {
    provider: tenant.provider ?? defaults.provider,
    model: tenant.model ?? defaults.model,
    apiKey: tenant.encrypted_api_key ?? undefined,
    budgetUsd: tenant.budget_usd ?? defaults.budgetUsd,
  }
}
