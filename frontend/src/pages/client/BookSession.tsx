// frontend/src/pages/client/BookSession.tsx
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateBookingRequest, useMyBookingRequests, useClientSessionTypes } from '@/hooks/useClientPortal'
import type { ClientBookingRequest } from '@/schemas/clientPortal'

interface BookingFormValues {
  preferred_date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
  session_type_id: string | null
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

export function BookSession() {
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<BookingFormValues>({
    defaultValues: { time_slot: 'morning', session_type_id: '__none__', message: '' },
  })
  const watchedValues = watch()
  const timeSlot = (watchedValues.time_slot || 'morning') as BookingFormValues['time_slot']
  const sessionTypeId = (watchedValues.session_type_id || '__none__') as string

  const createRequest = useCreateBookingRequest()
  const { data: requests = [], isLoading: requestsLoading } = useMyBookingRequests()
  const { data: sessionTypes = [] } = useClientSessionTypes()

  const onSubmit = async (values: BookingFormValues) => {
    const resolvedSessionTypeId = values.session_type_id === '__none__' ? null : values.session_type_id
    await createRequest.mutateAsync({
      preferred_date: values.preferred_date,
      time_slot: values.time_slot,
      session_type_id: resolvedSessionTypeId,
      message: values.message || null,
    })
    reset()
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Book a Session</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl bg-card border p-5 space-y-4">
        <div>
          <Label className="text-muted-foreground text-xs">Preferred Date</Label>
          <Input
            type="date"
            className="mt-1 bg-input border text-foreground"
            {...register('preferred_date', { required: true })}
          />
        </div>

        <div>
          <Label className="text-muted-foreground text-xs">Time of Day</Label>
          <Select
            value={timeSlot}
            onValueChange={(v) => setValue('time_slot', v as BookingFormValues['time_slot'])}
          >
            <SelectTrigger className="mt-1 bg-input border text-foreground">
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

        <div>
          <Label className="text-muted-foreground text-xs">Session Type (optional)</Label>
          <Select
            value={sessionTypeId!}
            onValueChange={(v) => setValue('session_type_id', v)}
          >
            <SelectTrigger className="mt-1 bg-input border text-foreground">
              <SelectValue>
                {(value: string | null) => {
                  if (!value || value === '__none__') return 'No preference'
                  return sessionTypes.find((st) => st.id === value)?.name ?? value
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border text-popover-foreground">
              <SelectItem value="__none__">No preference</SelectItem>
              {sessionTypes.map((st) => (
                <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-muted-foreground text-xs">Message (optional)</Label>
          <textarea
            rows={3}
            className="mt-1 w-full bg-input border rounded px-3 py-2 text-foreground resize-none block"
            placeholder="Any notes or special requests…"
            {...register('message')}
          />
        </div>

        <Button type="submit" disabled={isSubmitting || createRequest.isPending}>
          Submit Request
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Requests</h2>
        {requestsLoading && <div className="h-12 rounded-xl bg-muted animate-pulse" />}
        {!requestsLoading && requests.length === 0 && (
          <p className="text-muted-foreground text-sm">No requests yet.</p>
        )}
        {requests.map((req) => (
          <div key={req.id} className="rounded-xl bg-card border p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-foreground font-medium">
                {format(new Date(req.preferred_date + 'T00:00:00'), 'MMMM d, yyyy')} — {req.time_slot}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status]}`}>
                {STATUS_LABELS[req.status]}
              </span>
            </div>
            {req.session_type_name && (
              <p className="text-sm text-muted-foreground">{req.session_type_name}</p>
            )}
            {req.admin_notes && (
              <p className="text-sm text-muted-foreground italic">{req.admin_notes}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
