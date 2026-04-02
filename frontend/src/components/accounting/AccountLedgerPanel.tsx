// frontend/src/components/accounting/AccountLedgerPanel.tsx
import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { fetchAccountLedger } from '@/api/accounting'
import type { AccountLedgerOut, AccountOut, AccountType } from '@/schemas/accounting'

interface Props {
  account: AccountOut | null
  onClose: () => void
}

const TYPE_COLORS: Record<AccountType, string> = {
  asset: 'bg-blue-500/20 text-blue-400',
  liability: 'bg-red-500/20 text-red-400',
  equity: 'bg-purple-500/20 text-purple-400',
  revenue: 'bg-green-500/20 text-green-400',
  expense: 'bg-orange-500/20 text-orange-400',
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function monthStart(): string {
  const d = new Date()
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function AccountLedgerPanel({ account, onClose }: Props) {
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(toISO(new Date()))
  const [data, setData] = useState<AccountLedgerOut | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLoad = useCallback(async () => {
    if (!account) return
    setLoading(true)
    try {
      const result = await fetchAccountLedger(account.id, { start_date: startDate, end_date: endDate })
      setData(result)
    } catch {
      toast.error('Failed to load ledger')
    } finally {
      setLoading(false)
    }
  }, [account, startDate, endDate])

  // Auto-load only when the panel opens with a new account; date changes require clicking Load
  useEffect(() => {
    if (account) void handleLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id])

  if (!account) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-[580px] bg-card border-l border-border flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{account.code}</span>
            <h2 className="text-base font-semibold">{account.name}</h2>
            <Badge className={`text-xs ${TYPE_COLORS[account.type]}`}>{account.type}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Date range filter */}
        <div className="flex items-end gap-3 p-4 border-b border-border shrink-0">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">From</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">To</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" />
          </div>
          <Button size="sm" onClick={handleLoad} disabled={loading}>
            {loading ? 'Loading…' : 'Load'}
          </Button>
        </div>

        {/* Ledger table */}
        <div className="flex-1 overflow-y-auto">
          {data ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Date</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Description</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Ref</th>
                  <th className="text-right px-4 py-2 text-xs text-muted-foreground font-medium">Debit</th>
                  <th className="text-right px-4 py-2 text-xs text-muted-foreground font-medium">Credit</th>
                  <th className="text-right px-4 py-2 text-xs text-muted-foreground font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No transactions in this period
                    </td>
                  </tr>
                ) : (
                  data.lines.map((line, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-4 py-2 text-xs tabular-nums">{line.date}</td>
                      <td className="px-4 py-2 text-xs max-w-[160px] truncate">{line.line_description ?? line.description}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{line.reference_type ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums">
                        {parseFloat(line.debit) !== 0 ? `$${line.debit}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums">
                        {parseFloat(line.credit) !== 0 ? `$${line.credit}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums font-medium">${line.running_balance}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Select a date range and click Load
            </div>
          )}
        </div>

        {/* Footer: opening / closing balance */}
        {data && (
          <div className="p-4 border-t border-border shrink-0 flex justify-between text-sm">
            <span className="text-muted-foreground">
              Opening: <span className="text-foreground font-medium tabular-nums">${data.opening_balance}</span>
            </span>
            <span className="text-muted-foreground">
              Closing: <span className="text-foreground font-medium tabular-nums">${data.closing_balance}</span>
            </span>
          </div>
        )}
      </div>
    </>
  )
}
