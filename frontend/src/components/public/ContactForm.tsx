import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ContactFormSchema, type ContactForm as ContactFormData } from '../../schemas/portfolio'
import { useSubmitContact } from '../../hooks/usePortfolio'

interface Props {
  headline: string | null | undefined
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

  return (
    <section id="contact" className="py-16 px-4 bg-black">
      <p className="text-xs uppercase tracking-widest text-gray-400 text-center mb-4">Contact</p>
      <h2 className="text-white text-3xl font-bold text-center mb-10">
        {headline ?? 'Get in touch'}
      </h2>
      <div className="max-w-md mx-auto">
        {submitted ? (
          <p className="text-center text-amber-400 text-lg">Thanks! I'll be in touch soon.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {submitMutation.isError && (
              <p className="text-red-400 text-sm text-center">
                Something went wrong. Please try again.
              </p>
            )}
            <div>
              <input
                placeholder="Your name"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500"
                {...register('name')}
              />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <input
                type="email"
                placeholder="Email address"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500"
                {...register('email')}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <textarea
                rows={4}
                placeholder="Your message"
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500 resize-none"
                {...register('message')}
              />
              {errors.message && (
                <p className="text-red-400 text-xs mt-1">{errors.message.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold py-3 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
