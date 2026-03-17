import { api } from '@/lib/axios'
import { InvoiceListSchema, InvoiceSchema, type Invoice } from '@/schemas/invoices'

export type { Invoice }

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
