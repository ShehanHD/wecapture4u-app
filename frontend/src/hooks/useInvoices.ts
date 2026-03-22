import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchInvoices, fetchInvoice, addPayment, deletePayment, createJobInvoice, type PaymentCreatePayload } from '@/api/invoices'

export function useInvoices(params?: { status?: string; client_id?: string; job_id?: string }) {
  return useQuery({ queryKey: ['invoices', params], queryFn: () => fetchInvoices(params) })
}

export function useInvoice(id: string) {
  return useQuery({ queryKey: ['invoices', id], queryFn: () => fetchInvoice(id), enabled: !!id })
}

export function useAddPayment(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PaymentCreatePayload) => addPayment(invoiceId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useCreateJobInvoice(jobId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => createJobInvoice(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useDeletePayment(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentId: string) => deletePayment(invoiceId, paymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
