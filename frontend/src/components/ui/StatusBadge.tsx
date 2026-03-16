import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Appointment statuses
  pending: { label: 'Pending', className: 'bg-amber-500 text-black' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-500 text-white' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500 text-white' },
  // Invoice statuses
  draft: { label: 'Draft', className: 'bg-zinc-600 text-white' },
  sent: { label: 'Sent', className: 'bg-blue-500 text-white' },
  partially_paid: { label: 'Partial', className: 'bg-amber-500 text-black' },
  paid: { label: 'Paid', className: 'bg-emerald-500 text-white' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-zinc-500 text-white' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
