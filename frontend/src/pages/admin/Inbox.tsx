// frontend/src/pages/admin/Inbox.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Mail, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'

const SubmissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
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

async function fetchSubmissions(page: number) {
  const res = await api.get('/api/contact/submissions', { params: { page, page_size: PAGE_SIZE } })
  return ResponseSchema.parse(res.data)
}

export function Inbox() {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Submission | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['contact-submissions', page],
    queryFn: () => fetchSubmissions(page),
  })

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.total} submission{data.total !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* List */}
        <div className="lg:col-span-1 rounded-lg border border-border overflow-hidden">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : data?.items.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No submissions yet
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data?.items.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelected(s)}
                    className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-muted/40 ${selected?.id === s.id ? 'bg-muted/60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{s.message}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <Button
                size="sm" variant="ghost"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                size="sm" variant="ghost"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
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
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                </span>
              </div>

              <div className="border-t border-border pt-5">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              </div>

              <div className="pt-2">
                <a
                  href={`mailto:${selected.email}?subject=Re: Your enquiry`}
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-brand-subtle text-brand-solid hover:opacity-80 transition-opacity"
                >
                  <Mail className="h-4 w-4" />
                  Reply by email
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card/50 flex items-center justify-center py-24 text-sm text-muted-foreground">
              Select a message to read it
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
