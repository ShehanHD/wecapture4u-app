// frontend/src/pages/client/Notifications.tsx
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Bell } from 'lucide-react'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useClientPortal'

export function ClientNotifications() {
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>Notifications</h1>
          {unreadCount > 0 && (
            <p style={{ fontSize: 13, color: '#778899', marginTop: 2 }}>{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            style={{ background: 'none', border: '1px solid #e0e8ff', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#4d79ff', cursor: 'pointer' }}
          >
            Mark all read
          </button>
        )}
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ height: 64, background: '#e8f0ff', borderRadius: 12 }} />)}
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <div style={{ background: '#ffffff', border: '1.5px dashed #e0e8ff', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <Bell size={28} style={{ color: '#e0e8ff', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13, color: '#778899' }}>No notifications yet.</p>
        </div>
      )}

      {!isLoading && notifications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => { if (!n.read) markRead.mutate(n.id) }}
              style={{
                background: n.read ? '#ffffff' : '#f0f4ff',
                border: `1px solid ${n.read ? '#e0e8ff' : '#c8d8ff'}`,
                borderRadius: 12,
                padding: '13px 16px',
                cursor: n.read ? 'default' : 'pointer',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.read ? '#e0e8ff' : '#4d79ff', flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: '#0a0e2e', marginBottom: 2 }}>{n.title}</p>
                <p style={{ fontSize: 12, color: '#778899' }}>{n.body}</p>
              </div>
              <span style={{ fontSize: 10, color: '#b0bfd8', flexShrink: 0, marginTop: 2 }}>
                {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
