import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useClient, useTogglePortalAccess, useCreatePortalAccess } from '@/hooks/useClients'
import { useJobs } from '@/hooks/useJobs'
import { format, parseISO } from 'date-fns'

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: client, isLoading } = useClient(id!)
  const { data: jobs = [] } = useJobs(id ? { client_id: id } : undefined)
  const togglePortal = useTogglePortalAccess()
  const createPortal = useCreatePortalAccess()

  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [showPortalSetup, setShowPortalSetup] = useState(false)

  const handleTogglePortal = async (is_active: boolean) => {
    if (!id) return
    await togglePortal.mutateAsync({ id, is_active })
    setDeactivateOpen(false)
  }

  const handleCreatePortal = async () => {
    if (!id || !tempPassword) return
    await createPortal.mutateAsync({ id, temp_password: tempPassword })
    setTempPassword('')
    setShowPortalSetup(false)
  }

  const hasPortal = client?.user_id !== null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/clients" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold text-white">Client Detail</h1>
      </div>

      {isLoading && <div className="text-zinc-400 text-sm">Loading...</div>}
      {!isLoading && !client && <div className="text-red-400">Client not found.</div>}

      {client && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: contact info + stats + portal */}
        <div className="space-y-4">
          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5 space-y-3">
            <h2 className="text-lg font-medium text-white">{client.name}</h2>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-400">{client.email}</p>
              {client.phone && <p className="text-zinc-400">{client.phone}</p>}
              {client.address && <p className="text-zinc-400">{client.address}</p>}
              {client.birthday && (
                <p className="text-zinc-400">
                  🎂 {format(parseISO(client.birthday), 'MMMM d')}
                </p>
              )}
            </div>
            {client.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {client.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Stats</h3>
            <p className="text-white text-lg font-semibold">€{client.total_spent.toFixed(2)}</p>
            <p className="text-zinc-500 text-xs">Total spent (posted)</p>
          </div>

          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Portal Access</h3>
            {!hasPortal ? (
              showPortalSetup ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="portal_pw" className="text-zinc-400">Temporary password</Label>
                    <Input
                      id="portal_pw"
                      type="password"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="bg-zinc-900 border-zinc-700 text-white mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreatePortal}
                      disabled={tempPassword.length < 8 || createPortal.isPending}
                      className="bg-amber-500 hover:bg-amber-400 text-black"
                    >
                      Create account
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowPortalSetup(false)} className="text-zinc-400">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-zinc-500 text-sm mb-3">No portal account yet.</p>
                  <Button size="sm" onClick={() => setShowPortalSetup(true)} className="bg-zinc-700 hover:bg-zinc-600 text-white">
                    Create portal account
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">
                    Status:{' '}
                    <span className={client.is_active ? 'text-emerald-400' : 'text-red-400'}>
                      {client.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </span>
                </div>
                {client.is_active ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeactivateOpen(true)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    Deactivate portal access
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleTogglePortal(true)}
                    disabled={togglePortal.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Reactivate portal access
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: job history */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400">Job History ({jobs.length})</h3>
            </div>
            {jobs.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">No jobs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-zinc-400 font-medium">Job</th>
                    <th className="px-4 py-3 text-zinc-400 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {jobs.map(j => (
                    <tr key={j.id} className="hover:bg-zinc-900/50">
                      <td className="px-4 py-3">
                        <Link to={`/admin/jobs/${j.id}`} className="text-white hover:text-amber-400">
                          {j.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {format(parseISO(j.created_at), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>}

      {client && (
        <ConfirmDialog
          open={deactivateOpen}
          onOpenChange={setDeactivateOpen}
          title="Deactivate portal access?"
          description={`${client.name} will immediately be blocked from logging in. Their data is preserved. You can reactivate at any time.`}
          confirmLabel="Deactivate"
          onConfirm={() => handleTogglePortal(false)}
          destructive
        />
      )}
    </div>
  )
}
