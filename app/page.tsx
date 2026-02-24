import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const cookieStore = await cookies()
  const hasSession =
    !!cookieStore.get('stytch_session_jwt')?.value ||
    !!cookieStore.get('stytch_session')?.value

  if (hasSession) {
    redirect('/contacts')
  } else {
    redirect('/login')
  }
}
