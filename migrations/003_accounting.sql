-- migrations/003_accounting.sql
-- accounts, journal_entries, journal_lines, invoice_payments, expenses
-- Also adds FK columns to appointments and invoice_items
-- Includes balance invariant trigger and idempotency index
-- Seeds the chart of accounts

-- Enums
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE normal_balance_type AS ENUM ('debit', 'credit');
CREATE TYPE journal_entry_status AS ENUM ('draft', 'posted', 'voided');
CREATE TYPE journal_created_by AS ENUM ('system', 'manual');
CREATE TYPE expense_payment_status AS ENUM ('paid', 'payable');

-- accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type account_type NOT NULL,
    normal_balance normal_balance_type NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- journal_entries
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    status journal_entry_status NOT NULL DEFAULT 'draft',
    created_by journal_created_by NOT NULL,
    void_of UUID REFERENCES journal_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: only one non-voided system entry per (reference_type, reference_id)
CREATE UNIQUE INDEX journal_entries_idempotency_idx
    ON journal_entries (reference_type, reference_id)
    WHERE status != 'voided' AND created_by = 'system';

-- journal_lines
CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(10,2) NOT NULL DEFAULT 0,
    credit NUMERIC(10,2) NOT NULL DEFAULT 0,
    description TEXT,
    CONSTRAINT debit_non_negative CHECK (debit >= 0),
    CONSTRAINT credit_non_negative CHECK (credit >= 0),
    CONSTRAINT one_side_only CHECK (debit = 0 OR credit = 0),
    CONSTRAINT at_least_one_non_zero CHECK (debit > 0 OR credit > 0)
);

-- Balance invariant trigger: fires on status draft -> posted
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debits NUMERIC(10,2);
    total_credits NUMERIC(10,2);
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        SELECT
            COALESCE(SUM(debit), 0),
            COALESCE(SUM(credit), 0)
        INTO total_debits, total_credits
        FROM journal_lines
        WHERE entry_id = NEW.id;

        IF total_debits != total_credits THEN
            RAISE EXCEPTION
                'Journal entry does not balance: debits %, credits %',
                total_debits, total_credits;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entry_balance_check
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION check_journal_balance();

-- invoice_payments
CREATE TABLE invoice_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- expenses
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    description TEXT NOT NULL,
    expense_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL,
    payment_status expense_payment_status NOT NULL,
    payment_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK columns now that accounts table exists
ALTER TABLE appointments
    ADD COLUMN deposit_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE invoice_items
    ADD COLUMN revenue_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX ON journal_entries (reference_type, reference_id);
CREATE INDEX ON journal_entries (status);
CREATE INDEX ON journal_entries (date DESC);
CREATE INDEX ON journal_lines (entry_id);
CREATE INDEX ON journal_lines (account_id);
CREATE INDEX ON invoice_payments (invoice_id);
CREATE INDEX ON expenses (date DESC);
CREATE INDEX ON expenses (payment_status);

-- -----------------------------------------------------------------------
-- Seed: Chart of Accounts
-- -----------------------------------------------------------------------

-- Assets (normal balance: Debit)
INSERT INTO accounts (code, name, type, normal_balance, is_system) VALUES
    ('1000', 'Cash on Hand',          'asset', 'debit', TRUE),
    ('1010', 'Business Bank Account', 'asset', 'debit', TRUE),
    ('1020', 'Investment Account',    'asset', 'debit', TRUE),
    ('1100', 'Accounts Receivable',   'asset', 'debit', TRUE);

-- Liabilities (normal balance: Credit)
INSERT INTO accounts (code, name, type, normal_balance, is_system) VALUES
    ('2000', 'Accounts Payable', 'liability', 'credit', TRUE),
    ('2100', 'Loan Payable',     'liability', 'credit', TRUE),
    ('2200', 'Deferred Revenue', 'liability', 'credit', TRUE),
    ('2300', 'Tax Payable',      'liability', 'credit', TRUE);

-- Equity (normal balance: Credit, except Owner's Drawings)
INSERT INTO accounts (code, name, type, normal_balance, is_system) VALUES
    ('3000', 'Owner''s Capital',    'equity', 'credit', TRUE),
    ('3100', 'Owner''s Drawings',   'equity', 'debit',  TRUE),  -- contra-equity
    ('3200', 'Retained Earnings',   'equity', 'credit', TRUE);

-- Revenue (normal balance: Credit)
INSERT INTO accounts (code, name, type, normal_balance, is_system) VALUES
    ('4000', 'Session Fees',  'revenue', 'credit', TRUE),
    ('4100', 'Print Sales',   'revenue', 'credit', FALSE),
    ('4200', 'Album Sales',   'revenue', 'credit', FALSE),
    ('4300', 'Other Income',  'revenue', 'credit', FALSE);

-- Expenses (normal balance: Debit)
INSERT INTO accounts (code, name, type, normal_balance, is_system) VALUES
    ('5000', 'Equipment',                'expense', 'debit', FALSE),
    ('5100', 'Software & Subscriptions', 'expense', 'debit', FALSE),
    ('5200', 'Travel & Transport',       'expense', 'debit', FALSE),
    ('5300', 'Print & Production',       'expense', 'debit', FALSE),
    ('5400', 'Marketing & Advertising',  'expense', 'debit', FALSE),
    ('5500', 'Interest Expense',         'expense', 'debit', TRUE),
    ('5600', 'Other Expenses',           'expense', 'debit', FALSE);
