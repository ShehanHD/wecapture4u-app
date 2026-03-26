-- 013_fix_invoice_payments.sql
-- Aligns invoice_payments table with the schema defined in 003_accounting.sql.
-- The original CREATE TABLE in 003 was never applied to this table; it retained
-- the old schema (paid_at, method). This migration brings it in sync.

ALTER TABLE invoice_payments
  RENAME COLUMN paid_at TO payment_date;

ALTER TABLE invoice_payments
  DROP COLUMN IF EXISTS method;

ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE invoice_payments
  DROP CONSTRAINT IF EXISTS invoice_payments_invoice_id_fkey;

ALTER TABLE invoice_payments
  ADD CONSTRAINT invoice_payments_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT;
