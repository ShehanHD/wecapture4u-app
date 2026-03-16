# weCapture4U — Accounting Frontend

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Accounting page with six tabs: Overview, Journal, Accounts, Invoices (with payment recording), Expenses, and Reports (with CSV export). Includes the `JournalEntryReviewPanel` slide-over that opens after business events.

**Architecture:** A single `Accounting.tsx` page component with a `<Tabs>` layout. A shared `JournalEntryReviewPanel` component handles the review/edit/post flow. TanStack Query manages all state. No pagination for reports — load on demand with date params.

**Depends on:** Plans 5–7 (AdminShell, shadcn/ui, getApiErrorMessage, useSettings hook), Plan 10 (Accounting backend routers).

**Tech Stack:** React 18 + TypeScript, TanStack Query v5, react-hook-form, Zod, shadcn/ui, Tailwind CSS, Recharts.

---

## File Structure

```
frontend/src/
  schemas/
    accounting.ts           # Zod schemas for all accounting domain types
  api/
    accounting.ts           # Typed API functions
  hooks/
    useAccounting.ts        # TanStack Query hooks (accounts, journal, expenses, payments, reports)
  components/
    accounting/
      JournalEntryReviewPanel.tsx   # Slide-over for reviewing/editing/posting a draft entry
      JournalEntryLineEditor.tsx    # Line table within the review panel
  pages/
    admin/
      Accounting.tsx        # Main page — 6 tabs
```

---

## Chunk 1: Schemas, API, Hooks

### Task 1: Zod schemas + API functions

**Files:**
- Create: `frontend/src/schemas/accounting.ts`
- Create: `frontend/src/schemas/__tests__/accounting.test.ts`
- Create: `frontend/src/api/accounting.ts`

- [ ] **Step 1: Write failing schema tests**

```typescript
// frontend/src/schemas/__tests__/accounting.test.ts
import { JournalLineInSchema, JournalEntryCreateSchema, ExpenseCreateSchema } from '../accounting'

describe('JournalLineInSchema', () => {
  it('rejects when both debit and credit > 0', () => {
    const result = JournalLineInSchema.safeParse({
      account_id: '00000000-0000-0000-0000-000000000001',
      debit: 100, credit: 50
    })
    expect(result.success).toBe(false)
  })

  it('rejects when both are zero', () => {
    const result = JournalLineInSchema.safeParse({
      account_id: '00000000-0000-0000-0000-000000000001',
      debit: 0, credit: 0
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid debit-only line', () => {
    const result = JournalLineInSchema.safeParse({
      account_id: '00000000-0000-0000-0000-000000000001',
      debit: 100, credit: 0
    })
    expect(result.success).toBe(true)
  })
})

describe('ExpenseCreateSchema', () => {
  it('requires payment_account_id when status is paid', () => {
    const result = ExpenseCreateSchema.safeParse({
      date: '2026-01-15',
      description: 'Camera',
      expense_account_id: '00000000-0000-0000-0000-000000000001',
      amount: 500,
      payment_status: 'paid',
      payment_account_id: null,
    })
    expect(result.success).toBe(false)
  })

  it('allows null payment_account_id when payable', () => {
    const result = ExpenseCreateSchema.safeParse({
      date: '2026-01-15',
      description: 'Camera',
      expense_account_id: '00000000-0000-0000-0000-000000000001',
      amount: 500,
      payment_status: 'payable',
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect failures (module doesn't exist)**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="accounting" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Write the schemas**

```typescript
// frontend/src/schemas/accounting.ts
import { z } from 'zod'

// Accounts
export const AccountTypeSchema = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense'])
export const AccountOutSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  normal_balance: z.enum(['debit', 'credit']),
  is_system: z.boolean(),
  archived: z.boolean(),
})
export type AccountOut = z.infer<typeof AccountOutSchema>

export const AccountCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: AccountTypeSchema,
})
export type AccountCreate = z.infer<typeof AccountCreateSchema>

// Journal lines
export const JournalLineInSchema = z.object({
  account_id: z.string().uuid(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.debit > 0 && val.credit > 0) {
    ctx.addIssue({ code: 'custom', message: 'A line cannot have both debit and credit > 0' })
  }
  if (val.debit === 0 && val.credit === 0) {
    ctx.addIssue({ code: 'custom', message: 'A line must have debit > 0 or credit > 0' })
  }
})
export type JournalLineIn = z.infer<typeof JournalLineInSchema>

export const JournalLineOutSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  account_name: z.string(),
  account_code: z.string(),
  debit: z.number(),
  credit: z.number(),
  description: z.string().nullable().optional(),
})
export type JournalLineOut = z.infer<typeof JournalLineOutSchema>

// Journal entries
export const JournalEntryCreateSchema = z.object({
  date: z.string().date(),
  description: z.string().min(1),
  lines: z.array(JournalLineInSchema).min(2, 'At least two lines required'),
})
export type JournalEntryCreate = z.infer<typeof JournalEntryCreateSchema>

export const JournalEntryOutSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  reference_type: z.string().nullable().optional(),
  reference_id: z.string().uuid().nullable().optional(),
  status: z.enum(['draft', 'posted', 'voided']),
  created_by: z.enum(['system', 'manual']),
  void_of: z.string().uuid().nullable().optional(),
  lines: z.array(JournalLineOutSchema).default([]),
})
export type JournalEntryOut = z.infer<typeof JournalEntryOutSchema>

export const JournalEntryListItemSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  reference_type: z.string().nullable().optional(),
  status: z.enum(['draft', 'posted', 'voided']),
  created_by: z.enum(['system', 'manual']),
  total_debit: z.number(),
})
export type JournalEntryListItem = z.infer<typeof JournalEntryListItemSchema>

// Expenses
export const ExpenseCreateSchema = z.object({
  date: z.string().date(),
  description: z.string().min(1),
  expense_account_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_status: z.enum(['paid', 'payable']),
  payment_account_id: z.string().uuid().nullable().optional(),
  receipt_url: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
}).superRefine((val, ctx) => {
  if (val.payment_status === 'paid' && !val.payment_account_id) {
    ctx.addIssue({ code: 'custom', path: ['payment_account_id'],
      message: 'Payment account is required when status is paid' })
  }
})
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>

export const ExpenseOutSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  expense_account_id: z.string().uuid(),
  amount: z.number(),
  payment_status: z.enum(['paid', 'payable']),
  payment_account_id: z.string().uuid().nullable().optional(),
  receipt_url: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})
export type ExpenseOut = z.infer<typeof ExpenseOutSchema>

// Invoice payments
export const InvoicePaymentCreateSchema = z.object({
  amount: z.number().positive(),
  payment_date: z.string().date(),
  account_id: z.string().uuid(),
  notes: z.string().nullable().optional(),
})
export type InvoicePaymentCreate = z.infer<typeof InvoicePaymentCreateSchema>

export const InvoicePaymentOutSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  amount: z.number(),
  payment_date: z.string(),
  account_id: z.string().uuid(),
  notes: z.string().nullable().optional(),
})
export type InvoicePaymentOut = z.infer<typeof InvoicePaymentOutSchema>
```

- [ ] **Step 4: Write API functions**

```typescript
// frontend/src/api/accounting.ts
import api from './index'
import {
  AccountOutSchema, AccountOut, AccountCreate,
  JournalEntryOutSchema, JournalEntryOut, JournalEntryCreate, JournalEntryListItemSchema, JournalEntryListItem,
  ExpenseOutSchema, ExpenseOut, ExpenseCreate,
  InvoicePaymentOutSchema, InvoicePaymentOut, InvoicePaymentCreate,
} from '../schemas/accounting'
import { z } from 'zod'

// Accounts
export const fetchAccounts = async (params?: { type?: string; archived?: boolean }): Promise<AccountOut[]> => {
  const res = await api.get('/accounts', { params })
  return z.array(AccountOutSchema).parse(res.data)
}
export const createAccount = async (data: AccountCreate): Promise<AccountOut> => {
  const res = await api.post('/accounts', data)
  return AccountOutSchema.parse(res.data)
}
export const updateAccount = async (id: string, data: { name?: string; archived?: boolean }): Promise<AccountOut> => {
  const res = await api.patch(`/accounts/${id}`, data)
  return AccountOutSchema.parse(res.data)
}
export const deleteAccount = async (id: string): Promise<void> => {
  await api.delete(`/accounts/${id}`)
}

// Journal entries
export const fetchJournalEntries = async (params?: Record<string, unknown>): Promise<JournalEntryListItem[]> => {
  const res = await api.get('/journal-entries', { params })
  return z.array(JournalEntryListItemSchema).parse(res.data)
}
export const fetchJournalEntry = async (id: string): Promise<JournalEntryOut> => {
  const res = await api.get(`/journal-entries/${id}`)
  return JournalEntryOutSchema.parse(res.data)
}
export const createJournalEntry = async (data: JournalEntryCreate): Promise<JournalEntryOut> => {
  const res = await api.post('/journal-entries', data)
  return JournalEntryOutSchema.parse(res.data)
}
export const updateJournalEntry = async (id: string, data: Partial<JournalEntryCreate>): Promise<JournalEntryOut> => {
  const res = await api.patch(`/journal-entries/${id}`, data)
  return JournalEntryOutSchema.parse(res.data)
}
export const postJournalEntry = async (id: string): Promise<JournalEntryOut> => {
  const res = await api.post(`/journal-entries/${id}/post`)
  return JournalEntryOutSchema.parse(res.data)
}
export const voidJournalEntry = async (id: string): Promise<JournalEntryOut> => {
  const res = await api.post(`/journal-entries/${id}/void`)
  return JournalEntryOutSchema.parse(res.data)
}

// Expenses
export const fetchExpenses = async (params?: Record<string, unknown>): Promise<ExpenseOut[]> => {
  const res = await api.get('/expenses', { params })
  return z.array(ExpenseOutSchema).parse(res.data)
}
export const createExpense = async (data: ExpenseCreate): Promise<ExpenseOut> => {
  const res = await api.post('/expenses', data)
  return ExpenseOutSchema.parse(res.data)
}
export const deleteExpense = async (id: string): Promise<void> => {
  await api.delete(`/expenses/${id}`)
}
export const payExpense = async (id: string, data: { payment_account_id: string; payment_date: string }): Promise<ExpenseOut> => {
  const res = await api.post(`/expenses/${id}/pay`, data)
  return ExpenseOutSchema.parse(res.data)
}

// Invoice payments
export const fetchInvoicePayments = async (invoiceId: string): Promise<InvoicePaymentOut[]> => {
  const res = await api.get(`/invoices/${invoiceId}/payments`)
  return z.array(InvoicePaymentOutSchema).parse(res.data)
}
export const recordInvoicePayment = async (invoiceId: string, data: InvoicePaymentCreate): Promise<InvoicePaymentOut> => {
  const res = await api.post(`/invoices/${invoiceId}/payments`, data)
  return InvoicePaymentOutSchema.parse(res.data)
}
export const deleteInvoicePayment = async (invoiceId: string, paymentId: string): Promise<void> => {
  await api.delete(`/invoices/${invoiceId}/payments/${paymentId}`)
}

// Reports (returns raw JSON — no Zod schema for report responses, shapes vary)
export const fetchReport = async (
  reportType: 'pl' | 'balance-sheet' | 'trial-balance' | 'cash-flow' | 'tax-summary' | 'ar-aging',
  params: Record<string, string>,
): Promise<unknown> => {
  const res = await api.get(`/reports/${reportType}`, { params })
  return res.data
}
export const downloadReportCsv = async (
  reportType: string, params: Record<string, string>
): Promise<Blob> => {
  const res = await api.get(`/reports/${reportType}`, {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  })
  return res.data as Blob
}
```

- [ ] **Step 5: Run schema tests — expect all pass**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="accounting" --watchAll=false
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/schemas/accounting.ts frontend/src/schemas/__tests__/accounting.test.ts frontend/src/api/accounting.ts
git commit -m "feat: add accounting Zod schemas and typed API functions"
```

---

### Task 2: TanStack Query hooks

**Files:**
- Create: `frontend/src/hooks/useAccounting.ts`

- [ ] **Step 1: Write the hooks**

```typescript
// frontend/src/hooks/useAccounting.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../lib/apiError'
import * as accountingApi from '../api/accounting'
import type { AccountCreate, ExpenseCreate, InvoicePaymentCreate } from '../schemas/accounting'

// ── Accounts ──────────────────────────────────────────────────────────────────

export const useAccounts = (params?: { type?: string; archived?: boolean }) =>
  useQuery({
    queryKey: ['accounts', params],
    queryFn: () => accountingApi.fetchAccounts(params),
  })

export const useCreateAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AccountCreate) => accountingApi.createAccount(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Account created') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create account')),
  })
}

export const useUpdateAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; archived?: boolean } }) =>
      accountingApi.updateAccount(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Account updated') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update account')),
  })
}

export const useDeleteAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => accountingApi.deleteAccount(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Account deleted') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Cannot delete account')),
  })
}

// ── Journal Entries ────────────────────────────────────────────────────────────

export const useJournalEntries = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['journal-entries', params],
    queryFn: () => accountingApi.fetchJournalEntries(params),
  })

export const useJournalEntry = (id: string) =>
  useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => accountingApi.fetchJournalEntry(id),
    enabled: !!id,
  })

export const useCreateJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: accountingApi.createJournalEntry,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journal-entries'] }); toast.success('Entry created') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create entry')),
  })
}

export const useUpdateJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof accountingApi.updateJournalEntry>[1] }) =>
      accountingApi.updateJournalEntry(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      qc.invalidateQueries({ queryKey: ['journal-entry', id] })
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update entry')),
  })
}

export const usePostJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => accountingApi.postJournalEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Entry posted')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to post entry')),
  })
}

export const useVoidJournalEntry = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => accountingApi.voidJournalEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Entry voided — reversing entry created')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to void entry')),
  })
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export const useExpenses = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['expenses', params],
    queryFn: () => accountingApi.fetchExpenses(params),
  })

export const useCreateExpense = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExpenseCreate) => accountingApi.createExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      toast.success('Expense recorded')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record expense')),
  })
}

export const useDeleteExpense = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => accountingApi.deleteExpense(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense deleted') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Cannot delete expense')),
  })
}

export const usePayExpense = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { payment_account_id: string; payment_date: string } }) =>
      accountingApi.payExpense(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      toast.success('Expense marked as paid')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to mark expense as paid')),
  })
}

// ── Invoice Payments ──────────────────────────────────────────────────────────

export const useInvoicePayments = (invoiceId: string) =>
  useQuery({
    queryKey: ['invoice-payments', invoiceId],
    queryFn: () => accountingApi.fetchInvoicePayments(invoiceId),
    enabled: !!invoiceId,
  })

export const useRecordInvoicePayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: InvoicePaymentCreate }) =>
      accountingApi.recordInvoicePayment(invoiceId, data),
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      toast.success('Payment recorded')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record payment')),
  })
}

export const useDeleteInvoicePayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, paymentId }: { invoiceId: string; paymentId: string }) =>
      accountingApi.deleteInvoicePayment(invoiceId, paymentId),
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Payment deleted')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Cannot delete payment')),
  })
}

// ── Reports ───────────────────────────────────────────────────────────────────

export const useReport = (
  reportType: Parameters<typeof accountingApi.fetchReport>[0],
  params: Record<string, string>,
  enabled = true,
) =>
  useQuery({
    queryKey: ['report', reportType, params],
    queryFn: () => accountingApi.fetchReport(reportType, params),
    enabled,
    staleTime: 60_000, // reports are expensive — cache for 1 min
  })
```

- [ ] **Step 2: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/hooks/useAccounting.ts
git commit -m "feat: add accounting TanStack Query hooks"
```

---

## Chunk 2: Journal Review Panel + Accounting Page

### Task 3: JournalEntryReviewPanel component

**Files:**
- Create: `frontend/src/components/accounting/JournalEntryLineEditor.tsx`
- Create: `frontend/src/components/accounting/JournalEntryReviewPanel.tsx`
- Create: `frontend/src/components/accounting/__tests__/JournalEntryReviewPanel.test.tsx`

- [ ] **Step 1: Write failing component test**

```typescript
// frontend/src/components/accounting/__tests__/JournalEntryReviewPanel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { JournalEntryReviewPanel } from '../JournalEntryReviewPanel'
import type { JournalEntryOut } from '../../../schemas/accounting'

const mockEntry: JournalEntryOut = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  date: '2026-01-15',
  description: 'Invoice #42 — revenue recognition',
  reference_type: 'invoice',
  reference_id: null,
  status: 'draft',
  created_by: 'system',
  void_of: null,
  lines: [
    { id: 'l1', account_id: 'a1', account_name: 'Accounts Receivable', account_code: '1100', debit: 500, credit: 0, description: null },
    { id: 'l2', account_id: 'a2', account_name: 'Session Fees', account_code: '4000', debit: 0, credit: 500, description: null },
  ],
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>

describe('JournalEntryReviewPanel', () => {
  it('shows balance indicator as balanced', () => {
    render(
      <TestWrapper>
        <JournalEntryReviewPanel
          entry={mockEntry}
          open={true}
          onClose={() => {}}
          onPosted={() => {}}
        />
      </TestWrapper>
    )
    expect(screen.getByText(/Total Debits/i)).toBeInTheDocument()
    expect(screen.getByText('€500.00')).toBeInTheDocument()
    // Balance difference should show €0.00 in green (balanced)
    expect(screen.getByText('Difference: €0.00')).toBeInTheDocument()
  })

  it('shows "Post Entry" and "Save as Draft" buttons for draft entries', () => {
    render(
      <TestWrapper>
        <JournalEntryReviewPanel
          entry={mockEntry}
          open={true}
          onClose={() => {}}
          onPosted={() => {}}
        />
      </TestWrapper>
    )
    expect(screen.getByRole('button', { name: /Post Entry/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save as Draft/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failures (component doesn't exist)**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="JournalEntryReviewPanel" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Write the line editor component**

```typescript
// frontend/src/components/accounting/JournalEntryLineEditor.tsx
import type { JournalLineIn } from '../../schemas/accounting'
import { useAccounts } from '../../hooks/useAccounting'

interface Props {
  lines: JournalLineIn[]
  onChange: (lines: JournalLineIn[]) => void
  readOnly?: boolean
}

export function JournalEntryLineEditor({ lines, onChange, readOnly = false }: Props) {
  const { data: accounts = [] } = useAccounts({ archived: false })

  const updateLine = (idx: number, field: keyof JournalLineIn, value: unknown) => {
    const updated = lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    onChange(updated)
  }

  const addLine = () => {
    onChange([...lines, { account_id: '', debit: 0, credit: 0 }])
  }

  const removeLine = (idx: number) => {
    onChange(lines.filter((_, i) => i !== idx))
  }

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit ?? 0), 0)
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit ?? 0), 0)
  const diff = Math.abs(totalDebit - totalCredit)
  const balanced = diff === 0

  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-white/10">
            <th className="pb-2 pr-3">Account</th>
            <th className="pb-2 pr-3 w-32">Debit</th>
            <th className="pb-2 pr-3 w-32">Credit</th>
            {!readOnly && <th className="pb-2 w-8" />}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className="border-b border-white/5">
              <td className="py-1 pr-3">
                {readOnly ? (
                  <span>{accounts.find(a => a.id === line.account_id)?.name ?? line.account_id}</span>
                ) : (
                  <select
                    className="bg-transparent border border-white/20 rounded px-2 py-1 w-full text-white"
                    value={line.account_id}
                    onChange={(e) => updateLine(idx, 'account_id', e.target.value)}
                  >
                    <option value="">Select account…</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                )}
              </td>
              <td className="py-1 pr-3">
                {readOnly ? (
                  <span>{line.debit > 0 ? `€${line.debit.toFixed(2)}` : '—'}</span>
                ) : (
                  <input
                    type="number" min="0" step="0.01"
                    className="bg-transparent border border-white/20 rounded px-2 py-1 w-full text-white"
                    value={line.debit}
                    onChange={(e) => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                  />
                )}
              </td>
              <td className="py-1 pr-3">
                {readOnly ? (
                  <span>{line.credit > 0 ? `€${line.credit.toFixed(2)}` : '—'}</span>
                ) : (
                  <input
                    type="number" min="0" step="0.01"
                    className="bg-transparent border border-white/20 rounded px-2 py-1 w-full text-white"
                    value={line.credit}
                    onChange={(e) => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                  />
                )}
              </td>
              {!readOnly && (
                <td className="py-1">
                  <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/20 text-sm font-medium">
            <td className="pt-2 text-gray-400">Totals</td>
            <td className="pt-2">€{totalDebit.toFixed(2)}</td>
            <td className="pt-2">€{totalCredit.toFixed(2)}</td>
            {!readOnly && <td />}
          </tr>
        </tfoot>
      </table>

      <div className={`text-sm flex gap-4 ${balanced ? 'text-green-400' : 'text-red-400'}`}>
        <span>Total Debits: €{totalDebit.toFixed(2)}</span>
        <span>Total Credits: €{totalCredit.toFixed(2)}</span>
        <span>Difference: €{diff.toFixed(2)}</span>
      </div>

      {!readOnly && (
        <button
          onClick={addLine}
          className="text-amber-400 text-sm hover:text-amber-300 mt-1"
        >
          + Add line
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write the review panel component**

```typescript
// frontend/src/components/accounting/JournalEntryReviewPanel.tsx
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { JournalEntryLineEditor } from './JournalEntryLineEditor'
import { usePostJournalEntry, useUpdateJournalEntry, useVoidJournalEntry } from '../../hooks/useAccounting'
import type { JournalEntryOut, JournalLineIn } from '../../schemas/accounting'

interface Props {
  entry: JournalEntryOut
  open: boolean
  onClose: () => void
  onPosted: () => void
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-500/20 text-amber-400',
  posted: 'bg-green-500/20 text-green-400',
  voided: 'bg-gray-500/20 text-gray-400',
}

export function JournalEntryReviewPanel({ entry, open, onClose, onPosted }: Props) {
  const [lines, setLines] = useState<JournalLineIn[]>(
    entry.lines.map(l => ({ account_id: l.account_id, debit: l.debit, credit: l.credit, description: l.description ?? undefined }))
  )
  const [date, setDate] = useState(entry.date)
  const [description, setDescription] = useState(entry.description)

  const postMutation = usePostJournalEntry()
  const updateMutation = useUpdateJournalEntry()
  const voidMutation = useVoidJournalEntry()

  const isDraft = entry.status === 'draft'
  const isPosted = entry.status === 'posted'

  const handlePost = async () => {
    // Save any edits first
    await updateMutation.mutateAsync({ id: entry.id, data: { date, description, lines } })
    await postMutation.mutateAsync(entry.id)
    onPosted()
    onClose()
  }

  const handleSaveDraft = async () => {
    await updateMutation.mutateAsync({ id: entry.id, data: { date, description, lines } })
    onClose()
  }

  const handleVoid = async () => {
    if (confirm('Void this entry? A reversing entry will be created.')) {
      await voidMutation.mutateAsync(entry.id)
      onClose()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="bg-[#1a1a1a] border-white/10 text-white w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-white flex items-center gap-2">
            Journal Entry
            <Badge className={STATUS_COLORS[entry.status] ?? ''}>{entry.status}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Date</label>
            {isDraft ? (
              <input
                type="date"
                className="mt-1 w-full bg-white/5 border border-white/20 rounded px-3 py-2 text-white"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            ) : (
              <p className="mt-1 text-white">{date}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Description</label>
            {isDraft ? (
              <input
                type="text"
                className="mt-1 w-full bg-white/5 border border-white/20 rounded px-3 py-2 text-white"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            ) : (
              <p className="mt-1 text-white">{description}</p>
            )}
          </div>

          {/* Reference */}
          {entry.reference_type && (
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider">Reference</label>
              <p className="mt-1 text-amber-400 capitalize">{entry.reference_type}</p>
            </div>
          )}

          {/* Lines */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Lines</label>
            <JournalEntryLineEditor
              lines={lines}
              onChange={setLines}
              readOnly={!isDraft}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            {isDraft && (
              <>
                <Button
                  onClick={handlePost}
                  disabled={postMutation.isPending || updateMutation.isPending}
                  className="bg-green-600 hover:bg-green-500 text-white"
                >
                  Post Entry
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={updateMutation.isPending}
                  className="border-white/20 text-white hover:bg-white/5"
                >
                  Save as Draft
                </Button>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="text-gray-400 hover:text-white"
                >
                  Discard
                </Button>
              </>
            )}
            {isPosted && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleVoid}
                  disabled={voidMutation.isPending}
                >
                  Void Entry
                </Button>
                <Button variant="ghost" onClick={onClose} className="text-gray-400">Close</Button>
              </>
            )}
            {entry.status === 'voided' && (
              <Button variant="ghost" onClick={onClose} className="text-gray-400">Close</Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5: Run component tests**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="JournalEntryReviewPanel" --watchAll=false
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/components/accounting/ frontend/src/hooks/useAccounting.ts
git commit -m "feat: add JournalEntryReviewPanel and JournalEntryLineEditor components"
```

---

### Task 4: Accounting.tsx — 6-tab page

**Files:**
- Modify: `frontend/src/pages/admin/Accounting.tsx` — replace stub with full implementation

- [ ] **Step 1: Write component test**

```typescript
// frontend/src/pages/admin/__tests__/Accounting.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Accounting from '../Accounting'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  </MemoryRouter>
)

describe('Accounting page', () => {
  it('renders all six tabs', () => {
    render(<Accounting />, { wrapper: Wrapper })
    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Journal/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Accounts/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Invoices/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Expenses/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Reports/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL (stub page doesn't have tabs)**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="Accounting.test" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Implement Accounting.tsx**

```typescript
// frontend/src/pages/admin/Accounting.tsx
import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { AccountingOverview } from './accounting/AccountingOverview'
import { AccountingJournal } from './accounting/AccountingJournal'
import { AccountingAccounts } from './accounting/AccountingAccounts'
import { AccountingInvoices } from './accounting/AccountingInvoices'
import { AccountingExpenses } from './accounting/AccountingExpenses'
import { AccountingReports } from './accounting/AccountingReports'

export default function Accounting() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Accounting</h1>
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 bg-white/5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><AccountingOverview /></TabsContent>
        <TabsContent value="journal"><AccountingJournal /></TabsContent>
        <TabsContent value="accounts"><AccountingAccounts /></TabsContent>
        <TabsContent value="invoices"><AccountingInvoices /></TabsContent>
        <TabsContent value="expenses"><AccountingExpenses /></TabsContent>
        <TabsContent value="reports"><AccountingReports /></TabsContent>
      </Tabs>
    </div>
  )
}
```

Create sub-tab components in `frontend/src/pages/admin/accounting/`:

```typescript
// frontend/src/pages/admin/accounting/AccountingOverview.tsx
import { useJournalEntries, useAccounts, useReport } from '../../../hooks/useAccounting'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useState } from 'react'

export function AccountingOverview() {
  const currentYear = new Date().getFullYear()
  const { data: draftEntries = [] } = useJournalEntries({ status: 'draft' })
  const { data: plReport } = useReport(
    'pl',
    { start_date: `${currentYear}-01-01`, end_date: `${currentYear}-12-31` },
  )

  return (
    <div className="space-y-6">
      {/* Draft entries banner */}
      {draftEntries.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-amber-400">
          {draftEntries.length} draft {draftEntries.length === 1 ? 'entry' : 'entries'} awaiting review
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: plReport ? `€${(plReport as any).gross_revenue?.toFixed(2) ?? '0.00'}` : '—' },
          { label: 'Total Expenses', value: plReport ? `€${(plReport as any).total_expenses?.toFixed(2) ?? '0.00'}` : '—' },
          { label: 'Net Profit', value: plReport ? `€${(plReport as any).net_profit?.toFixed(2) ?? '0.00'}` : '—' },
        ].map(card => (
          <div key={card.label} className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{card.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue vs Expenses chart placeholder */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Revenue vs Expenses ({currentYear})</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[{ month: 'Jan', revenue: 0, expenses: 0 }]}>
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }} />
            <Bar dataKey="revenue" fill="#f59e0b" />
            <Bar dataKey="expenses" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// frontend/src/pages/admin/accounting/AccountingJournal.tsx
export { AccountingJournal } from './AccountingJournalImpl'

// frontend/src/pages/admin/accounting/AccountingJournalImpl.tsx
import { useState } from 'react'
import { useJournalEntries, useCreateJournalEntry, useVoidJournalEntry } from '../../../hooks/useAccounting'
import { JournalEntryReviewPanel } from '../../../components/accounting/JournalEntryReviewPanel'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import type { JournalEntryOut } from '../../../schemas/accounting'
import { fetchJournalEntry } from '../../../api/accounting'

export function AccountingJournal() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryOut | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const { data: entries = [], isLoading } = useJournalEntries(statusFilter ? { status: statusFilter } : {})

  const openEntry = async (id: string) => {
    const entry = await fetchJournalEntry(id)
    setSelectedEntry(entry)
    setPanelOpen(true)
  }

  const STATUS_BADGE: Record<string, string> = {
    draft: 'bg-amber-500/20 text-amber-400',
    posted: 'bg-green-500/20 text-green-400',
    voided: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'draft', 'posted', 'voided'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === 'all' ? undefined : s)}
              className={`px-3 py-1 rounded text-sm ${(statusFilter ?? 'all') === s ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-400 text-black"
          onClick={() => { setSelectedEntry(null); setPanelOpen(true) }}
        >
          New Journal Entry
        </Button>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => openEntry(entry.id)}
              className="w-full text-left bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{entry.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{entry.date} · {entry.created_by}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white">€{entry.total_debit.toFixed(2)}</span>
                  <Badge className={STATUS_BADGE[entry.status] ?? ''}>{entry.status}</Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedEntry && (
        <JournalEntryReviewPanel
          entry={selectedEntry}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          onPosted={() => setPanelOpen(false)}
        />
      )}
    </div>
  )
}
```

Create the remaining tab stubs (these are functional but minimal):

```typescript
// frontend/src/pages/admin/accounting/AccountingAccounts.tsx
import { useState } from 'react'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '../../../hooks/useAccounting'
import { Button } from '../../../components/ui/button'
import type { AccountCreate } from '../../../schemas/accounting'

export function AccountingAccounts() {
  const [showCreate, setShowCreate] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<AccountCreate['type']>('asset')
  const { data: accounts = [] } = useAccounts({ archived: false })
  const createMutation = useCreateAccount()
  const updateMutation = useUpdateAccount()
  const deleteMutation = useDeleteAccount()

  const grouped = accounts.reduce((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {} as Record<string, typeof accounts>)

  const typeOrder = ['asset', 'liability', 'equity', 'revenue', 'expense']

  const handleCreate = async () => {
    await createMutation.mutateAsync({ code: newCode, name: newName, type: newType })
    setShowCreate(false); setNewCode(''); setNewName('')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black" onClick={() => setShowCreate(true)}>
          Add Account
        </Button>
      </div>

      {showCreate && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex gap-3 items-end">
          <div><label className="text-xs text-gray-400">Code</label>
            <input className="mt-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white w-24"
              value={newCode} onChange={e => setNewCode(e.target.value)} /></div>
          <div><label className="text-xs text-gray-400">Name</label>
            <input className="mt-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white w-48"
              value={newName} onChange={e => setNewName(e.target.value)} /></div>
          <div><label className="text-xs text-gray-400">Type</label>
            <select className="mt-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
              value={newType} onChange={e => setNewType(e.target.value as AccountCreate['type'])}>
              {typeOrder.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <Button size="sm" className="bg-amber-500 text-black" onClick={handleCreate}>Save</Button>
          <Button size="sm" variant="ghost" className="text-gray-400" onClick={() => setShowCreate(false)}>Cancel</Button>
        </div>
      )}

      {typeOrder.map(type => {
        const group = grouped[type] ?? []
        if (!group.length) return null
        return (
          <div key={type}>
            <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2 capitalize">{type}s</h3>
            <div className="space-y-1">
              {group.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-4 py-2">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm w-12">{a.code}</span>
                    <span className="text-white">{a.name}</span>
                    {a.is_system && <span className="text-xs text-gray-500">🔒</span>}
                  </div>
                  {!a.is_system && (
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 text-xs"
                      onClick={() => deleteMutation.mutate(a.id)}>Delete</Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

```typescript
// frontend/src/pages/admin/accounting/AccountingExpenses.tsx
import { useState } from 'react'
import { useExpenses, useCreateExpense, useDeleteExpense, usePayExpense } from '../../../hooks/useAccounting'
import { useAccounts } from '../../../hooks/useAccounting'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'

export function AccountingExpenses() {
  const [showCreate, setShowCreate] = useState(false)
  const { data: expenses = [] } = useExpenses()
  const { data: accounts = [] } = useAccounts({ type: 'expense', archived: false })
  const { data: bankAccounts = [] } = useAccounts({ type: 'asset', archived: false })
  const createMutation = useCreateExpense()
  const deleteMutation = useDeleteExpense()
  const payMutation = usePayExpense()

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    expense_account_id: '',
    amount: '',
    payment_status: 'paid' as 'paid' | 'payable',
    payment_account_id: '',
  })

  const handleCreate = async () => {
    await createMutation.mutateAsync({
      ...form,
      amount: parseFloat(form.amount),
      payment_account_id: form.payment_status === 'paid' ? form.payment_account_id : null,
    })
    setShowCreate(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black" onClick={() => setShowCreate(true)}>
          Add Expense
        </Button>
      </div>

      {showCreate && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400">Date</label>
              <input type="date" className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-400">Amount (€)</label>
              <input type="number" className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs text-gray-400">Description</label>
              <input className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-400">Expense Account</label>
              <select className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                value={form.expense_account_id} onChange={e => setForm(f => ({ ...f, expense_account_id: e.target.value }))}>
                <option value="">Select…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select></div>
            <div><label className="text-xs text-gray-400">Payment</label>
              <select className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value as 'paid' | 'payable' }))}>
                <option value="paid">Paid now</option>
                <option value="payable">Payable later</option>
              </select></div>
            {form.payment_status === 'paid' && (
              <div className="col-span-2"><label className="text-xs text-gray-400">Paid from Account</label>
                <select className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                  value={form.payment_account_id} onChange={e => setForm(f => ({ ...f, payment_account_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select></div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-amber-500 text-black" onClick={handleCreate}>Save</Button>
            <Button size="sm" variant="ghost" className="text-gray-400" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {expenses.map(e => (
          <div key={e.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-white">{e.description}</p>
              <p className="text-xs text-gray-400 mt-1">{e.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">€{e.amount.toFixed(2)}</span>
              <Badge className={e.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}>
                {e.payment_status}
              </Badge>
              {e.payment_status === 'payable' && (
                <Button size="sm" variant="ghost" className="text-amber-400 text-xs"
                  onClick={() => payMutation.mutate({ id: e.id, data: { payment_account_id: '', payment_date: new Date().toISOString().split('T')[0] } })}>
                  Mark Paid
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-red-400 text-xs"
                onClick={() => deleteMutation.mutate(e.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

```typescript
// frontend/src/pages/admin/accounting/AccountingInvoices.tsx
// Placeholder — reuses existing invoice list from admin module.
// Payment recording is triggered from the invoice row.
export function AccountingInvoices() {
  return (
    <div className="text-gray-400 text-center py-12">
      Invoice management with payment recording — see Invoices tab in Jobs section.
      <br /><span className="text-sm">Payment recording integrated in Plan 11 (Client Portal).</span>
    </div>
  )
}
```

```typescript
// frontend/src/pages/admin/accounting/AccountingReports.tsx
import { useState } from 'react'
import { useReport } from '../../../hooks/useAccounting'
import { downloadReportCsv } from '../../../api/accounting'
import { Button } from '../../../components/ui/button'

type ReportType = 'pl' | 'balance-sheet' | 'trial-balance' | 'cash-flow' | 'tax-summary' | 'ar-aging'

const REPORT_LABELS: Record<ReportType, string> = {
  'pl': 'P&L Statement',
  'balance-sheet': 'Balance Sheet',
  'trial-balance': 'Trial Balance',
  'cash-flow': 'Cash Flow',
  'tax-summary': 'Tax Summary',
  'ar-aging': 'AR Aging',
}

export function AccountingReports() {
  const [activeReport, setActiveReport] = useState<ReportType>('pl')
  const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01')
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])

  const needsRange = ['pl', 'cash-flow', 'tax-summary'].includes(activeReport)
  const params = needsRange
    ? { start_date: startDate, end_date: endDate }
    : { as_of_date: asOfDate }

  const { data: reportData, isLoading, isError } = useReport(activeReport, params)

  const handleExportCsv = async () => {
    const blob = await downloadReportCsv(activeReport, params)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeReport}-report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Report selector */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(REPORT_LABELS) as ReportType[]).map(r => (
          <button
            key={r}
            onClick={() => setActiveReport(r)}
            className={`px-3 py-1.5 rounded text-sm ${activeReport === r ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {REPORT_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Date params */}
      <div className="flex gap-3 items-end">
        {needsRange ? (
          <>
            <div><label className="text-xs text-gray-400">From</label>
              <input type="date" className="mt-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><label className="text-xs text-gray-400">To</label>
              <input type="date" className="mt-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </>
        ) : (
          <div><label className="text-xs text-gray-400">As of</label>
            <input type="date" className="mt-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
              value={asOfDate} onChange={e => setAsOfDate(e.target.value)} /></div>
        )}
        <Button size="sm" variant="outline" className="border-white/20 text-white" onClick={handleExportCsv}>
          Export CSV
        </Button>
      </div>

      {/* Report data */}
      {isLoading && <p className="text-gray-400">Loading report…</p>}
      {isError && <p className="text-red-400">Failed to load report. Please check your date range and try again.</p>}
      {reportData && (
        <pre className="bg-white/5 border border-white/10 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
          {JSON.stringify(reportData, null, 2)}
        </pre>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run Accounting page test**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="Accounting.test" --watchAll=false
```

Expected: All PASS.

- [ ] **Step 5: Run all frontend tests**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --watchAll=false
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/pages/admin/Accounting.tsx frontend/src/pages/admin/accounting/
git commit -m "feat: implement Accounting page with 6 tabs — Overview, Journal, Accounts, Expenses, Invoices, Reports"
```
