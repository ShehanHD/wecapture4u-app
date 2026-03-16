import { useState } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, parseISO, addHours } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus } from 'lucide-react'
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
import { useAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from '@/hooks/useAppointments'
import { useSessionTypes } from '@/hooks/useSettings'
import type { Appointment } from '@/schemas/appointments'

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
  starts_at: z.string().min(1, 'Start date/time is required'),
  ends_at: z.string().optional(),
  session_type_id: z.string().uuid().optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  notes: z.string().optional().nullable(),
})
type AppointmentFormValues = z.infer<typeof appointmentFormSchema>

interface AppointmentModalProps {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
}

function AppointmentModal({ open, onClose, appointment }: AppointmentModalProps) {
  const { data: sessionTypes = [] } = useSessionTypes()
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
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

  const onSubmit = async (values: AppointmentFormValues) => {
    const payload = {
      ...values,
      starts_at: new Date(values.starts_at).toISOString(),
      ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
    }
    if (appointment) {
      await updateMutation.mutateAsync({ id: appointment.id, payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-[#1a1a1a] border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="client_id">Client ID</Label>
            <Input
              id="client_id"
              {...register('client_id')}
              className="bg-zinc-900 border-zinc-700 text-white mt-1"
              placeholder="Client UUID"
            />
            {errors.client_id && <p className="text-xs text-red-400 mt-1">{errors.client_id.message}</p>}
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              {...register('title')}
              className="bg-zinc-900 border-zinc-700 text-white mt-1"
            />
            {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="starts_at">Start</Label>
              <Input
                id="starts_at"
                type="datetime-local"
                {...register('starts_at')}
                className="bg-zinc-900 border-zinc-700 text-white mt-1"
              />
              {errors.starts_at && <p className="text-xs text-red-400 mt-1">{errors.starts_at.message}</p>}
            </div>
            <div>
              <Label htmlFor="ends_at">End (optional)</Label>
              <Input
                id="ends_at"
                type="datetime-local"
                {...register('ends_at')}
                className="bg-zinc-900 border-zinc-700 text-white mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Session Type</Label>
              <Select
                onValueChange={(v) => setValue('session_type_id', v)}
                defaultValue={appointment?.session_type_id ?? undefined}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white mt-1">
                  <SelectValue placeholder="Any type" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  {sessionTypes.map(st => (
                    <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                onValueChange={(v) => setValue('status', v as AppointmentFormValues['status'])}
                defaultValue={appointment?.status ?? 'pending'}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              {...register('location')}
              className="bg-zinc-900 border-zinc-700 text-white mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-400">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-400 text-black font-medium"
            >
              {appointment ? 'Save changes' : 'Create appointment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Appointments() {
  const [view, setView] = useState<'calendar' | 'list'>('list')
  const [calendarView, setCalendarView] = useState<View>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Appointments</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-sm ${view === 'calendar' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-sm ${view === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              List
            </button>
          </div>
          <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-400 text-black font-medium">
            <Plus className="h-4 w-4 mr-1" />
            New Appointment
          </Button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-4" style={{ height: 600 }}>
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
        <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sm text-zinc-400">Loading...</p>
          ) : appointments.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">No appointments yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800">
                <tr className="text-left">
                  <th className="px-4 py-3 text-zinc-400 font-medium">Title</th>
                  <th className="px-4 py-3 text-zinc-400 font-medium">Start</th>
                  <th className="px-4 py-3 text-zinc-400 font-medium">Status</th>
                  <th className="px-4 py-3 text-zinc-400 font-medium">Type</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {appointments.map(a => (
                  <tr key={a.id} className="hover:bg-zinc-900/50">
                    <td className="px-4 py-3 text-white font-medium">{a.title}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {format(parseISO(a.starts_at), 'MMM d, yyyy · HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {a.session_type?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(a)}
                        className="text-xs text-zinc-400 hover:text-white mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="text-xs text-red-400 hover:text-red-300"
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

      <AppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        appointment={editingAppointment}
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
