import { createOpenAI } from '@ai-sdk/openai'
import { DEFAULT_AI_MODEL } from '@/lib/constants'

export function getLiteLLMClient(_tenantId?: string) {
  return createOpenAI({
    baseURL: `${process.env.LITELLM_URL ?? 'http://litellm:4000'}/v1`,
    apiKey: process.env.LITELLM_MASTER_KEY ?? '',
  })
}

export function getAIModel(_tenantId?: string): string {
  return DEFAULT_AI_MODEL
}

export function isAnthropicProvider(model: string): boolean {
  return model.startsWith('anthropic/')
}
