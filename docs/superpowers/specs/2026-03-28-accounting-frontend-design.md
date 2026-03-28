# Accounting Frontend Design

**Date:** 2026-03-28
**Status:** Approved

## Overview

Full accounting UI for weCapture4U. Single admin page at `/accounting` with 6 horizontal tabs. Implemented in two sequential plans: reports backend first, then the frontend.

---

## Plan 1: Reports Backend

### Goal
Implement all 6 accounting reports as queryable API endpoints with CSV export, so the backend is fully functional before any frontend code is written.

### Service: `backend/services/reports.py`

Six functions, each querying `journal_lines` joined to `journal_entries` (posted only) and `accounts`:

| Function | Date params | Returns |
|---|---|---|
| `get_pl(db, start_date, end_date)` | date range | `{revenue_by_account, total_revenue, expenses_by_account, total_expenses, net_profit}` |
| `get_balance_sheet(db, as_of_date)` | as-of | `{assets, liabilities, equity, total_*, balanced}` |
| `get_trial_balance(db, as_of_date)` | as-of | `{rows: [{code, name, debit_balance, credit_balance}], totals}` |
| `get_cash_flow(db, start_date, end_date)` | date range | `{operating, investing, financing, net_change}` (cash account movements) |
| `get_tax_summary(db, start_date, end_date)` | date range | `{taxable_revenue, deductible_expenses, net_taxable_income}` |
| `get_ar_aging(db, as_of_date)` | as-of | `{buckets: {current, 1_30, 31_60, 61_90, over_90}, total_outstanding}` |

Each function has a companion `*_to_csv(data) -> str` that serializes using Python's `csv` stdlib.

### Router: `backend/routers/reports.py`

Six endpoints — all require admin auth (`get_current_admin`):

```
GET /api/reports/pl               ?start_date=&end_date=&format=csv
GET /api/reports/balance-sheet    ?as_of_date=&format=csv
GET /api/reports/trial-balance    ?as_of_date=&format=csv
GET /api/reports/cash-flow        ?start_date=&end_date=&format=csv
GET /api/reports/tax-summary      ?start_date=&end_date=&format=csv
GET /api/reports/ar-aging         ?as_of_date=&format=csv
```

`?format=csv` triggers `StreamingResponse` with `Content-Disposition: attachment`. Default is JSON.

### Registration

Add `reports_router` to `backend/main.py` with `prefix="/api"`, `tags=["reports"]`.

### Tests: `backend/tests/test_routers_reports.py`

One test per report. Each test:
1. Seeds minimal posted journal entries using the real-DB fixture (savepoint rollback)
2. Calls the endpoint via test client
3. Asserts HTTP 200, correct shape, correct computed values

---

## Plan 2: Accounting Frontend

### File Structure

```
frontend/src/
  schemas/
    accounting.ts
  api/
    accounting.ts
  hooks/
    useAccounting.ts
  components/
    accounting/
      JournalEntryReviewPanel.tsx
      JournalEntryLineEditor.tsx
  pages/
    admin/
      Accounting.tsx
      accounting/
        AccountingOverview.tsx
        AccountingAccounts.tsx
        AccountingJournal.tsx
        AccountingExpenses.tsx
        AccountingPayments.tsx
        AccountingReports.tsx
```

### Schemas: `frontend/src/schemas/accounting.ts`

Zod schemas for all accounting types:

- `AccountTypeSchema` — enum: `asset | liability | equity | revenue | expense`
- `AccountOutSchema` — id, code, name, type, normal_balance, is_system, archived
- `JournalLineOutSchema` — id, account_id, account_name, account_code, debit, credit, description
- `JournalEntryOutSchema` — id, date, description, reference_type, reference_id, status, created_by, void_of, lines
- `JournalEntryListItemSchema` — same minus lines (for list views)
- `ExpenseOutSchema` — id, date, description, amount, expense_account_id, expense_account_name, payment_status, payment_account_id, payment_date, notes, journal_entry_id
- `LedgerLineSchema` — date, description, reference_type, debit, credit, running_balance
- `AccountLedgerOutSchema` — account (AccountOutSchema), opening_balance, lines (LedgerLineSchema[]), closing_balance

Report responses use `z.unknown()` — shapes vary per report type and backend already validates.

### API Layer: `frontend/src/api/accounting.ts`

All functions Zod-parse at the boundary. Grouped by domain:

**Accounts:**
- `fetchAccounts(params?: { type?, archived? })` → `AccountOut[]`
- `createAccount(data)` → `AccountOut`
- `updateAccount(id, data)` → `AccountOut`
- `deleteAccount(id)` → `void`
- `fetchAccountLedger(id, params)` → `AccountLedgerOut`

**Journal:**
- `fetchJournalEntries(params?: { status?, start_date?, end_date? })` → `JournalEntryListItem[]`
- `fetchJournalEntry(id)` → `JournalEntryOut`
- `createJournalEntry(data)` → `JournalEntryOut`
- `updateJournalEntry(id, data)` → `JournalEntryOut`
- `postJournalEntry(id)` → `JournalEntryOut`
- `voidJournalEntry(id)` → `JournalEntryOut`

**Expenses:**
- `fetchExpenses(params?: { expense_account_id?, payment_status?, start_date?, end_date? })` → `ExpenseOut[]`
- `createExpense(data)` → `ExpenseOut`
- `updateExpense(id, data)` → `ExpenseOut`
- `deleteExpense(id)` → `void`
- `payExpense(id, data)` → `ExpenseOut`

**Reports:**
- `fetchReport(type: ReportType, params: Record<string, string>)` → `unknown`
- `downloadReportCsv(type, params)` — triggers browser download via blob URL

### Hooks: `frontend/src/hooks/useAccounting.ts`

TanStack Query hooks. Query key conventions:
- `['accounts', params]`, `['journal-entries', params]`, `['expenses', params]`
- `['journal-entry', id]`, `['account-ledger', id, params]`

Mutation invalidation rules:
- Account mutations → invalidate `['accounts']`
- Journal mutations → invalidate `['journal-entries']` + `['journal-entry', id]`
- `payExpense` → invalidate `['expenses']` + `['journal-entries']` (auto-creates an entry)
- Expense mutations → invalidate `['expenses']`

### Component: `JournalEntryReviewPanel`

Right-side slide-over. Implemented as an absolutely-positioned panel (no new UI dependency). Props:
- `entry: JournalEntryOut | null`
- `open: boolean`
- `onClose: () => void`

Content:
- Header: description, date, status badge, reference type/id (for auto-drafts)
- `JournalEntryLineEditor` — read-only for posted/voided, editable for draft
- Footer actions: **Post** (draft only), **Void** (posted only, with ConfirmDialog), **Close**

### Component: `JournalEntryLineEditor`

Props:
- `lines: JournalLineOut[]`
- `editable: boolean`
- `accounts: AccountOut[]` (for account selector in edit mode)
- `onChange?: (lines: LineInput[]) => void`

Displays debit/credit table. When editable: account selector + debit/credit number inputs per row, add/remove row buttons, running debit/credit totals at the bottom. Post button disabled unless totals balance (debit total = credit total).

### Page: `Accounting.tsx`

shadcn `Tabs` with 6 tabs. Each tab renders its sub-component. Tab components are lazy-loaded to avoid fetching all data on mount.

#### Tab: Overview (`AccountingOverview.tsx`)

- Fetches two P&L reports on mount: current month (first day → today) and prior month (for MoM delta), plus AR aging (as_of today)
- 4 KPI cards: Revenue MTD, Expenses MTD, Net Profit MTD, Outstanding AR
- Each card shows MoM delta (current month vs prior month) as a colored badge — computed client-side from the two P&L responses
- `BarChart` (recharts) — revenue vs expenses, one bar pair per month, current year
- Recent journal entries list — last 5 posted entries, linked to open the Journal tab at that entry

#### Tab: Chart of Accounts (`AccountingAccounts.tsx`)

- Table: code, name, type badge, normal balance, system flag, actions
- "Add Account" → inline form at top of table (code, name, type, normal_balance)
- Edit: row goes inline-edit on click, save/cancel buttons
- Delete: ConfirmDialog guard, blocked for system accounts (`is_system = true`)
- Toggle: "Show archived" checkbox to include archived accounts

#### Tab: Journal (`AccountingJournal.tsx`)

- Filter bar: status (all / draft / posted / voided)
- Table: date, description, reference type, status badge, line count
- Click row → opens `JournalEntryReviewPanel`
- "New Entry" → `createJournalEntry` with today's date and empty lines, then opens panel
- Auto-draft entries show reference type label (e.g. "Invoice #42") as a link

#### Tab: Expenses (`AccountingExpenses.tsx`)

- Filter bar: payment_status (all / payable / paid)
- "Add Expense" → inline form expands at top: description, amount, expense account (select from accounts of type `expense`), date, notes (optional)
- Table: date, description, account, amount, status badge, actions
- Payable rows: "Mark Paid" button → small dialog: payment account (type `asset`), payment date
- Delete: ConfirmDialog guard (only for payable expenses — paid ones have posted entries)

#### Tab: Payments (`AccountingPayments.tsx`)

- Read-only table of all invoice payments: paid_at, amount, method, invoice link, client name
- No mutations — audit view only
- Fetches from existing `/api/invoices` with payments embedded (no new endpoint needed)

#### Tab: Reports (`AccountingReports.tsx`)

- Sub-tabs: P&L, Balance Sheet, Trial Balance, Cash Flow, Tax Summary, AR Aging
- Each sub-tab has: date picker(s) appropriate to the report + **Run** button
- On Run: fetches report JSON, renders as formatted table below
- **Download CSV** button appears after first successful fetch; triggers blob download
- Report state is local (not cached in TanStack Query — too many param combinations)

### Payments Tab — data source clarification

The Payments tab shows invoice payments. These already exist in the invoice responses (embedded `payments` array). The tab fetches all invoices and flattens their payments — no new backend endpoint required.

---

## Constraints

- All data fetching goes through the TanStack Query hooks — no direct API calls in components
- Zod schemas are the source of truth for all API response shapes
- No new UI component libraries — use existing shadcn components + recharts
- The slide-over panel does not use a React portal or Dialog — it's a positioned element within the page to avoid z-index complexity with the AdminShell sidebar
- Reports tab fetches data on demand (Run button), not on tab mount

---

## Out of Scope

- Invoice detail mutations (managed in the existing Invoices flow)
- Manual journal entry editing for posted entries (must void + re-create)
- Multi-currency
- Budget vs actual comparisons
