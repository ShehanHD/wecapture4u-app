import { z } from 'zod'

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  amount: z.string(),
  payment_date: z.string(),
  account_id: z.string().uuid(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type Payment = z.infer<typeof PaymentSchema>
export const PaymentListSchema = z.array(PaymentSchema)

const InvoiceItemSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  revenue_account_id: z.string().uuid().nullable(),
  description: z.string(),
  quantity: z.string(),
  unit_price: z.string(),
  amount: z.string(),
})

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid().nullable(),
  client_id: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'partially_paid', 'paid']),
  subtotal: z.string(),
  discount: z.string(),
  tax: z.string(),
  total: z.string(),
  balance_due: z.string(),
  requires_review: z.boolean(),
  due_date: z.string().nullable(),
  sent_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  created_at: z.string(),
  items: z.array(InvoiceItemSchema),
  payments: z.array(PaymentSchema),
})
export type Invoice = z.infer<typeof InvoiceSchema>
export const InvoiceListSchema = z.array(InvoiceSchema)
