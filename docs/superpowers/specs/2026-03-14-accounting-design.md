# weCapture4U — Accounting Module Design

## Overview

The accounting module implements a **hybrid double-entry bookkeeping system** for a solo photography business. Business events (invoice sent, payment received, expense logged) automatically generate draft journal entries that the admin reviews and posts. Nothing hits the ledger silently. A manual journal entry form covers edge cases the automation cannot handle. Full reports are generated from posted entries.

This spec replaces the simple `transactions` table defined in the admin design spec. The `invoices` and `invoice_items` tables are extended but not replaced.

---

## Tech Stack

Same as the admin module. No additional libraries required — all accounting logic implemented in FastAPI (Python) with standard arithmetic. Reports rendered server-side and returned as JSON; CSV export handled by FastAPI's `StreamingResponse`.

---

## Data Model

### `accounts` — Chart of Accounts

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `code` | text | UNIQUE. Sortable account number (e.g. `1010`). Admin-assigned. Used for ordering within type group. |
| `name` | text | e.g. "Business Bank Account" |
| `type` | enum | `asset` / `liability` / `equity` / `revenue` / `expense` |
| `normal_balance` | enum | `debit` / `credit` — system-set at creation based on type: Assets/Expenses = debit; Liabilities/Equity/Revenue = credit. Exception: `Owner's Drawings` is seeded with `normal_balance = debit` despite being equity type. Never changed after creation. |
| `is_system` | boolean | System accounts can be renamed but not deleted or archived. |
| `archived` | boolean | default false. Archived accounts hidden from all entry forms but preserved in historical journal lines. System accounts cannot be archived. |
| `created_at` | timestamptz | |

> DB constraints: `accounts.code` is UNIQUE. `normal_balance` CHECK: must be `debit` or `credit`.

### `journal_entries` — Entry Header

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `date` | date | Accounting date (can differ from `created_at` — admin may backdate) |
| `description` | text | |
| `reference_type` | text | nullable — `invoice` / `expense` / `appointment` / `manual` |
| `reference_id` | uuid | nullable — ID of the originating record |
| `status` | enum | `draft` / `posted` / `voided` |
| `created_by` | enum | `system` (auto-generated) / `manual` (admin-created) |
| `void_of` | uuid (FK → journal_entries) | nullable — set on the reversing entry when voiding. Only `posted` entries can be voided. |
| `created_at` | timestamptz | |

> Idempotency constraint: a unique partial index enforces that only one non-voided `system`-created entry exists per `(reference_type, reference_id)`. Before creating an auto-draft, FastAPI checks for an existing non-voided entry for the same reference. If found, it surfaces the existing draft rather than creating a duplicate. If the admin re-triggers an event (e.g., invoice toggled back to `sent` after being `draft`), the previous non-voided entry is automatically voided and a new draft is created.

### `journal_lines` — Debit / Credit Lines

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `entry_id` | uuid (FK → journal_entries) | |
| `account_id` | uuid (FK → accounts) | |
| `debit` | numeric(10,2) | default 0 |
| `credit` | numeric(10,2) | default 0 |
| `description` | text | nullable — line-level note (e.g. "Principal portion", "Interest portion") |

> DB constraints: `CHECK (debit >= 0 AND credit >= 0)`, `CHECK (debit = 0 OR credit = 0)` (exactly one non-zero per line), `CHECK (debit > 0 OR credit > 0)` (no all-zero lines).

> **Balance invariant:** FastAPI enforces `SUM(debit lines) = SUM(credit lines)` on every `POST /journal-entries/{id}/post` call. Unbalanced entries are rejected with `422`. Draft entries are exempt — they can be saved unbalanced. As an additional safeguard, a PostgreSQL trigger fires on `UPDATE journal_entries SET status = 'posted'` and verifies the sum of all child `journal_lines` before the update commits — rolling back with an error if the entry is unbalanced.

### `invoice_items` — Extended (existing table)

Add one column to the existing `invoice_items` table:

| Column | Type | Notes |
|---|---|---|
| `revenue_account_id` | uuid (FK → accounts, type = revenue) | nullable. When set, the automation credits this account on invoice-sent. When null, defaults to `Session Fees` (code 4000). |

### `appointments` — Extended (existing table)

Add two columns:

| Column | Type | Notes |
|---|---|---|
| `deposit_amount` | numeric(10,2) | default 0. The deposit amount received (or expected) for this appointment. Used as the amount in the deposit auto-draft journal entry when `deposit_paid` is toggled to true. Must be ≤ linked invoice total when an invoice exists — validated at the application layer. |
| `deposit_account_id` | uuid (FK → accounts, type = asset) | nullable. The bank/cash account that received the deposit. Defaults to Business Bank Account (1010) when null. Set via a dropdown shown alongside the `deposit_paid` toggle in the admin appointment form. |

### `invoice_payments` — New Table

Replaces the implicit `deposit_amount`-as-payment model with explicit payment records for partial and full invoice payments.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `invoice_id` | uuid (FK → invoices) | |
| `amount` | numeric(10,2) | Amount received in this payment |
| `payment_date` | date | |
| `account_id` | uuid (FK → accounts, type = asset) | Which bank/cash account received the money (Business Bank Account or Cash on Hand) |
| `notes` | text | nullable |
| `created_at` | timestamptz | |

> `invoices.deposit_amount` and `invoices.balance_due` remain for display convenience but `balance_due` is recalculated as `total - SUM(invoice_payments.amount WHERE invoice_id = X)`. Recording a payment triggers the auto-draft journal entry.

### `expenses` — New Table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `date` | date | |
| `description` | text | |
| `expense_account_id` | uuid (FK → accounts, type = expense) | Which expense category (Equipment, Software, etc.) |
| `amount` | numeric(10,2) | |
| `payment_status` | enum | `paid` / `payable` — `paid` means cash/bank left immediately; `payable` creates an Accounts Payable liability |
| `payment_account_id` | uuid (FK → accounts, type = asset) | nullable — required when `payment_status = paid`. Which bank/cash account was debited. |
| `receipt_url` | text | nullable |
| `notes` | text | nullable |
| `created_at` | timestamptz | |

### `journal_entries` ↔ `invoice_payments` and `expenses` — reference_type values

| `reference_type` | `reference_id` points to |
|---|---|
| `invoice` | `invoices.id` — for invoice-sent entries |
| `invoice_payment` | `invoice_payments.id` — for payment receipt entries |
| `expense` | `expenses.id` |
| `appointment` | `appointments.id` — for deposit entries |
| `manual` | null |

---

## Pre-seeded Chart of Accounts

Seeded on first run via a migration script. Admin can rename any account and add new ones. System accounts (`is_system = true`) cannot be deleted or archived.

### Assets (normal balance: Debit)
| Code | Name | System |
|---|---|---|
| 1000 | Cash on Hand | ✓ |
| 1010 | Business Bank Account | ✓ |
| 1020 | Investment Account | ✓ |
| 1100 | Accounts Receivable | ✓ |

### Liabilities (normal balance: Credit)
| Code | Name | System |
|---|---|---|
| 2000 | Accounts Payable | ✓ |
| 2100 | Loan Payable | ✓ |
| 2200 | Deferred Revenue | ✓ |
| 2300 | Tax Payable | ✓ |

> `Tax Payable` (2300) is always seeded but only appears in entry forms and reports when `app_settings.tax_enabled = true`. When tax is disabled, this account is hidden from the UI but remains in the database.

### Equity (normal balance: Credit, except Owner's Drawings)
| Code | Name | System | Normal Balance |
|---|---|---|---|
| 3000 | Owner's Capital | ✓ | Credit |
| 3100 | Owner's Drawings | ✓ | **Debit** (contra-equity) |
| 3200 | Retained Earnings | ✓ | Credit |

> `Owner's Drawings` is seeded with `normal_balance = debit` — the only equity account with a debit normal balance. The seeding script sets this explicitly rather than deriving it from the type.

### Revenue (normal balance: Credit)
| Code | Name | System |
|---|---|---|
| 4000 | Session Fees | ✓ |
| 4100 | Print Sales | — |
| 4200 | Album Sales | — |
| 4300 | Other Income | — |

### Expenses (normal balance: Debit)
| Code | Name | System |
|---|---|---|
| 5000 | Equipment | — |
| 5100 | Software & Subscriptions | — |
| 5200 | Travel & Transport | — |
| 5300 | Print & Production | — |
| 5400 | Marketing & Advertising | — |
| 5500 | Interest Expense | ✓ |
| 5600 | Other Expenses | — |

> Admin can add custom accounts under any type. Codes are UNIQUE across all accounts. Non-system accounts with zero balance and no journal lines can be deleted.

---

## Automation Rules

Every business event generates a **draft journal entry** surfaced in a review panel. Nothing posts silently. The admin must explicitly post each entry.

| Trigger | Auto-generated Draft Entry | Notes |
|---|---|---|
| Invoice status → `sent` | Dr Accounts Receivable (`invoice.total`) · Cr [revenue account per `invoice_items.revenue_account_id`, defaults to Session Fees] (`subtotal − discount`) · Cr Tax Payable (`tax`) | Net credits = (subtotal − discount) + tax = total. Balance guaranteed. Each invoice line generates its own credit line. The Tax Payable line is **omitted** when `tax = 0` (zero-amount lines are rejected by the `journal_lines` CHECK constraint). |
| Payment recorded (`invoice_payments` created) | Dr [payment.account_id — Business Bank Account or Cash on Hand] (`payment.amount`) · Cr Accounts Receivable (`payment.amount`) | Fires for every payment: partial, full, or deposit catch-up. |
| Deposit received on appointment (`appointments.deposit_paid` → true) | Dr [`appointments.deposit_account_id`, defaults to Business Bank Account 1010] (`deposit_amount`) · Cr Deferred Revenue (`deposit_amount`) | Only fires if `deposit_amount > 0`. Account selector shown alongside deposit toggle in the appointment form. |
| Invoice created from appointment with posted deposit | Dr Deferred Revenue (`deposit_amount`) · Cr Accounts Receivable (`deposit_amount`) | Reduces net AR to `balance_due`. Fires only if the appointment's deposit journal entry has been posted. If the deposit draft was never posted, this entry is skipped — a warning is shown instead. When this entry is posted, FastAPI also creates an `invoice_payments` record (`amount = deposit_amount`, `account_id = appointments.deposit_account_id`, `notes = "Deposit applied"`) so that `balance_due` and AR Aging remain in sync with the journal ledger. |
| Expense created (`payment_status = paid`) | Dr [expense.expense_account_id] (`expense.amount`) · Cr [expense.payment_account_id] (`expense.amount`) | Cash/bank credited immediately. |
| Expense created (`payment_status = payable`) | Dr [expense.expense_account_id] (`expense.amount`) · Cr Accounts Payable (`expense.amount`) | Creates liability. |
| Expense paid (payable → paid) | Dr Accounts Payable (`expense.amount`) · Cr [admin selects: Business Bank Account / Cash on Hand] (`expense.amount`) | Clears the payable. |

> **Events handled via manual journal entry only** (no automation):
> - Loan repayment (principal + interest split requires admin input — use manual entry with Interest Expense and Loan Payable lines)
> - Owner drawing (Dr Owner's Drawings · Cr Bank/Cash)
> - Owner capital injection (Dr Bank · Cr Owner's Capital)
> - Investment account movements
> - Depreciation
> - End-of-year retained earnings transfer
> - Any correction or adjustment

> **Re-trigger behavior — invoice:** If an admin sets an invoice back to `draft` and then to `sent` again, FastAPI automatically voids the previous non-voided `system` entry for that invoice reference and opens a fresh draft. The admin sees: *"A previous entry for this invoice was voided. Review the new draft below."*

> **Re-trigger behavior — deposit:** If `deposit_paid` is toggled back to `false` on an appointment that has a non-voided deposit entry, FastAPI automatically voids that entry. When `deposit_paid` is toggled back to `true` (with `deposit_amount > 0`), a fresh draft is created. The admin sees: *"A previous deposit entry for this appointment was voided. Review the new draft below."* This mirrors the invoice re-trigger pattern for consistency.

---

## Journal Entry Review Flow

1. Admin triggers a business event (e.g. records a payment, creates an expense, marks an invoice as sent)
2. A **slide-over panel** opens showing the auto-generated draft:
   - Date (editable — admin can backdate)
   - Description (editable)
   - Reference link (e.g. "Invoice #0042 — Client Name")
   - Debit/Credit lines table: account name, debit column, credit column, line description
   - Balance indicator at the bottom: `Total Debits: €X · Total Credits: €X · Difference: €0.00` (shown in red if non-zero)
3. Admin can edit any line (change account, amount), add a new line, or remove a non-mandatory line
4. Actions:
   - **"Post Entry"** — validates balance, saves as `posted`, affects all reports and account balances immediately
   - **"Save as Draft"** — saves without posting; does not affect reports. Draft remains visible in the Journal tab and Overview banner.
   - **"Discard"** — cancels; the originating business event (e.g. expense saved) is still committed, but no journal entry is created. The admin can manually create one later from the Journal tab.
5. **Voiding a posted entry:** Click "Void" → confirmation dialog → FastAPI creates a reversing entry (all debit/credit amounts swapped, dated today, `void_of = original_id`, `status = voided`) → a new corrected draft opens immediately. If the voided entry was a payment entry, the linked invoice is flagged with a `requires_review` warning badge until a new payment entry is posted or the invoice status is manually corrected.
6. **Guards:**
   - Only `posted` entries can be voided — voiding a `draft` or `voided` entry returns `409`
   - Only `draft` entries can be edited — editing a `posted` or `voided` entry returns `409`
   - Entries where `void_of IS NOT NULL` (i.e. reversing entries) cannot themselves be voided — returns `409` ("Reversing entries cannot be voided. Create a manual correction entry instead.")

---

## UI Structure

The Accounting page has six tabs:

### Tab 1 — Overview

- **Key metric cards:** Total Revenue (current period), Total Expenses (current period), Net Profit, Cash Position (sum of Business Bank Account + Cash on Hand balances), Outstanding AR (sum of open invoice balances), Loan Balance (Loan Payable account balance)
- **Revenue vs Expenses bar chart** — monthly bars, filterable by year (Recharts)
- **Recent posted entries** — last 5 posted journal entries with date, description, amount
- **Draft entries alert banner** — shown when any `draft` entries exist: *"X draft entries awaiting review"* → links to Journal tab filtered to drafts

### Tab 2 — Journal

- Paginated list of all journal entries (posted + draft + voided), ordered by `date` desc
- **Columns:** date, description, reference (linked record as a clickable badge), status badge, total debit, created by (system / manual)
- **Filters:** status, date range, reference type, account
- **Row expand:** click any entry to expand inline and see all debit/credit lines
- **"New Journal Entry" button** → opens a blank manual entry form (same slide-over panel). Used for loan repayments, owner drawings, depreciation, capital injections, adjustments.
- **Void button** on posted entries → confirmation → creates reversing entry + opens corrected draft

### Tab 3 — Accounts

- Chart of accounts grouped by type (Assets → Liabilities → Equity → Revenue → Expenses)
- Each row: code, name, current balance (from posted lines), normal balance indicator
- **Add account:** inline form — code (must be unique), name, type
- **Rename** inline for any account
- **Archive** for non-system accounts with no open balances
- System accounts show lock icon — rename only
- **Click any account** → Account Ledger view: all posted lines for that account ordered by date, with opening balance, running balance per line, and closing balance

### Tab 4 — Invoices

Existing invoices tab — extended with payment recording. Marking an invoice as paid now opens the payment recording form (amount, date, account) which triggers the auto-draft journal entry. Invoices flagged with `requires_review` show a warning badge.

### Tab 5 — Expenses

- List of all expenses, ordered by `date` desc
- **Columns:** date, description, expense account, amount, payment status badge (paid / payable)
- **Filters:** expense account, payment status, date range
- **"Add Expense" button** → form: date, description, expense account, amount, payment status (paid / payable), payment account (if paid), receipt URL, notes
- **"Mark as Paid" action** on payable expenses → opens payment confirmation (which account, which date) → triggers auto-draft for Accounts Payable settlement
- **Click any expense** → view detail + linked journal entry

### Tab 6 — Reports

All reports use **posted** entries only. Draft and voided entries are excluded.

| Report | Query Parameters | Output |
|---|---|---|
| P&L Statement | `start_date`, `end_date` | Revenue accounts minus Expense accounts; gross revenue, total expenses, net profit |
| Balance Sheet | `as_of_date` | Assets (total and by account), Liabilities (total and by account), Equity (total and by account). Must satisfy: Assets = Liabilities + Equity |
| Trial Balance | `as_of_date` | All accounts with debit balance column, credit balance column, and net balance. Total debits = total credits row at bottom |
| Cash Flow | `start_date`, `end_date` | Direct method: all movements in Cash on Hand + Business Bank Account during the period. Shown as total inflows, total outflows, net change. No operating/investing/financing split in this iteration. |
| Tax Summary | `start_date`, `end_date` | Total income (Revenue accounts), itemized deductible expenses (Expense accounts by account name), net profit. Formatted for tax filing reference. Hidden when `tax_enabled = false`. |
| AR Aging | `as_of_date` | Outstanding invoice balances grouped by age: 0–30 / 31–60 / 61–90 / 90+ days overdue. Per-client breakdown. Age = `as_of_date − invoices.due_date` (days overdue). Invoices with `due_date = null` are placed in the 0–30 bucket (treated as current). Only invoices with `status != 'paid'` are included. |

Each report: screen view + **"Export CSV"** button.

---

## FastAPI Endpoints

### Accounts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/accounts` | List all accounts. Query params: `type`, `archived` (bool) |
| `POST` | `/api/accounts` | Create new account |
| `GET` | `/api/accounts/{id}` | Get single account |
| `PATCH` | `/api/accounts/{id}` | Rename or archive |
| `DELETE` | `/api/accounts/{id}` | Delete (blocked if referenced in journal lines — returns 409 with count) |
| `GET` | `/api/accounts/{id}/ledger` | Account ledger with running balance. Query params: `start_date`, `end_date` |

### Journal Entries

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/journal-entries` | List entries (paginated). Query params: `status`, `start_date`, `end_date`, `reference_type`, `account_id` |
| `GET` | `/api/journal-entries/{id}` | Single entry with all lines embedded |
| `POST` | `/api/journal-entries` | Create manual draft entry (with lines) |
| `POST` | `/api/journal-entries/preview` | Generate auto-draft preview for a business event. Returns unsaved draft — used to populate review panel before committing. |
| `PATCH` | `/api/journal-entries/{id}` | Update draft entry (lines, date, description). Blocked if status ≠ `draft` → 409 |
| `POST` | `/api/journal-entries/{id}/post` | Post a draft (validates balance invariant → 422 if unbalanced) |
| `POST` | `/api/journal-entries/{id}/void` | Void a posted entry. Blocked if status ≠ `posted` → 409. Creates reversing entry. |

### Expenses

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/expenses` | List expenses. Query params: `expense_account_id`, `payment_status`, `start_date`, `end_date` |
| `GET` | `/api/expenses/{id}` | Single expense with linked journal entry |
| `POST` | `/api/expenses` | Create expense → triggers auto-draft journal entry preview |
| `PATCH` | `/api/expenses/{id}` | Update expense. Blocked if any associated journal entry is `posted` → 409 ("Cannot edit an expense with a posted journal entry. Void the entry first.") |
| `DELETE` | `/api/expenses/{id}` | Delete expense (blocked if posted journal entry linked → 409) |
| `POST` | `/api/expenses/{id}/pay` | Mark payable expense as paid → triggers auto-draft for AP settlement |

### Invoice Payments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/invoices/{id}/payments` | List all payments for an invoice |
| `POST` | `/api/invoices/{id}/payments` | Record a payment → triggers auto-draft journal entry preview |
| `DELETE` | `/api/invoices/{id}/payments/{payment_id}` | Delete payment record. Blocked if the associated journal entry is `posted` → 409 ("Cannot delete a payment with a posted journal entry. Void the journal entry first."). If the associated entry is `draft` or `voided`, the payment record and its entry are deleted together. |

> **Invoice payments are intentionally immutable once their journal entry is posted.** To correct a payment, void the associated journal entry first (which sets `invoice.requires_review = true`), then delete the payment and re-record it correctly. There is no PATCH endpoint for payments — this is by design, not an omission.

### Reports

| Method | Endpoint | Query Params | Notes |
|---|---|---|---|
| `GET` | `/api/reports/pl` | `start_date`, `end_date`, `format` (json / csv) | |
| `GET` | `/api/reports/balance-sheet` | `as_of_date`, `format` | |
| `GET` | `/api/reports/trial-balance` | `as_of_date`, `format` | |
| `GET` | `/api/reports/cash-flow` | `start_date`, `end_date`, `format` | |
| `GET` | `/api/reports/tax-summary` | `start_date`, `end_date`, `format` | Returns `404` if `app_settings.tax_enabled = false` |
| `GET` | `/api/reports/ar-aging` | `as_of_date`, `format` | |

---

## Changes to Existing Tables

> **Column authority:** All column definitions for `appointments`, `invoice_items`, and `invoices` live in the admin spec (`2026-03-14-admin-design.md`). The columns below are already defined there — this section documents only the **behavioral changes** the accounting module introduces.

### `appointments`
- `deposit_amount` and `deposit_account_id` are defined in the admin spec. The accounting module uses `deposit_amount` as the entry amount and `deposit_account_id` as the debit account when the deposit auto-draft fires (`deposit_paid` → true). Multiple installment payments are supported via the `invoice_payments` table — each payment is a separate row and `balance_due` always reflects the running total.

### `invoice_items`
- `revenue_account_id` is defined in the admin spec. When null, the automation defaults to Session Fees (code 4000).

### `invoices`
- `balance_due` formula superseded: previously computed as `total − deposit_amount`. Now computed as `total − SUM(invoice_payments.amount)` at the application layer. `deposit_amount` is retained as a display-only reference field but no longer drives balance calculations. A migration is required to ensure `balance_due` is recalculated correctly on existing rows.
- `requires_review` is defined in the admin spec. Set to `true` when a posted payment journal entry is voided. The badge tooltip: "A payment entry was voided. Review and re-post a corrected payment." Cleared automatically when a new payment entry is posted for this invoice. A **"Dismiss"** action is also available for cases where no corrected entry is needed.

### `transactions` table — removed
The `transactions` table is dropped. References to it in the admin spec (client `total spent` calculation and "Transactions tab" in Accounting) are updated: total spent is calculated from posted journal lines on revenue accounts filtered by client; the Transactions tab becomes the Journal tab.

---

## Data Integrity

- `accounts.code`: UNIQUE constraint
- `journal_lines`: three CHECK constraints (see Data Model section)
- Balance invariant: application-layer on `POST /journal-entries/{id}/post` + PostgreSQL trigger on `UPDATE journal_entries SET status = 'posted'`
- Idempotency: partial unique index on `journal_entries (reference_type, reference_id)` WHERE `status != 'voided'` AND `created_by = 'system'`
- Void guard: `POST /api/journal-entries/{id}/void` returns 409 if `status != 'posted'`
- Deposit validation: `appointments.deposit_amount` must be ≤ linked invoice total — validated at the application layer when the invoice is created from the appointment

---

## Error Handling

| Condition | Response |
|---|---|
| Post unbalanced entry | `422` — "Entry does not balance: debits €X, credits €Y" |
| Edit/delete posted entry | `409` — "Cannot modify a posted entry. Void it first." |
| Void non-posted entry | `409` — "Only posted entries can be voided." |
| Archive system account | `403` |
| Delete account with journal lines | `409` — "Account is referenced in N journal lines." |
| Delete expense with posted journal entry | `409` — "Cannot delete an expense with a posted journal entry. Void the entry first." |
| Edit expense with posted journal entry | `409` — "Cannot edit an expense with a posted journal entry. Void the entry first." |
| Delete invoice payment with posted journal entry | `409` — "Cannot delete a payment with a posted journal entry. Void the journal entry first." |
| Void a reversing entry (`void_of IS NOT NULL`) | `409` — "Reversing entries cannot be voided. Create a manual correction entry instead." |
| Duplicate system auto-draft for same reference | `200` — returns existing draft with note: "An existing draft was found for this event." |
| Deposit amount > invoice total | `422` — "Deposit amount cannot exceed invoice total." |

---

## Testing Strategy

- **Unit tests (backend):** Balance invariant enforcement, auto-draft generation correctness per event type, report calculation (P&L totals, Balance Sheet equation Assets = Liabilities + Equity, Trial Balance sum check), revenue account mapping logic
- **Unit tests (frontend):** Zod schema validation, debit/credit running total in review panel
- **Integration tests (backend):** Full journal entry lifecycle (create draft → edit → post → void → re-draft → post) via `pytest` + `httpx` against test DB. Each automation rule tested end-to-end (create expense → verify correct draft accounts and amounts). Idempotency tests: trigger same event twice, verify only one non-voided entry exists.
- **Report integrity tests:** After seeding test data, verify Balance Sheet balances (Assets = Liabilities + Equity) and Trial Balance (total debits = total credits)
- **Component tests:** Journal entry review panel (line editing, balance indicator update) with React Testing Library

---

## Out of Scope (This Iteration)

- Multi-currency support
- Bank feed / bank reconciliation (automatic import of bank transactions)
- Depreciation schedules (handled via manual journal entries)
- Payroll
- VAT / GST return filing (tax summary is a reference report only — not a filing tool)
- Cash Flow Statement activity classification (operating / investing / financing) — current iteration shows flat inflows and outflows only
- Budgeting and forecasting
- Bulk draft dismissal
- Audit log beyond void/reverse trail
