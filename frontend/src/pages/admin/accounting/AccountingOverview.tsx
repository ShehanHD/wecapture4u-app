<<<<<<< HEAD
=======
// frontend/src/pages/admin/accounting/AccountingOverview.tsx
>>>>>>> main
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchReport } from '@/api/accounting'
import { useJournalEntries } from '@/hooks/useAccounting'

<<<<<<< HEAD
=======
function asStringRecord(val: unknown): Record<string, string> {
  if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, string>
  }
  return {}
}

>>>>>>> main
function fmt(n: string | number | undefined): string {
  if (n === undefined) return '—'
  return `$${parseFloat(String(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function delta(current: number, prior: number): { pct: string; up: boolean } {
  if (prior === 0) return { pct: '—', up: current >= 0 }
  const pct = ((current - prior) / Math.abs(prior)) * 100
  return { pct: `${Math.abs(pct).toFixed(0)}%`, up: pct >= 0 }
}

export function AccountingOverview() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonthStart = toISO(new Date(currentYear, today.getMonth(), 1))
  const priorMonthStart = toISO(new Date(currentYear, today.getMonth() - 1, 1))
  const priorMonthEnd = toISO(new Date(currentYear, today.getMonth(), 0))

  const { data: currentPL } = useQuery({
    queryKey: ['reports', 'pl', currentMonthStart, toISO(today)],
    queryFn: () => fetchReport('pl', { start_date: currentMonthStart, end_date: toISO(today) }),
  })

  const { data: priorPL } = useQuery({
    queryKey: ['reports', 'pl', priorMonthStart, priorMonthEnd],
    queryFn: () => fetchReport('pl', { start_date: priorMonthStart, end_date: priorMonthEnd }),
  })

  const { data: arAging } = useQuery({
    queryKey: ['reports', 'ar-aging', toISO(today)],
    queryFn: () => fetchReport('ar-aging', { as_of_date: toISO(today) }),
  })

  const { data: monthlyData } = useQuery({
    queryKey: ['reports', 'monthly-pl', currentYear],
    queryFn: async () => {
      const monthCount = today.getMonth() + 1
      return Promise.all(
        Array.from({ length: monthCount }, async (_, i) => {
          const start = toISO(new Date(currentYear, i, 1))
          const end = toISO(new Date(currentYear, i + 1, 0))
<<<<<<< HEAD
          const pl = await fetchReport('pl', { start_date: start, end_date: end }) as Record<string, string>
=======
          const pl = asStringRecord(await fetchReport('pl', { start_date: start, end_date: end }))
>>>>>>> main
          return {
            month: new Date(currentYear, i).toLocaleString('default', { month: 'short' }),
            revenue: parseFloat(pl.total_revenue ?? '0'),
            expenses: parseFloat(pl.total_expenses ?? '0'),
          }
        })
      )
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: recentEntries = [] } = useJournalEntries({ status: 'posted' })
  const last5 = recentEntries.slice(0, 5)

<<<<<<< HEAD
  const cur = currentPL as Record<string, string> | undefined
  const pri = priorPL as Record<string, string> | undefined
  const ar = arAging as Record<string, string> | undefined
=======
  const cur = asStringRecord(currentPL)
  const pri = asStringRecord(priorPL)
  const ar = asStringRecord(arAging)
>>>>>>> main

  const revenue = parseFloat(cur?.total_revenue ?? '0')
  const expenses = parseFloat(cur?.total_expenses ?? '0')
  const profit = parseFloat(cur?.net_profit ?? '0')
  const outstanding = parseFloat(ar?.total_outstanding ?? '0')

  const revPrior = parseFloat(pri?.total_revenue ?? '0')
  const expPrior = parseFloat(pri?.total_expenses ?? '0')
  const profitPrior = parseFloat(pri?.net_profit ?? '0')

  const revDelta = delta(revenue, revPrior)
  const expDelta = delta(expenses, expPrior)
  const profitDelta = delta(profit, profitPrior)

  const cards = [
    { label: 'Revenue (MTD)', value: fmt(revenue), delta: revDelta, positive: revDelta.up },
    { label: 'Expenses (MTD)', value: fmt(expenses), delta: expDelta, positive: !expDelta.up },
    { label: 'Net Profit (MTD)', value: fmt(profit), delta: profitDelta, positive: profitDelta.up },
    { label: 'Outstanding AR', value: fmt(outstanding), delta: null, positive: outstanding === 0 },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
            {card.delta && (
              <p className={`text-xs mt-1 ${card.positive ? 'text-green-400' : 'text-red-400'}`}>
                {card.delta.up ? '↑' : '↓'} {card.delta.pct} vs last month
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Revenue vs Expenses ({currentYear})</h3>
          {monthlyData && monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                />
                <Bar dataKey="revenue" fill="#f59e0b" name="Revenue" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
<<<<<<< HEAD
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Loading chart…</div>
=======
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Loading chart…
            </div>
>>>>>>> main
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Recent Journal Entries</h3>
          {last5.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posted entries yet.</p>
          ) : (
            <div className="space-y-2">
              {last5.map(entry => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{entry.description}</span>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">{entry.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
