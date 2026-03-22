import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, X, Plus, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useClient, useTogglePortalAccess, useCreatePortalAccess, useUpdateClient } from '@/hooks/useClients'
import { useJobs } from '@/hooks/useJobs'
import { format, parseISO } from 'date-fns'

function TagEditor({ clientId, initialTags }: { clientId: string; initialTags: string[] }) {
  const [tags, setTags] = useState(initialTags)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const updateClient = useUpdateClient()

  useEffect(() => { setTags(initialTags) }, [initialTags.join(',')])

  const save = (nextTags: string[]) => {
    setTags(nextTags)
    updateClient.mutate({ id: clientId, payload: { tags: nextTags } })
  }

  const addTag = () => {
    const tag = input.trim()
    if (!tag || tags.includes(tag)) { setInput(''); return }
    save([...tags, tag])
    setInput('')
    inputRef.current?.focus()
  }

  const removeTag = (tag: string) => save(tags.filter(t => t !== tag))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-accent text-foreground/80">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-muted-foreground hover:text-foreground leading-none"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
      </div>
      <div className="flex gap-1">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder="Add tag…"
          className="h-7 text-xs bg-input border text-foreground"
        />
        <Button
          type="button"
          size="sm"
          onClick={addTag}
          disabled={!input.trim()}
          className="h-7 px-2 bg-accent hover:bg-muted text-foreground"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

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
        <Link to="/admin/clients" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
            <UserRound className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Client Detail</h1>
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
      {!isLoading && !client && <div className="text-red-400">Client not found.</div>}

      {client && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: contact info + stats + portal */}
        <div className="space-y-4">
          <div className="rounded-xl bg-card border p-5 space-y-3">
            <h2 className="text-lg font-medium text-foreground">{client.name}</h2>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{client.email}</p>
              {client.phone && <p className="text-muted-foreground">{client.phone}</p>}
              {client.address && <p className="text-muted-foreground">{client.address}</p>}
              {client.birthday && (
                <p className="text-muted-foreground">
                  🎂 {format(parseISO(client.birthday), 'MMMM d')}
                </p>
              )}
            </div>
            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-1">Tags (admin only)</p>
              <TagEditor clientId={id!} initialTags={client.tags} />
            </div>
          </div>

          <div className="rounded-xl bg-card border p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Stats</h3>
            <p className="text-foreground text-lg font-semibold">€{client.total_spent.toFixed(2)}</p>
            <p className="text-muted-foreground text-xs">Total spent (posted)</p>
          </div>

          <div className="rounded-xl bg-card border p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Portal Access</h3>
            {!hasPortal ? (
              showPortalSetup ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="portal_pw" className="text-muted-foreground">Temporary password</Label>
                    <Input
                      id="portal_pw"
                      type="password"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="bg-input border text-foreground mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreatePortal}
                      disabled={tempPassword.length < 8 || createPortal.isPending}
                      className=""
                    >
                      Create account
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowPortalSetup(false)} className="text-muted-foreground">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground text-sm mb-3">No portal account yet.</p>
                  <Button size="sm" onClick={() => setShowPortalSetup(true)} className="bg-accent hover:bg-muted text-foreground">
                    Create portal account
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/80">
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
          <div className="rounded-xl bg-card border overflow-hidden">
            <div className="px-4 py-3 border-b border">
              <h3 className="text-sm font-medium text-muted-foreground">Job History ({jobs.length})</h3>
            </div>
            {jobs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No jobs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-muted-foreground font-medium">Job</th>
                    <th className="px-4 py-3 text-muted-foreground font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map(j => (
                    <tr key={j.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link to={`/admin/jobs/${j.id}`} className="text-foreground hover:opacity-70">
                          {j.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
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
