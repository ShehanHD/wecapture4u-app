import { api } from '@/lib/axios'
import { z } from 'zod'

const DashboardStatsSchema = z.object({
  total_clients: z.number(),
  active_jobs: z.number(),
  overdue_balance: z.number(),
  upcoming_balance: z.number(),
})

export interface DashboardStats {
  totalClients: number
  activeJobs: number
  overdueBalance: number
  upcomingBalance: number
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await api.get('/api/dashboard')
  const data = DashboardStatsSchema.parse(res.data)
  return {
    totalClients: data.total_clients,
    activeJobs: data.active_jobs,
    overdueBalance: data.overdue_balance,
    upcomingBalance: data.upcoming_balance,
  }
}
