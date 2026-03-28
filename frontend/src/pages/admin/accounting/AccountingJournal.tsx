import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { JournalEntryReviewPanel } from '@/components/accounting/JournalEntryReviewPanel'
import { useJournalEntries, useCreateJournalEntry } from '@/hooks/useAccounting'
import { fetchJournalEntry } from '@/api/accounting'
import type { JournalEntryOut } from '@/schemas/accounting'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-500/20 text-yellow-400',
  posted: 'bg-green-500/20 text-green-400',
  voided: 'bg-zinc-500/20 text-zinc-400',
}

const REF_LABELS: Record<string, string> = {
  invoice: 'Invoice', expense: 'Expense', payment: 'Payment', deposit: 'Deposit', manual: 'Manual',
}

type StatusFilter = 'all' | 'draft' | 'posted' | 'voided'

export function AccountingJournal() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [panelEntry, setPanelEntry] = useState<JournalEntryOut | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const { data: entries = [], isLoading } = useJournalEntries(
    statusFilter === 'all' ? undefined : { status: statusFilter }
  )
  const createMutation = useCreateJournalEntry()

  async function handleOpenEntry(id: string) {
    try {
      const entry = await fetchJournalEntry(id)
      setPanelEntry(entry)
      setPanelOpen(true)
    } catch {
      toast.error('Failed to load entry')
    }
  }

  async function handleNewEntry() {
    const today = new Date().toISOString().split('T')[0]
    try {
      const entry = await createMutation.mutateAsync({ date: today, description: 'New journal entry', lines: [] })
      const full = await fetchJournalEntry(entry.id)
      setPanelEntry(full)
      setPanelOpen(true)
    } catch {
      toast.error('Failed to create entry')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['all', 'draft', 'posted', 'voided'] as StatusFilter[]).map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'ghost'} onClick={() => setStatusFilter(s)} className="capitalize text-xs h-7">{s}</Button>
          ))}
        </div>
        <Button size="sm" onClick={handleNewEntry} disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" /> New Entry
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries found.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(entry => (
                <tr key={entry.id} className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => handleOpenEntry(entry.id)}>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{entry.date}</td>
                  <td className="px-4 py-2">{entry.description}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {entry.reference_type ? REF_LABELS[entry.reference_type] ?? entry.reference_type : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={`text-xs ${STATUS_COLORS[entry.status]}`}>{entry.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <JournalEntryReviewPanel
        entry={panelEntry}
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setPanelEntry(null) }}
      />
    </div>
  )
}
