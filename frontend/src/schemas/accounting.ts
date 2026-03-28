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

export const JournalEntryOutSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  reference_type: z.string().nullable(),
  reference_id: z.string().nullable(),
  status: z.enum(['draft', 'posted', 'voided']),
  created_by: z.string(),
  void_of: z.string().uuid().nullable(),
  lines: z.array(JournalLineOutSchema),
})
export type JournalEntryOut = z.infer<typeof JournalEntryOutSchema>

// List item omits lines (for list views)
export const JournalEntryListItemSchema = JournalEntryOutSchema.omit({ lines: true }).extend({
  line_count: z.number(),
})
export type JournalEntryListItem = z.infer<typeof JournalEntryListItemSchema>

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const ExpenseOutSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  expense_account_id: z.string().uuid(),
  expense_account_name: z.string(),
  payment_status: z.enum(['payable', 'paid']),
  payment_account_id: z.string().uuid().nullable(),
  payment_date: z.string().nullable(),
  notes: z.string().nullable(),
  journal_entry_id: z.string().uuid().nullable(),
})
export type ExpenseOut = z.infer<typeof ExpenseOutSchema>
