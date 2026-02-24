import type { Tables } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types métier — dérivés des types Supabase Row
// ---------------------------------------------------------------------------

export type Contact = Tables<'contacts'>
export type Pipeline = Tables<'pipelines'>
export type PipelineStage = Tables<'pipeline_stages'>
export type ContactPipeline = Tables<'contact_pipeline'>
export type PipelineHistory = Tables<'pipeline_history'>
export type AiEnrichment = Tables<'ai_enrichments'>
export type NotionConfig = Tables<'notion_config'>

// ---------------------------------------------------------------------------
// Types enrichis — avec relations jointes
// ---------------------------------------------------------------------------

export interface ContactWithPipelines extends Contact {
  contact_pipeline: (ContactPipeline & {
    pipeline: Pipeline
    stage: PipelineStage | null
  })[]
}

export interface PipelineWithStages extends Pipeline {
  pipeline_stages: PipelineStage[]
}

export interface KanbanColumn {
  stage: PipelineStage
  contacts: (ContactPipeline & { contact: Contact })[]
}

export interface KanbanBoard {
  pipeline: Pipeline
  columns: KanbanColumn[]
  unassigned: (ContactPipeline & { contact: Contact })[]
}

// ---------------------------------------------------------------------------
// Types pour les formulaires
// ---------------------------------------------------------------------------

export interface ContactFormValues {
  first_name: string
  last_name: string
  email: string[]
  phone: string[]
  company: string
  job_title: string
  address: string
  city: string
  country: string
  tags: string[]
  notes: string
  linkedin_url: string
  twitter_url: string
  website: string
}

export interface PipelineFormValues {
  name: string
  description: string
}

export interface PipelineStageFormValues {
  name: string
  color: string
  position: number
}

// ---------------------------------------------------------------------------
// Types utilitaires
// ---------------------------------------------------------------------------

export type AiEnrichmentType = 'contact_profile' | 'company_news'

export interface NotionFieldMapping {
  [crmField: string]: string // crmField → notionPropertyName
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface ContactFilters {
  search?: string
  tags?: string[]
  company?: string
  country?: string
  pipelineId?: string
  stageId?: string
}

export interface ContactSortField {
  field: keyof Pick<Contact, 'first_name' | 'last_name' | 'company' | 'created_at' | 'updated_at'>
  direction: 'asc' | 'desc'
}
