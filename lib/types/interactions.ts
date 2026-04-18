import type { Tables, InsertDto, UpdateDto } from '@/lib/supabase/types'

export type Interaction = Tables<'interactions'>
export type InteractionInsert = InsertDto<'interactions'>
export type InteractionUpdate = UpdateDto<'interactions'>

export type InteractionType = 'note' | 'reminder'

export type ActionTemplate =
  | 'email_followup'
  | 'call'
  | 'linkedin_message'
  | 'propose_meeting'
  | 'send_document'
  | 'other'

export type InteractionStatus = 'pending' | 'done'

export const ActionTemplateLabels: Record<ActionTemplate, string> = {
  email_followup:   'Suivi par email',
  call:             'Appel téléphonique',
  linkedin_message: 'Message LinkedIn',
  propose_meeting:  'Proposer un rendez-vous',
  send_document:    'Envoyer un document',
  other:            'Autre',
}
