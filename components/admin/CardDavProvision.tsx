'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Check, Smartphone, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CardDavConfig {
  server: string
  username: string
  password: string
  path: string
}

interface TenantUserProp {
  email: string
  role: string
  userId: string
  config: CardDavConfig | null
}

interface CardDavProvisionProps {
  tenantName: string
  users: TenantUserProp[]
}

export function CardDavProvision({ tenantName, users }: CardDavProvisionProps) {
  const [copied, setCopied] = useState<string | null>(null)

  function buildConfigText(cfg: CardDavConfig): string {
    return [
      'Configuration iOS :',
      'Réglages → Contacts → Comptes → Ajouter → Autre → Compte CardDAV',
      '',
      `Serveur      : ${cfg.server}`,
      `Identifiant  : ${cfg.username}`,
      `Mot de passe : ${cfg.password}`,
      `Description  : PipeLeads - ${tenantName}`,
    ].join('\n')
  }

  async function handleCopy(email: string, cfg: CardDavConfig) {
    await navigator.clipboard.writeText(buildConfigText(cfg))
    setCopied(email)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Configuration copiée')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-zinc-500" />
        <h2 className="text-base font-semibold">Synchronisation CardDAV</h2>
      </div>

      <div className="rounded-lg border divide-y text-sm">
        {users.length === 0 ? (
          <div className="py-6 text-center text-zinc-500 text-sm">
            Aucun utilisateur dans ce tenant
          </div>
        ) : (
          users.map((u) => (
            <div key={u.userId}>
              {/* User row */}
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.email}</p>
                  <p className="text-xs text-zinc-500 capitalize">{u.role}</p>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  {u.config ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Activé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                      <XCircle className="h-3.5 w-3.5" />
                      Non provisionné
                    </span>
                  )}

                  {u.config && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(u.email, u.config!)}
                      className="h-7 gap-1 text-xs"
                    >
                      {copied === u.email ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Copier la config
                    </Button>
                  )}
                </div>
              </div>

              {/* iOS config panel */}
              {u.config && (
                <div className="px-4 pb-4 pt-3 border-t bg-zinc-50 dark:bg-zinc-900 space-y-3">
                  <p className="text-xs text-zinc-400">
                    Réglages → Contacts → Comptes → Ajouter → Autre → Compte CardDAV
                  </p>
                  <div className="rounded border divide-y text-sm bg-white dark:bg-zinc-800">
                    <ConfigRow label="Serveur" value={u.config.server} />
                    <ConfigRow label="Identifiant" value={u.config.username} />
                    <ConfigRow label="Mot de passe" value={u.config.password} secret />
                    <ConfigRow
                      label="Description"
                      value={`PipeLeads - ${tenantName}`}
                    />
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">Chemin : {u.config.path}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ConfigRow({
  label,
  value,
  secret,
}: {
  label: string
  value: string
  secret?: boolean
}) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <span className="w-28 shrink-0 text-zinc-500">{label}</span>
      <span className="flex-1 font-mono text-xs truncate">
        {secret && !revealed ? '••••••••' : value}
      </span>
      {secret && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="text-xs text-zinc-400 hover:text-zinc-600 shrink-0"
        >
          {revealed ? 'Masquer' : 'Afficher'}
        </button>
      )}
    </div>
  )
}
