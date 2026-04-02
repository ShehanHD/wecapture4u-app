// frontend/src/schemas/accounting.ts
import { z } from 'zod'
<<<<<<< HEAD
=======
import { numericString } from '@/lib/zod'
>>>>>>> main

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
<<<<<<< HEAD
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
=======
  journal_entry_id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  line_description: z.string().nullable(),
  reference_type: z.string().nullable(),
  debit: numericString,
  credit: numericString,
  running_balance: numericString,
})

export const AccountLedgerOutSchema = z.object({
  account_id: z.string().uuid(),
  account_name: z.string(),
  normal_balance: z.string(),
  opening_balance: numericString,
  closing_balance: numericString,
  lines: z.array(AccountLedgerLineSchema),
>>>>>>> main
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

<<<<<<< HEAD
=======
export const JournalEntryStatusSchema = z.enum(['draft', 'posted', 'voided'])

>>>>>>> main
export const JournalEntryOutSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  reference_type: z.string().nullable(),
<<<<<<< HEAD
  reference_id: z.string().nullable(),
  status: z.enum(['draft', 'posted', 'voided']),
=======
  reference_id: z.string().uuid().nullable(),
  status: JournalEntryStatusSchema,
>>>>>>> main
  created_by: z.string(),
  void_of: z.string().uuid().nullable(),
  lines: z.array(JournalLineOutSchema),
})
export type JournalEntryOut = z.infer<typeof JournalEntryOutSchema>

<<<<<<< HEAD
// List item omits lines (for list views)
export const JournalEntryListItemSchema = JournalEntryOutSchema.omit({ lines: true }).extend({
  line_count: z.number(),
=======
export const JournalEntryListItemSchema = JournalEntryOutSchema.omit({ lines: true }).extend({
  line_count: z.number().optional(),
>>>>>>> main
})
export type JournalEntryListItem = z.infer<typeof JournalEntryListItemSchema>

// ─── Expenses ─────────────────────────────────────────────────────────────────

<<<<<<< HEAD
=======
export const ExpensePaymentStatusSchema = z.enum(['paid', 'payable'])

>>>>>>> main
export const ExpenseOutSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
<<<<<<< HEAD
  amount: z.string(),
  expense_account_id: z.string().uuid(),
  expense_account_name: z.string(),
  payment_status: z.enum(['payable', 'paid']),
  payment_account_id: z.string().uuid().nullable(),
  payment_date: z.string().nullable(),
  notes: z.string().nullable(),
  journal_entry_id: z.string().uuid().nullable(),
=======
  expense_account_id: z.string().uuid(),
  expense_account_name: z.string().nullable(),
  amount: z.string(),
  payment_status: ExpensePaymentStatusSchema,
  payment_account_id: z.string().uuid().nullable(),
  receipt_url: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
>>>>>>> main
})
export type ExpenseOut = z.infer<typeof ExpenseOutSchema>
