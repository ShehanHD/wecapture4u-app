# Accounting Gaps — Design Spec

**Date:** 2026-03-29
**Scope:** Four gaps in the accounting frontend — formatted report tables, account ledger slide-over, expense edit, raw axios import fix.

---

## Gap 1: Format the 4 Remaining Reports

**Current state:** Trial Balance, Cash Flow, Tax Summary, and AR Aging use a generic `<pre>{JSON.stringify(...)}</pre>` dump. P&L and Balance Sheet already have proper formatted tables.

**Goal:** Replace the generic JSON dump with formatted tables matching the P&L/Balance Sheet style. Each report keeps the existing date filter bar and CSV download button.

### Trial Balance
- **Response shape:** `{ as_of_date, rows: [{code, name, debit_balance, credit_balance}], total_debit, total_credit, balanced }`
- **UI:** 4-column table — Code | Name | Debit | Credit. Bold totals row at bottom. Balanced/Unbalanced badge (green/red) next to the totals row.

### Cash Flow
- **Response shape:** `{ start_date, end_date, cash_collected, cash_spent, net_change }`
- **UI:** Simple 3-row summary table — Description | Amount. Rows: "Cash collected from clients", "Cash spent on expenses", "Net cash change" (highlighted green if positive, red if negative).

### Tax Summary
- **Response shape:** `{ start_date, end_date, taxable_revenue, deductible_expenses: {name: amount}, total_deductible_expenses, net_taxable_income }`
- **UI:** 2-section table — Revenue section (single "Total Revenue" row), then Deductible Expenses section (one row per account). Footer row: Net Taxable Income (bold).

### AR Aging
- **Response shape:** `{ as_of_date, buckets: {current, 1_30, 31_60, 61_90, over_90}: [{invoice_id, client_name, balance, due_date, days_overdue}], total_outstanding }`
- **UI:** Bucket sections, each with a header row (bucket label + subtotal). Inside each bucket: Client | Due Date | Balance columns. Total Outstanding row at the bottom. Empty buckets are hidden.

---

## Gap 2: Account Ledger Slide-Over

**Current state:** `GET /api/accounts/{id}/ledger` exists on the backend and `fetchAccountLedger` is in the API layer, but there is no UI to view an account's transaction history.

**Goal:** Add a "View Ledger" button (book icon) on each account row in the Chart of Accounts tab. Clicking it opens a slide-over panel showing that account's full transaction history.

### Panel structure
- Follows `JournalEntryReviewPanel` pattern: fixed right panel (w-[580px]), dark backdrop, close button.
- **Header:** account code + name + type badge.
- **Date range filter:** From / To date inputs + "Load" button. Defaults to current month.
- **Table:** Date | Description | Reference | Debit | Credit | Running Balance (tabular-nums, right-aligned amounts).
- **Footer:** Opening Balance (left) → Closing Balance (right), bold.

### Component
- New file: `frontend/src/components/accounting/AccountLedgerPanel.tsx`
- Props: `{ accountId: string | null; accountName: string; onClose: () => void }`
- Uses `fetchAccountLedger` directly (not via hook — one-shot fetch on Load button click, no TanStack Query needed since it's user-triggered with params).
- Loading state: spinner/disabled button while fetching.

### Trigger
- In `AccountingAccounts.tsx`: add a `Book` (lucide) icon button on each account row (right side, before the edit/archive/delete buttons).
- State in parent: `ledgerAccount: { id: string; name: string } | null`.

---

## Gap 3: Expense Edit (Inline, Payable Only)

**Current state:** Expenses only support create, delete, and pay. `updateExpense` exists in the API and hooks but has no UI.

**Goal:** Add inline edit for `payable` expenses, matching the inline-edit pattern already used in `AccountingAccounts`.

### Behaviour
- Pencil icon button on each `payable` expense row. `paid` expenses show no edit button (immutable).
- Clicking pencil puts that row into edit mode: fields become inputs.
- Editable fields: `date`, `description`, `amount`, `expense_account_id`, `notes`.
- `payment_status` and `payment_account_id` are not editable (those change via the Pay action).
- Check (✓) button saves — calls `updateExpense`. X button cancels.
- Only one row can be in edit mode at a time.

### State
- `editingId: string | null` — which expense row is being edited.
- `editForm: { date, description, amount, expense_account_id, notes }` — current edit values.
- Initialised from the expense when pencil is clicked.

---

## Gap 4: Fix Raw axios Import

**Current state:** `AccountingExpenses.tsx` imports `axios` (default) just to call `axios.isAxiosError(err)`.

**Fix:** Change:
```ts
import axios from 'axios'
// ...
if (axios.isAxiosError(err) && err.response?.status === 409)
```
To:
```ts
import { isAxiosError } from 'axios'
// ...
if (isAxiosError(err) && err.response?.status === 409)
```

---

## File Map

| File | Change |
|---|---|
| `frontend/src/pages/admin/accounting/AccountingReports.tsx` | Replace 4 `GenericReport` usages with `TrialBalanceReport`, `CashFlowReport`, `TaxSummaryReport`, `ARAgingReport` components |
| `frontend/src/components/accounting/AccountLedgerPanel.tsx` | New — slide-over panel for account ledger |
| `frontend/src/pages/admin/accounting/AccountingAccounts.tsx` | Add Book icon button + ledger panel state |
| `frontend/src/pages/admin/accounting/AccountingExpenses.tsx` | Add inline edit + fix axios import |

No backend changes required. All endpoints already exist.

---

## Out of Scope

- Report date range presets (e.g. "This Quarter") — YAGNI for now.
- Clicking a ledger line to navigate to the journal entry — can be added later.
- Expense edit for `paid` expenses — paid expenses are immutable by design.
