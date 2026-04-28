'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TenantUser {
  userId: string
  email: string
  role: 'manager' | 'member'
  createdAt: string
}

interface Props {
  slug: string
}

export function TenantUsersSection({ slug }: Props) {
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('member')
  const [inviting, setInviting] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${slug}/users`)
      const json = await res.json()
      if (res.ok) {
        setUsers(json.users)
      } else {
        toast.error(json.error ?? 'Erreur lors du chargement des utilisateurs')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function handleRoleChange(userId: string, role: 'manager' | 'member') {
    const res = await fetch(`/api/admin/tenants/${slug}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const json = await res.json()
    if (res.ok) {
      toast.success('Rôle mis à jour')
      setUsers((prev) => prev.map((u) => (u.userId === userId ? { ...u, role } : u)))
    } else {
      toast.error(json.error ?? 'Erreur lors de la mise à jour du rôle')
    }
  }

  async function handleDelete(userId: string) {
    const res = await fetch(`/api/admin/tenants/${slug}/users/${userId}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (res.ok) {
      toast.success('Utilisateur supprimé')
      setUsers((prev) => prev.filter((u) => u.userId !== userId))
    } else {
      toast.error(json.error ?? 'Erreur lors de la suppression')
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${slug}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(`Invitation envoyée à ${inviteEmail}`)
        setInviteOpen(false)
        setInviteEmail('')
        setInviteRole('member')
        await fetchUsers()
      } else {
        toast.error(json.error ?? "Erreur lors de l'invitation")
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Utilisateurs</h2>
        <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Inviter un utilisateur
        </Button>
      </div>

      <div className="rounded-lg border">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-zinc-500">
            <UserPlus className="h-6 w-6 opacity-30" />
            Aucun utilisateur pour ce tenant.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>{"Date d'ajout"}</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(v) =>
                        handleRoleChange(user.userId, v as 'manager' | 'member')
                      }
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="member">Membre</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">
                    {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action supprimera définitivement{' '}
                            <strong>{user.email}</strong> de ce tenant et de Supabase Auth.
                            Cette opération est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(user.userId)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="utilisateur@exemple.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Rôle</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as 'manager' | 'member')}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Membre</SelectItem>
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
              disabled={inviting || !inviteEmail.trim()}
              className="gap-2"
            >
              {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

