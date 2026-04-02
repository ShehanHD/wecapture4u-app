// frontend/src/components/public/StatsSection.tsx
const STATS = [
  { value: '500', accent: '+', label: 'Sessions completed' },
  { value: '10', accent: '+', label: 'Years of experience' },
  { value: '5', accent: ' ★', label: 'Average client rating' },
  { value: '48', accent: 'h', label: 'Photo delivery time' },
]

export function StatsSection() {
  return (
    <section
      style={{ background: 'var(--pub-light)', padding: '64px 24px' }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              style={{
                background: 'var(--pub-card)',
                border: '1px solid var(--pub-border)',
                borderRadius: 16,
                padding: '28px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: 'var(--pub-navy)',
                  lineHeight: 1,
                }}
              >
                {stat.value}
                <span style={{ color: 'var(--pub-accent)' }}>{stat.accent}</span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: 'var(--pub-muted)',
                  lineHeight: 1.4,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
