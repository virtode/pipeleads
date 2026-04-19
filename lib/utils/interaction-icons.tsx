import { Mail, Phone, Linkedin, Coffee, FileText, PenLine, Bell } from 'lucide-react'

export const TEMPLATE_ICONS: Record<string, { icon: React.ElementType; className: string }> = {
  email_followup:   { icon: Mail,      className: 'text-blue-500' },
  call:             { icon: Phone,     className: 'text-green-500' },
  linkedin_message: { icon: Linkedin,  className: 'text-sky-600' },
  propose_meeting:  { icon: Coffee,    className: 'text-orange-400' },
  send_document:    { icon: FileText,  className: 'text-violet-500' },
  other:            { icon: PenLine,   className: 'text-muted-foreground' },
}

export const DEFAULT_TEMPLATE_ICON = { icon: Bell, className: 'text-muted-foreground' }

export function TemplateIcon({ template, size = 16 }: { template: string | null; size?: number }) {
  const { icon: Icon, className } = TEMPLATE_ICONS[template ?? ''] ?? DEFAULT_TEMPLATE_ICON
  return <Icon size={size} className={className} />
}
