'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Users, UserPlus, Trash2, Loader2, ShieldCheck, UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import Link from 'next/link'
import { useSupabaseClient } from '@/lib/supabase/context'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMember {
  id: string
  userId: string
  role: 'manager' | 'member'
  email: string | null
  createdAt: string
  invitedBy: string | null
  lastSignIn: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: 'manager' | 'member' }) {
  if (role === 'manager') {
    return (
      <Badge variant="secondary" className="gap-1">
        <ShieldCheck className="h-3 w-3 text-primary" />
        Manager
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <UserRound className="h-3 w-3 text-muted-foreground" />
      Membre
    </Badge>
  )
}

function Initials({ email }: { email: string | null }) {
  const initials = email ? email.slice(0, 2).toUpperCase() : '??'
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeamPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<'manager' | 'member' | null>(null)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('member')
  const [inviteLoading, setInviteLoading] = useState(false)

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<TeamMember | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  // ---------------------------------------------------------------------------
  // Auth + role check
  // ---------------------------------------------------------------------------

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [supabase])

  const loadTeam = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team')
      if (res.status === 403) {
        // Not a manager — redirect to settings
        router.replace('/settings')
        return
      }
      const json = await res.json()
      if (json.data) {
        const members: TeamMember[] = json.data
        setTeam(members)
        if (currentUserId) {
          const me = members.find((m) => m.userId === currentUserId)
          setCurrentRole(me?.role ?? 'member')
        }
      }
    } catch {
      toast.error('Erreur lors du chargement de l\'équipe')
    } finally {
      setLoading(false)
    }
  }, [router, currentUserId])

  useEffect(() => {
    if (currentUserId !== null) {
      loadTeam()
    }
  }, [currentUserId, loadTeam])

  // ---------------------------------------------------------------------------
  // Invite
  // ---------------------------------------------------------------------------

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur lors de l\'invitation')
        return
      }
      toast.success(`Invitation envoyée à ${inviteEmail}`)
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('member')
      await loadTeam()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setInviteLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Role change
  // ---------------------------------------------------------------------------

  async function handleRoleChange(member: TeamMember, newRole: 'manager' | 'member') {
    try {
      const res = await fetch(`/api/team/${member.userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur lors du changement de rôle')
        return
      }
      toast.success(`Rôle mis à jour`)
      await loadTeam()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  // ---------------------------------------------------------------------------
  // Revoke
  // ---------------------------------------------------------------------------

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevokeLoading(true)
    try {
      const res = await fetch(`/api/team/${revokeTarget.userId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Erreur lors de la révocation')
        return
      }
      toast.success(`Accès révoqué`)
      setRevokeTarget(null)
      await loadTeam()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setRevokeLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">
        <h1 className="text-2xl font-bold">Équipe</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/settings">← Retour aux paramètres</Link>
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez les membres et leurs rôles.
          </p>
        </div>
        {currentRole === 'manager' && (
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Inviter un membre
          </Button>
        )}
      </div>

      {/* Team table */}
      <div className="rounded-lg border">
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b px-4 py-3 text-xs font-medium text-muted-foreground">
          <span />
          <span>Membre</span>
          <span>Rôle</span>
          <span />
        </div>

        {team.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
            <Users className="h-8 w-8 opacity-30" />
            Aucun membre pour l'instant.
          </div>
        ) : (
          team.map((member) => {
            const isMe = member.userId === currentUserId
            return (
              <div
                key={member.id}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b px-4 py-3 last:border-0"
              >
                <Initials email={member.email} />

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.email ?? member.userId}
                    {isMe && (
                      <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Invité le{' '}
                    {new Date(member.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {currentRole === 'manager' && !isMe ? (
                  <Select
                    value={member.role}
                    onValueChange={(v) => handleRoleChange(member, v as 'manager' | 'member')}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="member">Membre</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <RoleBadge role={member.role} />
                )}

                {currentRole === 'manager' && !isMe ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setRevokeTarget(member)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="h-8 w-8" />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Invite modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogDescription className="sr-only">
            Formulaire d&apos;invitation d&apos;un nouveau membre à rejoindre l&apos;équipe
          </DialogDescription>
          <DialogHeader>
            <DialogTitle>Inviter un membre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Adresse email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="collaborateur@exemple.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as 'manager' | 'member')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membre</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviteLoading || !inviteEmail.trim()}
              className="gap-1.5"
            >
              {inviteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer l'accès ?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.email ?? revokeTarget?.userId} n'aura plus accès à PipeLeads.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revokeLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Révoquer l'accès
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
