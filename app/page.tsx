import { redirect } from 'next/navigation'

// Middleware handles auth check — always redirect to /contacts.
// Unauthenticated users are redirected to /login by middleware before reaching here.
export default function RootPage() {
  redirect('/contacts')
}
