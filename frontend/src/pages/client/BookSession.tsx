// frontend/src/pages/client/BookSession.tsx
import { useFieldArray, useForm } from 'react-hook-form'
import { getDay, parseISO } from 'date-fns'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

const STATUS_COLORS: Record<ClientBookingRequest['status'], string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  confirmed: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function isDateAllowed(dateStr: string, availableDays: number[]): boolean {
  if (!dateStr || availableDays.length === 0) return true
  const day = getDay(parseISO(dateStr))
  const normalized = day === 0 ? 6 : day - 1
  return availableDays.includes(normalized)
}

export function BookSession() {
  const { control, register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } =
    useForm<BookingFormValues>({
      defaultValues: {
        slots: [{ session_type_id: '', date: '', time_slot: 'morning' }],
        message: '',
      },
    })

  const { fields, append, remove } = useFieldArray({ control, name: 'slots' })
  const watchedSlots = watch('slots')

  const createRequest = useCreateBookingRequest()
  const { data: requests = [], isLoading: requestsLoading } = useMyBookingRequests()
  const { data: sessionTypes = [] } = useClientSessionTypes()

  const getAvailableDays = (sessionTypeId: string) =>
    sessionTypes.find(s => s.id === sessionTypeId)?.available_days ?? []

  const onSubmit = async (values: BookingFormValues) => {
    await createRequest.mutateAsync({
      session_slots: values.slots.map(s => ({
        session_type_id: s.session_type_id,
        date: s.date,
        time_slot: s.time_slot,
      })),
      message: values.message || null,
    })
    reset({
      slots: [{ session_type_id: '', date: '', time_slot: 'morning' }],
      message: '',
    })
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Book a Session</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl bg-card border p-5 space-y-4">
        <div className="space-y-3">
          <Label>Sessions</Label>
          {fields.map((field, index) => {
            const slotTypeId = watchedSlots[index]?.session_type_id ?? ''
            const slotDate = watchedSlots[index]?.date ?? ''
            const availDays = getAvailableDays(slotTypeId)
            const dateAllowed = isDateAllowed(slotDate, availDays)

            return (
              <div key={field.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex flex-wrap gap-2 items-start">
                  {/* Session type */}
                  <div className="flex-1 min-w-[160px]">
                    <Select
                      value={slotTypeId || ''}
                      onValueChange={(v) => { if (v) setValue(`slots.${index}.session_type_id`, v) }}
                    >
                      <SelectTrigger className="bg-input border text-foreground h-9 text-sm">
                        <SelectValue placeholder="Select session type" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border text-popover-foreground">
                        {sessionTypes.map(st => (
                          <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date */}
                  <div className="flex-1 min-w-[140px] space-y-1">
                    <Input
                      type="date"
                      {...register(`slots.${index}.date`)}
                      className="bg-input border text-foreground h-9 text-sm"
                    />
                    {slotDate && !dateAllowed && (
                      <p className="text-xs text-red-400">
                        Not available on {DAY_NAMES[getDay(parseISO(slotDate)) === 0 ? 6 : getDay(parseISO(slotDate)) - 1]}.
                        {availDays.length > 0 && ` Available: ${availDays.map(d => DAY_NAMES[d].slice(0, 3)).join(', ')}`}
                      </p>
                    )}
                  </div>

                  {/* Time of day */}
                  <div className="w-[130px]">
                    <Select
                      value={watchedSlots[index]?.time_slot ?? 'morning'}
                      onValueChange={(v) => setValue(`slots.${index}.time_slot`, v as SlotFormValue['time_slot'])}
                    >
                      <SelectTrigger className="bg-input border text-foreground h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border text-popover-foreground">
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                        <SelectItem value="all_day">All Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-9 px-2"
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const firstDate = watchedSlots[0]?.date ?? ''
              append({ session_type_id: '', date: firstDate, time_slot: 'morning' })
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add session type
          </Button>
        </div>

        <div>
          <Label className="text-muted-foreground text-xs">Message (optional)</Label>
          <textarea
            {...register('message')}
            placeholder="Any questions or notes for the photographer…"
            rows={3}
            className="w-full mt-1 rounded-md bg-input border text-foreground px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Submitting…' : 'Send Request'}
        </Button>
      </form>

      {/* Past requests */}
      {!requestsLoading && requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Requests</h2>
          {requests.map(req => (
            <div key={req.id} className="rounded-xl bg-card border p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {req.session_slots.length > 0
                    ? req.session_slots.map(s => s.session_type_name ?? 'Session').join(' + ')
                    : 'Booking request'}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status]}`}>
                  {STATUS_LABELS[req.status]}
                </span>
              </div>
              {req.session_slots.map((slot, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {slot.session_type_name ?? 'Session'}: {slot.date} — {slot.time_slot.replace('_', ' ')}
                </p>
              ))}
              {req.admin_notes && (
                <p className="text-sm text-muted-foreground italic">"{req.admin_notes}"</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
