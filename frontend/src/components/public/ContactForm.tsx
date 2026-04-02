import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ContactFormSchema, type ContactForm as ContactFormData } from '../../schemas/portfolio'
import { useSubmitContact } from '../../hooks/usePortfolio'

interface Props {
  headline?: string | null
}

export function ContactForm({ headline }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const submitMutation = useSubmitContact()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(ContactFormSchema),
  })

  const onSubmit = async (data: ContactFormData) => {
    try {
      await submitMutation.mutateAsync(data)
      setSubmitted(true)
    } catch {}
  }

  const inputStyle = {
    width: '100%',
    border: '1.5px solid var(--pub-border)',
    borderRadius: 10,
    background: 'var(--pub-light)',
    padding: '12px 16px',
    fontSize: 14,
    color: 'var(--pub-navy)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  if (submitted) {
    return (
      <p style={{ textAlign: 'center', color: 'var(--pub-accent)', fontSize: 16, padding: '20px 0' }}>
        Thanks! I'll be in touch soon.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {headline && (
        <p style={{ fontSize: 14, color: 'var(--pub-muted)', marginBottom: 4 }}>{headline}</p>
      )}
      {submitMutation.isError && (
        <p style={{ color: '#e53e3e', fontSize: 13, textAlign: 'center' }}>
          Something went wrong. Please try again.
        </p>
      )}

      <div>
        <input placeholder="Your name" style={inputStyle} {...register('name')} />
        {errors.name && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.name.message}</p>}
      </div>

      <div>
        <input type="email" placeholder="Email address" style={inputStyle} {...register('email')} />
        {errors.email && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
      </div>

      <div>
        <input type="tel" placeholder="Phone number (optional)" style={inputStyle} {...register('phone')} />
        {errors.phone && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.phone.message}</p>}
      </div>

      <div>
        <textarea
          rows={4}
          placeholder="Your message"
          style={{ ...inputStyle, resize: 'none' }}
          {...register('message')}
        />
        {errors.message && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          width: '100%',
          background: 'var(--pub-accent)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          padding: '14px',
          borderRadius: 10,
          border: 'none',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          opacity: isSubmitting ? 0.6 : 1,
        }}
      >
        {isSubmitting ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
