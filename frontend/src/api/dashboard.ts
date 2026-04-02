import { api } from '@/lib/axios'
import { z } from 'zod'

const DashboardStatsSchema = z.object({
  total_cash: z.number(),
  total_bank: z.number(),
  total_liabilities: z.number(),
  total_receivables: z.number(),
  this_month_revenue: z.number(),
  overdue_balance: z.number(),
  upcoming_balance: z.number(),
  active_jobs: z.number(),
  total_jobs: z.number(),
  this_month_jobs: z.number(),
  future_jobs: z.number(),
  total_clients: z.number(),
  total_albums: z.number(),
  upcoming_albums: z.number(),
  ongoing_albums: z.number(),
})

export type DashboardStats = z.infer<typeof DashboardStatsSchema>

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await api.get('/api/dashboard')
  return DashboardStatsSchema.parse(res.data)
}
