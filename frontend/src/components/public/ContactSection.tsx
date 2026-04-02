import { ContactForm } from './ContactForm'

interface Props {
  headline?: string | null
}

export function ContactSection({ headline }: Props) {
  return (
    <section
      id="contact"
      style={{ background: 'var(--pub-light)', padding: '72px 24px' }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--pub-navy)', marginBottom: 8 }}>
            Contact Us
          </h2>
          <p style={{ fontSize: 14, color: 'var(--pub-muted)' }}>
            Fill in the form and I'll get back to you within 24 hours
          </p>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 8px 40px rgba(77,121,255,0.08)',
            padding: '36px 32px',
          }}
        >
          <ContactForm headline={headline} />
        </div>
      </div>
    </section>
  )
}
