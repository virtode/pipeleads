import type { AnalysisConfig, Contact, ContactsPayload } from './data'

// ---------------------------------------------------------------------------
// Output schema injected into every system prompt
// ---------------------------------------------------------------------------

const OUTPUT_SCHEMA = `
Tu dois répondre UNIQUEMENT avec un objet JSON valide respectant exactement ce schéma, sans markdown, sans commentaire :

{
  "respondent_profile": {
    "dominant_type": "string",
    "type_breakdown": [{ "type": "string", "pct": number }],
    "key_traits": ["string"],
    "insight": "string"
  },
  "to_follow_up": [{
    "contact_id": "string",
    "priority": number,
    "score": number,
    "reason": "string",
    "tags": ["string"],
    "specific_angle": "string"
  }],
  "do_not_follow_up": [{
    "contact_id": "string",
    "reason": "string"
  }],
  "key_insight": "string",
  "generated_at": "string (ISO 8601)",
  "model": "string"
}`.trim()

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function buildSystemPrompt(config: AnalysisConfig): string {
  const parts = [config.system_prompt]

  if (config.context_prompt) {
    parts.push(config.context_prompt)
  }

  parts.push(OUTPUT_SCHEMA)

  return parts.join('\n\n')
}

export function buildUserPrompt(payload: ContactsPayload): string {
  return [
    `RÉPONDANTS (${payload.respondents.length} contacts) :`,
    JSON.stringify(payload.respondents.map(serializeContact), null, 2),
    '',
    `SILENCIEUX (${payload.silents.length} contacts) :`,
    JSON.stringify(payload.silents.map(serializeContact), null, 2),
    '',
    'Génère l\'analyse.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeContact(contact: Contact) {
  return {
    id: contact.id,
    name: [contact.first_name, contact.last_name].filter(Boolean).join(' '),
    company: contact.company ?? null,
  }
}
