'use client'

import { AgendaView } from '@/components/agenda/AgendaView'

export default function AgendaPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Agenda</h1>
        <p className="text-sm text-muted-foreground">Rappels en attente, tous contacts confondus</p>
      </div>
      <AgendaView />
    </div>
  )
}
