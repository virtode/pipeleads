'use client'

import {
  Mail, Phone, MapPin, Globe, Linkedin, Twitter,
  Tag, FileText, ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

function InfoRow({
  icon: Icon,
  children,
}: {
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1">{children}</span>
    </div>
  )
}

interface ContactInfoSectionProps {
  contact: {
    email: string[] | null
    phone: string[] | null
    address: string | null
    city: string | null
    postal_code: string | null
    country: string | null
    linkedin_url: string | null
    twitter_url: string | null
    website: string | null
    tags: string[] | null
    notes: string | null
  }
  interactionCount: number | undefined
  onAddInteraction: () => void
}

export function ContactInfoSection({
  contact,
  interactionCount,
  onAddInteraction,
}: ContactInfoSectionProps) {
  return (
    <>
      {/* Coordonnées */}
      <section className="space-y-2.5">
        {(contact.email ?? []).map((e) => (
          <InfoRow key={e} icon={Mail}>
            <a href={`mailto:${e}`} className="text-primary hover:underline">{e}</a>
          </InfoRow>
        ))}
        {(contact.phone ?? []).map((p) => (
          <InfoRow key={p} icon={Phone}>
            <a href={`tel:${p}`} className="hover:underline">{p}</a>
          </InfoRow>
        ))}

        {(contact.address || contact.city || contact.postal_code || contact.country) && (
          <InfoRow icon={MapPin}>
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent([contact.address, [contact.postal_code, contact.city].filter(Boolean).join(' ') || null, contact.country].filter(Boolean).join(', '))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col hover:underline"
            >
              {contact.address && <span>{contact.address}</span>}
              <span>
                {[
                  [contact.postal_code, contact.city].filter(Boolean).join(' ') || null,
                  contact.country,
                ].filter(Boolean).join(', ')}
              </span>
            </a>
          </InfoRow>
        )}
      </section>

      {/* Réseaux */}
      {(contact.linkedin_url || contact.twitter_url || contact.website) && (
        <section className="space-y-2">
            {contact.linkedin_url && (
              <InfoRow icon={Linkedin}>
                <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              </InfoRow>
            )}
            {contact.twitter_url && (
              <InfoRow icon={Twitter}>
                <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  Twitter / X <ExternalLink className="h-3 w-3" />
                </a>
              </InfoRow>
            )}
            {contact.website && (
              <InfoRow icon={Globe}>
                <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  Site web <ExternalLink className="h-3 w-3" />
                </a>
              </InfoRow>
            )}
        </section>
      )}

      {/* Tags */}
      {(contact.tags ?? []).length > 0 && (
        <>
          <section>
            <InfoRow icon={Tag}>
              <div className="flex flex-wrap gap-1">
                {contact.tags!.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </InfoRow>
          </section>
        </>
      )}

      {/* Invite timeline — visible uniquement si 0 interaction */}
      {interactionCount === 0 && (
        <button
          type="button"
          onClick={onAddInteraction}
          className="text-sm text-primary hover:underline text-left"
        >
          Aucune interaction pour l&apos;instant. Ajouter une note ou un rappel →
        </button>
      )}

      {/* Notes */}
      {contact.notes && (
        <>
          <Separator />
          <section>
            <InfoRow icon={FileText}>
              <p className="whitespace-pre-wrap text-sm">{contact.notes}</p>
            </InfoRow>
          </section>
        </>
      )}
    </>
  )
}
