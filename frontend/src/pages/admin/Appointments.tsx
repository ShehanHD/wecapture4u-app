import { useState, useMemo, useRef, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, type View, type ToolbarProps } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, parseISO, addHours, formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus, CheckCircle2, XCircle, CalendarDays, X, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from '@/hooks/useAppointments'
import { useSessionTypes } from '@/hooks/useSettings'
import { useClients, useClient } from '@/hooks/useClients'
import { useBookingRequests, useUpdateBookingRequest } from '@/hooks/useBookingRequests'
import type { Appointment } from '@/schemas/appointments'
import type { Client } from '@/schemas/clients'
import type { BookingRequest } from '@/schemas/bookingRequests'
import { SkeletonRow } from '@/components/ui/skeleton'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

const SessionSlotFormSchema = z.object({
  session_type_id: z.string().uuid('Select a session type'),
  date: z.string().min(1, 'Date is required'),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
  time: z.string().optional(),
})

const appointmentFormSchema = z.object({
  client_id: z.string().uuid('Select a client'),
  title: z.string().min(1, 'Title is required'),
  session_slots: z.array(SessionSlotFormSchema).min(1, 'At least one session slot is required'),
  location: z.string().optional().nullable(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  addon_album: z.boolean().default(false),
  addon_thank_you_card: z.boolean().default(false),
  addon_enlarged_photos: z.boolean().default(false),
  deposit_paid: z.boolean().default(false),
  deposit_amount: z.string().optional(),
  deposit_account_id: z.string().uuid().optional().nullable(),
  contract_signed: z.boolean().default(false),
  price: z.string().optional(),
  notes: z.string().optional().nullable(),
})

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>

function ClientCombobox({
  value,
  onChange,
  initialName,
}: {
  value: string
  onChange: (id: string) => void
  initialName?: string
}) {
  const [search, setSearch] = useState(initialName ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: clients = [] } = useClients(search.length >= 1 ? { search } : undefined)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (client: Client) => {
    onChange(client.id)
    setSearch(client.name)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onChange('') }}
        onClick={() => setOpen(true)}
        placeholder="Search client by name or email…"
        className="bg-input border text-foreground mt-1"
        autoComplete="off"
      />
      {open && clients.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {clients.map(c => (
            <li
              key={c.id}
              onMouseDown={() => select(c)}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted ${c.id === value ? 'text-brand-solid' : 'text-popover-foreground'}`}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-muted-foreground ml-2 text-xs">{c.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface AppointmentModalProps {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  prefill?: Partial<AppointmentFormValues>
  onCreated?: () => void
  onDelete?: (a: Appointment) => void
}

function AppointmentModal({ open, onClose, appointment, prefill, onCreated, onDelete }: AppointmentModalProps) {
  const { data: sessionTypes = [] } = useSessionTypes()
  const { data: existingClient } = useClient(appointment?.client_id ?? prefill?.client_id ?? '')
  const { data: allAppointments = [] } = useAppointments()
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: appointment
      ? {
          client_id: appointment.client_id,
          title: appointment.title,
          session_slots: appointment.session_slots.length > 0
            ? appointment.session_slots.map(s => ({
                session_type_id: s.session_type_id,
                date: s.date,
                time_slot: s.time_slot as 'morning' | 'afternoon' | 'evening' | 'all_day',
                time: s.time ?? undefined,
              }))
            : [{ session_type_id: '', date: '', time_slot: 'morning' as const, time: undefined }],
          location: appointment.location,
          status: appointment.status,
          notes: appointment.notes,
        }
      : {
          status: 'pending',
          session_slots: [{ session_type_id: '', date: '', time_slot: 'morning' as const, time: undefined }],
        },
  })

  const clientId = watch('client_id')

  const { fields: slotFields, append: appendSlot, remove: removeSlot } = useFieldArray({
    control,
    name: 'session_slots',
  })

  const isDateAllowed = (dateStr: string, availableDays: number[]): boolean => {
    if (!dateStr || availableDays.length === 0) return true
    const day = getDay(parseISO(dateStr)) // 0=Sun in date-fns
    const normalized = day === 0 ? 6 : day - 1  // convert to 0=Mon
    return availableDays.includes(normalized)
  }

  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  function deriveTimeSlot(time: string): 'morning' | 'afternoon' | 'evening' {
    const h = parseInt(time.split(':')[0], 10)
    if (h < 12) return 'morning'
    if (h < 17) return 'afternoon'
    return 'evening'
  }

  const getAvailableDays = (sessionTypeId: string): number[] => {
    const st = sessionTypes.find(s => s.id === sessionTypeId)
    return st?.available_days ?? []
  }

  useEffect(() => {
    if (!open) return
    if (appointment) {
      reset({
        client_id: appointment.client_id,
        title: appointment.title,
        session_slots: appointment.session_slots.length > 0
          ? appointment.session_slots.map(s => ({
              session_type_id: s.session_type_id,
              date: s.date,
              time_slot: s.time_slot as 'morning' | 'afternoon' | 'evening' | 'all_day',
              time: s.time ?? undefined,
            }))
          : [{ session_type_id: '', date: '', time_slot: 'morning' as const, time: undefined }],
        location: appointment.location ?? undefined,
        status: appointment.status,
        addon_album: appointment.addons.includes('album'),
        addon_thank_you_card: appointment.addons.includes('thank_you_card'),
        addon_enlarged_photos: appointment.addons.includes('enlarged_photos'),
        deposit_paid: appointment.deposit_paid,
        deposit_amount: appointment.deposit_amount ?? undefined,
        contract_signed: appointment.contract_signed,
        price: appointment.price ?? '0',
        notes: appointment.notes ?? undefined,
      })
    } else {
      reset({
        status: 'pending',
        session_slots: [{ session_type_id: '', date: '', time_slot: 'morning' as const, time: undefined }],
        addon_album: false,
        addon_thank_you_card: false,
        addon_enlarged_photos: false,
        deposit_paid: false,
        contract_signed: false,
        ...prefill,
      })
    }
  }, [open, appointment?.id])

  const onSubmit: SubmitHandler<AppointmentFormValues> = async (values) => {
    const addons: string[] = []
    if (values.addon_album) addons.push('album')
    if (values.addon_thank_you_card) addons.push('thank_you_card')
    if (values.addon_enlarged_photos) addons.push('enlarged_photos')

    const payload = {
      client_id: values.client_id,
      title: values.title,
      session_slots: values.session_slots,
      location: values.location ?? null,
      status: values.status,
      addons,
      deposit_paid: values.deposit_paid,
      deposit_amount: values.deposit_amount || '0',
      contract_signed: values.contract_signed,
      price: values.price || '0',
      notes: values.notes ?? null,
    }
    try {
      if (appointment) {
        await updateMutation.mutateAsync({ id: appointment.id, payload })
      } else {
        await createMutation.mutateAsync(payload)
        onCreated?.()
      }
      reset()
      onClose()
    } catch {
      // error is already surfaced via the mutation's onError toast
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-card border text-foreground sm:!max-w-5xl">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Two-column body */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* Client */}
              <div>
                <Label>Client</Label>
                <ClientCombobox
                  key={appointment?.id ?? prefill?.client_id ?? 'new'}
                  value={clientId ?? ''}
                  onChange={(id) => setValue('client_id', id, { shouldValidate: true })}
                  initialName={existingClient?.name}
                />
                {errors.client_id && <p className="text-xs text-red-400 mt-1">{errors.client_id.message}</p>}
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="a_title">Title</Label>
                <Input id="a_title" {...register('title')} className="bg-input border text-foreground mt-1" />
                {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title.message}</p>}
              </div>

              {/* Location */}
              <div>
                <Label htmlFor="a_location">Location</Label>
                <Input id="a_location" {...register('location')} className="bg-input border text-foreground mt-1" />
              </div>

            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-4">

              {/* Status */}
              <div>
                <Label>Status</Label>
                <Select value={watch('status') ?? 'pending'} onValueChange={(v) => setValue('status', v as AppointmentFormValues['status'], { shouldValidate: true })}>
                  <SelectTrigger className="bg-input border text-foreground mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border text-popover-foreground">
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Add-ons */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-brand">Add-ons</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('addon_album')} className="rounded" />
                  <span className="text-sm text-foreground">Album</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('addon_thank_you_card')} className="rounded" />
                  <span className="text-sm text-foreground">Thank you cards</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('addon_enlarged_photos')} className="rounded" />
                  <span className="text-sm text-foreground">Enlarged photos</span>
                </label>
              </div>

              {/* Pricing & Deposit */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-brand">Pricing &amp; Deposit</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="a_price">Job Price (€)</Label>
                    <Input
                      id="a_price"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('price')}
                      placeholder="0.00"
                      className="bg-input border text-foreground mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="a_deposit_amount">Deposit (€)</Label>
                    <Input
                      id="a_deposit_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('deposit_amount')}
                      placeholder="0.00"
                      className="bg-input border text-foreground mt-1"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('deposit_paid')} className="rounded" />
                  <span className="text-sm text-foreground">Deposit paid</span>
                </label>
              </div>

              {/* Contract */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('contract_signed')} className="rounded" />
                <span className="text-sm text-foreground">Contract signed</span>
              </label>

            </div>
          </div>

          {/* Session Slots */}
          <div className="space-y-3 sm:col-span-2">
            <Label>Sessions</Label>
            {slotFields.map((field, index) => {
              const slotTypeId = watch(`session_slots.${index}.session_type_id`)
              const slotDate = watch(`session_slots.${index}.date`)
              const availDays = getAvailableDays(slotTypeId)
              const dateAllowed = isDateAllowed(slotDate, availDays)
              const slotTime = watch(`session_slots.${index}.time`) ?? ''
              const slotTimeSlot = watch(`session_slots.${index}.time_slot`)

              const overlappingAppts = slotDate && slotTimeSlot
                ? allAppointments.filter(a =>
                    a.id !== appointment?.id &&
                    a.session_slots.some(s => s.date === slotDate && s.time_slot === slotTimeSlot)
                  )
                : []

              return (
                <div key={field.id}>
                  <div className="flex flex-wrap gap-2 items-start p-3 rounded-lg border border-border bg-muted/30">
                    {/* Session type */}
                    <div className="flex-1 min-w-[160px]">
                      <Select
                        value={watch(`session_slots.${index}.session_type_id`) || ''}
                        onValueChange={(v) => setValue(`session_slots.${index}.session_type_id`, v as string, { shouldValidate: true })}
                      >
                        <SelectTrigger className="bg-input border text-foreground h-9 text-sm">
                          <SelectValue>
                            {(value: string | null) => {
                              if (!value) return <span className="text-muted-foreground">Select session type</span>
                              return sessionTypes.find((st) => st.id === value)?.name ?? value
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-popover border text-popover-foreground">
                          {sessionTypes.map(st => (
                            <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.session_slots?.[index]?.session_type_id && (
                        <p className="text-xs text-red-400 mt-1">{errors.session_slots[index]?.session_type_id?.message}</p>
                      )}
                    </div>

                    {/* Date */}
                    <div className="flex-1 min-w-[140px]">
                      <Input
                        type="date"
                        {...register(`session_slots.${index}.date`)}
                        className="bg-input border text-foreground h-9 text-sm"
                      />
                      {slotDate && !dateAllowed && (
                        <p className="text-xs text-red-400 mt-1">
                          Not available on {DAY_NAMES[getDay(parseISO(slotDate)) === 0 ? 6 : getDay(parseISO(slotDate)) - 1]}.
                          Available: {availDays.map(d => DAY_NAMES[d].slice(0, 3)).join(', ')}
                        </p>
                      )}
                      {errors.session_slots?.[index]?.date && (
                        <p className="text-xs text-red-400 mt-1">{errors.session_slots[index]?.date?.message}</p>
                      )}
                    </div>

                    {/* All day checkbox */}
                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer whitespace-nowrap select-none self-center">
                      <input
                        type="checkbox"
                        checked={slotTimeSlot === 'all_day'}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setValue(`session_slots.${index}.time`, undefined)
                            setValue(`session_slots.${index}.time_slot`, 'all_day')
                          } else {
                            setValue(`session_slots.${index}.time_slot`, 'morning')
                          }
                        }}
                        className="h-3.5 w-3.5 rounded accent-brand"
                      />
                      All day
                    </label>

                    {/* Precise time — hidden when all_day */}
                    {slotTimeSlot !== 'all_day' && (
                      <div className="w-[120px]">
                        <Input
                          type="time"
                          value={slotTime}
                          onChange={(e) => {
                            const t = e.target.value
                            setValue(`session_slots.${index}.time`, t || undefined)
                            setValue(`session_slots.${index}.time_slot`, t ? deriveTimeSlot(t) : 'morning')
                          }}
                          className="bg-input border text-foreground h-9 text-sm"
                        />
                      </div>
                    )}

                    {/* Time of day — dropdown when no precise time, label when time is set */}
                    {slotTimeSlot !== 'all_day' && (
                      !slotTime ? (
                        <div className="w-[130px]">
                          <Select
                            value={slotTimeSlot}
                            onValueChange={(v) => setValue(`session_slots.${index}.time_slot`, v as 'morning' | 'afternoon' | 'evening')}
                          >
                            <SelectTrigger className="bg-input border text-foreground h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border text-popover-foreground">
                              <SelectItem value="morning">Morning</SelectItem>
                              <SelectItem value="afternoon">Afternoon</SelectItem>
                              <SelectItem value="evening">Evening</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="w-[130px] h-9 flex items-center px-2 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground capitalize">
                          {deriveTimeSlot(slotTime)}
                        </div>
                      )
                    )}

                    {/* Remove button */}
                    {slotFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-9 px-2"
                        onClick={() => removeSlot(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {overlappingAppts.length > 0 && (
                    <p className="text-xs text-yellow-500 mt-1 px-1">
                      ⚠ Overlaps with: {overlappingAppts.map(a => `"${a.title}"`).join(', ')} ({slotTimeSlot}, {slotDate})
                    </p>
                  )}
                </div>
              )
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const firstDate = watch('session_slots.0.date') ?? ''
                appendSlot({ session_type_id: '', date: firstDate, time_slot: 'morning', time: undefined })
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add session type
            </Button>
          </div>

          {/* Notes — full width */}
          <div>
            <Label htmlFor="a_notes">Notes</Label>
            <textarea
              id="a_notes"
              {...register('notes')}
              rows={3}
              className="w-full mt-1 rounded-md bg-input border text-foreground px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {appointment && onDelete ? (
              <button
                type="button"
                onClick={() => { onClose(); onDelete(appointment) }}
                className="text-sm text-transparent bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text hover:opacity-80"
              >
                Delete appointment
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground">Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {appointment ? 'Save changes' : 'Create appointment'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type CalendarEvent = { id: string; title: string; start: Date; end: Date; resource: Appointment }

function CalendarToolbar({ label, onNavigate, onView, view }: ToolbarProps<CalendarEvent>) {
  const views: View[] = ['month', 'week', 'day', 'agenda']
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onNavigate('PREV')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onNavigate('TODAY')}
          className="px-3 h-8 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Today
        </button>
        <button
          onClick={() => onNavigate('NEXT')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <span className="text-base font-semibold text-foreground tracking-tight">{label}</span>

      <div className="flex rounded-lg overflow-hidden border border-border">
        {views.map(v => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={`px-3 h-8 text-xs font-medium capitalize transition-colors ${
              view === v
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

const EVENT_COLORS: Record<string, { bg: string; color: string }> = {
  confirmed: { bg: 'var(--brand-from)', color: '#ffffff' },
  pending:   { bg: '#f59e0b',           color: '#ffffff' },
  cancelled: { bg: 'var(--muted-foreground)', color: 'var(--card)' },
}

function eventPropGetter(event: CalendarEvent) {
  const c = EVENT_COLORS[event.resource?.status] ?? EVENT_COLORS.pending
  return { style: { backgroundColor: c.bg, color: c.color } }
}

function generateICS(a: Appointment): string {
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const isAllDay = a.session_slots.length > 0 && a.session_slots.every(s => s.time_slot === 'all_day')

  let dtStart: string
  let dtEnd: string

  if (isAllDay) {
    const date = a.starts_at.slice(0, 10).replace(/-/g, '')
    const nextDay = new Date(a.starts_at)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    dtStart = `DTSTART;VALUE=DATE:${date}`
    dtEnd = `DTEND;VALUE=DATE:${nextDay.toISOString().slice(0, 10).replace(/-/g, '')}`
  } else {
    const start = new Date(a.starts_at)
    const end = a.ends_at ? new Date(a.ends_at) : new Date(start.getTime() + 60 * 60 * 1000)
    dtStart = `DTSTART:${start.toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`
    dtEnd = `DTEND:${end.toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//weCapture4U//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${a.id}@wecapture4u`,
    `DTSTAMP:${now}`,
    dtStart,
    dtEnd,
    `SUMMARY:${a.title}`,
  ]
  if (a.location) lines.push(`LOCATION:${a.location}`)
  if (a.notes) lines.push(`DESCRIPTION:${a.notes.replace(/\n/g, '\\n')}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

function openInCalendar(a: Appointment) {
  const url = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(generateICS(a))
  window.open(url, '_blank')
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  all_day: 'All Day',
}

const ADDON_LABELS: Record<string, string> = {
  album: 'Album',
  thank_you_card: 'Thank You Card',
  enlarged_photos: 'Enlarged Photos',
}

function RequestsTab({ onConfirm }: { onConfirm: (r: BookingRequest) => void }) {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'confirmed' | 'rejected'>('pending')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const { data: requests = [], isLoading } = useBookingRequests(statusFilter)
  const { data: sessionTypes = [] } = useSessionTypes()
  const updateRequest = useUpdateBookingRequest()

  const sessionTypeName = (id: string | null) =>
    id ? (sessionTypes.find(st => st.id === id)?.name ?? '—') : '—'

  const handleReject = () => {
    if (!rejectingId) return
    updateRequest.mutate(
      { id: rejectingId, status: 'rejected', admin_notes: rejectNotes || undefined },
      {
        onSettled: () => {
          setRejectingId(null)
          setRejectNotes('')
        },
      },
    )
  }

  const FILTERS = ['pending', 'confirmed', 'rejected'] as const

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex rounded-lg overflow-hidden border w-fit">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 text-sm capitalize ${statusFilter === f ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card border overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <p className="p-6 text-sm text-center text-muted-foreground">No {statusFilter} requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border">
              <tr className="text-left">
                <th className="px-4 py-3 text-muted-foreground font-medium">Client</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Preferred Date</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Time Slot</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Session Type</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Add-ons</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Message</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Submitted</th>
                {statusFilter === 'pending' && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{r.client_name}</td>
                  <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">
                    {format(new Date(r.preferred_date + 'T00:00:00'), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-foreground/80">{TIME_SLOT_LABELS[r.time_slot] ?? r.time_slot}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sessionTypeName(r.session_type_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.addons.length > 0 ? r.addons.map(a => ADDON_LABELS[a] ?? a).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                    {r.message
                      ? <span title={r.message}>{r.message.length > 60 ? r.message.slice(0, 60) + '\u2026' : r.message}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                  {statusFilter === 'pending' && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => onConfirm(r)}>Confirm</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRejectingId(r.id); setRejectNotes('') }}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject modal */}
      <Dialog open={!!rejectingId} onOpenChange={(o) => { if (!o) { setRejectingId(null); setRejectNotes('') } }}>
        <DialogContent className="bg-card border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject booking request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-notes">Notes to client (optional)</Label>
              <textarea
                id="reject-notes"
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                rows={3}
                placeholder="Reason for rejection\u2026"
                className="w-full mt-1 rounded-md bg-input border text-foreground px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setRejectingId(null); setRejectNotes('') }}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={updateRequest.isPending}
                onClick={handleReject}
              >
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function Appointments() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [calendarView, setCalendarView] = useState<View>('month')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null)

  const [activeTab, setActiveTab] = useState<'appointments' | 'requests'>('appointments')
  const [confirmingRequest, setConfirmingRequest] = useState<BookingRequest | null>(null)
  const updateBookingRequest = useUpdateBookingRequest()

  const { data: appointments = [], isLoading } = useAppointments()
  const deleteMutation = useDeleteAppointment()

  const events: CalendarEvent[] = appointments.map(a => ({
    id: a.id,
    title: a.title,
    start: parseISO(a.starts_at),
    end: a.ends_at ? parseISO(a.ends_at) : addHours(parseISO(a.starts_at), 1),
    resource: a,
  }))

  const openCreate = () => {
    setEditingAppointment(null)
    setModalOpen(true)
  }

  const openEdit = (a: Appointment) => {
    setEditingAppointment(a)
    setModalOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const requestPrefill = useMemo(() => {
    if (!confirmingRequest) return undefined
    return {
      client_id: confirmingRequest.client_id,
      session_slots: confirmingRequest.session_slots.length > 0
        ? confirmingRequest.session_slots.map(s => ({
            session_type_id: s.session_type_id,
            date: s.date,
            time_slot: s.time_slot,
          }))
        : [{
            session_type_id: '',
            date: String(confirmingRequest.preferred_date),
            time_slot: 'morning' as const,
          }],
      addon_album: confirmingRequest.addons.includes('album'),
      addon_thank_you_card: confirmingRequest.addons.includes('thank_you_card'),
      addon_enlarged_photos: confirmingRequest.addons.includes('enlarged_photos'),
      notes: confirmingRequest.message ?? undefined,
      status: 'confirmed' as const,
    }
  }, [confirmingRequest])

  const handleAppointmentCreated = () => {
    if (!confirmingRequest) return
    updateBookingRequest.mutate({ id: confirmingRequest.id, status: 'confirmed' })
    setConfirmingRequest(null)
  }

  const handleConfirmRequest = (request: BookingRequest) => {
    setConfirmingRequest(request)
    setEditingAppointment(null)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
              <CalendarDays className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Appointments</h1>
          </div>
        {activeTab === 'appointments' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border">
              <button
                onClick={() => setView('calendar')}
                className={`px-3 py-1.5 text-sm ${view === 'calendar' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Calendar
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-sm ${view === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                List
              </button>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              New Appointment
            </Button>
          </div>
        )}
      </div>

      <div className="flex rounded-lg overflow-hidden border w-fit">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-3 py-1.5 text-sm ${activeTab === 'appointments' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Appointments
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-3 py-1.5 text-sm ${activeTab === 'requests' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Requests
        </button>
      </div>

      {activeTab === 'appointments' ? (
      <>
      {view === 'calendar' ? (
        <div className="rounded-2xl bg-card border border-border p-5" style={{ height: 660 }}>
          <Calendar<CalendarEvent>
            localizer={localizer}
            events={events}
            view={calendarView}
            onView={setCalendarView}
            date={calendarDate}
            onNavigate={setCalendarDate}
            onSelectEvent={(event) => openEdit(event.resource)}
            eventPropGetter={eventPropGetter}
            components={{ toolbar: CalendarToolbar }}
            style={{ height: '100%' }}
          />
        </div>
      ) : (
        <div className="rounded-xl bg-card border overflow-hidden">
          {isLoading ? (
            <table className="w-full text-sm">
              <tbody>{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}</tbody>
            </table>
          ) : appointments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No appointments yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border">
                <tr className="text-left">
                  <th className="px-4 py-3 text-muted-foreground font-medium text-center">Title</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-center">Date</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-center">Status</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-center">Session type</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-center">Price</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-center">Deposit</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-center">Contract</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {appointments.map(a => (
                  <tr
                    key={a.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => openEdit(a)}
                  >
                    <td className="px-4 py-3 text-center">
                      <p className="text-foreground font-medium">{a.title}</p>
                      {a.location && <p className="text-xs text-muted-foreground mt-0.5">{a.location}</p>}
                    </td>
                    <td className="px-4 py-3 text-foreground/80 whitespace-nowrap text-center">
                      {format(parseISO(a.starts_at), 'MMM d, yyyy')}
                      {a.session_time && (
                        <span className="ml-1.5 text-muted-foreground capitalize">· {a.session_time}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-center">
                      {a.session_types.length > 0
                        ? a.session_types.map(st => st.name).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground/80 text-center">
                      {Number(a.price) > 0 ? `€${a.price}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        {a.deposit_paid
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : <XCircle className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        {a.contract_signed
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : <XCircle className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-6">
                        {a.status === 'confirmed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openInCalendar(a) }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Add to Calendar"
                          >
                            <CalendarPlus className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(a) }}
                          className="text-xs text-transparent bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text hover:opacity-80"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      </>
      ) : (
        <RequestsTab onConfirm={handleConfirmRequest} />
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setConfirmingRequest(null) }}
        appointment={editingAppointment}
        prefill={requestPrefill}
        onCreated={confirmingRequest ? handleAppointmentCreated : undefined}
        onDelete={(a) => setDeleteTarget(a)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete appointment?"
        description={`This will permanently delete "${deleteTarget?.title}". This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  )
}
