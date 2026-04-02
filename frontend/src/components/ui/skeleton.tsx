import { cn } from '@/lib/utils'

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton rounded-md', className)} style={style} />
}

/** A row of n skeleton cells for table loading states */
export function SkeletonRow({ cols, className }: { cols: number; className?: string }) {
  return (
    <tr className={className}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

/** Skeleton block that mimics a stat card */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-5 flex flex-col gap-3', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}
