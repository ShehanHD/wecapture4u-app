<<<<<<< HEAD
=======
// frontend/src/pages/admin/accounting/AccountingReports.tsx
>>>>>>> main
import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
<<<<<<< HEAD
import { fetchReport, downloadReportCsv, type ReportType } from '@/api/accounting'
=======
import { fetchReport, downloadReportCsv } from '@/api/accounting'
>>>>>>> main
import { toast } from 'sonner'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function monthStart(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

function PLReport() {
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(today())
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      const result = await fetchReport('pl', { start_date: startDate, end_date: endDate })
      setData(result as Record<string, unknown>)
<<<<<<< HEAD
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const pl = data as {
    revenue_by_account: Record<string, string>
    total_revenue: string
    expenses_by_account: Record<string, string>
    total_expenses: string
    net_profit: string
  } | null
=======
    } catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  const pl = data as { revenue_by_account: Record<string, string>; total_revenue: string; expenses_by_account: Record<string, string>; total_expenses: string; net_profit: string } | null
>>>>>>> main

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
<<<<<<< HEAD
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" />
        </div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {pl && (
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv('pl', { start_date: startDate, end_date: endDate })}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        )}
=======
        <div><label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" /></div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {pl && <Button size="sm" variant="outline" onClick={() => downloadReportCsv('pl', { start_date: startDate, end_date: endDate })}>
          <Download className="h-3 w-3 mr-1" /> CSV
        </Button>}
>>>>>>> main
      </div>
      {pl && (
        <div className="rounded-lg border border-border overflow-hidden text-sm">
          <table className="w-full">
<<<<<<< HEAD
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 text-muted-foreground">Account</th>
                <th className="text-right px-4 py-2 text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr><td colSpan={2} className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">Revenue</td></tr>
              {Object.entries(pl.revenue_by_account).map(([name, amt]) => (
                <tr key={name}>
                  <td className="px-4 py-2 pl-8">{name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${amt}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="px-4 py-2">Total Revenue</td>
                <td className="px-4 py-2 text-right tabular-nums text-green-400">${pl.total_revenue}</td>
              </tr>
              <tr><td colSpan={2} className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">Expenses</td></tr>
              {Object.entries(pl.expenses_by_account).map(([name, amt]) => (
                <tr key={name}>
                  <td className="px-4 py-2 pl-8">{name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${amt}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="px-4 py-2">Total Expenses</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-400">${pl.total_expenses}</td>
              </tr>
              <tr className="font-bold border-t-2 border-border">
                <td className="px-4 py-3">Net Profit</td>
                <td className={`px-4 py-3 text-right tabular-nums ${parseFloat(pl.net_profit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${pl.net_profit}
                </td>
              </tr>
=======
            <thead className="bg-muted/30"><tr>
              <th className="text-left px-4 py-2 text-muted-foreground">Account</th>
              <th className="text-right px-4 py-2 text-muted-foreground">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              <tr><td colSpan={2} className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">Revenue</td></tr>
              {Object.entries(pl.revenue_by_account).map(([name, amt]) => (
                <tr key={name}><td className="px-4 py-2 pl-8">{name}</td><td className="px-4 py-2 text-right tabular-nums">${amt}</td></tr>
              ))}
              <tr className="font-medium"><td className="px-4 py-2">Total Revenue</td><td className="px-4 py-2 text-right tabular-nums text-green-400">${pl.total_revenue}</td></tr>
              <tr><td colSpan={2} className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">Expenses</td></tr>
              {Object.entries(pl.expenses_by_account).map(([name, amt]) => (
                <tr key={name}><td className="px-4 py-2 pl-8">{name}</td><td className="px-4 py-2 text-right tabular-nums">${amt}</td></tr>
              ))}
              <tr className="font-medium"><td className="px-4 py-2">Total Expenses</td><td className="px-4 py-2 text-right tabular-nums text-red-400">${pl.total_expenses}</td></tr>
              <tr className="font-bold border-t-2 border-border"><td className="px-4 py-3">Net Profit</td>
                <td className={`px-4 py-3 text-right tabular-nums ${parseFloat(pl.net_profit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>${pl.net_profit}</td></tr>
>>>>>>> main
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function BalanceSheetReport() {
  const [asOf, setAsOf] = useState(today())
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
<<<<<<< HEAD
    try {
      setData(await fetchReport('balance-sheet', { as_of_date: asOf }) as Record<string, unknown>)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  type BSEntry = { code: string; name: string; balance: string }
  const bs = data as {
    assets: BSEntry[]
    total_assets: string
    liabilities: BSEntry[]
    total_liabilities: string
    equity: BSEntry[]
    total_equity: string
    balanced: boolean
  } | null

  function Section({ title, rows, total }: { title: string; rows: BSEntry[]; total: string }) {
    return (
      <>
        <tr><td colSpan={2} className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">{title}</td></tr>
        {rows.map(r => (
          <tr key={r.code}>
            <td className="px-4 py-2 pl-8">{r.code} — {r.name}</td>
            <td className="px-4 py-2 text-right tabular-nums">${r.balance}</td>
          </tr>
        ))}
        <tr className="font-medium">
          <td className="px-4 py-2">Total {title}</td>
          <td className="px-4 py-2 text-right tabular-nums">${total}</td>
        </tr>
      </>
    )
=======
    try { setData(await fetchReport('balance-sheet', { as_of_date: asOf }) as Record<string, unknown>) }
    catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  type BSEntry = { code: string; name: string; balance: string }
  const bs = data as { assets: BSEntry[]; total_assets: string; liabilities: BSEntry[]; total_liabilities: string; equity: BSEntry[]; total_equity: string; balanced: boolean } | null

  function Section({ title, rows, total }: { title: string; rows: BSEntry[]; total: string }) {
    return <>
      <tr><td colSpan={2} className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">{title}</td></tr>
      {rows.map(r => <tr key={r.code}><td className="px-4 py-2 pl-8">{r.code} — {r.name}</td><td className="px-4 py-2 text-right tabular-nums">${r.balance}</td></tr>)}
      <tr className="font-medium"><td className="px-4 py-2">Total {title}</td><td className="px-4 py-2 text-right tabular-nums">${total}</td></tr>
    </>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div><label className="text-xs text-muted-foreground block mb-1">As of</label>
          <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-8 text-sm" /></div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {bs && <Button size="sm" variant="outline" onClick={() => downloadReportCsv('balance-sheet', { as_of_date: asOf })}>
          <Download className="h-3 w-3 mr-1" /> CSV
        </Button>}
      </div>
      {bs && (
        <div className="rounded-lg border border-border overflow-hidden text-sm">
          <table className="w-full">
            <thead className="bg-muted/30"><tr>
              <th className="text-left px-4 py-2 text-muted-foreground">Account</th>
              <th className="text-right px-4 py-2 text-muted-foreground">Balance</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              <Section title="Assets" rows={bs.assets} total={bs.total_assets} />
              <Section title="Liabilities" rows={bs.liabilities} total={bs.total_liabilities} />
              <Section title="Equity" rows={bs.equity} total={bs.total_equity} />
              {!bs.balanced && <tr><td colSpan={2} className="px-4 py-2 text-destructive text-xs">&#9888; Balance sheet does not balance</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Trial Balance ────────────────────────────────────────────────────────────

type TBData = {
  as_of_date: string
  rows: { code: string; name: string; debit_balance: string; credit_balance: string }[]
  total_debit: string
  total_credit: string
  balanced: boolean
}

function TrialBalanceReport() {
  const [asOf, setAsOf] = useState(today())
  const [data, setData] = useState<TBData | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try { setData(await fetchReport('trial-balance', { as_of_date: asOf }) as TBData) }
    catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
>>>>>>> main
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">As of</label>
          <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-8 text-sm" />
        </div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
<<<<<<< HEAD
        {bs && (
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv('balance-sheet', { as_of_date: asOf })}>
=======
        {data && (
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv('trial-balance', { as_of_date: asOf })}>
>>>>>>> main
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        )}
      </div>
<<<<<<< HEAD
      {bs && (
        <div className="rounded-lg border border-border overflow-hidden text-sm">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 text-muted-foreground">Account</th>
                <th className="text-right px-4 py-2 text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <Section title="Assets" rows={bs.assets} total={bs.total_assets} />
              <Section title="Liabilities" rows={bs.liabilities} total={bs.total_liabilities} />
              <Section title="Equity" rows={bs.equity} total={bs.total_equity} />
              {!bs.balanced && (
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-destructive text-xs">Balance sheet does not balance</td>
                </tr>
              )}
            </tbody>
=======
      {data && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Code</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Account</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Debit</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map(row => (
                <tr key={row.code}>
                  <td className="px-4 py-2 text-xs text-muted-foreground font-mono">{row.code}</td>
                  <td className="px-4 py-2">{row.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {parseFloat(row.debit_balance) !== 0 ? `$${row.debit_balance}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {parseFloat(row.credit_balance) !== 0 ? `$${row.credit_balance}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-medium">
                <td className="px-4 py-2" colSpan={2}>
                  Totals{' '}
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${data.balanced ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {data.balanced ? 'Balanced' : 'Unbalanced'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">${data.total_debit}</td>
                <td className="px-4 py-2 text-right tabular-nums">${data.total_credit}</td>
              </tr>
            </tfoot>
>>>>>>> main
          </table>
        </div>
      )}
    </div>
  )
}

<<<<<<< HEAD
function GenericReport({
  type,
  params: paramDefs,
}: {
  type: ReportType
  params: Array<{ key: string; label: string; defaultValue?: string }>
}) {
  const initParams = Object.fromEntries(paramDefs.map(p => [p.key, p.defaultValue ?? today()]))
  const [params, setParams] = useState<Record<string, string>>(initParams)
  const [data, setData] = useState<unknown | null>(null)
=======
// ─── Cash Flow ────────────────────────────────────────────────────────────────

type CFData = {
  start_date: string
  end_date: string
  cash_collected: string
  cash_spent: string
  net_change: string
}

function CashFlowReport() {
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(today())
  const [data, setData] = useState<CFData | null>(null)
>>>>>>> main
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
<<<<<<< HEAD
    try {
      setData(await fetchReport(type, params))
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
=======
    try { setData(await fetchReport('cash-flow', { start_date: startDate, end_date: endDate }) as CFData) }
    catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  const netChange = data ? parseFloat(data.net_change) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div><label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" /></div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {data && (
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv('cash-flow', { start_date: startDate, end_date: endDate })}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        )}
      </div>
      {data && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-3">Cash collected from clients</td>
                <td className="px-4 py-3 text-right tabular-nums text-green-400">${data.cash_collected}</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Cash spent on expenses</td>
                <td className="px-4 py-3 text-right tabular-nums text-red-400">${data.cash_spent}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-medium">
                <td className="px-4 py-3">Net cash change</td>
                <td className={`px-4 py-3 text-right tabular-nums ${netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {netChange >= 0 ? '+' : ''}${data.net_change}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tax Summary ──────────────────────────────────────────────────────────────

type TSData = {
  start_date: string
  end_date: string
  taxable_revenue: string
  deductible_expenses: Record<string, string>
  total_deductible_expenses: string
  net_taxable_income: string
}

function TaxSummaryReport() {
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(today())
  const [data, setData] = useState<TSData | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try { setData(await fetchReport('tax-summary', { start_date: startDate, end_date: endDate }) as TSData) }
    catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
>>>>>>> main
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
<<<<<<< HEAD
        {paramDefs.map(p => (
          <div key={p.key}>
            <label className="text-xs text-muted-foreground block mb-1">{p.label}</label>
            <Input
              type="date"
              value={params[p.key]}
              onChange={e => setParams(v => ({ ...v, [p.key]: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
        ))}
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {data !== null && (
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv(type, params)}>
=======
        <div><label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" /></div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {data && (
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv('tax-summary', { start_date: startDate, end_date: endDate })}>
>>>>>>> main
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        )}
      </div>
<<<<<<< HEAD
      {data !== null && (
        <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs overflow-auto max-h-96 text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
=======
      {data && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-2 font-medium">Total Revenue</td>
                <td className="px-4 py-2 text-right tabular-nums text-green-400">${data.taxable_revenue}</td>
              </tr>
              <tr>
                <td colSpan={2} className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">
                  Deductible Expenses
                </td>
              </tr>
              {Object.entries(data.deductible_expenses).map(([name, amt]) => (
                <tr key={name}>
                  <td className="px-4 py-2 pl-8">{name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${amt}</td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-2">Total Deductible</td>
                <td className="px-4 py-2 text-right tabular-nums">${data.total_deductible_expenses}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-medium">
                <td className="px-4 py-3">Net Taxable Income</td>
                <td className="px-4 py-3 text-right tabular-nums">${data.net_taxable_income}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── AR Aging ─────────────────────────────────────────────────────────────────

type AREntry = {
  invoice_id: string
  client_name: string
  balance: string
  due_date: string | null
  days_overdue: number
}

type ARData = {
  as_of_date: string
  buckets: {
    current: AREntry[]
    '1_30': AREntry[]
    '31_60': AREntry[]
    '61_90': AREntry[]
    over_90: AREntry[]
  }
  total_outstanding: string
}

const BUCKET_LABELS: Record<string, string> = {
  current: 'Current',
  '1_30': '1–30 days overdue',
  '31_60': '31–60 days overdue',
  '61_90': '61–90 days overdue',
  over_90: 'Over 90 days overdue',
}

function ARAgingReport() {
  const [asOf, setAsOf] = useState(today())
  const [data, setData] = useState<ARData | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try { setData(await fetchReport('ar-aging', { as_of_date: asOf }) as ARData) }
    catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">As of</label>
          <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-8 text-sm" />
        </div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {data && (
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv('ar-aging', { as_of_date: asOf })}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        )}
      </div>
      {data && (
        <div className="space-y-3">
          {(Object.keys(BUCKET_LABELS) as Array<keyof ARData['buckets']>).map(key => {
            const entries = data.buckets[key]
            if (entries.length === 0) return null
            const subtotal = entries.reduce((sum, e) => sum + parseFloat(e.balance), 0)
            return (
              <div key={key} className="rounded-lg border border-border overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
                  <span>{BUCKET_LABELS[key]}</span>
                  <span className="tabular-nums">${subtotal.toFixed(2)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Client</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Due Date</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entries.map(e => (
                      <tr key={e.invoice_id}>
                        <td className="px-4 py-2">{e.client_name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{e.due_date ?? '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">${e.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
          <div className="flex justify-between items-center px-4 py-3 rounded-lg border border-border font-medium text-sm">
            <span>Total Outstanding</span>
            <span className="tabular-nums">${parseFloat(data.total_outstanding).toFixed(2)}</span>
          </div>
        </div>
>>>>>>> main
      )}
    </div>
  )
}

export function AccountingReports() {
  return (
    <Tabs defaultValue="pl">
      <TabsList className="mb-4 flex-wrap h-auto">
<<<<<<< HEAD
        <TabsTrigger value="pl" className="text-xs">P&L</TabsTrigger>
=======
        <TabsTrigger value="pl" className="text-xs">P&amp;L</TabsTrigger>
>>>>>>> main
        <TabsTrigger value="balance-sheet" className="text-xs">Balance Sheet</TabsTrigger>
        <TabsTrigger value="trial-balance" className="text-xs">Trial Balance</TabsTrigger>
        <TabsTrigger value="cash-flow" className="text-xs">Cash Flow</TabsTrigger>
        <TabsTrigger value="tax-summary" className="text-xs">Tax Summary</TabsTrigger>
        <TabsTrigger value="ar-aging" className="text-xs">AR Aging</TabsTrigger>
      </TabsList>

      <TabsContent value="pl"><PLReport /></TabsContent>
      <TabsContent value="balance-sheet"><BalanceSheetReport /></TabsContent>
<<<<<<< HEAD
      <TabsContent value="trial-balance">
        <GenericReport type="trial-balance" params={[{ key: 'as_of_date', label: 'As of', defaultValue: today() }]} />
      </TabsContent>
      <TabsContent value="cash-flow">
        <GenericReport type="cash-flow" params={[
          { key: 'start_date', label: 'From', defaultValue: monthStart() },
          { key: 'end_date', label: 'To', defaultValue: today() },
        ]} />
      </TabsContent>
      <TabsContent value="tax-summary">
        <GenericReport type="tax-summary" params={[
          { key: 'start_date', label: 'From', defaultValue: monthStart() },
          { key: 'end_date', label: 'To', defaultValue: today() },
        ]} />
      </TabsContent>
      <TabsContent value="ar-aging">
        <GenericReport type="ar-aging" params={[{ key: 'as_of_date', label: 'As of', defaultValue: today() }]} />
      </TabsContent>
=======
      <TabsContent value="trial-balance"><TrialBalanceReport /></TabsContent>
      <TabsContent value="cash-flow"><CashFlowReport /></TabsContent>
      <TabsContent value="tax-summary"><TaxSummaryReport /></TabsContent>
      <TabsContent value="ar-aging"><ARAgingReport /></TabsContent>
>>>>>>> main
    </Tabs>
  )
}
