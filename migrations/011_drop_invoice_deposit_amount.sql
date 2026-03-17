-- Migration 011: Drop deposit_amount from invoices
-- Deposits are now recorded as InvoicePayment rows, which correctly
-- reduce balance_due via the payments sum. The old deposit_amount column
-- was stored but never used in any balance calculation.

ALTER TABLE invoices DROP COLUMN IF EXISTS deposit_amount;
