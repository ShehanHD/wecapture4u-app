import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
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

function CreateClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createClient = useCreateClient()
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } =
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
      <DialogContent className="bg-[#1a1a1a] border-zinc-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="c_name">Name</Label>
            <Input id="c_name" {...register('name')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="c_email">Email</Label>
            <Input id="c_email" type="email" {...register('email')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="c_phone">Phone (optional)</Label>
            <Input id="c_phone" {...register('phone')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
          </div>
          <div>
            <Label htmlFor="c_tags">Tags (comma-separated)</Label>
            <Input id="c_tags" {...register('tags')} placeholder="wedding, portrait" className="bg-zinc-900 border-zinc-700 text-white mt-1" />
          </div>

          <div className="rounded-lg border border-zinc-700 p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('portal_access')} className="rounded" />
              <span className="text-sm text-white">Enable portal access</span>
            </label>
            {portalAccess && (
              <div>
                <Label htmlFor="c_temp_pw">Temporary password</Label>
                <Input
                  id="c_temp_pw"
                  type="password"
                  {...register('temp_password')}
                  placeholder="Min. 8 characters"
                  className="bg-zinc-900 border-zinc-700 text-white mt-1"
                />
                {errors.temp_password && (
                  <p className="text-xs text-red-400 mt-1">{errors.temp_password.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-400">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-400 text-black font-medium">
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
        <h1 className="text-2xl font-semibold text-white">Clients</h1>
        <Button onClick={() => setModalOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-medium">
          <Plus className="h-4 w-4 mr-1" />
          New Client
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-700 text-white"
          />
        </div>
        <Button type="submit" variant="outline" className="border-zinc-700 text-white bg-zinc-900 hover:bg-zinc-800">
          Search
        </Button>
      </form>

      <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-zinc-400">Loading...</p>
        ) : clients.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">
            {search ? `No clients matching "${search}".` : 'No clients yet.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-zinc-400 font-medium">Name</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Email</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Tags</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Since</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/clients/${c.id}`} className="text-white hover:text-amber-400 font-medium">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{c.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-zinc-700 text-zinc-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {format(parseISO(c.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="text-xs text-red-400 hover:text-red-300"
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
