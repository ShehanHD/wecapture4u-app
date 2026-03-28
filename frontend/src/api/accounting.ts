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
  // Reports have varying shapes — spec uses z.unknown(). Validate it's at least an object.
  if (typeof data !== 'object' || data === null) {
    throw new Error(`Unexpected report response for ${type}`)
  }
  return data
}

export async function downloadReportCsv(type: ReportType, params: Record<string, string>): Promise<void> {
  const { data } = await api.get(`/api/reports/${type}`, {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${type}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
