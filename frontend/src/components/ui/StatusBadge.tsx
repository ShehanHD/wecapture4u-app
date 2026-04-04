import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Appointment statuses
  pending: { label: 'Pending', className: 'bg-brand text-black' },
  confirmed: { label: 'Confirmed', className: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' },
  cancelled: { label: 'Cancelled', className: 'bg-gradient-to-r from-rose-400 to-pink-500 text-white' },
  // Job statuses
  active: { label: 'Active', className: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' },
  // Invoice statuses
  draft: { label: 'Draft', className: 'bg-gradient-to-r from-slate-400 to-zinc-500 text-white' },
  sent: { label: 'Sent', className: 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white' },
  partially_paid: { label: 'Partial', className: 'bg-gradient-to-r from-violet-400 to-purple-500 text-white' },
  paid: { label: 'Paid', className: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gradient-to-r from-slate-400 to-zinc-500 text-white' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
