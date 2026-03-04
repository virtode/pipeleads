import Link from 'next/link'

export default function TenantNotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-lg text-muted-foreground">Ce sous-domaine n'existe pas ou n'est plus actif.</p>
      <p className="text-sm text-muted-foreground">
        Vérifiez l'URL ou contactez votre administrateur.
      </p>
      <Link href="/" className="text-sm text-primary underline">
        Retour à l'accueil
      </Link>
    </div>
  )
}
