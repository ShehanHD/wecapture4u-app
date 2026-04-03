// frontend/src/hooks/useClientPortal.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import axios from 'axios'
import {
  fetchMyProfile,
  updateMyProfile,
  changePassword,
  uploadAvatar,
  fetchMyJobs,
  fetchMyJob,
  fetchSessionTypes,
  fetchMyBookingRequests,
  createBookingRequest,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
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

export function useChangePassword() {
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => toast.success('Password updated'),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : undefined
      toast.error(msg ?? 'Failed to update password')
    },
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-profile'] })
      toast.success('Photo updated')
    },
    onError: () => toast.error('Failed to upload photo'),
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

export function useNotifications() {
  return useQuery({ queryKey: ['client-notifications'], queryFn: fetchNotifications })
}

export function useUnreadNotificationCount() {
  const { data = [] } = useNotifications()
  return data.filter(n => !n.read).length
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-notifications'] }),
  })
}
