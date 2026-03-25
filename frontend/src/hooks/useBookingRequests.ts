import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchBookingRequests, updateBookingRequest } from '@/api/bookingRequests'

export function useBookingRequests(status = 'pending') {
  return useQuery({
    queryKey: ['booking-requests', status],
    queryFn: () => fetchBookingRequests(status),
  })
}

export function useUpdateBookingRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; status: 'confirmed' | 'rejected'; admin_notes?: string }) =>
      updateBookingRequest(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] })
      toast.success(vars.status === 'confirmed' ? 'Booking confirmed' : 'Booking rejected')
    },
    onError: () => toast.error('Failed to update booking request'),
  })
}
