import { resolveAIConfig } from './config'

export interface LiteLLMConfig {
  baseURL: string
  apiKey: string
}

export function getLiteLLMConfig(apiKey?: string): LiteLLMConfig {
  return {
    baseURL: `${process.env.LITELLM_URL ?? 'http://litellm:4000'}/v1`,
    apiKey: apiKey ?? process.env.LITELLM_MASTER_KEY ?? '',
  }
}

export async function getAIModel(tenantId?: string): Promise<string> {
  const config = await resolveAIConfig(tenantId)
  return config.model
}

export function isAnthropicProvider(model: string): boolean {
  return model.startsWith('anthropic/')
}
