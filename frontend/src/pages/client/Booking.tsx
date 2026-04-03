import { useFieldArray, useForm } from 'react-hook-form'
import { getDay, parseISO, format } from 'date-fns'
import { Plus, X } from 'lucide-react'
import { useCreateBookingRequest, useMyBookingRequests, useClientSessionTypes } from '@/hooks/useClientPortal'
import type { ClientBookingRequest } from '@/schemas/clientPortal'

interface SlotFormValue {
  session_type_id: string
  date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
}

interface BookingFormValues {
  slots: SlotFormValue[]
  message: string
}

const STATUS_LABELS: Record<ClientBookingRequest['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rejected: 'Not Available',
}

const STATUS_COLORS: Record<ClientBookingRequest['status'], { bg: string; color: string }> = {
  pending:   { bg: '#fff8e6', color: '#b07d00' },
  confirmed: { bg: '#e6f9f0', color: '#2ecc8a' },
  rejected:  { bg: '#fff0f0', color: '#e05252' },
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function isDateAllowed(dateStr: string, availableDays: number[]): boolean {
  if (!dateStr || availableDays.length === 0) return true
  const day = getDay(parseISO(dateStr))
  const normalized = day === 0 ? 6 : day - 1
  return availableDays.includes(normalized)
}

const selectStyle: React.CSSProperties = {
  height: 38, background: '#f8f9ff', border: '1.5px solid #e0e8ff', borderRadius: 8,
  padding: '0 10px', fontSize: 13, color: '#0a0e2e', outline: 'none', cursor: 'pointer', width: '100%',
}

const inputStyle: React.CSSProperties = {
  ...selectStyle, cursor: 'text',
}

export function ClientBooking() {
  const { control, register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } =
    useForm<BookingFormValues>({ defaultValues: { slots: [{ session_type_id: '', date: '', time_slot: 'morning' }], message: '' } })

  const { fields, append, remove } = useFieldArray({ control, name: 'slots' })
  const watchedSlots = watch('slots')

  const createRequest = useCreateBookingRequest()
  const { data: requests = [], isLoading: requestsLoading } = useMyBookingRequests()
  const { data: sessionTypes = [] } = useClientSessionTypes()

  const getAvailableDays = (id: string) => sessionTypes.find(s => s.id === id)?.available_days ?? []

  const onSubmit = async (values: BookingFormValues) => {
    await createRequest.mutateAsync({
      session_slots: values.slots.map(s => ({ session_type_id: s.session_type_id, date: s.date, time_slot: s.time_slot })),
      message: values.message || null,
    })
    reset({ slots: [{ session_type_id: '', date: '', time_slot: 'morning' }], message: '' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>Book a Session</h1>
        <p style={{ fontSize: 13, color: '#778899', marginTop: 3 }}>Choose your preferred dates and session types.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sessions</p>

        {fields.map((field, index) => {
          const slotTypeId = watchedSlots[index]?.session_type_id ?? ''
          const slotDate = watchedSlots[index]?.date ?? ''
          const availDays = getAvailableDays(slotTypeId)
          const dateAllowed = isDateAllowed(slotDate, availDays)
          const rawDay = slotDate ? getDay(parseISO(slotDate)) : 0
          const dayIdx = rawDay === 0 ? 6 : rawDay - 1

          return (
            <div key={field.id} style={{ background: '#f8f9ff', border: '1px solid #e0e8ff', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
                {/* Session type */}
                <div style={{ flex: 2, minWidth: 140 }}>
                  <select style={selectStyle} value={slotTypeId} onChange={e => setValue(`slots.${index}.session_type_id`, e.target.value)}>
                    <option value="">Select session type</option>
                    {sessionTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>

                {/* Date */}
                <div style={{ flex: 2, minWidth: 130 }}>
                  <input type="date" style={inputStyle} {...register(`slots.${index}.date`)} />
                  {slotDate && !dateAllowed && (
                    <p style={{ color: '#e05252', fontSize: 11, marginTop: 4 }}>
                      Not available on {DAY_NAMES[dayIdx]}.
                      {availDays.length > 0 && ` Available: ${availDays.map(d => DAY_NAMES[d].slice(0, 3)).join(', ')}`}
                    </p>
                  )}
                </div>

                {/* Time of day */}
                <div style={{ width: 120 }}>
                  <select style={selectStyle} value={watchedSlots[index]?.time_slot ?? 'morning'} onChange={e => setValue(`slots.${index}.time_slot`, e.target.value as SlotFormValue['time_slot'])}>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="all_day">All Day</option>
                  </select>
                </div>

                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(index)} style={{ height: 38, width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid #fde0e0', borderRadius: 8, cursor: 'pointer', color: '#e05252', flexShrink: 0 }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => append({ session_type_id: '', date: watchedSlots[0]?.date ?? '', time_slot: 'morning' })}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1.5px dashed #e0e8ff', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#4d79ff', cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          <Plus size={14} />
          Add session type
        </button>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#778899', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message (optional)</label>
          <textarea
            {...register('message')}
            placeholder="Any questions or notes for the photographer…"
            rows={3}
            style={{ width: '100%', background: '#f8f9ff', border: '1.5px solid #e0e8ff', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#0a0e2e', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ width: '100%', background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px', borderRadius: 9, border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? 'Submitting…' : 'Send Request'}
        </button>
      </form>

      {/* Past requests */}
      {!requestsLoading && requests.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0a0e2e', marginBottom: 10 }}>Your Requests</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map(req => (
              <div key={req.id} style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 12, padding: '13px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: req.session_slots.length > 0 ? 8 : 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e' }}>
                    {req.session_slots.length > 0 ? req.session_slots.map(s => s.session_type_name ?? 'Session').join(' + ') : 'Booking request'}
                  </p>
                  <span style={{ ...STATUS_COLORS[req.status], fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
                {req.session_slots.map((slot, i) => (
                  <p key={i} style={{ fontSize: 11, color: '#778899' }}>
                    {slot.session_type_name ?? 'Session'}: {format(parseISO(slot.date), 'MMMM d, yyyy')} — {slot.time_slot.replace('_', ' ')}
                  </p>
                ))}
                {req.admin_notes && (
                  <p style={{ fontSize: 12, color: '#778899', fontStyle: 'italic', marginTop: 6 }}>"{req.admin_notes}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
