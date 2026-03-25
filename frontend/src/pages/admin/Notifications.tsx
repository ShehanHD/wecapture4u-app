import { useState } from 'react'
import { Bell, Cake, Receipt } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
} from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import type { Notification } from '@/schemas/notifications'

function typeIcon(type: string) {
  if (type === 'birthday') return <Cake className="h-4 w-4 shrink-0 text-muted-foreground" />
  if (type === 'invoice_overdue') return <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
  return <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
}

export function Notifications() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const params = {
    limit: 100,
    ...(unreadOnly ? { unread: true as const } : {}),
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
  }

  const { data: notifications, isLoading } = useNotifications(params)
  const unreadCount = useUnreadCount()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  if (isLoading) return null

  const list = notifications ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Notifications</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={unreadOnly}
            onClick={() => setUnreadOnly(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${unreadOnly ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${unreadOnly ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm cursor-pointer" onClick={() => setUnreadOnly(v => !v)}>Unread only</span>
        </div>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'all')}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="appointment_reminder">Appointment Reminders</SelectItem>
            <SelectItem value="birthday">Birthdays</SelectItem>
            <SelectItem value="invoice_overdue">Invoice Overdue</SelectItem>
          </SelectContent>
        </Select>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification list */}
      <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
        {list.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No notifications</p>
        ) : (
          list.map((n: Notification) => (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3',
                !n.read && 'bg-muted/40'
              )}
            >
              <div className="mt-0.5">{typeIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', n.read && 'text-muted-foreground')}>
                  {n.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              {!n.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  aria-label={`Mark "${n.title}" as read`}
                  onClick={() => markRead.mutate(n.id)}
                  disabled={markRead.variables === n.id && markRead.isPending}
                >
                  Mark read
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
