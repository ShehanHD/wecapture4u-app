// frontend/src/hooks/useClientPortal.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchMyProfile,
  updateMyProfile,
  fetchMyJobs,
  fetchMyJob,
  fetchSessionTypes,
  fetchMyBookingRequests,
  createBookingRequest,
  type BookingRequestCreatePayload,
} from '@/api/clientPortal'

export function useMyProfile() {
  return useQuery({ queryKey: ['client-profile'], queryFn: fetchMyProfile })
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-profile'] })
      toast.success('Profile updated')
    },
    onError: () => toast.error('Failed to update profile'),
  })
}

export function useMyJobs() {
  return useQuery({ queryKey: ['client-jobs'], queryFn: fetchMyJobs })
}

export function useMyJob(id: string) {
  return useQuery({
    queryKey: ['client-jobs', id],
    queryFn: () => fetchMyJob(id),
    enabled: !!id,
  })
}

export function useClientSessionTypes() {
  return useQuery({ queryKey: ['client-session-types'], queryFn: fetchSessionTypes })
}

export function useMyBookingRequests() {
  return useQuery({ queryKey: ['client-booking-requests'], queryFn: fetchMyBookingRequests })
}

export function useCreateBookingRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: BookingRequestCreatePayload) => createBookingRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-booking-requests'] })
      toast.success('Booking request submitted!')
    },
    onError: () => toast.error('Failed to submit booking request'),
  })
}
