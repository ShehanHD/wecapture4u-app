import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchReport, downloadReportCsv, type ReportType } from '@/api/accounting'
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

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
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
      </div>
      {pl && (
        <div className="rounded-lg border border-border overflow-hidden text-sm">
          <table className="w-full">
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
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">As of</label>
          <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-8 text-sm" />
        </div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {bs && (
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv('balance-sheet', { as_of_date: asOf })}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        )}
      </div>
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
          </table>
        </div>
      )}
    </div>
  )
}

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
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      setData(await fetchReport(type, params))
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
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
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        )}
      </div>
      {data !== null && (
        <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs overflow-auto max-h-96 text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function AccountingReports() {
  return (
    <Tabs defaultValue="pl">
      <TabsList className="mb-4 flex-wrap h-auto">
        <TabsTrigger value="pl" className="text-xs">P&L</TabsTrigger>
        <TabsTrigger value="balance-sheet" className="text-xs">Balance Sheet</TabsTrigger>
        <TabsTrigger value="trial-balance" className="text-xs">Trial Balance</TabsTrigger>
        <TabsTrigger value="cash-flow" className="text-xs">Cash Flow</TabsTrigger>
        <TabsTrigger value="tax-summary" className="text-xs">Tax Summary</TabsTrigger>
        <TabsTrigger value="ar-aging" className="text-xs">AR Aging</TabsTrigger>
      </TabsList>

      <TabsContent value="pl"><PLReport /></TabsContent>
      <TabsContent value="balance-sheet"><BalanceSheetReport /></TabsContent>
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
    </Tabs>
  )
}
