import { z } from 'zod'

export const DashboardStatsSchema = z.object({
  revenue_this_month: z.number(),
  active_jobs: z.number(),
  total_clients: z.number(),
  unpaid_invoices_total: z.number(),
})

export type DashboardStats = z.infer<typeof DashboardStatsSchema>

export const MonthlyRevenueSchema = z.object({
  month: z.string(),
  revenue: z.number(),
})

export const RevenueChartSchema = z.array(MonthlyRevenueSchema)
export type MonthlyRevenue = z.infer<typeof MonthlyRevenueSchema>
