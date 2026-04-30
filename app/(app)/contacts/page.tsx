import { ContactsPageClient } from './ContactsPageClient'

interface PageProps {
  searchParams: Promise<{
    id?: string
    new?: string
    import?: string
    export?: string
  }>
}

export default async function ContactsPage({ searchParams }: PageProps) {
  const params = await searchParams
  return (
    <ContactsPageClient
      initialId={params.id ?? null}
      openNew={params.new === '1'}
      openImportCSV={params.import === 'csv'}
      openExport={params.export === '1'}
    />
  )
}
