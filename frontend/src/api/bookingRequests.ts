import { api } from '@/lib/axios'
import {
  BookingRequestSchema,
  BookingRequestListSchema,
  type BookingRequest,
} from '@/schemas/bookingRequests'

export async function fetchBookingRequests(status = 'pending'): Promise<BookingRequest[]> {
  const { data } = await api.get('/api/booking-requests', { params: { status } })
  return BookingRequestListSchema.parse(data)
}

export async function updateBookingRequest(
  id: string,
  payload: { status: 'confirmed' | 'rejected'; admin_notes?: string },
): Promise<BookingRequest> {
  const { data } = await api.patch(`/api/booking-requests/${id}`, payload)
  return BookingRequestSchema.parse(data)
}
