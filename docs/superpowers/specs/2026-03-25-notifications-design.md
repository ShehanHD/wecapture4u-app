# Admin Notifications Page — Design Spec

**Goal:** Build the `/admin/notifications` full-history page with filtering and mark-read actions.

**Date:** 2026-03-25

---

## Architecture

Frontend-only. All backend endpoints, Zod schemas, API functions, and TanStack Query hooks are already implemented and working. Work is exclusively the page component and route wiring.

**Existing infrastructure:**
- Backend: `GET /api/notifications` (params: `unread`, `type`, `limit`), `PATCH /api/notifications/{id}/read`, `POST /api/notifications/read-all`
- Frontend schemas: `NotificationSchema`, `NotificationListSchema` in `frontend/src/schemas/notifications.ts`
- Frontend API: `fetchNotifications`, `markNotificationRead`, `markAllNotificationsRead` in `frontend/src/api/notifications.ts`
- Frontend hooks: `useNotifications(params?)`, `useUnreadCount`, `useMarkRead`, `useMarkAllRead` in `frontend/src/hooks/useNotifications.ts`

---

## File Map

| File | Change |
|---|---|
| `frontend/src/pages/admin/Notifications.tsx` | New — full notifications page |
| `frontend/src/routes/index.tsx` | Replace placeholder at `path: 'notifications'` with `<Notifications />` |

---

## Page: `/admin/notifications`

### Filter bar

Displayed at the top of the page, inline row:

- **"Unread only" toggle** — when on, passes `unread: true` to `useNotifications`; when off, omits `unread`
- **Type dropdown** — options:
  - "All types" → omit `type` param
  - "Appointment Reminders" → `type: 'appointment_reminder'`
  - "Birthdays" → `type: 'birthday'`
  - "Invoice Overdue" → `type: 'invoice_overdue'`
- **"Mark all read" button** — visible only when `useUnreadCount() > 0`; calls `useMarkAllRead().mutate()`

### Notification list

`useNotifications({ unread?: true, type?: string, limit: 100 })` — hook already refetches every 30s.

Each row:
- **Left:** type icon (`Bell` for appointment_reminder, `Cake` for birthday, `Receipt` for invoice_overdue, `Bell` as fallback)
- **Middle:** `title` (bold, slightly dimmed if read), `body` (muted text, text-sm), relative timestamp (`formatDistanceToNow` from date-fns, addSuffix: true)
- **Right:** "Mark read" button (ghost, small) — only rendered when `!notification.read`; calls `useMarkRead().mutate(id)`
- **Row background:** `bg-muted/40` when `!notification.read`, transparent when read

### Empty state

When list is empty (after filters applied): centered message "No notifications" with muted text.

### Loading state

While query is loading: render nothing (consistent with other pages in the app).

---

## Error Handling

- `useMarkRead` and `useMarkAllRead` already handle errors with `toast.error` in the hook — no additional error handling needed in the page component.

---

## Testing

No new backend or frontend unit tests needed — all endpoints already tested, hooks already wired up. The page is pure UI composition.
