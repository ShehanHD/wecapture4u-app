// frontend/src/pages/admin/Dashboard.tsx
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  DollarSign, Briefcase, Users, FileWarning, CalendarPlus, Camera,
  CreditCard, Banknote, Building2, TrendingUp, Clock, BookImage,
  ArrowDownLeft, ArrowUpRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchDashboardStats } from '@/api/dashboard'
import { useAppointments } from '@/hooks/useAppointments'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { GradientStatCard, StatCard, QuickActionCard } from '@/components/ui/GradientCards'
import { format, parseISO } from 'date-fns'

const PLACEHOLDER_REVENUE: Array<{ month: string; revenue: number }> = [
  { month: 'Oct', revenue: 0 },
  { month: 'Nov', revenue: 0 },
  { month: 'Dec', revenue: 0 },
  { month: 'Jan', revenue: 0 },
  { month: 'Feb', revenue: 0 },
  { month: 'Mar', revenue: 0 },
]

function fmt(n: number) {
  return `€${n.toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function Dashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  })

  const now = useMemo(() => new Date().toISOString(), [])
  const { data: appointments = [] } = useAppointments({ start_date: now })
  const upcoming = appointments.filter(a => a.status !== 'cancelled').slice(0, 5)

  const v = (n: number | undefined) => (isLoading || n === undefined ? '—' : fmt(n))
  const n = (n: number | undefined) => (isLoading || n === undefined ? '—' : n)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Welcome back — here's what's happening.</p>
      </div>

      {/* Row 1: Cash, Bank, Debits, Credits */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GradientStatCard label="Total Cash" value={v(stats?.total_cash)} sub="Cash on hand" gradient="amber" icon={<Banknote className="h-5 w-5" />} />
        <GradientStatCard label="Total Bank" value={v(stats?.total_bank)} sub="Bank account balance" gradient="cyan" icon={<Building2 className="h-5 w-5" />} />
        <GradientStatCard label="Total Debits" value={v(stats?.total_debits)} sub="All posted journal debits" gradient="coral" icon={<ArrowUpRight className="h-5 w-5" />} />
        <GradientStatCard label="Total Credits" value={v(stats?.total_credits)} sub="All posted journal credits" gradient="emerald" icon={<ArrowDownLeft className="h-5 w-5" />} />
      </div>

      {/* Chart + Upcoming appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-1">Monthly Revenue</h2>
          <p className="text-xs text-muted-foreground mb-5">Will populate once accounting is set up</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={PLACEHOLDER_REVENUE} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--popover-foreground)' }}
                labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--brand-from)' }}
                cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
              />
              <Bar dataKey="revenue" fill="url(#amberGrad)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-from)" />
                  <stop offset="100%" stopColor="var(--brand-to)" stopOpacity={0.7} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card border border-border p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Upcoming Appointments</h2>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <CalendarPlus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {upcoming.map(a => (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--brand-from)' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(parseISO(a.starts_at), 'MMM d, yyyy')}</p>
                    <div className="mt-1"><StatusBadge status={a.status} /></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Row 3: Revenue, Invoices, Active Jobs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="This Month Revenue" value={v(stats?.this_month_revenue)} sub="Payments received" gradient="amber" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Overdue Invoices" value={v(stats?.overdue_balance)} sub="Shoot date passed" gradient="coral" icon={<FileWarning className="h-5 w-5" />} />
        <StatCard label="Upcoming Payments" value={v(stats?.upcoming_balance)} sub="Future shoots" gradient="purple" icon={<DollarSign className="h-5 w-5" />} />
        <StatCard label="Active Jobs" value={n(stats?.active_jobs)} sub="In progress" gradient="emerald" icon={<Briefcase className="h-5 w-5" />} />
      </div>

      {/* Row 4: Jobs breakdown + Clients */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={n(stats?.total_jobs)} sub="All time" gradient="purple" icon={<Camera className="h-5 w-5" />} />
        <StatCard label="This Month Jobs" value={n(stats?.this_month_jobs)} sub="Created this month" gradient="cyan" icon={<Camera className="h-5 w-5" />} />
        <StatCard label="Future Jobs" value={n(stats?.future_jobs)} sub="Upcoming shoots" gradient="amber" icon={<CalendarPlus className="h-5 w-5" />} />
        <StatCard label="Total Clients" value={n(stats?.total_clients)} sub="All time" gradient="coral" icon={<Users className="h-5 w-5" />} />
      </div>

      {/* Albums */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Albums</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Upcoming Albums" value={n(stats?.upcoming_albums)} sub="Shoot not yet done" gradient="amber" icon={<BookImage className="h-4 w-4" />} className="py-3" />
          <StatCard label="Ongoing Albums" value={n(stats?.ongoing_albums)} sub="In production" gradient="purple" icon={<Clock className="h-4 w-4" />} className="py-3" />
          <StatCard label="Total Albums" value={n(stats?.total_albums)} sub="All time" gradient="cyan" icon={<BookImage className="h-4 w-4" />} className="py-3" />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionCard label="New Appointment" description="Schedule a shoot" icon={<CalendarPlus className="h-5 w-5" />} gradient="amber" onClick={() => navigate('/admin/appointments')} />
          <QuickActionCard label="View Jobs" description="Track your pipeline" icon={<Camera className="h-5 w-5" />} gradient="purple" onClick={() => navigate('/admin/jobs')} />
          <QuickActionCard label="Clients" description="Manage your clients" icon={<Users className="h-5 w-5" />} gradient="cyan" onClick={() => navigate('/admin/clients')} />
          <QuickActionCard label="Accounting" description="Invoices & payments" icon={<CreditCard className="h-5 w-5" />} gradient="emerald" onClick={() => navigate('/admin/accounting')} />
        </div>
      </div>
    </div>
  )
}
