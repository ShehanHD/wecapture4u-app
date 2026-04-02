import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Mail, ChevronLeft, ChevronRight, UserPlus, CalendarPlus, ExternalLink, Check, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { ClientSchema } from '@/schemas/clients'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'

const SubmissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  message: z.string(),
  created_at: z.string(),
})

const ResponseSchema = z.object({
  items: z.array(SubmissionSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
})

type Submission = z.infer<typeof SubmissionSchema>

const PAGE_SIZE = 20
const STORAGE_KEY = 'inbox-created-clients' // submissionId -> clientId

function loadCreatedClients(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function saveCreatedClients(map: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

async function fetchSubmissions(page: number) {
  const res = await api.get('/api/contact/submissions', { params: { page, page_size: PAGE_SIZE } })
  return ResponseSchema.parse(res.data)
}

async function createClientFromSubmission(s: Submission) {
  const { data } = await api.post('/api/clients', { name: s.name, email: s.email, phone: s.phone ?? undefined })
  return ClientSchema.parse(data)
}

async function batchDeleteSubmissions(ids: string[]) {
  await api.delete('/api/contact/submissions', { data: ids })
}

export function Inbox() {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [confirmCreate, setConfirmCreate] = useState(false)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)
  const [createdClients, setCreatedClients] = useState<Record<string, string>>(loadCreatedClients)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['contact-submissions', page],
    queryFn: () => fetchSubmissions(page),
  })

  const createClient = useMutation({
    mutationFn: (s: Submission) => createClientFromSubmission(s),
    onSuccess: (client, s) => {
      const updated = { ...createdClients, [s.id]: client.id }
      setCreatedClients(updated)
      saveCreatedClients(updated)
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success(`Client "${client.name}" created`)
    },
    onError: () => toast.error('Failed to create client — email may already exist'),
  })

  const batchDelete = useMutation({
    mutationFn: batchDeleteSubmissions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-submissions'] })
      if (selected && checkedIds.has(selected.id)) setSelected(null)
      setCheckedIds(new Set())
      setConfirmBatchDelete(false)
      toast.success(`Deleted ${checkedIds.size} submission${checkedIds.size !== 1 ? 's' : ''}`)
    },
    onError: () => toast.error('Failed to delete submissions'),
  })

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1
  const selectedClientId = selected ? createdClients[selected.id] : undefined
  const allIds = data?.items.map(s => s.id) ?? []
  const allChecked = allIds.length > 0 && allIds.every(id => checkedIds.has(id))

  function toggleCheck(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set(allIds))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
          <Mail className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.total} submission{data.total !== 1 ? 's' : ''}</p>
          )}
        </div>
        {checkedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => setConfirmBatchDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete {checkedIds.size}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* List */}
        <div className="lg:col-span-1 rounded-lg border border-border overflow-hidden">
          {/* Select-all row */}
          {!isLoading && (data?.items.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="h-3.5 w-3.5 rounded accent-brand cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">Select all</span>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : data?.items.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No submissions yet</div>
          ) : (
            <ul className="divide-y divide-border">
              {data?.items.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelected(s)}
                    className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-muted/40 ${selected?.id === s.id ? 'bg-muted/60' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span onClick={(e) => toggleCheck(s.id, e)} className="mt-0.5 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={checkedIds.has(s.id)}
                          readOnly
                          className="h-3.5 w-3.5 rounded accent-brand cursor-pointer pointer-events-none"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{s.message}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button size="sm" variant="ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Detail pane */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="rounded-lg border border-border bg-card p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{selected.name}</h2>
                  <a
                    href={`mailto:${selected.email}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {selected.email}
                  </a>
                  {selected.phone && (
                    <p className="text-sm text-muted-foreground">{selected.phone}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                </span>
              </div>

              <div className="border-t border-border pt-5">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              </div>

              <div className="border-t border-border pt-4 flex flex-wrap gap-2">
                <a
                  href={`mailto:${selected.email}?subject=Re: Your enquiry`}
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-brand-subtle text-brand-solid hover:opacity-80 transition-opacity"
                >
                  <Mail className="h-4 w-4" />
                  Reply by email
                </a>

                {selectedClientId ? (
                  <Link
                    to={`/admin/clients/${selectedClientId}`}
                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:opacity-80 transition-opacity"
                  >
                    <Check className="h-4 w-4" />
                    View client
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={createClient.isPending}
                    onClick={() => setConfirmCreate(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Create client
                  </Button>
                )}

                {selectedClientId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate(`/admin/appointments?client_id=${selectedClientId}`)}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Book appointment
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card/50 flex items-center justify-center py-24 text-sm text-muted-foreground">
              Select a message to read it
            </div>
          )}
        </div>
      </div>

      {/* Confirm create client */}
      <ConfirmDialog
        open={confirmCreate}
        onOpenChange={setConfirmCreate}
        title="Create client?"
        description={selected ? `Create a client account for ${selected.name} (${selected.email})?` : ''}
        confirmLabel="Create"
        onConfirm={() => { if (selected) createClient.mutate(selected) }}
      />

      {/* Confirm batch delete */}
      <ConfirmDialog
        open={confirmBatchDelete}
        onOpenChange={setConfirmBatchDelete}
        title={`Delete ${checkedIds.size} submission${checkedIds.size !== 1 ? 's' : ''}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => batchDelete.mutate([...checkedIds])}
      />
    </div>
  )
}
