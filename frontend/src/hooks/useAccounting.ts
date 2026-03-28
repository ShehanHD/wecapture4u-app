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
