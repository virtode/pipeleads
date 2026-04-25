import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalysisConfig {
  id: string
  pipeline_id: string
  tenant_id: string | null
  system_prompt: string
  context_prompt: string | null
  respondent_statuses: string[]
  silent_statuses: string[]
  excluded_statuses: string[]
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  first_name: string
  last_name: string | null
  company: string | null
  stage_id: string | null
}

export interface ContactsPayload {
  respondents: Contact[]
  silents: Contact[]
  excluded: Contact[]
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAnalysisConfig(
  supabase: SupabaseClient<Database>,
  pipelineId: string,
): Promise<AnalysisConfig | null> {
  // analysis_configs is not yet in lib/supabase/types.ts — add it when the migration is applied
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from('analysis_configs')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .maybeSingle()

  if (error) throw error
  return (data as AnalysisConfig) ?? null
}

export async function getContactsForAnalysis(
  supabase: SupabaseClient<Database>,
  pipelineId: string,
  config: AnalysisConfig,
): Promise<ContactsPayload> {
  const { data, error } = await supabase
    .from('contact_pipeline')
    .select(`
      stage_id,
      contacts (
        id,
        first_name,
        last_name,
        company
      )
    `)
    .eq('pipeline_id', pipelineId)

  if (error) throw error

  const respondents: Contact[] = []
  const silents: Contact[] = []
  const excluded: Contact[] = []

  for (const row of data ?? []) {
    const contactData = row.contacts as {
      id: string
      first_name: string
      last_name: string | null
      company: string | null
    } | null

    if (!contactData) continue

    const stageId = row.stage_id ?? null
    const contact: Contact = {
      id: contactData.id,
      first_name: contactData.first_name,
      last_name: contactData.last_name,
      company: contactData.company,
      stage_id: stageId,
    }

    if (stageId !== null && config.respondent_statuses.includes(stageId)) {
      respondents.push(contact)
    } else if (stageId !== null && config.silent_statuses.includes(stageId)) {
      silents.push(contact)
    } else if (stageId !== null && config.excluded_statuses.includes(stageId)) {
      excluded.push(contact)
    }
  }

  return { respondents, silents, excluded }
}
