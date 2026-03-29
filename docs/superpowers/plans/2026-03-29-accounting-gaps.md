# Accounting Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four accounting frontend gaps — format 4 raw-JSON reports into proper tables, add account ledger slide-over, add expense inline edit, fix raw axios import.

**Architecture:** Frontend-only. All backend endpoints already exist. Four independent tasks that can be done and committed in isolation. No new hooks or API functions needed — all exist. Pattern: `JournalEntryReviewPanel` for the slide-over; `AccountingAccounts` inline-edit pattern for expense edit.

**Tech Stack:** React 18, TypeScript strict, TanStack Query, shadcn/ui, lucide-react, axios

---

## File Map

| File | Change |
|---|---|
| `frontend/src/pages/admin/accounting/AccountingReports.tsx` | Replace 4 `GenericReport` usages with `TrialBalanceReport`, `CashFlowReport`, `TaxSummaryReport`, `ARAgingReport` |
| `frontend/src/components/accounting/AccountLedgerPanel.tsx` | New — slide-over panel for account transaction history |
| `frontend/src/pages/admin/accounting/AccountingAccounts.tsx` | Add BookOpen icon button + ledger panel state |
| `frontend/src/pages/admin/accounting/AccountingExpenses.tsx` | Add inline edit for payable expenses + fix axios import |

---

## Task 1: Fix raw axios import in AccountingExpenses

**Files:**
- Modify: `frontend/src/pages/admin/accounting/AccountingExpenses.tsx`

- [ ] **Step 1: Replace the import**

In `AccountingExpenses.tsx`, change line 3:

```ts
// Before
import axios from 'axios'

// After
import { isAxiosError } from 'axios'
```

- [ ] **Step 2: Update the usage**

Change line 63:

```ts
// Before
if (axios.isAxiosError(err) && err.response?.status === 409) {

// After
if (isAxiosError(err) && err.response?.status === 409) {
```

- [ ] **Step 3: Verify lint**

Run: `cd /Users/don/Desktop/weCapture4U-app/frontend && npm run lint 2>&1 | grep "AccountingExpenses"`

Expected: no output

- [ ] **Step 4: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/pages/admin/accounting/AccountingExpenses.tsx
git commit -m "fix: replace default axios import with named isAxiosError in AccountingExpenses"
```

---

## Task 2: Format Trial Balance and Cash Flow reports

**Files:**
- Modify: `frontend/src/pages/admin/accounting/AccountingReports.tsx`

The current file has `PLReport`, `BalanceSheetReport`, `GenericReport`, and `AccountingReports`. Add the two new components after `BalanceSheetReport` and before `GenericReport`.

- [ ] **Step 1: Add `TrialBalanceReport` component**

Insert after the closing `}` of `BalanceSheetReport` and before `GenericReport`:

```tsx
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
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv('trial-balance', { as_of_date: asOf })}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        )}
      </div>
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
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `CashFlowReport` component**

Insert immediately after `TrialBalanceReport`:

```tsx
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
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
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
```

- [ ] **Step 3: Replace GenericReport usages for trial-balance and cash-flow**

In the `AccountingReports` function, replace:

```tsx
      <TabsContent value="trial-balance">
        <GenericReport type="trial-balance" params={[{ key: 'as_of_date', label: 'As of', defaultValue: today() }]} />
      </TabsContent>
      <TabsContent value="cash-flow">
        <GenericReport type="cash-flow" params={[
          { key: 'start_date', label: 'From', defaultValue: monthStart() },
          { key: 'end_date', label: 'To', defaultValue: today() },
        ]} />
      </TabsContent>
```

With:

```tsx
      <TabsContent value="trial-balance"><TrialBalanceReport /></TabsContent>
      <TabsContent value="cash-flow"><CashFlowReport /></TabsContent>
```

- [ ] **Step 4: Verify lint**

Run: `cd /Users/don/Desktop/weCapture4U-app/frontend && npm run lint 2>&1 | grep "AccountingReports"`

Expected: no output

- [ ] **Step 5: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/pages/admin/accounting/AccountingReports.tsx
git commit -m "feat: format Trial Balance and Cash Flow reports with proper tables"
```

---

## Task 3: Format Tax Summary and AR Aging reports

**Files:**
- Modify: `frontend/src/pages/admin/accounting/AccountingReports.tsx`

- [ ] **Step 1: Add `TaxSummaryReport` component**

Insert after `CashFlowReport` and before `GenericReport`:

```tsx
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
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div><label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" /></div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {data && (
          <Button size="sm" variant="outline" onClick={() => downloadReportCsv('tax-summary', { start_date: startDate, end_date: endDate })}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        )}
      </div>
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
```

- [ ] **Step 2: Add `ARAgingReport` component**

Insert after `TaxSummaryReport` and before `GenericReport`:

```tsx
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
      )}
    </div>
  )
}
```

- [ ] **Step 3: Replace GenericReport usages for tax-summary and ar-aging**

In the `AccountingReports` function, replace:

```tsx
      <TabsContent value="tax-summary">
        <GenericReport type="tax-summary" params={[
          { key: 'start_date', label: 'From', defaultValue: monthStart() },
          { key: 'end_date', label: 'To', defaultValue: today() },
        ]} />
      </TabsContent>
      <TabsContent value="ar-aging">
        <GenericReport type="ar-aging" params={[{ key: 'as_of_date', label: 'As of', defaultValue: today() }]} />
      </TabsContent>
```

With:

```tsx
      <TabsContent value="tax-summary"><TaxSummaryReport /></TabsContent>
      <TabsContent value="ar-aging"><ARAgingReport /></TabsContent>
```

- [ ] **Step 4: Delete the unused `GenericReport` function**

Remove the entire `GenericReport` function from the file. It begins with `function GenericReport(` and ends at its closing `}` before `export function AccountingReports`.

- [ ] **Step 5: Verify lint**

Run: `cd /Users/don/Desktop/weCapture4U-app/frontend && npm run lint 2>&1 | grep "AccountingReports"`

Expected: no output

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/pages/admin/accounting/AccountingReports.tsx
git commit -m "feat: format Tax Summary and AR Aging reports, remove GenericReport"
```

---

## Task 4: Account Ledger slide-over component

**Files:**
- Create: `frontend/src/components/accounting/AccountLedgerPanel.tsx`

- [ ] **Step 1: Create the file with full content**

```tsx
// frontend/src/components/accounting/AccountLedgerPanel.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { fetchAccountLedger } from '@/api/accounting'
import type { AccountLedgerOut, AccountOut } from '@/schemas/accounting'

interface Props {
  account: AccountOut | null
  onClose: () => void
}

const TYPE_COLORS: Record<string, string> = {
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

  if (!account) return null

  async function handleLoad() {
    setLoading(true)
    try {
      const result = await fetchAccountLedger(account!.id, { start_date: startDate, end_date: endDate })
      setData(result)
    } catch {
      toast.error('Failed to load ledger')
    } finally {
      setLoading(false)
    }
  }

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
                      <td className="px-4 py-2 text-xs max-w-[160px] truncate">{line.description}</td>
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
```

- [ ] **Step 2: Verify lint**

Run: `cd /Users/don/Desktop/weCapture4U-app/frontend && npm run lint 2>&1 | grep "AccountLedgerPanel"`

Expected: no output

- [ ] **Step 3: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/components/accounting/AccountLedgerPanel.tsx
git commit -m "feat: add AccountLedgerPanel slide-over component"
```

---

## Task 5: Wire Account Ledger into AccountingAccounts

**Files:**
- Modify: `frontend/src/pages/admin/accounting/AccountingAccounts.tsx`

- [ ] **Step 1: Update imports**

Replace the existing lucide-react import line:

```tsx
// Before
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

// After
import { Plus, Pencil, Trash2, Check, X, BookOpen } from 'lucide-react'
```

Add after the last existing import line:

```tsx
import { AccountLedgerPanel } from '@/components/accounting/AccountLedgerPanel'
```

- [ ] **Step 2: Add ledger state inside `AccountingAccounts`**

After `const [deleteTarget, setDeleteTarget] = useState<AccountOut | null>(null)` (line 32), add:

```tsx
  const [ledgerAccount, setLedgerAccount] = useState<AccountOut | null>(null)
```

- [ ] **Step 3: Add BookOpen button to each account row**

In the actions cell `<div className="flex items-center gap-1 justify-end">`, add a BookOpen button as the **first** child (before the Pencil button condition):

```tsx
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setLedgerAccount(acct)}
                        title="View ledger"
                      >
                        <BookOpen className="h-3 w-3" />
                      </Button>
```

- [ ] **Step 4: Render the panel**

Add before the closing `</div>` of the component return, after `<ConfirmDialog .../>`:

```tsx
      <AccountLedgerPanel
        account={ledgerAccount}
        onClose={() => setLedgerAccount(null)}
      />
```

- [ ] **Step 5: Verify lint**

Run: `cd /Users/don/Desktop/weCapture4U-app/frontend && npm run lint 2>&1 | grep "AccountingAccounts"`

Expected: no output

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/pages/admin/accounting/AccountingAccounts.tsx
git commit -m "feat: add account ledger drill-down via BookOpen button in chart of accounts"
```

---

## Task 6: Expense inline edit

**Files:**
- Modify: `frontend/src/pages/admin/accounting/AccountingExpenses.tsx`

- [ ] **Step 1: Add icons to lucide-react import**

```tsx
// Before
import { Plus, Trash2 } from 'lucide-react'

// After
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
```

- [ ] **Step 2: Add `useUpdateExpense` to hook import**

```tsx
// Before
import { useExpenses, useCreateExpense, useDeleteExpense, usePayExpense, useAccounts } from '@/hooks/useAccounting'

// After
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, usePayExpense, useAccounts } from '@/hooks/useAccounting'
```

- [ ] **Step 3: Add edit state after existing `payForm` state**

After `const [payForm, setPayForm] = useState(...)` add:

```tsx
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    date: '',
    description: '',
    amount: '',
    expense_account_id: '',
    notes: '',
  })
```

- [ ] **Step 4: Add `updateMutation` after existing mutations**

After `const payMutation = usePayExpense()` add:

```tsx
  const updateMutation = useUpdateExpense()
```

- [ ] **Step 5: Add `startEdit` and `handleEdit` functions after `handlePay`**

```tsx
  function startEdit(exp: ExpenseOut) {
    setEditingId(exp.id)
    setEditForm({
      date: exp.date,
      description: exp.description,
      amount: exp.amount,
      expense_account_id: exp.expense_account_id,
      notes: exp.notes ?? '',
    })
  }

  async function handleEdit() {
    if (!editingId) return
    try {
      await updateMutation.mutateAsync({ id: editingId, payload: editForm })
      setEditingId(null)
      toast.success('Expense updated')
    } catch {
      toast.error('Failed to update expense')
    }
  }
```

- [ ] **Step 6: Replace the expense table row block**

Replace the existing `{expenses.map(exp => (` block (the `<tr>` and all its `<td>` children) with an edit-aware version:

```tsx
              {expenses.map(exp => (
                <tr key={exp.id}>
                  {editingId === exp.id ? (
                    <>
                      <td className="px-2 py-1">
                        <Input type="date" value={editForm.date}
                          onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                          className="h-7 text-xs" />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={editForm.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          className="h-7 text-xs" />
                      </td>
                      <td className="px-2 py-1">
                        <select className="h-7 rounded-md border border-input bg-background px-2 text-xs w-full"
                          value={editForm.expense_account_id}
                          onChange={e => setEditForm(f => ({ ...f, expense_account_id: e.target.value }))}>
                          {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" step="0.01" value={editForm.amount}
                          onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                          className="h-7 text-xs text-right" />
                      </td>
                      <td className="px-2 py-1 text-xs text-muted-foreground">—</td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={handleEdit}
                            disabled={!editForm.description || !editForm.expense_account_id || !editForm.amount || updateMutation.isPending}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setEditingId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">{exp.date}</td>
                      <td className="px-4 py-2">{exp.description}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{exp.expense_account_name ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">${exp.amount}</td>
                      <td className="px-4 py-2">
                        <Badge className={exp.payment_status === 'paid'
                          ? 'bg-green-500/20 text-green-400 text-xs'
                          : 'bg-yellow-500/20 text-yellow-400 text-xs'}>
                          {exp.payment_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          {exp.payment_status === 'payable' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => startEdit(exp)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {exp.payment_status === 'payable' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => { setPayTarget(exp); setPayForm({ payment_account_id: '', payment_date: new Date().toISOString().split('T')[0] }) }}>
                              Mark Paid
                            </Button>
                          )}
                          {exp.payment_status === 'payable' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteTarget(exp)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
```

- [ ] **Step 7: Verify lint**

Run: `cd /Users/don/Desktop/weCapture4U-app/frontend && npm run lint 2>&1 | grep "AccountingExpenses"`

Expected: no output

- [ ] **Step 8: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/pages/admin/accounting/AccountingExpenses.tsx
git commit -m "feat: add inline edit for payable expenses in accounting tab"
```
