import { api } from '@/lib/axios'
import { z } from 'zod'

const ClientCountSchema = z.array(z.object({ id: z.string() }))
const InvoiceListSchema = z.array(z.object({
  id: z.string(),
  status: z.string(),
  balance_due: z.string(),
}))
const JobListSchema = z.array(z.object({
  id: z.string(),
  stage_id: z.string(),
}))

export interface DashboardStats {
  totalClients: number
  activeJobs: number
  unpaidInvoicesTotal: number
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [clientsRes, jobsRes, invoicesRes] = await Promise.all([
    api.get('/api/clients'),
    api.get('/api/jobs'),
    api.get('/api/invoices'),
  ])

  const clients = ClientCountSchema.parse(clientsRes.data)
  const jobs = JobListSchema.parse(jobsRes.data)
  const invoices = InvoiceListSchema.parse(invoicesRes.data)

  const unpaidInvoicesTotal = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + parseFloat(i.balance_due), 0)

  return {
    totalClients: clients.length,
    activeJobs: jobs.length,
    unpaidInvoicesTotal,
  }
}
