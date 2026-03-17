import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { DollarSign, Briefcase, Users, FileWarning } from 'lucide-react'
import { fetchDashboardStats } from '@/api/dashboard'
import { useAppointments } from '@/hooks/useAppointments'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { format, parseISO } from 'date-fns'

// Placeholder monthly data — Plan 8 (Accounting) adds real journal-based revenue
const PLACEHOLDER_REVENUE: Array<{ month: string; revenue: number }> = [
  { month: 'Oct', revenue: 0 },
  { month: 'Nov', revenue: 0 },
  { month: 'Dec', revenue: 0 },
  { month: 'Jan', revenue: 0 },
  { month: 'Feb', revenue: 0 },
  { month: 'Mar', revenue: 0 },
]

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  })

  const now = useMemo(() => new Date().toISOString(), [])
  const { data: appointments = [] } = useAppointments({ start_date: now })
  const upcoming = appointments
    .filter(a => a.status !== 'cancelled')
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenue this month"
          value={statsLoading ? '—' : `€0`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="Active jobs"
          value={statsLoading ? '—' : (stats?.activeJobs ?? 0)}
          icon={<Briefcase className="h-5 w-5" />}
        />
        <StatCard
          label="Total clients"
          value={statsLoading ? '—' : (stats?.totalClients ?? 0)}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Unpaid invoices"
          value={statsLoading ? '—' : `€${(stats?.unpaidInvoicesTotal ?? 0).toFixed(2)}`}
          icon={<FileWarning className="h-5 w-5" />}
        />
      </div>

      {/* Main grid: revenue chart + upcoming appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={PLACEHOLDER_REVENUE} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #27272a', borderRadius: 8 }}
                labelStyle={{ color: '#fafafa' }}
                itemStyle={{ color: '#f59e0b' }}
              />
              <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-zinc-600 mt-2">Revenue chart will populate after accounting is set up (Plan 8)</p>
        </div>

        {/* Upcoming appointments */}
        <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Upcoming Appointments</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-zinc-500">No upcoming appointments</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map(a => (
                <li key={a.id} className="space-y-1">
                  <p className="text-sm font-medium text-white truncate">{a.title}</p>
                  <p className="text-xs text-zinc-400">
                    {format(parseISO(a.starts_at), 'MMM d, yyyy · HH:mm')}
                  </p>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
