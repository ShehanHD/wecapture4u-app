// frontend/src/components/public/StatsSection.tsx
import { DEFAULT_STATS } from '@/schemas/portfolio'
import type { StatItem } from '@/schemas/portfolio'

export function StatsSection({ stats }: { stats?: StatItem[] }) {
  const items = stats && stats.length > 0 ? stats : DEFAULT_STATS

  return (
    <section style={{ background: 'var(--pub-light)', padding: '64px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {items.map((stat, i) => (
            <div key={i} style={{ background: 'var(--pub-card)', border: '1px solid var(--pub-border)', borderRadius: 16, padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--pub-navy)', lineHeight: 1 }}>
                {stat.value}<span style={{ color: 'var(--pub-accent)' }}>{stat.accent}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--pub-muted)', lineHeight: 1.4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
