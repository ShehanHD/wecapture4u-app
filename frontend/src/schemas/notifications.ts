import { z } from 'zod'

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  read: z.boolean(),
  sent_email: z.boolean(),
  created_at: z.string(),
})

export type Notification = z.infer<typeof NotificationSchema>

export const NotificationListSchema = z.array(NotificationSchema)
