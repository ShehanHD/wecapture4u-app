# Notifications Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/notifications` full-history page with filter bar (unread toggle + type dropdown + mark-all-read) and a notification list with per-item mark-read actions.

**Architecture:** Frontend-only page. All backend endpoints, Zod schemas, API functions, and TanStack Query hooks already exist. Work is exclusively the page component and route wiring.

**Tech Stack:** React 18, TypeScript strict, TanStack Query (`useNotifications`, `useUnreadCount`, `useMarkRead`, `useMarkAllRead`), shadcn/ui (`Select`, `Button`, `Switch`), lucide-react icons, date-fns `formatDistanceToNow`

---

## File Map

| File | Change |
|---|---|
| `frontend/src/pages/admin/Notifications.tsx` | New — full notifications page |
| `frontend/src/routes/index.tsx` | Replace placeholder at `path: 'notifications'` with `<Notifications />` |

---

### Task 1: Create the Notifications page component

**Files:**
- Create: `frontend/src/pages/admin/Notifications.tsx`

No tests needed per spec — pure UI composition on top of already-tested hooks.

- [ ] **Step 1: Create the file**

```tsx
import React, { useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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

  const params: { unread?: boolean; type?: string; limit: number } = { limit: 100 }
  if (unreadOnly) params.unread = true
  if (typeFilter !== 'all') params.type = typeFilter

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
          <Switch
            id="unread-only"
            checked={unreadOnly}
            onCheckedChange={setUnreadOnly}
          />
          <Label htmlFor="unread-only" className="text-sm cursor-pointer">
            Unread only
          </Label>
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
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
                  onClick={() => markRead.mutate(n.id)}
                  disabled={markRead.isPending}
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
```

- [ ] **Step 2: Verify the file compiles (lint check)**

Run: `cd /Users/don/Desktop/weCapture4U-app/frontend && npm run lint 2>&1 | grep -E "Notifications|error" | head -20`

Expected: No errors for `Notifications.tsx`

- [ ] **Step 3: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/pages/admin/Notifications.tsx
git commit -m "feat: add admin Notifications page with filter bar and mark-read actions"
```

---

### Task 2: Wire the route

**Files:**
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Add import and replace placeholder**

In `frontend/src/routes/index.tsx`:

1. Add import after the other admin page imports:
```tsx
import { Notifications } from '@/pages/admin/Notifications'
```

2. Replace:
```tsx
{ path: 'notifications', element: <div className="text-white">Notifications — Plan 7</div> },
```
With:
```tsx
{ path: 'notifications', element: <Notifications /> },
```

- [ ] **Step 2: Verify lint passes**

Run: `cd /Users/don/Desktop/weCapture4U-app/frontend && npm run lint 2>&1 | grep -E "error|warning" | head -20`

Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/routes/index.tsx
git commit -m "feat: wire /admin/notifications route to Notifications page"
```
