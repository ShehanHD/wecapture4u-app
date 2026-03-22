import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchAppointments, fetchAppointment,
  createAppointment, updateAppointment, deleteAppointment,
  type AppointmentCreatePayload,
} from '@/api/appointments'

export function useAppointments(params?: {
  status?: string
  session_type_id?: string
  start_date?: string
  end_date?: string
}) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: () => fetchAppointments(params),
  })
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ['appointments', id],
    queryFn: () => fetchAppointment(id),
    enabled: !!id,
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAppointment,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      if (variables.status === 'confirmed') {
        queryClient.invalidateQueries({ queryKey: ['jobs'] })
      }
      toast.success('Appointment created')
    },
    onError: () => toast.error('Failed to create appointment'),
  })
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AppointmentCreatePayload> }) =>
      updateAppointment(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      if (variables.payload.status === 'confirmed') {
        queryClient.invalidateQueries({ queryKey: ['jobs'] })
        toast.success('Appointment confirmed — job created automatically')
      } else {
        toast.success('Appointment updated')
      }
    },
    onError: () => toast.error('Failed to update appointment'),
  })
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment deleted')
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Cannot delete — a job is linked'
      toast.error(msg)
    },
  })
}
