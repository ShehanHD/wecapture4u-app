import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, RefreshCw, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useClients, useCreateClient, useDeleteClient } from '@/hooks/useClients'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Client } from '@/schemas/clients'
import { format, parseISO } from 'date-fns'

const clientFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  tags: z.string().optional(),
  portal_access: z.boolean().default(false),
  temp_password: z.string().optional(),
}).refine(
  (d) => !d.portal_access || (d.temp_password && d.temp_password.length >= 8),
  { message: 'Temporary password (8+ chars) required when enabling portal access', path: ['temp_password'] }
)
type ClientFormValues = z.infer<typeof clientFormSchema>

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

function CreateClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createClient = useCreateClient()
  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<ClientFormValues>({ resolver: zodResolver(clientFormSchema), defaultValues: { portal_access: false } })

  const portalAccess = watch('portal_access')

  const onSubmit = async (values: ClientFormValues) => {
    await createClient.mutateAsync({
      name: values.name,
      email: values.email,
      phone: values.phone || null,
      tags: values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      portal_access: values.portal_access,
      temp_password: values.portal_access ? values.temp_password : undefined,
    })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-card border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="c_name">Name</Label>
            <Input id="c_name" {...register('name')} className="bg-input border text-foreground mt-1" />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="c_email">Email</Label>
            <Input id="c_email" type="email" {...register('email')} className="bg-input border text-foreground mt-1" />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="c_phone">Phone (optional)</Label>
            <Input id="c_phone" {...register('phone')} className="bg-input border text-foreground mt-1" />
          </div>
          <div>
            <Label htmlFor="c_tags">Tags (comma-separated)</Label>
            <Input id="c_tags" {...register('tags')} placeholder="wedding, portrait" className="bg-input border text-foreground mt-1" />
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('portal_access')} className="rounded" />
              <span className="text-sm text-foreground">Enable portal access</span>
            </label>
            {portalAccess && (
              <div>
                <Label htmlFor="c_temp_pw">Temporary password</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="c_temp_pw"
                    type="text"
                    {...register('temp_password')}
                    placeholder="Min. 8 characters"
                    className="bg-input border text-foreground font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setValue('temp_password', generatePassword(), { shouldValidate: true })}
                    className="shrink-0 border text-foreground/80 bg-input hover:bg-muted"
                    title="Generate password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {errors.temp_password && (
                  <p className="text-xs text-red-400 mt-1">{errors.temp_password.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground">Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              Create client
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Clients() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const [searchInput, setSearchInput] = useState(search)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)

  const { data: clients = [], isLoading } = useClients(search ? { search } : undefined)
  const deleteClient = useDeleteClient()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams(searchInput ? { search: searchInput } : {})
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteClient.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
            <Users className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Client
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 bg-input border text-foreground"
          />
        </div>
        <Button type="submit" variant="outline" className="border text-foreground bg-input hover:bg-muted">
          Search
        </Button>
      </form>

      <div className="rounded-xl bg-card border overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading...</p>
        ) : clients.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {search ? `No clients matching "${search}".` : 'No clients yet.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border">
              <tr className="text-left">
                <th className="px-4 py-3 text-muted-foreground font-medium">Name</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Email</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Tags</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Since</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/clients/${c.id}`} className="text-foreground hover:opacity-70 font-medium">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">{c.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-accent text-foreground/80">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(parseISO(c.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="text-xs text-transparent bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text hover:opacity-80"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateClientModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete client?"
        description={`This will permanently delete "${deleteTarget?.name}". This cannot be undone if they have no jobs or invoices.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  )
}
