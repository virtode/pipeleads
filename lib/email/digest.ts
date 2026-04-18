import { ActionTemplateLabels } from '@/lib/types/interactions'
import type { ActionTemplate } from '@/lib/types/interactions'

const TEMPLATE_EMOJI: Record<ActionTemplate, string> = {
  email_followup:   '📧',
  call:             '📞',
  linkedin_message: '💼',
  propose_meeting:  '☕',
  send_document:    '📄',
  other:            '✍️',
}

export interface DigestItem {
  id: string
  contact_id: string
  content: string
  action_template: string | null
  date: string
  contact: { id: string; first_name: string; last_name: string | null } | null
}

export interface DigestEmailOptions {
  overdueItems: DigestItem[]
  todayItems:   DigestItem[]
  appUrl:       string
}

function excerpt(text: string): string {
  return text.length > 80 ? text.slice(0, 80) + '…' : text
}

function contactName(item: DigestItem): string {
  if (!item.contact) return '—'
  return [item.contact.first_name, item.contact.last_name].filter(Boolean).join(' ')
}

function renderItem(item: DigestItem, appUrl: string): string {
  const tpl    = item.action_template as ActionTemplate | null
  const emoji  = tpl ? TEMPLATE_EMOJI[tpl] : '🔔'
  const label  = tpl ? ActionTemplateLabels[tpl] : 'Rappel'
  const link   = `${appUrl}/contacts?id=${item.contact_id}`
  const name   = contactName(item)
  const text   = excerpt(item.content)

  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:8px;">${emoji}</td>
            <td>
              <p style="margin:0 0 3px;font-size:14px;color:#111827;">
                <strong>${name}</strong>
                <span style="color:#6b7280;font-weight:400;"> — ${label}</span>
              </p>
              <p style="margin:0 0 5px;font-size:13px;color:#374151;line-height:1.5;">${text}</p>
              <a href="${link}" style="font-size:12px;color:#4f46e5;text-decoration:none;">
                Voir le contact →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

function renderSection(title: string, color: string, items: DigestItem[], appUrl: string): string {
  if (items.length === 0) return ''
  return `
    <tr>
      <td style="padding:20px 0 8px;">
        <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;
                  letter-spacing:0.05em;color:${color};">${title}</p>
      </td>
    </tr>
    ${items.map((i) => renderItem(i, appUrl)).join('')}`
}

export function buildDailyDigestHtml({
  overdueItems,
  todayItems,
  appUrl,
}: DigestEmailOptions): string {
  const total = overdueItems.length + todayItems.length
  const settingsUrl = `${appUrl}/settings`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PipeLeads — Récap du jour</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:24px 40px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;
                        letter-spacing:-0.3px;">PipeLeads</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 24px;">
              <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#111827;">
                Bonjour,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Tu as <strong>${total} rappel${total > 1 ? 's' : ''}</strong>
                en attente aujourd&apos;hui.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                ${renderSection('🔴 En retard', '#dc2626', overdueItems, appUrl)}
                ${renderSection('🟠 Aujourd\'hui', '#ea580c', todayItems, appUrl)}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f1f5f9;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                PipeLeads — Votre CRM &nbsp;·&nbsp;
                <a href="${settingsUrl}"
                   style="color:#4f46e5;text-decoration:none;">
                  Gérer mes préférences →
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
