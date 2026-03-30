import { api } from '@/lib/axios'
import {
  InvoiceListSchema, InvoiceSchema, PaymentSchema,
  type Invoice, type Payment,
} from '@/schemas/invoices'

export type { Invoice, Payment }

export async function fetchInvoices(params?: {
  status?: string; client_id?: string; job_id?: string
}): Promise<Invoice[]> {
  const { data } = await api.get('/api/invoices', { params })
  return InvoiceListSchema.parse(data)
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  const { data } = await api.get(`/api/invoices/${id}`)
  return InvoiceSchema.parse(data)
}

export interface PaymentCreatePayload {
  amount: string
  payment_date: string  // YYYY-MM-DD
  account_id: string
  notes?: string | null
}

export async function addPayment(invoiceId: string, payload: PaymentCreatePayload): Promise<Payment> {
  const { data } = await api.post(`/api/invoices/${invoiceId}/payments`, payload)
  return PaymentSchema.parse(data)
}

export async function deletePayment(invoiceId: string, paymentId: string): Promise<void> {
  await api.delete(`/api/invoices/${invoiceId}/payments/${paymentId}`)
}

export async function createJobInvoice(jobId: string): Promise<Invoice> {
  const { data } = await api.post(`/api/jobs/${jobId}/invoice`)
  return InvoiceSchema.parse(data)
}
