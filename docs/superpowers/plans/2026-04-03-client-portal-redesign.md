# Client Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the weCapture4U client portal with a light-mode palette derived from the public portfolio site, a collapsible sidebar on desktop, bottom tabs on mobile, and new Notifications + Profile pages with avatar and password support.

**Architecture:** All UI changes are purely frontend (React/TypeScript). The backend already has `/api/profile/change-password`, `/api/profile/avatar`, and `/api/notifications` endpoints — only a minor schema tweak is needed to expose `avatar_url` from `ClientProfileOut`. New pages (Home merges Dashboard+Jobs, Booking replaces BookSession, Notifications is new) are added; old Dashboard/Jobs/BookSession/Profile pages are replaced in-place.

**Tech Stack:** React 18, TypeScript, TanStack Query, React Hook Form, Zod, React Router v6, Tailwind CSS (arbitrary values for pub palette), shadcn/ui Dialog, Lucide icons, date-fns.

---

## Design Palette Reference

All new components use these values (via Tailwind arbitrary values or inline styles):

| Token | Value |
|-------|-------|
| Page bg | `#f8f9ff` |
| Card / sidebar | `#ffffff` |
| Border | `#e0e8ff` |
| Active nav bg | `#f0f4ff` |
| Accent | `#4d79ff` |
| Accent light | `#7aa5ff` |
| Text primary | `#0a0e2e` |
| Text muted | `#778899` |
| Danger | `#e05252` |
| Danger border | `#fde0e0` |
| Input fill | `#f8f9ff` |
| Navy gradient | `linear-gradient(135deg, #0a0e2e, #1a3468)` |

---

## File Map

| File | Action |
|------|--------|
| `backend/schemas/client_portal.py` | Modify — add `avatar_url` to `ClientProfileOut` |
| `backend/routers/client_portal.py` | Modify — pass `avatar_url` in profile responses |
| `frontend/src/schemas/clientPortal.ts` | Modify — add `avatar_url`, fix `ClientBookingRequestSchema` |
| `frontend/src/api/clientPortal.ts` | Modify — add notifications + password + avatar fns, fix booking payload type |
| `frontend/src/hooks/useClientPortal.ts` | Modify — add notification + password + avatar hooks |
| `frontend/src/components/layout/ClientShell.tsx` | Replace — collapsible sidebar + mobile tabs |
| `frontend/src/pages/auth/ClientLogin.tsx` | Replace — light-mode floating card |
| `frontend/src/pages/auth/ClientRegister.tsx` | Replace — same card style |
| `frontend/src/pages/client/Home.tsx` | Create — merges Dashboard + Jobs |
| `frontend/src/pages/client/Booking.tsx` | Create — replaces BookSession |
| `frontend/src/pages/client/JobDetail.tsx` | Modify — restyle only |
| `frontend/src/pages/client/Notifications.tsx` | Create — new page |
| `frontend/src/pages/client/Profile.tsx` | Replace — avatar, dialogs |
| `frontend/src/routes/index.tsx` | Modify — update imports and paths |

---

### Task 1: Backend — expose avatar_url in ClientProfileOut

**Files:**
- Modify: `backend/schemas/client_portal.py`
- Modify: `backend/routers/client_portal.py`

- [ ] **Step 1: Add avatar_url to ClientProfileOut schema**

In `backend/schemas/client_portal.py`, change `ClientProfileOut`:

```python
class ClientProfileOut(BaseModel):
    name: str
    email: str
    phone: Optional[str]
    avatar_url: Optional[str] = None
```

- [ ] **Step 2: Pass avatar_url in both profile handlers**

In `backend/routers/client_portal.py`, find the two places that return `ClientProfileOut(...)` and add `avatar_url=user.avatar_url`:

```python
# GET /me  (line ~53)
return ClientProfileOut(name=user.full_name, email=user.email, phone=client.phone, avatar_url=user.avatar_url)

# PATCH /me  (line ~73)
return ClientProfileOut(name=user.full_name, email=user.email, phone=client.phone, avatar_url=user.avatar_url)
```

- [ ] **Step 3: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/schemas/client_portal.py backend/routers/client_portal.py
git commit -m "feat(client-portal): expose avatar_url in ClientProfileOut"
```

---

### Task 2: Frontend schema updates

**Files:**
- Modify: `frontend/src/schemas/clientPortal.ts`

- [ ] **Step 1: Add avatar_url to ClientProfileSchema, fix booking request schema**

Replace the entire content of `frontend/src/schemas/clientPortal.ts`:

```ts
// frontend/src/schemas/clientPortal.ts
import { z } from 'zod'

export const ClientProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  avatar_url: z.string().nullable().optional(),
})
export type ClientProfile = z.infer<typeof ClientProfileSchema>

export const ClientJobSchema = z.object({
  id: z.string().uuid(),
  delivery_url: z.string().nullable(),
  appointment_title: z.string(),
  appointment_starts_at: z.string(),
  stage_name: z.string(),
  stage_color: z.string(),
})
export type ClientJob = z.infer<typeof ClientJobSchema>
export const ClientJobListSchema = z.array(ClientJobSchema)

export const ClientJobStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  position: z.number().int(),
})
export type ClientJobStage = z.infer<typeof ClientJobStageSchema>

export const ClientJobDetailSchema = z.object({
  id: z.string().uuid(),
  delivery_url: z.string().nullable(),
  appointment_title: z.string(),
  appointment_starts_at: z.string(),
  appointment_session_types: z.array(z.string()),
  stage_id: z.string().uuid(),
  stage_name: z.string(),
  all_stages: z.array(ClientJobStageSchema),
})
export type ClientJobDetail = z.infer<typeof ClientJobDetailSchema>

export const SessionTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  available_days: z.array(z.number()).optional().default([]),
})
export type SessionType = z.infer<typeof SessionTypeSchema>
export const SessionTypeListSchema = z.array(SessionTypeSchema)

export const ClientBookingRequestSlotSchema = z.object({
  session_type_id: z.string().uuid(),
  session_type_name: z.string().nullable(),
  date: z.string(),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
})
export type ClientBookingRequestSlot = z.infer<typeof ClientBookingRequestSlotSchema>

export const ClientBookingRequestSchema = z.object({
  id: z.string().uuid(),
  preferred_date: z.string(),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']).nullable(),
  session_type_name: z.string().nullable(),
  session_slots: z.array(ClientBookingRequestSlotSchema).default([]),
  message: z.string().nullable(),
  status: z.enum(['pending', 'confirmed', 'rejected']),
  admin_notes: z.string().nullable(),
  created_at: z.string(),
})
export type ClientBookingRequest = z.infer<typeof ClientBookingRequestSchema>
export const ClientBookingRequestListSchema = z.array(ClientBookingRequestSchema)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/schemas/clientPortal.ts
git commit -m "feat(client-portal): add avatar_url to profile schema, fix booking request shape"
```

---

### Task 3: API layer — add notifications, password, avatar functions

**Files:**
- Modify: `frontend/src/api/clientPortal.ts`

- [ ] **Step 1: Replace the file with extended version**

```ts
// frontend/src/api/clientPortal.ts
import apiClient from '@/lib/axios'
import {
  ClientProfileSchema,
  ClientJobListSchema,
  ClientJobDetailSchema,
  SessionTypeListSchema,
  ClientBookingRequestListSchema,
  ClientBookingRequestSchema,
  type ClientProfile,
  type ClientJob,
  type ClientJobDetail,
  type SessionType,
  type ClientBookingRequest,
} from '@/schemas/clientPortal'
import { NotificationSchema, NotificationListSchema, type Notification } from '@/schemas/notifications'

export type { ClientProfile, ClientJob, ClientJobDetail, SessionType, ClientBookingRequest, Notification }

// ── Profile ──────────────────────────────────────────────────────────────────

export async function fetchMyProfile(): Promise<ClientProfile> {
  const { data } = await apiClient.get('/api/client/me')
  return ClientProfileSchema.parse(data)
}

export async function updateMyProfile(payload: { name?: string; phone?: string | null }): Promise<ClientProfile> {
  const { data } = await apiClient.patch('/api/client/me', payload)
  return ClientProfileSchema.parse(data)
}

export async function changePassword(payload: { current_password: string; new_password: string }): Promise<void> {
  await apiClient.post('/api/profile/change-password', payload)
}

export async function uploadAvatar(file: File): Promise<ClientProfile> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post('/api/profile/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  // /api/profile/avatar returns ProfileResponse shape; map to ClientProfile
  return ClientProfileSchema.parse({
    name: data.full_name,
    email: data.email,
    phone: data.phone ?? null,
    avatar_url: data.avatar_url ?? null,
  })
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export async function fetchMyJobs(): Promise<ClientJob[]> {
  const { data } = await apiClient.get('/api/client/jobs')
  return ClientJobListSchema.parse(data)
}

export async function fetchMyJob(id: string): Promise<ClientJobDetail> {
  const { data } = await apiClient.get(`/api/client/jobs/${id}`)
  return ClientJobDetailSchema.parse(data)
}

// ── Session types ─────────────────────────────────────────────────────────────

export async function fetchSessionTypes(): Promise<SessionType[]> {
  const { data } = await apiClient.get('/api/client/session-types')
  return SessionTypeListSchema.parse(data)
}

// ── Booking requests ──────────────────────────────────────────────────────────

export async function fetchMyBookingRequests(): Promise<ClientBookingRequest[]> {
  const { data } = await apiClient.get('/api/client/booking-requests')
  return ClientBookingRequestListSchema.parse(data)
}

export interface BookingSlotPayload {
  session_type_id: string
  date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
}

export interface BookingRequestCreatePayload {
  session_slots: BookingSlotPayload[]
  message?: string | null
}

export async function createBookingRequest(payload: BookingRequestCreatePayload): Promise<ClientBookingRequest> {
  const { data } = await apiClient.post('/api/client/booking-requests', payload)
  return ClientBookingRequestSchema.parse(data)
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await apiClient.get('/api/notifications')
  return NotificationListSchema.parse(data)
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await apiClient.patch(`/api/notifications/${id}/read`)
  return NotificationSchema.parse(data)
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/api/notifications/read-all')
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/clientPortal.ts
git commit -m "feat(client-portal): add notifications, password-change, avatar-upload API functions"
```

---

### Task 4: Hooks — add notification, password, avatar hooks

**Files:**
- Modify: `frontend/src/hooks/useClientPortal.ts`

- [ ] **Step 1: Replace the file with extended version**

```ts
// frontend/src/hooks/useClientPortal.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useClientPortal.ts
git commit -m "feat(client-portal): add notification, password-change, avatar hooks"
```

---

### Task 5: ClientShell — collapsible sidebar + mobile tabs

**Files:**
- Replace: `frontend/src/components/layout/ClientShell.tsx`

- [ ] **Step 1: Write the new ClientShell**

```tsx
// frontend/src/components/layout/ClientShell.tsx
import { useState, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell, CalendarPlus, ChevronLeft, ChevronRight,
  LayoutDashboard, LogOut, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMyProfile, useUnreadNotificationCount } from '@/hooks/useClientPortal'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/client', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/client/book', label: 'Booking', icon: CalendarPlus },
  { to: '/client/notifications', label: 'Notifications', icon: Bell },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function ClientShell() {
  const { logout } = useAuth()
  const { data: profile } = useMyProfile()
  const unreadCount = useUnreadNotificationCount()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('client-sidebar-collapsed') === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('client-sidebar-collapsed', String(next)) } catch { /* noop */ }
      return next
    })
  }

  const handleLogout = () => logout()

  const initials = profile?.name ? getInitials(profile.name) : '?'
  const avatarUrl = profile?.avatar_url ?? null

  return (
    <div className="min-h-screen flex" style={{ background: '#f8f9ff' }}>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen border-r"
        style={{
          width: collapsed ? 56 : 200,
          background: '#ffffff',
          borderColor: '#e0e8ff',
          transition: 'width 220ms ease',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 border-b flex-shrink-0"
          style={{ padding: collapsed ? '14px 0' : '14px 14px', borderColor: '#e0e8ff', justifyContent: collapsed ? 'center' : 'flex-start' }}
        >
          <div
            className="flex-shrink-0 rounded-[7px]"
            style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #4d79ff, #7aa5ff)' }}
          />
          {!collapsed && (
            <span className="text-[13px] font-[800] tracking-tight" style={{ color: '#0a0e2e' }}>
              weCapture4U
            </span>
          )}
        </div>

        {/* User card */}
        <div
          className={cn('border-b flex-shrink-0 cursor-pointer', collapsed ? 'flex justify-center py-3' : 'flex flex-col items-center gap-1.5 py-4 px-3')}
          style={{ borderColor: '#e0e8ff' }}
          onClick={() => navigate('/client/profile')}
        >
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile?.name}
                className="rounded-full object-cover"
                style={{ width: collapsed ? 34 : 52, height: collapsed ? 34 : 52, border: '2px solid #e0e8ff' }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center font-[800]"
                style={{
                  width: collapsed ? 34 : 52,
                  height: collapsed ? 34 : 52,
                  background: 'linear-gradient(135deg, rgba(77,121,255,0.15), rgba(122,165,255,0.2))',
                  border: '2px solid #e0e8ff',
                  color: '#4d79ff',
                  fontSize: collapsed ? 11 : 16,
                }}
              >
                {initials}
              </div>
            )}
            {/* Pencil dot when collapsed */}
            {collapsed && (
              <div
                className="absolute bottom-0 right-0 rounded-full flex items-center justify-center"
                style={{ width: 14, height: 14, background: '#4d79ff', border: '2px solid #fff' }}
              />
            )}
          </div>
          {!collapsed && (
            <>
              <span className="text-[13px] font-[700] text-center" style={{ color: '#0a0e2e' }}>
                {profile?.name ?? '—'}
              </span>
              <span className="text-[10px] font-[600]" style={{ color: '#4d79ff' }}>
                Edit profile →
              </span>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto" style={{ padding: collapsed ? '10px 0' : '10px 8px' }}>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-[8px] transition-colors',
                  collapsed ? 'justify-center mx-auto' : 'gap-2.5 px-[10px]',
                  isActive
                    ? 'bg-[#f0f4ff] text-[#4d79ff]'
                    : 'text-[#778899] hover:bg-[#f8f9ff]',
                )
              }
              style={{ height: 38, width: collapsed ? 40 : 'auto' }}
            >
              {({ isActive }) => (
                <>
                  <div className="relative flex-shrink-0">
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    {label === 'Notifications' && unreadCount > 0 && (
                      <span
                        className="absolute rounded-full"
                        style={{ top: -3, right: -3, width: 7, height: 7, background: '#e05252', border: '1.5px solid #fff' }}
                      />
                    )}
                  </div>
                  {!collapsed && (
                    <span className={cn('text-[13px]', isActive ? 'font-[600]' : 'font-[500]')}>
                      {label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* Logout — pushed to bottom */}
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center rounded-[8px] mt-auto transition-colors hover:bg-[#fff5f5]',
              collapsed ? 'justify-center mx-auto' : 'gap-2.5 px-[10px]',
            )}
            style={{ height: 38, width: collapsed ? 40 : 'auto', color: '#e05252', marginTop: 'auto' }}
          >
            <LogOut size={16} strokeWidth={2} />
            {!collapsed && <span className="text-[13px] font-[500]">Log out</span>}
          </button>
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center border-t flex-shrink-0 hover:bg-[#f8f9ff] transition-colors"
          style={{ height: 36, borderColor: '#e0e8ff', color: '#778899' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header
          className="md:hidden flex items-center justify-between border-b flex-shrink-0 px-4"
          style={{ height: 48, background: '#ffffff', borderColor: '#e0e8ff' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="rounded-[6px] flex-shrink-0"
              style={{ width: 22, height: 22, background: 'linear-gradient(135deg, #4d79ff, #7aa5ff)' }}
            />
            <span className="text-[13px] font-[800] tracking-tight" style={{ color: '#0a0e2e' }}>
              weCapture4U
            </span>
          </div>
          <button onClick={() => navigate('/client/profile')} className="rounded-full overflow-hidden" style={{ width: 28, height: 28 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile?.name} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-[700] text-[10px] rounded-full"
                style={{ background: '#f0f4ff', border: '1.5px solid #4d79ff', color: '#4d79ff' }}
              >
                {initials}
              </div>
            )}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="mx-auto max-w-2xl px-4 py-6">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-10"
          style={{ height: 62, background: '#ffffff', borderColor: '#e0e8ff' }}
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[9px] font-[500] transition-colors pt-2',
                  isActive ? 'text-[#4d79ff] font-[600]' : 'text-[#b0bfd8]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                    {label === 'Notifications' && unreadCount > 0 && (
                      <span
                        className="absolute rounded-full"
                        style={{ top: -2, right: -2, width: 7, height: 7, background: '#e05252', border: '1.5px solid #fff' }}
                      />
                    )}
                  </div>
                  {label === 'Notifications' ? 'Alerts' : label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[9px] font-[500] transition-colors pt-2"
            style={{ color: '#e05252' }}
          >
            <LogOut size={20} strokeWidth={1.8} />
            Log out
          </button>
        </nav>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the shell compiles**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors related to ClientShell. (Other errors from yet-to-be-updated imports are OK at this stage.)

- [ ] **Step 3: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/components/layout/ClientShell.tsx
git commit -m "feat(client-portal): collapsible sidebar desktop, bottom tabs mobile"
```

---

### Task 6: ClientLogin — light-mode floating card

**Files:**
- Replace: `frontend/src/pages/auth/ClientLogin.tsx`

- [ ] **Step 1: Write the new ClientLogin**

```tsx
// frontend/src/pages/auth/ClientLogin.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})
type FormData = z.infer<typeof schema>

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #e0e8ff',
  borderRadius: 9,
  background: '#f8f9ff',
  padding: '11px 14px',
  fontSize: 14,
  color: '#0a0e2e',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function ClientLogin() {
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      await login(data.email, data.password)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Login failed. Please try again.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Logo above card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4d79ff, #7aa5ff)', borderRadius: 8, flexShrink: 0 }} />
        <span style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>weCapture4U</span>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 380, background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 16, padding: '28px 28px 24px', boxShadow: '0 4px 20px rgba(77,121,255,0.07)' }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', marginBottom: 4 }}>Welcome back</p>
          <p style={{ fontSize: 13, color: '#778899' }}>Sign in to your client area</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#778899', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
            <input type="email" style={inputStyle} placeholder="you@example.com" {...register('email')} />
            {errors.email && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#778899', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</label>
            <input type="password" style={inputStyle} placeholder="••••••••" {...register('password')} />
            {errors.password && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
          </div>

          <div style={{ textAlign: 'right', marginTop: -4 }}>
            <Link to="/client/forgot-password" style={{ fontSize: 12, color: '#4d79ff', fontWeight: 600 }}>Forgot password?</Link>
          </div>

          {error && <p style={{ color: '#e05252', fontSize: 13, textAlign: 'center' }}>{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ width: '100%', background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px', borderRadius: 9, border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, marginTop: 4 }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#778899' }}>
          Don't have an account?{' '}
          <Link to="/client/register" style={{ color: '#4d79ff', fontWeight: 600 }}>Register</Link>
        </p>
      </div>

      <a href="/" style={{ marginTop: 20, fontSize: 12, color: '#778899' }}>← Back to website</a>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/auth/ClientLogin.tsx
git commit -m "feat(client-portal): restyle ClientLogin with light floating card"
```

---

### Task 7: ClientRegister — matching card style

**Files:**
- Replace: `frontend/src/pages/auth/ClientRegister.tsx`

- [ ] **Step 1: Write the new ClientRegister (logic unchanged, same card style as login)**

```tsx
// frontend/src/pages/auth/ClientRegister.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RegisterSchema, type RegisterFormData } from '@/schemas/auth'
import { useRegister, useResendVerification } from '@/hooks/useAuth'

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #e0e8ff',
  borderRadius: 9,
  background: '#f8f9ff',
  padding: '11px 14px',
  fontSize: 14,
  color: '#0a0e2e',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function ClientRegister() {
  const registerMutation = useRegister()
  const resendMutation = useResendVerification()
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [resendDone, setResendDone] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    await registerMutation.mutateAsync({ full_name: data.full_name, email: data.email, phone: data.phone, password: data.password })
    setSubmittedEmail(data.email)
    setSubmitted(true)
  }

  const handleResend = async () => {
    const email = submittedEmail || getValues('email')
    await resendMutation.mutateAsync(email)
    setResendDone(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4d79ff, #7aa5ff)', borderRadius: 8, flexShrink: 0 }} />
        <span style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>weCapture4U</span>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 380, background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 16, padding: '28px 28px 24px', boxShadow: '0 4px 20px rgba(77,121,255,0.07)' }}>
        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', marginBottom: 8 }}>Check your inbox</p>
            <p style={{ fontSize: 13, color: '#778899', marginBottom: 20 }}>
              We've sent a verification link to <strong style={{ color: '#0a0e2e' }}>{submittedEmail}</strong>.
            </p>
            {resendDone ? (
              <p style={{ fontSize: 13, color: '#4d79ff', fontWeight: 600 }}>New link sent!</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendMutation.isPending}
                style={{ background: 'none', border: 'none', color: '#4d79ff', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                {resendMutation.isPending ? 'Sending…' : "Didn't receive it? Resend"}
              </button>
            )}
            <div style={{ marginTop: 24 }}>
              <Link to="/client/login" style={{ fontSize: 13, color: '#778899' }}>← Back to sign in</Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', marginBottom: 4 }}>Create your account</p>
              <p style={{ fontSize: 13, color: '#778899' }}>Join weCapture4U to view your sessions</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(
                [
                  { name: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Sarah Johnson' },
                  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
                  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+44 7700 900123' },
                  { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
                  { name: 'confirm_password', label: 'Confirm Password', type: 'password', placeholder: '••••••••' },
                ] as const
              ).map(({ name, label, type, placeholder }) => (
                <div key={name}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#778899', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                  <input type={type} style={inputStyle} placeholder={placeholder} {...register(name)} />
                  {errors[name] && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{(errors[name] as { message?: string })?.message}</p>}
                </div>
              ))}

              {registerMutation.isError && (
                <p style={{ color: '#e05252', fontSize: 13, textAlign: 'center' }}>Registration failed. Please try again.</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || registerMutation.isPending}
                style={{ width: '100%', background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px', borderRadius: 9, border: 'none', cursor: (isSubmitting || registerMutation.isPending) ? 'not-allowed' : 'pointer', opacity: (isSubmitting || registerMutation.isPending) ? 0.7 : 1, marginTop: 4 }}
              >
                {(isSubmitting || registerMutation.isPending) ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#778899' }}>
              Already have an account?{' '}
              <Link to="/client/login" style={{ color: '#4d79ff', fontWeight: 600 }}>Sign in</Link>
            </p>
          </>
        )}
      </div>

      <a href="/" style={{ marginTop: 20, fontSize: 12, color: '#778899' }}>← Back to website</a>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/auth/ClientRegister.tsx
git commit -m "feat(client-portal): restyle ClientRegister with light floating card"
```

---

### Task 8: ClientHome — merged Dashboard + Jobs

**Files:**
- Create: `frontend/src/pages/client/Home.tsx`

- [ ] **Step 1: Create the new Home page**

```tsx
// frontend/src/pages/client/Home.tsx
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { format, parseISO, isAfter } from 'date-fns'
import { useMyJobs, useMyProfile } from '@/hooks/useClientPortal'
import type { ClientJob } from '@/schemas/clientPortal'

function stageBadgeStyle(color: string): React.CSSProperties {
  // Lighten the stage color for badge background
  return { background: `${color}22`, color, border: `1px solid ${color}44`, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }
}

function JobCard({ job }: { job: ClientJob }) {
  return (
    <Link
      to={`/client/jobs/${job.id}`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 12, padding: '13px 16px', textDecoration: 'none', transition: 'box-shadow 0.15s, border-color 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(77,121,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = '#c8d8ff' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.borderColor = '#e0e8ff' }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', marginBottom: 2 }}>{job.appointment_title}</p>
        <p style={{ fontSize: 11, color: '#778899' }}>{format(parseISO(job.appointment_starts_at), 'MMMM d, yyyy')}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {job.delivery_url && (
          <a
            href={job.delivery_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#4d79ff', fontWeight: 600, textDecoration: 'none' }}
          >
            <ExternalLink size={12} />
            Photos
          </a>
        )}
        <span style={stageBadgeStyle(job.stage_color)}>{job.stage_name}</span>
      </div>
    </Link>
  )
}

export function ClientHome() {
  const { data: jobs = [], isLoading } = useMyJobs()
  const { data: profile } = useMyProfile()

  const now = new Date()
  const sortedJobs = [...jobs].sort(
    (a, b) => parseISO(b.appointment_starts_at).getTime() - parseISO(a.appointment_starts_at).getTime(),
  )
  const nextSession = jobs
    .filter(j => isAfter(parseISO(j.appointment_starts_at), now))
    .sort((a, b) => parseISO(a.appointment_starts_at).getTime() - parseISO(b.appointment_starts_at).getTime())[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>
          Welcome back{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''} 👋
        </h1>
        <p style={{ fontSize: 13, color: '#778899', marginTop: 3 }}>Here's an overview of your sessions and photos.</p>
      </div>

      {/* Upcoming session banner */}
      {!isLoading && nextSession && (
        <div style={{ background: 'linear-gradient(135deg, #0a0e2e, #1a3468)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ display: 'inline-flex', background: 'rgba(77,121,255,0.2)', border: '1px solid rgba(77,121,255,0.35)', borderRadius: 999, padding: '2px 10px', fontSize: 10, color: '#7aa5ff', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 6 }}>
              📅 Upcoming session
            </span>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#f8f9ff' }}>{nextSession.appointment_title}</p>
            <p style={{ fontSize: 12, color: '#7aa5ff', marginTop: 2 }}>
              {format(parseISO(nextSession.appointment_starts_at), 'EEEE, MMMM d · h:mm a')}
            </p>
          </div>
          <Link
            to={`/client/jobs/${nextSession.id}`}
            style={{ background: '#4d79ff', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
          >
            View Details →
          </Link>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 64, background: '#e8f0ff', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {/* Jobs list */}
      {!isLoading && sortedJobs.length === 0 && (
        <div style={{ background: '#ffffff', border: '1.5px dashed #e0e8ff', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#778899', marginBottom: 12 }}>No sessions yet.</p>
          <Link
            to="/client/book"
            style={{ display: 'inline-block', background: '#4d79ff', color: '#fff', borderRadius: 9, padding: '8px 20px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
          >
            Book a session
          </Link>
        </div>
      )}

      {!isLoading && sortedJobs.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0a0e2e', marginBottom: 10 }}>Your Sessions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedJobs.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/client/Home.tsx
git commit -m "feat(client-portal): ClientHome page merges Dashboard + Jobs"
```

---

### Task 9: ClientBooking — restyled booking form

**Files:**
- Create: `frontend/src/pages/client/Booking.tsx`

- [ ] **Step 1: Create Booking.tsx (same logic as BookSession, new palette)**

```tsx
// frontend/src/pages/client/Booking.tsx
import { useFieldArray, useForm } from 'react-hook-form'
import { getDay, parseISO, format } from 'date-fns'
import { Plus, X } from 'lucide-react'
import { useCreateBookingRequest, useMyBookingRequests, useClientSessionTypes } from '@/hooks/useClientPortal'
import type { ClientBookingRequest } from '@/schemas/clientPortal'

interface SlotFormValue {
  session_type_id: string
  date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
}

interface BookingFormValues {
  slots: SlotFormValue[]
  message: string
}

const STATUS_LABELS: Record<ClientBookingRequest['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rejected: 'Not Available',
}

const STATUS_COLORS: Record<ClientBookingRequest['status'], { bg: string; color: string }> = {
  pending:   { bg: '#fff8e6', color: '#b07d00' },
  confirmed: { bg: '#e6f9f0', color: '#2ecc8a' },
  rejected:  { bg: '#fff0f0', color: '#e05252' },
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function isDateAllowed(dateStr: string, availableDays: number[]): boolean {
  if (!dateStr || availableDays.length === 0) return true
  const day = getDay(parseISO(dateStr))
  const normalized = day === 0 ? 6 : day - 1
  return availableDays.includes(normalized)
}

const selectStyle: React.CSSProperties = {
  height: 38, background: '#f8f9ff', border: '1.5px solid #e0e8ff', borderRadius: 8,
  padding: '0 10px', fontSize: 13, color: '#0a0e2e', outline: 'none', cursor: 'pointer', width: '100%',
}

const inputStyle: React.CSSProperties = {
  ...selectStyle, cursor: 'text',
}

export function ClientBooking() {
  const { control, register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } =
    useForm<BookingFormValues>({ defaultValues: { slots: [{ session_type_id: '', date: '', time_slot: 'morning' }], message: '' } })

  const { fields, append, remove } = useFieldArray({ control, name: 'slots' })
  const watchedSlots = watch('slots')

  const createRequest = useCreateBookingRequest()
  const { data: requests = [], isLoading: requestsLoading } = useMyBookingRequests()
  const { data: sessionTypes = [] } = useClientSessionTypes()

  const getAvailableDays = (id: string) => sessionTypes.find(s => s.id === id)?.available_days ?? []

  const onSubmit = async (values: BookingFormValues) => {
    await createRequest.mutateAsync({
      session_slots: values.slots.map(s => ({ session_type_id: s.session_type_id, date: s.date, time_slot: s.time_slot })),
      message: values.message || null,
    })
    reset({ slots: [{ session_type_id: '', date: '', time_slot: 'morning' }], message: '' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>Book a Session</h1>
        <p style={{ fontSize: 13, color: '#778899', marginTop: 3 }}>Choose your preferred dates and session types.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sessions</p>

        {fields.map((field, index) => {
          const slotTypeId = watchedSlots[index]?.session_type_id ?? ''
          const slotDate = watchedSlots[index]?.date ?? ''
          const availDays = getAvailableDays(slotTypeId)
          const dateAllowed = isDateAllowed(slotDate, availDays)
          const rawDay = slotDate ? getDay(parseISO(slotDate)) : 0
          const dayIdx = rawDay === 0 ? 6 : rawDay - 1

          return (
            <div key={field.id} style={{ background: '#f8f9ff', border: '1px solid #e0e8ff', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
                {/* Session type */}
                <div style={{ flex: 2, minWidth: 140 }}>
                  <select style={selectStyle} value={slotTypeId} onChange={e => setValue(`slots.${index}.session_type_id`, e.target.value)}>
                    <option value="">Select session type</option>
                    {sessionTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>

                {/* Date */}
                <div style={{ flex: 2, minWidth: 130 }}>
                  <input type="date" style={inputStyle} {...register(`slots.${index}.date`)} />
                  {slotDate && !dateAllowed && (
                    <p style={{ color: '#e05252', fontSize: 11, marginTop: 4 }}>
                      Not available on {DAY_NAMES[dayIdx]}.
                      {availDays.length > 0 && ` Available: ${availDays.map(d => DAY_NAMES[d].slice(0, 3)).join(', ')}`}
                    </p>
                  )}
                </div>

                {/* Time of day */}
                <div style={{ width: 120 }}>
                  <select style={selectStyle} value={watchedSlots[index]?.time_slot ?? 'morning'} onChange={e => setValue(`slots.${index}.time_slot`, e.target.value as SlotFormValue['time_slot'])}>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="all_day">All Day</option>
                  </select>
                </div>

                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(index)} style={{ height: 38, width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid #fde0e0', borderRadius: 8, cursor: 'pointer', color: '#e05252', flexShrink: 0 }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => append({ session_type_id: '', date: watchedSlots[0]?.date ?? '', time_slot: 'morning' })}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1.5px dashed #e0e8ff', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#4d79ff', cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          <Plus size={14} />
          Add session type
        </button>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#778899', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message (optional)</label>
          <textarea
            {...register('message')}
            placeholder="Any questions or notes for the photographer…"
            rows={3}
            style={{ width: '100%', background: '#f8f9ff', border: '1.5px solid #e0e8ff', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#0a0e2e', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ width: '100%', background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px', borderRadius: 9, border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? 'Submitting…' : 'Send Request'}
        </button>
      </form>

      {/* Past requests */}
      {!requestsLoading && requests.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0a0e2e', marginBottom: 10 }}>Your Requests</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map(req => (
              <div key={req.id} style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 12, padding: '13px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: req.session_slots.length > 0 ? 8 : 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e' }}>
                    {req.session_slots.length > 0 ? req.session_slots.map(s => s.session_type_name ?? 'Session').join(' + ') : 'Booking request'}
                  </p>
                  <span style={{ ...STATUS_COLORS[req.status], fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
                {req.session_slots.map((slot, i) => (
                  <p key={i} style={{ fontSize: 11, color: '#778899' }}>
                    {slot.session_type_name ?? 'Session'}: {format(parseISO(slot.date), 'MMMM d, yyyy')} — {slot.time_slot.replace('_', ' ')}
                  </p>
                ))}
                {req.admin_notes && (
                  <p style={{ fontSize: 12, color: '#778899', fontStyle: 'italic', marginTop: 6 }}>"{req.admin_notes}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/client/Booking.tsx
git commit -m "feat(client-portal): ClientBooking page with pub palette"
```

---

### Task 10: ClientJobDetail — restyle

**Files:**
- Modify: `frontend/src/pages/client/JobDetail.tsx`

- [ ] **Step 1: Replace JobDetail with pub-palette styled version**

```tsx
// frontend/src/pages/client/JobDetail.tsx
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useMyJob } from '@/hooks/useClientPortal'
import type { ClientJobStage } from '@/schemas/clientPortal'

function StageProgress({ stages, currentStageId }: { stages: ClientJobStage[]; currentStageId: string }) {
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  const currentIndex = sorted.findIndex(s => s.id === currentStageId)

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Progress</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {sorted.map((stage, i) => {
          const isActive = stage.id === currentStageId
          const isDone = i < currentIndex
          return (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: isActive ? stage.color : isDone ? `${stage.color}88` : '#e0e8ff', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: isActive ? '#0a0e2e' : '#778899', fontWeight: isActive ? 600 : 400 }}>{stage.name}</span>
              {i < sorted.length - 1 && <span style={{ color: '#c8d8ff', fontSize: 11, marginLeft: 2 }}>→</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ClientJobDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: job, isLoading } = useMyJob(id!)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to="/client" style={{ color: '#4d79ff', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </Link>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>Session Detail</h1>
      </div>

      {isLoading && <div style={{ height: 160, background: '#e8f0ff', borderRadius: 14, animation: 'pulse 1.5s infinite' }} />}

      {!isLoading && !job && <p style={{ color: '#e05252', fontSize: 13 }}>Session not found.</p>}

      {job && (
        <div style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 14, padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0a0e2e' }}>{job.appointment_title}</h2>
            <p style={{ fontSize: 13, color: '#778899', marginTop: 3 }}>
              {format(parseISO(job.appointment_starts_at), 'EEEE, MMMM d, yyyy')}
            </p>
            {job.appointment_session_types.length > 0 && (
              <p style={{ fontSize: 13, color: '#778899', marginTop: 2 }}>{job.appointment_session_types.join(', ')}</p>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f0f4ff', paddingTop: 16 }}>
            <StageProgress stages={job.all_stages} currentStageId={job.stage_id} />
          </div>

          {job.delivery_url && (
            <a
              href={job.delivery_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#4d79ff', color: '#fff', borderRadius: 9, padding: '12px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
            >
              <ExternalLink size={16} />
              View Your Photos
            </a>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/client/JobDetail.tsx
git commit -m "feat(client-portal): restyle ClientJobDetail with pub palette"
```

---

### Task 11: ClientNotifications — new page

**Files:**
- Create: `frontend/src/pages/client/Notifications.tsx`

- [ ] **Step 1: Create the Notifications page**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/client/Notifications.tsx
git commit -m "feat(client-portal): ClientNotifications page"
```

---

### Task 12: ClientProfile — full redesign with avatar + dialogs

**Files:**
- Replace: `frontend/src/pages/client/Profile.tsx`

- [ ] **Step 1: Write the new Profile page**

```tsx
// frontend/src/pages/client/Profile.tsx
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera } from 'lucide-react'
import { useMyProfile, useUpdateMyProfile, useChangePassword, useUploadAvatar } from '@/hooks/useClientPortal'

// ── Shared input style ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f8f9ff', border: '1.5px solid #e0e8ff',
  borderRadius: 9, padding: '10px 12px', fontSize: 13, color: '#0a0e2e',
  outline: 'none', boxSizing: 'border-box',
}

// ── Edit field dialog ───────────────────────────────────────────────────────
function EditDialog({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,46,0.3)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* On md+: center the dialog */}
      <style>{`@media (min-width: 768px) { .edit-dialog-inner { bottom: auto !important; border-radius: 14px !important; margin: auto; } }`}</style>
      <div
        className="edit-dialog-inner"
        style={{ background: '#ffffff', borderRadius: '20px 20px 0 0', padding: '16px 20px 28px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ width: 36, height: 4, background: '#e0e8ff', borderRadius: 2, margin: '0 auto 4px' }} />
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0a0e2e' }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

// ── Name dialog ─────────────────────────────────────────────────────────────
const nameSchema = z.object({ name: z.string().min(1, 'Name required') })

function EditNameDialog({ open, currentName, onClose }: { open: boolean; currentName: string; onClose: () => void }) {
  const updateProfile = useUpdateMyProfile()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(nameSchema), defaultValues: { name: currentName } })
  useEffect(() => { if (open) reset({ name: currentName }) }, [open, currentName, reset])

  const onSubmit = async ({ name }: { name: string }) => {
    await updateProfile.mutateAsync({ name })
    onClose()
  }
  return (
    <EditDialog open={open} onClose={onClose} title="Edit Name">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Full Name</label>
          <input style={inputStyle} autoFocus {...register('name')} />
          {errors.name && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{errors.name.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting} style={{ background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#778899', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>Cancel</button>
      </form>
    </EditDialog>
  )
}

// ── Phone dialog ─────────────────────────────────────────────────────────────
const phoneSchema = z.object({ phone: z.string() })

function EditPhoneDialog({ open, currentPhone, onClose }: { open: boolean; currentPhone: string; onClose: () => void }) {
  const updateProfile = useUpdateMyProfile()
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({ resolver: zodResolver(phoneSchema), defaultValues: { phone: currentPhone } })
  useEffect(() => { if (open) reset({ phone: currentPhone }) }, [open, currentPhone, reset])

  const onSubmit = async ({ phone }: { phone: string }) => {
    await updateProfile.mutateAsync({ phone: phone || null })
    onClose()
  }
  return (
    <EditDialog open={open} onClose={onClose} title="Edit Phone">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Phone Number</label>
          <input type="tel" style={inputStyle} autoFocus {...register('phone')} />
        </div>
        <button type="submit" disabled={isSubmitting} style={{ background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#778899', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>Cancel</button>
      </form>
    </EditDialog>
  )
}

// ── Password dialog ──────────────────────────────────────────────────────────
const pwSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'Min 8 characters'),
  confirm: z.string(),
}).refine(d => d.new_password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const changePassword = useChangePassword()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(pwSchema) })
  useEffect(() => { if (open) reset() }, [open, reset])

  const onSubmit = async (d: { current_password: string; new_password: string }) => {
    await changePassword.mutateAsync({ current_password: d.current_password, new_password: d.new_password })
    onClose()
  }
  return (
    <EditDialog open={open} onClose={onClose} title="Change Password">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(
          [
            { name: 'current_password', label: 'Current Password' },
            { name: 'new_password', label: 'New Password' },
            { name: 'confirm', label: 'Confirm New Password' },
          ] as const
        ).map(({ name, label }) => (
          <div key={name}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>{label}</label>
            <input type="password" style={inputStyle} autoFocus={name === 'current_password'} {...register(name)} />
            {errors[name] && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{(errors[name] as { message?: string })?.message}</p>}
          </div>
        ))}
        <button type="submit" disabled={isSubmitting} style={{ background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? 'Updating…' : 'Update Password'}
        </button>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#778899', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>Cancel</button>
      </form>
    </EditDialog>
  )
}

// ── Row item ─────────────────────────────────────────────────────────────────
function ProfileRow({ label, value, action, onAction, readOnly }: {
  label: string; value: string; action?: string; onAction?: () => void; readOnly?: boolean
}) {
  return (
    <div
      onClick={!readOnly ? onAction : undefined}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid #f8f9ff', cursor: readOnly ? 'default' : 'pointer' }}
    >
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: readOnly ? '#b0bfd8' : '#0a0e2e' }}>{value || '—'}</p>
      </div>
      {readOnly ? (
        <span style={{ fontSize: 10, color: '#b0bfd8', fontStyle: 'italic' }}>read-only</span>
      ) : (
        <span style={{ fontSize: 12, fontWeight: 600, color: '#4d79ff' }}>{action}</span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
type Dialog = 'name' | 'phone' | 'password' | null

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function ClientProfile() {
  const { data: profile } = useMyProfile()
  const uploadAvatar = useUploadAvatar()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [openDialog, setOpenDialog] = useState<Dialog>(null)

  const initials = profile?.name ? getInitials(profile.name) : '?'
  const avatarUrl = profile?.avatar_url ?? null

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadAvatar.mutate(file)
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>My Profile</h1>

      {/* Avatar + name + email */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '10px 0 4px' }}>
        <div style={{ position: 'relative' }}>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile?.name}
              style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #e0e8ff' }}
            />
          ) : (
            <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(77,121,255,0.15), rgba(122,165,255,0.2))', border: '2.5px solid #e0e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#4d79ff' }}>
              {initials}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: '#4d79ff', border: '2px solid #f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Camera size={10} color="white" strokeWidth={2.5} />
          </button>
        </div>
        <p style={{ fontSize: 15, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.01em' }}>{profile?.name ?? '—'}</p>
        <p style={{ fontSize: 12, color: '#778899' }}>{profile?.email ?? '—'}</p>
      </div>

      {/* Personal info section */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Personal Info</p>
        <div style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 12, overflow: 'hidden' }}>
          <ProfileRow label="Full Name" value={profile?.name ?? ''} action="Edit" onAction={() => setOpenDialog('name')} />
          <ProfileRow label="Phone" value={profile?.phone ?? ''} action="Edit" onAction={() => setOpenDialog('phone')} />
          <ProfileRow label="Email" value={profile?.email ?? ''} readOnly />
        </div>
      </div>

      {/* Security section */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Security</p>
        <div style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 12, overflow: 'hidden' }}>
          <ProfileRow label="Password" value="••••••••" action="Change" onAction={() => setOpenDialog('password')} />
        </div>
      </div>

      {/* Dialogs */}
      <EditNameDialog
        open={openDialog === 'name'}
        currentName={profile?.name ?? ''}
        onClose={() => setOpenDialog(null)}
      />
      <EditPhoneDialog
        open={openDialog === 'phone'}
        currentPhone={profile?.phone ?? ''}
        onClose={() => setOpenDialog(null)}
      />
      <ChangePasswordDialog
        open={openDialog === 'password'}
        onClose={() => setOpenDialog(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/client/Profile.tsx
git commit -m "feat(client-portal): ClientProfile redesign — avatar, row-based editing, dialogs"
```

---

### Task 13: Routes — update paths and imports

**Files:**
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Update routes to use new components and add /client/notifications + /client/profile**

```tsx
// Changes in frontend/src/routes/index.tsx
// 1. Replace ClientDashboard import with ClientHome
// 2. Replace BookSession import with ClientBooking
// 3. Remove ClientJobs import (merged into Home)
// 4. Add ClientNotifications import
// 5. Update route paths

// Replace these imports:
// import { ClientDashboard } from '@/pages/client/Dashboard'
// import { ClientJobs } from '@/pages/client/Jobs'
// import { BookSession } from '@/pages/client/BookSession'
// With:
import { ClientHome } from '@/pages/client/Home'
import { ClientBooking } from '@/pages/client/Booking'
import { ClientNotifications } from '@/pages/client/Notifications'
// Keep:
import { ClientJobDetail } from '@/pages/client/JobDetail'
import { ClientProfile } from '@/pages/client/Profile'

// Update the client route children from:
//   { index: true, element: <ClientDashboard /> },
//   { path: 'jobs', element: <ClientJobs /> },
//   { path: 'jobs/:id', element: <ClientJobDetail /> },
//   { path: 'book', element: <BookSession /> },
//   { path: 'profile', element: <ClientProfile /> },
// To:
//   { index: true, element: <ClientHome /> },
//   { path: 'jobs/:id', element: <ClientJobDetail /> },
//   { path: 'book', element: <ClientBooking /> },
//   { path: 'notifications', element: <ClientNotifications /> },
//   { path: 'profile', element: <ClientProfile /> },
```

Show the exact diff to apply to the client portal routes section:

The client routes section in the file currently looks like:
```tsx
{
  path: '/client',
  element: (
    <ClientRoute>
      <ClientShell />
    </ClientRoute>
  ),
  children: [
    { index: true, element: <ClientDashboard /> },
    { path: 'jobs', element: <ClientJobs /> },
    { path: 'jobs/:id', element: <ClientJobDetail /> },
    { path: 'book', element: <BookSession /> },
    { path: 'profile', element: <ClientProfile /> },
    { path: 'biometric/setup', element: <BiometricSetup /> },
  ],
},
```

Replace with:
```tsx
{
  path: '/client',
  element: (
    <ClientRoute>
      <ClientShell />
    </ClientRoute>
  ),
  children: [
    { index: true, element: <ClientHome /> },
    { path: 'jobs/:id', element: <ClientJobDetail /> },
    { path: 'book', element: <ClientBooking /> },
    { path: 'notifications', element: <ClientNotifications /> },
    { path: 'profile', element: <ClientProfile /> },
    { path: 'biometric/setup', element: <BiometricSetup /> },
  ],
},
```

Also remove the old import lines for `ClientDashboard`, `ClientJobs`, `BookSession` and add new ones.

- [ ] **Step 2: Run build to check for TypeScript errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm run build 2>&1 | grep -E "error TS|Error"
```

Expected: no errors. Fix any type errors before committing.

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/routes/index.tsx
git commit -m "feat(client-portal): update routes for new pages and nav structure"
```

---

### Task 14: Smoke test + final cleanup

- [ ] **Step 1: Start dev server and verify pages load**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm run dev
```

Verify by navigating to:
- `http://localhost:5173/client/login` — floating card on `#f8f9ff` bg
- `http://localhost:5173/client` — Home with welcome heading (after login)
- `http://localhost:5173/client/book` — Booking form
- `http://localhost:5173/client/notifications` — Notifications list
- `http://localhost:5173/client/profile` — Profile with avatar
- Sidebar collapse/expand on desktop
- Bottom tabs on mobile (resize browser)

- [ ] **Step 2: Remove old unused files**

```bash
cd /Users/don/Desktop/weCapture4U-app
# Only remove if no other imports exist for these files
git rm frontend/src/pages/client/Dashboard.tsx
git rm frontend/src/pages/client/Jobs.tsx
git rm frontend/src/pages/client/BookSession.tsx
```

- [ ] **Step 3: Final commit**

```bash
git add -u
git commit -m "chore(client-portal): remove superseded Dashboard, Jobs, BookSession pages"
```
