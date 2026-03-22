import React from 'react'
import { cn } from '@/lib/utils'

// ─── Gradient presets ─────────────────────────────────────────────────────────

export const gradients = {
  amber:   '', // uses CSS .bg-brand / .bg-brand-br utility classes
  purple:  'from-violet-500 to-indigo-500',
  pink:    'from-pink-500 to-rose-400',
  cyan:    'from-cyan-400 to-blue-500',
  emerald: 'from-emerald-400 to-teal-500',
  coral:   'from-orange-400 to-pink-500',
} as const

export type GradientVariant = keyof typeof gradients

// ─── GradientStatCard ─────────────────────────────────────────────────────────
// Hero metric card with full gradient background

interface GradientStatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  gradient?: GradientVariant
  trend?: { value: string; up: boolean }
  className?: string
}

export function GradientStatCard({
  label,
  value,
  sub,
  icon,
  gradient = 'amber',
  trend,
  className,
}: GradientStatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-5 text-white shadow-lg',
        gradient === 'amber' ? 'bg-brand-br' : cn('bg-gradient-to-br', gradients[gradient]),
        className,
      )}
    >
      {/* Decorative circle */}
      <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -right-2 h-16 w-16 rounded-full bg-white/10" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-white/70">{label}</p>
          <p className="mt-1.5 text-3xl font-bold tracking-tight">{value}</p>
          {sub && <p className="mt-0.5 text-sm text-white/70">{sub}</p>}
          {trend && (
            <p className={cn('mt-2 text-xs font-medium', trend.up ? 'text-white' : 'text-white/70')}>
              {trend.up ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
// Clean card with a gradient icon badge — works in both light and dark

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  gradient?: GradientVariant
  className?: string
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  gradient = 'amber',
  className,
}: StatCardProps) {
  return (
    <div className={cn('rounded-2xl bg-card border border-border p-5 shadow-sm', className)}>
      <div className="flex items-center justify-between gap-3">
        {icon && (
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md',
              gradient === 'amber' ? 'bg-brand-br' : cn('bg-gradient-to-br', gradients[gradient]),
            )}
          >
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0 text-right">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── GlassCard ────────────────────────────────────────────────────────────────
// Frosted glass card — looks great over gradient backgrounds

interface GlassCardProps {
  children: React.ReactNode
  className?: string
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-5 text-white shadow-lg',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── GradientBadge ────────────────────────────────────────────────────────────

interface GradientBadgeProps {
  children: React.ReactNode
  gradient?: GradientVariant
  className?: string
}

export function GradientBadge({ children, gradient = 'amber', className }: GradientBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm',
        gradient === 'amber' ? 'bg-brand' : cn('bg-gradient-to-r', gradients[gradient]),
        className,
      )}
    >
      {children}
    </span>
  )
}

// ─── GradientButton ───────────────────────────────────────────────────────────

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  gradient?: GradientVariant
  size?: 'sm' | 'md' | 'lg'
}

export function GradientButton({
  children,
  gradient = 'amber',
  size = 'md',
  className,
  ...props
}: GradientButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white shadow-md',
        'transition-all duration-150 hover:opacity-90 hover:shadow-lg active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        gradient === 'amber' ? 'bg-brand' : cn('bg-gradient-to-r', gradients[gradient]),
        size === 'sm' && 'h-8 px-3.5 text-sm',
        size === 'md' && 'h-10 px-5 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── QuickActionCard ──────────────────────────────────────────────────────────

interface QuickActionCardProps {
  label: string
  description?: string
  icon?: React.ReactNode
  gradient?: GradientVariant
  onClick?: () => void
  className?: string
}

export function QuickActionCard({
  label,
  description,
  icon,
  gradient = 'purple',
  onClick,
  className,
}: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full rounded-2xl bg-card border border-border p-4 text-left shadow-sm',
        'transition-all duration-150 hover:shadow-md hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow',
              gradient === 'amber' ? 'bg-brand-br' : cn('bg-gradient-to-br', gradients[gradient]),
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="ml-auto text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
          →
        </div>
      </div>
    </button>
  )
}
