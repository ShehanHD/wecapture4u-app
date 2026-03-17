import { useQuery } from '@tanstack/react-query'
import { fetchInvoices, fetchInvoice } from '@/api/invoices'

export function useInvoices(params?: { status?: string; client_id?: string; job_id?: string }) {
  return useQuery({ queryKey: ['invoices', params], queryFn: () => fetchInvoices(params) })
}

export function useInvoice(id: string) {
  return useQuery({ queryKey: ['invoices', id], queryFn: () => fetchInvoice(id), enabled: !!id })
}
