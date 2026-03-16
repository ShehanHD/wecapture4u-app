import { api } from '@/lib/axios'
import { NotificationListSchema, NotificationSchema, type Notification } from '@/schemas/notifications'

export async function fetchNotifications(params?: {
  unread?: boolean
  type?: string
  limit?: number
}): Promise<Notification[]> {
  const { data } = await api.get('/api/notifications', { params })
  return NotificationListSchema.parse(data)
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await api.patch(`/api/notifications/${id}/read`)
  return NotificationSchema.parse(data)
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/api/notifications/read-all')
}
