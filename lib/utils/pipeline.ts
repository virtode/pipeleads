export function countDistinctCompanies(contacts: { company?: string | null }[]): number {
  return new Set(contacts.filter((c) => c.company).map((c) => c.company!)).size
}
