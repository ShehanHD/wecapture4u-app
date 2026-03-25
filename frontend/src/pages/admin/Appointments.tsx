import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, parseISO, addHours, formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus, CheckCircle2, XCircle, CalendarDays } from 'lucide-react'
import { useForm } from 'react-hook-form'
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
import { toast } from 'sonner'
import { useAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from '@/hooks/useAppointments'
import { useSessionTypes } from '@/hooks/useSettings'
import { useClients, useClient } from '@/hooks/useClients'
import { useBookingRequests, useUpdateBookingRequest } from '@/hooks/useBookingRequests'
import type { Appointment } from '@/schemas/appointments'
import type { Client } from '@/schemas/clients'
import type { BookingRequest } from '@/schemas/bookingRequests'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

const appointmentFormSchema = z.object({
  client_id: z.string().uuid('Select a client'),
  title: z.string().min(1, 'Title is required'),
  starts_at: z.string().min(1, 'Start date is required'),
  multi_day: z.boolean().default(false),
  ends_at: z.string().optional(),
  session_type_ids: z.array(z.string().uuid()).default([]),
  session_time: z.enum(['morning', 'afternoon', 'evening']).optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  addon_album: z.boolean().default(false),
  addon_thank_you_card: z.boolean().default(false),
  addon_enlarged_photos: z.boolean().default(false),
  deposit_paid: z.boolean().default(false),
  deposit_amount: z.string().optional(),
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
}

function AppointmentModal({ open, onClose, appointment, prefill, onCreated }: AppointmentModalProps) {
  const { data: sessionTypes = [] } = useSessionTypes()
  const { data: existingClient } = useClient(appointment?.client_id ?? '')
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: appointment
      ? {
          client_id: appointment.client_id,
          title: appointment.title,
          starts_at: appointment.starts_at.slice(0, 16),
          ends_at: appointment.ends_at?.slice(0, 16) ?? undefined,
          session_type_id: appointment.session_type_id,
          location: appointment.location,
          status: appointment.status,
          notes: appointment.notes,
        }
      : { status: 'pending' },
  })

  const clientId = watch('client_id')

  useEffect(() => {
    if (!open) return
    if (appointment) {
      reset({
        client_id: appointment.client_id,
        title: appointment.title,
        starts_at: appointment.starts_at.slice(0, 10),
        multi_day: !!appointment.ends_at,
        ends_at: appointment.ends_at?.slice(0, 10) ?? undefined,
        session_type_ids: appointment.session_type_ids ?? [],
        session_time: appointment.session_time ?? undefined,
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
        multi_day: false,
        session_type_ids: [],
        addon_album: false,
        addon_thank_you_card: false,
        addon_enlarged_photos: false,
        deposit_paid: false,
        contract_signed: false,
        ...prefill,
      })
    }
  }, [open, appointment?.id])

  const onSubmit = async (values: AppointmentFormValues) => {
    const addons: string[] = []
    if (values.addon_album) addons.push('album')
    if (values.addon_thank_you_card) addons.push('thank_you_card')
    if (values.addon_enlarged_photos) addons.push('enlarged_photos')

    const payload = {
      client_id: values.client_id,
      title: values.title,
      starts_at: new Date(values.starts_at).toISOString(),
      ends_at: values.multi_day && values.ends_at ? new Date(values.ends_at).toISOString() : null,
      session_type_ids: values.session_type_ids,
      session_time: values.session_time ?? null,
      location: values.location ?? null,
      status: values.status,
      addons,
      deposit_paid: values.deposit_paid,
      deposit_amount: values.deposit_amount || '0',
      contract_signed: values.contract_signed,
      price: values.price || '0',
      notes: values.notes ?? null,
    }
    if (appointment) {
      await updateMutation.mutateAsync({ id: appointment.id, payload })
    } else {
      await createMutation.mutateAsync(payload)
      onCreated?.()
    }
    reset()
    onClose()
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
                  key={appointment?.id ?? 'new'}
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

              {/* Dates */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="a_starts_at">Start date</Label>
                  <Input id="a_starts_at" type="date" {...register('starts_at')} className="bg-input border text-foreground mt-1" />
                  {errors.starts_at && <p className="text-xs text-red-400 mt-1">{errors.starts_at.message}</p>}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('multi_day')} className="rounded" />
                  <span className="text-sm text-foreground">Multi-day shoot</span>
                </label>
                {watch('multi_day') && (
                  <div>
                    <Label htmlFor="a_ends_at">End date</Label>
                    <Input id="a_ends_at" type="date" {...register('ends_at')} className="bg-input border text-foreground mt-1" />
                  </div>
                )}
              </div>

              {/* Session Time */}
              <div>
                <Label>Session time</Label>
                <div className="flex gap-3 mt-2 flex-wrap">
                  {(['morning', 'afternoon', 'evening'] as const).map(t => (
                    <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" value={t} {...register('session_time')} className="accent-[color:var(--brand-from)]" />
                      <span className="text-sm text-foreground capitalize">{t}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                    <input type="radio" value="" {...register('session_time')} className="accent-[color:var(--brand-from)]" />
                    <span className="text-sm text-muted-foreground">Any</span>
                  </label>
                </div>
                {prefill?.session_time && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Client preference: <span className="capitalize">{prefill.session_time}</span>
                  </p>
                )}
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
                <Select value={watch('status') ?? 'pending'} onValueChange={(v) => setValue('status', v as AppointmentFormValues['status'])}>
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

              {/* Session Types */}
              <div>
                <Label>Session types</Label>
                {sessionTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-2">No session types configured yet.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {sessionTypes.map(st => {
                      const ids: string[] = watch('session_type_ids') ?? []
                      return (
                        <label key={st.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ids.includes(st.id)}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...ids, st.id]
                                : ids.filter(id => id !== st.id)
                              setValue('session_type_ids', next)
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-foreground">{st.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground">Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {appointment ? 'Save changes' : 'Create appointment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
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

  if (isLoading) return null

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
        {requests.length === 0 ? (
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
  const [view, setView] = useState<'calendar' | 'list'>('list')
  const [calendarView, setCalendarView] = useState<View>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null)

  const [activeTab, setActiveTab] = useState<'appointments' | 'requests'>('appointments')
  const [confirmingRequest, setConfirmingRequest] = useState<BookingRequest | null>(null)
  const updateBookingRequest = useUpdateBookingRequest()

  const { data: appointments = [], isLoading } = useAppointments()
  const deleteMutation = useDeleteAppointment()

  const events = appointments.map(a => ({
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
      starts_at: confirmingRequest.preferred_date,
      session_type_ids: confirmingRequest.session_type_id ? [confirmingRequest.session_type_id] : [],
      addon_album: confirmingRequest.addons.includes('album'),
      addon_thank_you_card: confirmingRequest.addons.includes('thank_you_card'),
      addon_enlarged_photos: confirmingRequest.addons.includes('enlarged_photos'),
      notes: confirmingRequest.message ?? undefined,
      session_time: confirmingRequest.time_slot === 'all_day'
        ? undefined
        : (confirmingRequest.time_slot as 'morning' | 'afternoon' | 'evening'),
      status: 'confirmed' as const,
    }
  }, [confirmingRequest])

  const handleAppointmentCreated = () => {
    if (!confirmingRequest) return
    updateBookingRequest.mutate(
      { id: confirmingRequest.id, status: 'confirmed' },
      { onError: () => toast.error('Appointment created but could not confirm booking request') },
    )
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
        <div className="rounded-xl bg-card border p-4" style={{ height: 600 }}>
          <Calendar
            localizer={localizer}
            events={events}
            view={calendarView}
            onView={setCalendarView}
            onSelectEvent={(event) => openEdit(event.resource)}
            style={{ background: 'transparent' }}
          />
        </div>
      ) : (
        <div className="rounded-xl bg-card border overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading...</p>
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
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(a) }}
                        className="text-xs text-transparent bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text hover:opacity-80"
                      >
                        Delete
                      </button>
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
