# Accounting Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Accounting admin page — 6 horizontal tabs (Overview, Chart of Accounts, Journal, Expenses, Payments, Reports) — wired to the existing accounting backend.

**Architecture:** Single `/accounting` page with shadcn `Tabs`. Each tab is a sub-component in `pages/admin/accounting/`. Data flows through: page → TanStack Query hook → api function (axios) → Zod-validated response. Reports tab fetches on demand (Run button). Overview fetches on mount.

**Tech Stack:** React 18, TypeScript (strict), Zod, TanStack Query v5, axios, shadcn/ui (Tabs, Badge, Button, Input, Select, Dialog, ConfirmDialog), recharts, lucide-react

**Depends on:** Plan 5 (reports backend) must be deployed before the Reports tab can function.

---

## File Structure

```
frontend/src/
  schemas/
    accounting.ts                           # Create: Zod schemas for all accounting types
  api/
    accounting.ts                           # Create: typed API functions (axios + Zod)
  hooks/
    useAccounting.ts                        # Create: TanStack Query hooks
  components/
    accounting/
      JournalEntryLineEditor.tsx            # Create: debit/credit line table (read/edit modes)
      JournalEntryReviewPanel.tsx           # Create: slide-over panel for journal entry detail
  pages/
    admin/
      Accounting.tsx                        # Modify: replace stub with 6-tab page
      accounting/
        AccountingOverview.tsx              # Create: KPI cards + bar chart + recent entries
        AccountingAccounts.tsx              # Create: chart of accounts CRUD table
        AccountingJournal.tsx               # Create: journal entry list + review panel
        AccountingExpenses.tsx              # Create: expense list + inline add + pay dialog
        AccountingPayments.tsx              # Create: read-only invoice payment audit view
        AccountingReports.tsx              # Create: 6 report sub-tabs with run + CSV download
```

---

### Task 1: Zod schemas

**Files:**
- Create: `frontend/src/schemas/accounting.ts`

- [ ] **Step 1: Write the schema file**

```typescript
// frontend/src/schemas/accounting.ts
import { z } from 'zod'

// ─── Accounts ─────────────────────────────────────────────────────────────────

export const AccountTypeSchema = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense'])
export type AccountType = z.infer<typeof AccountTypeSchema>

export const AccountOutSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  normal_balance: z.enum(['debit', 'credit']),
  is_system: z.boolean(),
  archived: z.boolean(),
  created_at: z.string(),
})
export type AccountOut = z.infer<typeof AccountOutSchema>

export const AccountLedgerLineSchema = z.object({
  date: z.string(),
  description: z.string(),
  reference_type: z.string().nullable(),
  debit: z.string(),
  credit: z.string(),
  running_balance: z.string(),
})

export const AccountLedgerOutSchema = z.object({
  account: AccountOutSchema,
  opening_balance: z.string(),
  lines: z.array(AccountLedgerLineSchema),
  closing_balance: z.string(),
})
export type AccountLedgerOut = z.infer<typeof AccountLedgerOutSchema>

// ─── Journal Entries ──────────────────────────────────────────────────────────

export const JournalLineOutSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  account_name: z.string(),
  account_code: z.string(),
  debit: z.string(),
  credit: z.string(),
  description: z.string().nullable(),
})
export type JournalLineOut = z.infer<typeof JournalLineOutSchema>

export const JournalEntryStatusSchema = z.enum(['draft', 'posted', 'voided'])

export const JournalEntryOutSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  reference_type: z.string().nullable(),
  reference_id: z.string().uuid().nullable(),
  status: JournalEntryStatusSchema,
  created_by: z.string(),
  void_of: z.string().uuid().nullable(),
  lines: z.array(JournalLineOutSchema),
})
export type JournalEntryOut = z.infer<typeof JournalEntryOutSchema>

export const JournalEntryListItemSchema = JournalEntryOutSchema.omit({ lines: true }).extend({
  line_count: z.number().optional(),
})
export type JournalEntryListItem = z.infer<typeof JournalEntryListItemSchema>

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const ExpensePaymentStatusSchema = z.enum(['paid', 'payable'])

export const ExpenseOutSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  expense_account_id: z.string().uuid(),
  expense_account_name: z.string().nullable(),
  amount: z.string(),
  payment_status: ExpensePaymentStatusSchema,
  payment_account_id: z.string().uuid().nullable(),
  receipt_url: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type ExpenseOut = z.infer<typeof ExpenseOutSchema>
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | grep "accounting.ts" | head -20
```

Expected: no output (no errors in the schema file).

---

### Task 2: API layer

**Files:**
- Create: `frontend/src/api/accounting.ts`

- [ ] **Step 1: Write the API file**

```typescript
// frontend/src/api/accounting.ts
import { z } from 'zod'
import { api } from '@/lib/axios'
import {
  AccountOutSchema, AccountLedgerOutSchema,
  JournalEntryOutSchema, JournalEntryListItemSchema,
  ExpenseOutSchema,
  type AccountOut, type AccountLedgerOut,
  type JournalEntryOut, type JournalEntryListItem,
  type ExpenseOut,
} from '@/schemas/accounting'

export type { AccountOut, AccountLedgerOut, JournalEntryOut, JournalEntryListItem, ExpenseOut }

// ─── Accounts ─────────────────────────────────────────────────────────────────

export interface AccountCreatePayload {
  code: string
  name: string
  type: string
  normal_balance: string
}

export interface AccountUpdatePayload {
  name?: string
  archived?: boolean
}

export async function fetchAccounts(params?: { type?: string; archived?: boolean }): Promise<AccountOut[]> {
  const { data } = await api.get('/api/accounts', { params })
  return z.array(AccountOutSchema).parse(data)
}

export async function createAccount(payload: AccountCreatePayload): Promise<AccountOut> {
  const { data } = await api.post('/api/accounts', payload)
  return AccountOutSchema.parse(data)
}

export async function updateAccount(id: string, payload: AccountUpdatePayload): Promise<AccountOut> {
  const { data } = await api.patch(`/api/accounts/${id}`, payload)
  return AccountOutSchema.parse(data)
}

export async function deleteAccount(id: string): Promise<void> {
  await api.delete(`/api/accounts/${id}`)
}

export async function fetchAccountLedger(
  id: string,
  params: { start_date?: string; end_date?: string; as_of_date?: string },
): Promise<AccountLedgerOut> {
  const { data } = await api.get(`/api/accounts/${id}/ledger`, { params })
  return AccountLedgerOutSchema.parse(data)
}

// ─── Journal Entries ──────────────────────────────────────────────────────────

export interface JournalLineInput {
  account_id: string
  debit: string
  credit: string
  description?: string
}

export interface JournalEntryCreatePayload {
  date: string
  description: string
  lines: JournalLineInput[]
}

export interface JournalEntryUpdatePayload {
  date?: string
  description?: string
  lines?: JournalLineInput[]
}

export async function fetchJournalEntries(params?: {
  status?: string
  start_date?: string
  end_date?: string
}): Promise<JournalEntryListItem[]> {
  const { data } = await api.get('/api/journal-entries', { params })
  return z.array(JournalEntryListItemSchema).parse(data)
}

export async function fetchJournalEntry(id: string): Promise<JournalEntryOut> {
  const { data } = await api.get(`/api/journal-entries/${id}`)
  return JournalEntryOutSchema.parse(data)
}

export async function createJournalEntry(payload: JournalEntryCreatePayload): Promise<JournalEntryOut> {
  const { data } = await api.post('/api/journal-entries', payload)
  return JournalEntryOutSchema.parse(data)
}

export async function updateJournalEntry(id: string, payload: JournalEntryUpdatePayload): Promise<JournalEntryOut> {
  const { data } = await api.patch(`/api/journal-entries/${id}`, payload)
  return JournalEntryOutSchema.parse(data)
}

export async function postJournalEntry(id: string): Promise<JournalEntryOut> {
  const { data } = await api.post(`/api/journal-entries/${id}/post`)
  return JournalEntryOutSchema.parse(data)
}

export async function voidJournalEntry(id: string): Promise<JournalEntryOut> {
  const { data } = await api.post(`/api/journal-entries/${id}/void`)
  return JournalEntryOutSchema.parse(data)
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface ExpenseCreatePayload {
  date: string
  description: string
  expense_account_id: string
  amount: string
  payment_status: 'payable' | 'paid'
  payment_account_id?: string
  notes?: string
}

export interface ExpenseUpdatePayload {
  description?: string
  amount?: string
  notes?: string
}

export interface ExpensePayPayload {
  payment_account_id: string
  payment_date: string
}

export async function fetchExpenses(params?: {
  expense_account_id?: string
  payment_status?: string
  start_date?: string
  end_date?: string
}): Promise<ExpenseOut[]> {
  const { data } = await api.get('/api/expenses', { params })
  return z.array(ExpenseOutSchema).parse(data)
}

export async function createExpense(payload: ExpenseCreatePayload): Promise<ExpenseOut> {
  const { data } = await api.post('/api/expenses', payload)
  return ExpenseOutSchema.parse(data)
}

export async function updateExpense(id: string, payload: ExpenseUpdatePayload): Promise<ExpenseOut> {
  const { data } = await api.patch(`/api/expenses/${id}`, payload)
  return ExpenseOutSchema.parse(data)
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/api/expenses/${id}`)
}

export async function payExpense(id: string, payload: ExpensePayPayload): Promise<ExpenseOut> {
  const { data } = await api.post(`/api/expenses/${id}/pay`, payload)
  return ExpenseOutSchema.parse(data)
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportType = 'pl' | 'balance-sheet' | 'trial-balance' | 'cash-flow' | 'tax-summary' | 'ar-aging'

export async function fetchReport(
  type: ReportType,
  params: Record<string, string>,
): Promise<unknown> {
  const { data } = await api.get(`/api/reports/${type}`, { params })
  return data
}

export function downloadReportCsv(type: ReportType, params: Record<string, string>): void {
  const qs = new URLSearchParams({ ...params, format: 'csv' }).toString()
  const url = `${api.defaults.baseURL ?? ''}/api/reports/${type}?${qs}`
  const a = document.createElement('a')
  a.href = url
  a.download = `${type}.csv`
  a.click()
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | grep "api/accounting" | head -20
```

Expected: no output.

---

### Task 3: TanStack Query hooks

**Files:**
- Create: `frontend/src/hooks/useAccounting.ts`

- [ ] **Step 1: Write the hooks file**

```typescript
// frontend/src/hooks/useAccounting.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAccounts, createAccount, updateAccount, deleteAccount,
  fetchJournalEntries, fetchJournalEntry, createJournalEntry,
  updateJournalEntry, postJournalEntry, voidJournalEntry,
  fetchExpenses, createExpense, updateExpense, deleteExpense, payExpense,
  type AccountCreatePayload, type AccountUpdatePayload,
  type JournalEntryCreatePayload, type JournalEntryUpdatePayload,
  type ExpenseCreatePayload, type ExpenseUpdatePayload, type ExpensePayPayload,
} from '@/api/accounting'

// ─── Accounts ─────────────────────────────────────────────────────────────────

export function useAccounts(params?: { type?: string; archived?: boolean }) {
  return useQuery({
    queryKey: ['accounts', params],
    queryFn: () => fetchAccounts(params),
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AccountCreatePayload) => createAccount(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AccountUpdatePayload }) =>
      updateAccount(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

// ─── Journal Entries ──────────────────────────────────────────────────────────

export function useJournalEntries(params?: { status?: string; start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: ['journal-entries', params],
    queryFn: () => fetchJournalEntries(params),
  })
}

export function useJournalEntry(id: string | null) {
  return useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => fetchJournalEntry(id!),
    enabled: !!id,
  })
}

export function useCreateJournalEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: JournalEntryCreatePayload) => createJournalEntry(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal-entries'] }),
  })
}

export function useUpdateJournalEntry(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: JournalEntryUpdatePayload) => updateJournalEntry(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      qc.invalidateQueries({ queryKey: ['journal-entry', id] })
    },
  })
}

export function usePostJournalEntry(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => postJournalEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      qc.invalidateQueries({ queryKey: ['journal-entry', id] })
    },
  })
}

export function useVoidJournalEntry(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => voidJournalEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      qc.invalidateQueries({ queryKey: ['journal-entry', id] })
    },
  })
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export function useExpenses(params?: {
  expense_account_id?: string
  payment_status?: string
  start_date?: string
  end_date?: string
}) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => fetchExpenses(params),
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ExpenseCreatePayload) => createExpense(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpenseUpdatePayload }) =>
      updateExpense(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function usePayExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpensePayPayload }) =>
      payExpense(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
    },
  })
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | grep "useAccounting" | head -20
```

Expected: no output.

---

### Task 4: JournalEntryLineEditor + JournalEntryReviewPanel components

**Files:**
- Create: `frontend/src/components/accounting/JournalEntryLineEditor.tsx`
- Create: `frontend/src/components/accounting/JournalEntryReviewPanel.tsx`

- [ ] **Step 1: Write JournalEntryLineEditor**

```tsx
// frontend/src/components/accounting/JournalEntryLineEditor.tsx
import { X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AccountOut, JournalLineOut } from '@/schemas/accounting'

export interface LineInput {
  account_id: string
  debit: string
  credit: string
  description: string
}

interface Props {
  lines: JournalLineOut[] | LineInput[]
  editable: boolean
  accounts?: AccountOut[]
  onChange?: (lines: LineInput[]) => void
}

function isJournalLineOut(line: JournalLineOut | LineInput): line is JournalLineOut {
  return 'account_name' in line
}

export function JournalEntryLineEditor({ lines, editable, accounts = [], onChange }: Props) {
  const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0)
  const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || '0'), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001

  function updateLine(index: number, field: keyof LineInput, value: string) {
    const updated = (lines as LineInput[]).map((l, i) =>
      i === index ? { ...l, [field]: value } : l
    )
    onChange?.(updated)
  }

  function addLine() {
    onChange?.([...(lines as LineInput[]), { account_id: '', debit: '0.00', credit: '0.00', description: '' }])
  }

  function removeLine(index: number) {
    onChange?.((lines as LineInput[]).filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground px-1 mb-1">
        <span>Account</span>
        <span className="text-right">Debit</span>
        <span className="text-right">Credit</span>
        <span />
      </div>

      {lines.map((line, i) => (
        <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
          {editable ? (
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={(line as LineInput).account_id}
              onChange={e => updateLine(i, 'account_id', e.target.value)}
            >
              <option value="">Select account…</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm">
              {isJournalLineOut(line) ? `${line.account_code} — ${line.account_name}` : line.account_id}
            </span>
          )}

          {editable ? (
            <Input
              className="h-8 text-right text-sm"
              value={(line as LineInput).debit}
              onChange={e => updateLine(i, 'debit', e.target.value)}
            />
          ) : (
            <span className="text-right text-sm tabular-nums">
              {parseFloat(line.debit) > 0 ? line.debit : '—'}
            </span>
          )}

          {editable ? (
            <Input
              className="h-8 text-right text-sm"
              value={(line as LineInput).credit}
              onChange={e => updateLine(i, 'credit', e.target.value)}
            />
          ) : (
            <span className="text-right text-sm tabular-nums">
              {parseFloat(line.credit) > 0 ? line.credit : '—'}
            </span>
          )}

          {editable ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(i)}>
              <X className="h-3 w-3" />
            </Button>
          ) : (
            <span />
          )}
        </div>
      ))}

      {editable && (
        <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={addLine}>
          <Plus className="h-3 w-3 mr-1" /> Add line
        </Button>
      )}

      <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 border-t border-border pt-2 mt-2">
        <span className="text-sm font-medium">Totals</span>
        <span className={`text-right text-sm font-medium tabular-nums ${!balanced ? 'text-destructive' : ''}`}>
          {totalDebit.toFixed(2)}
        </span>
        <span className={`text-right text-sm font-medium tabular-nums ${!balanced ? 'text-destructive' : ''}`}>
          {totalCredit.toFixed(2)}
        </span>
        <span />
      </div>
      {!balanced && (
        <p className="text-xs text-destructive">Debits and credits must be equal to post.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write JournalEntryReviewPanel**

```tsx
// frontend/src/components/accounting/JournalEntryReviewPanel.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { JournalEntryLineEditor, type LineInput } from './JournalEntryLineEditor'
import { usePostJournalEntry, useVoidJournalEntry, useUpdateJournalEntry, useAccounts } from '@/hooks/useAccounting'
import type { JournalEntryOut } from '@/schemas/accounting'

interface Props {
  entry: JournalEntryOut | null
  open: boolean
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-500/20 text-yellow-400',
  posted: 'bg-green-500/20 text-green-400',
  voided: 'bg-zinc-500/20 text-zinc-400',
}

export function JournalEntryReviewPanel({ entry, open, onClose }: Props) {
  const [editLines, setEditLines] = useState<LineInput[] | null>(null)
  const { data: accounts = [] } = useAccounts()

  const postMutation = usePostJournalEntry(entry?.id ?? '')
  const voidMutation = useVoidJournalEntry(entry?.id ?? '')
  const updateMutation = useUpdateJournalEntry(entry?.id ?? '')

  if (!open || !entry) return null

  const isDraft = entry.status === 'draft'
  const isPosted = entry.status === 'posted'
  const isEditing = editLines !== null && isDraft

  const displayLines = editLines ?? entry.lines.map(l => ({
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    description: l.description ?? '',
  }))

  const totalDebit = displayLines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0)
  const totalCredit = displayLines.reduce((s, l) => s + parseFloat(l.credit || '0'), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001

  async function handlePost() {
    try {
      await postMutation.mutateAsync()
      toast.success('Entry posted')
      onClose()
    } catch {
      toast.error('Failed to post entry')
    }
  }

  async function handleSaveAndPost() {
    if (!editLines) return
    try {
      await updateMutation.mutateAsync({ lines: editLines, date: entry!.date, description: entry!.description })
      await postMutation.mutateAsync()
      toast.success('Entry saved and posted')
      onClose()
    } catch {
      toast.error('Failed to save and post entry')
    }
  }

  async function handleSaveDraft() {
    if (!editLines) return
    try {
      await updateMutation.mutateAsync({ lines: editLines })
      setEditLines(null)
      toast.success('Draft saved')
    } catch {
      toast.error('Failed to save draft')
    }
  }

  async function handleVoid() {
    try {
      await voidMutation.mutateAsync()
      toast.success('Entry voided')
      onClose()
    } catch {
      toast.error('Failed to void entry')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-[520px] bg-card border-l border-border flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold leading-tight">{entry.description}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{entry.date}</span>
              <Badge className={`text-xs ${STATUS_COLORS[entry.status]}`}>{entry.status}</Badge>
              {entry.reference_type && (
                <span className="text-xs text-muted-foreground">{entry.reference_type}</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto p-4">
          <JournalEntryLineEditor
            lines={isEditing ? editLines! : entry.lines}
            editable={isEditing}
            accounts={accounts}
            onChange={setEditLines}
          />
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border shrink-0 flex items-center gap-2 flex-wrap">
          {isDraft && !isEditing && (
            <>
              <Button size="sm" onClick={() => setEditLines(displayLines)}>Edit</Button>
              <Button size="sm" variant="default" onClick={handlePost} disabled={postMutation.isPending}>
                Post
              </Button>
            </>
          )}
          {isDraft && isEditing && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditLines(null)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveDraft} disabled={updateMutation.isPending}>
                Save Draft
              </Button>
              <Button size="sm" variant="default" onClick={handleSaveAndPost} disabled={!balanced || updateMutation.isPending || postMutation.isPending}>
                Save & Post
              </Button>
            </>
          )}
          {isPosted && (
            <ConfirmDialog
              title="Void journal entry"
              description="This will create a reversing entry. The original entry cannot be edited after voiding."
              onConfirm={handleVoid}
            >
              <Button size="sm" variant="destructive" disabled={voidMutation.isPending}>
                Void
              </Button>
            </ConfirmDialog>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | grep -E "JournalEntry|LineEditor" | head -20
```

Expected: no output.

---

### Task 5: AccountingAccounts tab

**Files:**
- Create: `frontend/src/pages/admin/accounting/AccountingAccounts.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/pages/admin/accounting/AccountingAccounts.tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '@/hooks/useAccounting'
import type { AccountOut } from '@/schemas/accounting'

const TYPE_COLORS: Record<string, string> = {
  asset: 'bg-blue-500/20 text-blue-400',
  liability: 'bg-red-500/20 text-red-400',
  equity: 'bg-purple-500/20 text-purple-400',
  revenue: 'bg-green-500/20 text-green-400',
  expense: 'bg-orange-500/20 text-orange-400',
}

interface NewAccountForm {
  code: string
  name: string
  type: string
  normal_balance: string
}

export function AccountingAccounts() {
  const [showArchived, setShowArchived] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newForm, setNewForm] = useState<NewAccountForm>({
    code: '', name: '', type: 'asset', normal_balance: 'debit',
  })

  const { data: accounts = [], isLoading } = useAccounts({ archived: showArchived || undefined })
  const createMutation = useCreateAccount()
  const updateMutation = useUpdateAccount()
  const deleteMutation = useDeleteAccount()

  // Auto-set normal_balance when type changes
  const typeNormalBalance: Record<string, string> = {
    asset: 'debit', expense: 'debit',
    liability: 'credit', equity: 'credit', revenue: 'credit',
  }

  async function handleCreate() {
    try {
      await createMutation.mutateAsync(newForm)
      setNewForm({ code: '', name: '', type: 'asset', normal_balance: 'debit' })
      setShowAddForm(false)
      toast.success('Account created')
    } catch {
      toast.error('Failed to create account')
    }
  }

  async function handleUpdate(id: string) {
    try {
      await updateMutation.mutateAsync({ id, payload: { name: editName } })
      setEditingId(null)
      toast.success('Account updated')
    } catch {
      toast.error('Failed to update account')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Account deleted')
    } catch {
      toast.error('Failed to delete account — it may be in use')
    }
  }

  async function handleArchive(account: AccountOut) {
    try {
      await updateMutation.mutateAsync({ id: account.id, payload: { archived: !account.archived } })
      toast.success(account.archived ? 'Account restored' : 'Account archived')
    } catch {
      toast.error('Failed to update account')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
        <Button size="sm" onClick={() => setShowAddForm(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Add Account
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
          <h3 className="text-sm font-medium">New Account</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Code (e.g. 4100)"
              value={newForm.code}
              onChange={e => setNewForm(f => ({ ...f, code: e.target.value }))}
            />
            <Input
              placeholder="Account name"
              value={newForm.name}
              onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={newForm.type}
              onChange={e => setNewForm(f => ({
                ...f,
                type: e.target.value,
                normal_balance: typeNormalBalance[e.target.value] ?? 'debit',
              }))}
            >
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={newForm.normal_balance}
              onChange={e => setNewForm(f => ({ ...f, normal_balance: e.target.value }))}
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newForm.code || !newForm.name || createMutation.isPending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Code</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Normal</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accounts.map(acct => (
                <tr key={acct.id} className={acct.archived ? 'opacity-50' : ''}>
                  <td className="px-4 py-2 font-mono text-xs">{acct.code}</td>
                  <td className="px-4 py-2">
                    {editingId === acct.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-7 text-sm"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(acct.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span>
                        {acct.name}
                        {acct.is_system && <span className="ml-1 text-xs text-muted-foreground">(system)</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={`text-xs ${TYPE_COLORS[acct.type]}`}>{acct.type}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground capitalize">{acct.normal_balance}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      {!acct.is_system && editingId !== acct.id && (
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditingId(acct.id); setEditName(acct.name) }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {!acct.is_system && (
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                          onClick={() => handleArchive(acct)}
                        >
                          {acct.archived ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        </Button>
                      )}
                      {!acct.is_system && (
                        <ConfirmDialog
                          title="Delete account"
                          description={`Delete "${acct.name}"? This cannot be undone. If the account is in use, deletion will fail.`}
                          onConfirm={() => handleDelete(acct.id)}
                        >
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </ConfirmDialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | grep "AccountingAccounts" | head -10
```

Expected: no output.

---

### Task 6: AccountingJournal tab

**Files:**
- Create: `frontend/src/pages/admin/accounting/AccountingJournal.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/pages/admin/accounting/AccountingJournal.tsx
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
  invoice: 'Invoice',
  expense: 'Expense',
  payment: 'Payment',
  deposit: 'Deposit',
  manual: 'Manual',
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
      const entry = await createMutation.mutateAsync({
        date: today,
        description: 'New journal entry',
        lines: [],
      })
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
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'ghost'}
              onClick={() => setStatusFilter(s)}
              className="capitalize text-xs h-7"
            >
              {s}
            </Button>
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
                <tr
                  key={entry.id}
                  className="cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => handleOpenEntry(entry.id)}
                >
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
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | grep "AccountingJournal" | head -10
```

Expected: no output.

---

### Task 7: AccountingExpenses tab

**Files:**
- Create: `frontend/src/pages/admin/accounting/AccountingExpenses.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/pages/admin/accounting/AccountingExpenses.tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useExpenses, useCreateExpense, useDeleteExpense, usePayExpense, useAccounts } from '@/hooks/useAccounting'
import type { ExpenseOut } from '@/schemas/accounting'

type FilterStatus = 'all' | 'payable' | 'paid'

export function AccountingExpenses() {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [payTarget, setPayTarget] = useState<ExpenseOut | null>(null)

  // Add form state
  const [addForm, setAddForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    expense_account_id: '',
    amount: '',
    notes: '',
  })

  // Pay form state
  const [payForm, setPayForm] = useState({
    payment_account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
  })

  const { data: expenses = [], isLoading } = useExpenses(
    filter === 'all' ? undefined : { payment_status: filter }
  )
  const { data: allAccounts = [] } = useAccounts()
  const expenseAccounts = allAccounts.filter(a => a.type === 'expense' && !a.archived)
  const assetAccounts = allAccounts.filter(a => a.type === 'asset' && !a.archived)

  const createMutation = useCreateExpense()
  const deleteMutation = useDeleteExpense()
  const payMutation = usePayExpense()

  async function handleCreate() {
    try {
      await createMutation.mutateAsync({
        ...addForm,
        payment_status: 'payable',
      })
      setAddForm({
        date: new Date().toISOString().split('T')[0],
        description: '', expense_account_id: '', amount: '', notes: '',
      })
      setShowAddForm(false)
      toast.success('Expense added')
    } catch {
      toast.error('Failed to add expense')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Expense deleted')
    } catch {
      toast.error('Failed to delete expense')
    }
  }

  async function handlePay() {
    if (!payTarget) return
    try {
      await payMutation.mutateAsync({ id: payTarget.id, payload: payForm })
      setPayTarget(null)
      toast.success('Expense marked as paid')
    } catch {
      toast.error('Failed to record payment')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['all', 'payable', 'paid'] as FilterStatus[]).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'ghost'}
              onClick={() => setFilter(f)}
              className="capitalize text-xs h-7"
            >
              {f}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowAddForm(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Add Expense
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
          <h3 className="text-sm font-medium">New Expense</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              value={addForm.date}
              onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
            />
            <Input
              placeholder="Description"
              value={addForm.description}
              onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={addForm.expense_account_id}
              onChange={e => setAddForm(f => ({ ...f, expense_account_id: e.target.value }))}
            >
              <option value="">Expense account…</option>
              {expenseAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={addForm.amount}
              onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
            />
            <Input
              placeholder="Notes (optional)"
              value={addForm.notes}
              onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
              className="col-span-2"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!addForm.description || !addForm.expense_account_id || !addForm.amount || createMutation.isPending}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Account</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map(exp => (
                <tr key={exp.id}>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{exp.date}</td>
                  <td className="px-4 py-2">{exp.description}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{exp.expense_account_name ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${exp.amount}</td>
                  <td className="px-4 py-2">
                    <Badge className={exp.payment_status === 'paid'
                      ? 'bg-green-500/20 text-green-400 text-xs'
                      : 'bg-yellow-500/20 text-yellow-400 text-xs'
                    }>
                      {exp.payment_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      {exp.payment_status === 'payable' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => { setPayTarget(exp); setPayForm({ payment_account_id: '', payment_date: new Date().toISOString().split('T')[0] }) }}
                        >
                          Mark Paid
                        </Button>
                      )}
                      {exp.payment_status === 'payable' && (
                        <ConfirmDialog
                          title="Delete expense"
                          description={`Delete "${exp.description}"?`}
                          onConfirm={() => handleDelete(exp.id)}
                        >
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </ConfirmDialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pay dialog */}
      <Dialog open={!!payTarget} onOpenChange={open => { if (!open) setPayTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as paid — {payTarget?.description}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Payment account</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={payForm.payment_account_id}
                onChange={e => setPayForm(f => ({ ...f, payment_account_id: e.target.value }))}
              >
                <option value="">Select account…</option>
                {assetAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Payment date</label>
              <Input
                type="date"
                value={payForm.payment_date}
                onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button
              onClick={handlePay}
              disabled={!payForm.payment_account_id || payMutation.isPending}
            >
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | grep "AccountingExpenses" | head -10
```

Expected: no output.

---

### Task 8: AccountingPayments + AccountingOverview tabs

**Files:**
- Create: `frontend/src/pages/admin/accounting/AccountingPayments.tsx`
- Create: `frontend/src/pages/admin/accounting/AccountingOverview.tsx`

- [ ] **Step 1: Write AccountingPayments**

```tsx
// frontend/src/pages/admin/accounting/AccountingPayments.tsx
import { useInvoices } from '@/hooks/useInvoices'
import type { Payment } from '@/api/invoices'

export function AccountingPayments() {
  const { data: invoices = [], isLoading } = useInvoices()

  // Flatten all payments from all invoices, most recent first
  const payments: Array<Payment & { clientId: string }> = invoices
    .flatMap(inv => inv.payments.map(p => ({ ...p, clientId: inv.client_id })))
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        All recorded invoice payments — read only. To add payments, use the invoice detail view.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Method</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{p.paid_at}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${p.amount}</td>
                  <td className="px-4 py-2 text-muted-foreground capitalize">{p.method ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write AccountingOverview**

```tsx
// frontend/src/pages/admin/accounting/AccountingOverview.tsx
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchReport } from '@/api/accounting'
import { useJournalEntries } from '@/hooks/useAccounting'

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

  // Monthly chart data for current year
  const { data: monthlyData } = useQuery({
    queryKey: ['reports', 'monthly-pl', currentYear],
    queryFn: async () => {
      const monthCount = today.getMonth() + 1
      return Promise.all(
        Array.from({ length: monthCount }, async (_, i) => {
          const start = toISO(new Date(currentYear, i, 1))
          const end = toISO(new Date(currentYear, i + 1, 0))
          const pl = await fetchReport('pl', { start_date: start, end_date: end }) as Record<string, string>
          return {
            month: new Date(currentYear, i).toLocaleString('default', { month: 'short' }),
            revenue: parseFloat(pl.total_revenue ?? '0'),
            expenses: parseFloat(pl.total_expenses ?? '0'),
          }
        })
      )
    },
    staleTime: 5 * 60 * 1000, // 5 min cache — avoids refetch on every tab switch
  })

  const { data: recentEntries = [] } = useJournalEntries({ status: 'posted' })
  const last5 = recentEntries.slice(0, 5)

  const cur = currentPL as Record<string, string> | undefined
  const pri = priorPL as Record<string, string> | undefined
  const ar = arAging as Record<string, string> | undefined

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
      {/* KPI cards */}
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

      {/* Chart + recent entries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Revenue vs Expenses ({currentYear})
          </h3>
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
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Loading chart…
            </div>
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
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | grep -E "AccountingPayments|AccountingOverview" | head -10
```

Expected: no output.

---

### Task 9: AccountingReports tab

**Files:**
- Create: `frontend/src/pages/admin/accounting/AccountingReports.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/pages/admin/accounting/AccountingReports.tsx
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

// ─── P&L ──────────────────────────────────────────────────────────────────────

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
    } catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  const pl = data as { revenue_by_account: Record<string, string>; total_revenue: string; expenses_by_account: Record<string, string>; total_expenses: string; net_profit: string } | null

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div><label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" /></div>
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {pl && <Button size="sm" variant="outline" onClick={() => downloadReportCsv('pl', { start_date: startDate, end_date: endDate })}>
          <Download className="h-3 w-3 mr-1" /> CSV
        </Button>}
      </div>
      {pl && (
        <div className="rounded-lg border border-border overflow-hidden text-sm">
          <table className="w-full">
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Balance Sheet ─────────────────────────────────────────────────────────────

function BalanceSheetReport() {
  const [asOf, setAsOf] = useState(today())
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
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
              {!bs.balanced && <tr><td colSpan={2} className="px-4 py-2 text-destructive text-xs">⚠ Balance sheet does not balance</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Generic table report (Trial Balance, Cash Flow, Tax Summary, AR Aging) ────

function GenericReport({ type, params: paramDefs }: {
  type: ReportType
  params: Array<{ key: string; label: string; type: 'date' | 'date-range'; defaultValue?: string }>
}) {
  const initParams = Object.fromEntries(paramDefs.map(p => [p.key, p.defaultValue ?? today()]))
  const [params, setParams] = useState<Record<string, string>>(initParams)
  const [data, setData] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try { setData(await fetchReport(type, params)) }
    catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        {paramDefs.map(p => (
          <div key={p.key}>
            <label className="text-xs text-muted-foreground block mb-1">{p.label}</label>
            <Input type="date" value={params[p.key]} onChange={e => setParams(v => ({ ...v, [p.key]: e.target.value }))} className="h-8 text-sm" />
          </div>
        ))}
        <Button size="sm" onClick={run} disabled={loading}>Run</Button>
        {data && <Button size="sm" variant="outline" onClick={() => downloadReportCsv(type, params)}>
          <Download className="h-3 w-3 mr-1" /> CSV
        </Button>}
      </div>
      {data && (
        <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs overflow-auto max-h-96 text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ─── Main reports page ────────────────────────────────────────────────────────

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
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | grep "AccountingReports" | head -10
```

Expected: no output.

---

### Task 10: Accounting.tsx main page + wiring + final verification

**Files:**
- Modify: `frontend/src/pages/admin/Accounting.tsx`

- [ ] **Step 1: Replace the stub with the full page**

```tsx
// frontend/src/pages/admin/Accounting.tsx
import { BarChart2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccountingOverview } from './accounting/AccountingOverview'
import { AccountingAccounts } from './accounting/AccountingAccounts'
import { AccountingJournal } from './accounting/AccountingJournal'
import { AccountingExpenses } from './accounting/AccountingExpenses'
import { AccountingPayments } from './accounting/AccountingPayments'
import { AccountingReports } from './accounting/AccountingReports'

export function Accounting() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
          <BarChart2 className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><AccountingOverview /></TabsContent>
        <TabsContent value="accounts"><AccountingAccounts /></TabsContent>
        <TabsContent value="journal"><AccountingJournal /></TabsContent>
        <TabsContent value="expenses"><AccountingExpenses /></TabsContent>
        <TabsContent value="payments"><AccountingPayments /></TabsContent>
        <TabsContent value="reports"><AccountingReports /></TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Create the accounting sub-page directory if it doesn't exist**

```bash
mkdir -p /Users/don/Desktop/weCapture4U-app/frontend/src/pages/admin/accounting
```

- [ ] **Step 3: Run the TypeScript compiler across the full frontend**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors. If you see errors:
- Import path typos: check `@/` aliases resolve to `src/`
- Missing props: check component interfaces match the usage
- Unknown field on type: re-check the Zod schema vs the API response fields

Fix any errors before continuing.

- [ ] **Step 4: Run the frontend test suite**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm run test
```

Expected: all previously passing tests still pass. The new files have no tests (UI smoke tests are out of scope).

- [ ] **Step 5: Run the linter**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm run lint 2>&1 | head -30
```

Fix any lint errors before committing.

- [ ] **Step 6: Build check**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors. Warnings about bundle size are acceptable.

- [ ] **Step 7: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add \
  frontend/src/schemas/accounting.ts \
  frontend/src/api/accounting.ts \
  frontend/src/hooks/useAccounting.ts \
  frontend/src/components/accounting/JournalEntryLineEditor.tsx \
  frontend/src/components/accounting/JournalEntryReviewPanel.tsx \
  frontend/src/pages/admin/Accounting.tsx \
  frontend/src/pages/admin/accounting/
git commit -m "feat: add accounting frontend (6-tab page: overview, accounts, journal, expenses, payments, reports)"
```
