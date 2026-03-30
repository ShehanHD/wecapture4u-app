import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ContactFormSchema, type ContactForm as ContactFormData } from '../../schemas/portfolio'
import { useSubmitContact } from '../../hooks/usePortfolio'

interface Props {
  headline: string | null | undefined
}

const inputClass = [
  'w-full font-[inherit] text-[15px] rounded-[10px] px-3.5 py-3 outline-none transition-all duration-150',
  'bg-[#F5F5F7] border border-[#E8E8ED]',
  'text-[#1D1D1F] placeholder:text-[#AEAEB2]',
  'focus:border-[#1D1D1F] focus:shadow-[0_0_0_3px_rgba(29,29,31,0.08)]',
].join(' ')

export function ContactForm({ headline }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const submitMutation = useSubmitContact()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({ resolver: zodResolver(ContactFormSchema) })

  const onSubmit = async (data: ContactFormData) => {
    try {
      await submitMutation.mutateAsync(data)
      setSubmitted(true)
    } catch {}
  }

  return (
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-start">

          {/* Left: intro */}
          <div>
            <p className="text-xs font-semibold tracking-[0.1em] uppercase mb-3" style={{ color: '#6E6E73' }}>
              Contact
            </p>
            <h2 className="font-semibold mb-4 leading-tight" style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', letterSpacing: '-0.8px', color: '#1D1D1F' }}>
              {headline ?? "Let's create\nsomething together."}
            </h2>
            <p className="leading-relaxed mb-10" style={{ fontSize: 16, color: '#6E6E73', lineHeight: 1.75 }}>
              Whether it's a wedding, portrait session, or commercial project,
              I'd love to hear about your vision. Send me a message and I'll
              get back to you within 24 hours.
            </p>
          </div>

          {/* Right: form */}
          <div>
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: '#F5F5F7' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D1D1F" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="font-medium mb-1" style={{ color: '#1D1D1F' }}>Message sent</p>
                <p className="text-sm" style={{ color: '#6E6E73' }}>I'll be in touch soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {submitMutation.isError && (
                  <p className="text-sm text-red-500">Something went wrong. Please try again.</p>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#6E6E73' }}>Your name</label>
                  <input placeholder="Jane Murphy" className={inputClass} {...register('name')} />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#6E6E73' }}>Email</label>
                  <input type="email" placeholder="jane@example.com" className={inputClass} {...register('email')} />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#6E6E73' }}>Message</label>
                  <textarea
                    rows={5}
                    placeholder="Tell me about your vision…"
                    className={`${inputClass} resize-none`}
                    {...register('message')}
                  />
                  {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full text-sm font-medium py-3.5 rounded-full text-white transition-opacity duration-150 hover:opacity-80 disabled:opacity-50 mt-2"
                  style={{ background: '#1D1D1F' }}
                >
                  {isSubmitting ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}
