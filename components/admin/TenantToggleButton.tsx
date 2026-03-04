'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TenantToggleButtonProps {
  slug: string
  isActive: boolean
}

export function TenantToggleButton({ slug, isActive }: TenantToggleButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${slug}/toggle`, { method: 'POST' })
      const json = await res.json()

      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur')
        return
      }

      toast.success(json.data.is_active ? 'Tenant activé' : 'Tenant désactivé')
      router.refresh()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="gap-1.5"
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {isActive ? 'Désactiver' : 'Activer'}
    </Button>
  )
}
