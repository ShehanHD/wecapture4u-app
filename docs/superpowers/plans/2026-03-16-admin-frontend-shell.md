# weCapture4U — Admin Frontend: Shell, Dashboard & Appointments

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin frontend foundation — the AdminShell layout (top nav + notification bell), Dashboard page (revenue chart, stat cards, upcoming appointments), and Appointments page (calendar/list toggle with create/edit modal).

**Architecture:** Domain-scoped Zod schemas in `src/schemas/`, typed API functions in `src/api/`, TanStack Query hooks in `src/hooks/`. AdminShell wraps all `/admin/*` routes via React Router outlet. Notification bell polls every 30s for unread count. Dashboard uses Recharts for the revenue bar chart. Appointments uses react-big-calendar for the calendar view and a modal form.

**Depends on:** Plan 1 (Frontend scaffold — Vite, Tailwind, shadcn/ui, Axios instance, QueryClient), Plan 2 (Auth — AdminRoute guard, useAuth hook, Axios interceptors with refresh queue), Plans 3 & 4 (Backend APIs available).

**Tech Stack:** React 18 + TypeScript, TanStack Query v5, Zod, react-hook-form, Recharts, react-big-calendar, shadcn/ui, Tailwind CSS, date-fns.

---

## File Structure

```
frontend/src/
  schemas/
    notifications.ts      # Zod schemas for notification API responses
    settings.ts           # Zod schemas for app_settings and session_types
    appointments.ts       # Zod schemas for appointments
    dashboard.ts          # Zod schemas for dashboard stats response
  api/
    notifications.ts      # Typed API functions — /api/notifications
    settings.ts           # /api/settings, /api/session-types
    appointments.ts       # /api/appointments
    dashboard.ts          # /api/dashboard (stats aggregated from multiple endpoints)
  hooks/
    useNotifications.ts   # TanStack Query hooks for notifications (bell + page)
    useSettings.ts        # app_settings + session_types hooks
    useAppointments.ts    # appointments CRUD hooks
  components/
    layout/
      AdminShell.tsx      # Top nav, notification bell popover, avatar dropdown, outlet
    ui/
      StatusBadge.tsx     # Reusable status badge (appointment status, invoice status)
      ConfirmDialog.tsx   # Reusable confirmation dialog (used across admin pages)
  pages/
    admin/
      Dashboard.tsx       # /admin — stats, revenue chart, upcoming appointments
      Appointments.tsx    # /admin/appointments — calendar/list + create/edit modal
  routes/
    index.tsx             # Updated: wrap /admin/* in AdminShell, add Dashboard + Appointments
```

---

## Chunk 1: API Layer

### Task 1: Zod schemas + API functions for notifications, settings, appointments

**Files:**
- Create: `frontend/src/schemas/notifications.ts`
- Create: `frontend/src/schemas/settings.ts`
- Create: `frontend/src/schemas/appointments.ts`
- Create: `frontend/src/schemas/dashboard.ts`
- Create: `frontend/src/api/notifications.ts`
- Create: `frontend/src/api/settings.ts`
- Create: `frontend/src/api/appointments.ts`
- Create: `frontend/src/api/dashboard.ts`
- Create: `frontend/src/schemas/__tests__/admin.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/schemas/__tests__/admin.test.ts
import { NotificationSchema } from '../notifications'
import { AppSettingsSchema, SessionTypeSchema } from '../settings'
import { AppointmentSchema } from '../appointments'

describe('NotificationSchema', () => {
  it('parses a valid notification', () => {
    const result = NotificationSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      type: 'appointment_reminder',
      title: 'Reminder',
      body: 'You have an appointment',
      read: false,
      sent_email: true,
      created_at: '2026-01-01T08:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('AppointmentSchema', () => {
  it('parses a valid appointment', () => {
    const result = AppointmentSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      client_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      session_type_id: null,
      session_type: null,
      title: 'Wedding shoot',
      starts_at: '2026-06-01T10:00:00Z',
      ends_at: null,
      location: null,
      status: 'pending',
      addons: [],
      deposit_paid: false,
      deposit_amount: '0.00',
      deposit_account_id: null,
      contract_signed: false,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = AppointmentSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      client_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      title: 'Test',
      starts_at: '2026-06-01T10:00:00Z',
      status: 'invalid_status',
      addons: [],
      deposit_paid: false,
      deposit_amount: '0',
      contract_signed: false,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd frontend
npm test -- --testPathPattern=schemas/__tests__/admin
```
Expected: `Cannot find module '../notifications'`.

- [ ] **Step 3: Create `frontend/src/schemas/notifications.ts`**

```typescript
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
```

- [ ] **Step 4: Create `frontend/src/schemas/settings.ts`**

```typescript
import { z } from 'zod'

export const AppSettingsSchema = z.object({
  id: z.number(),
  tax_enabled: z.boolean(),
  tax_rate: z.string(),
  pdf_invoices_enabled: z.boolean(),
  updated_at: z.string(),
})

export type AppSettings = z.infer<typeof AppSettingsSchema>

export const SessionTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
})

export type SessionType = z.infer<typeof SessionTypeSchema>

export const SessionTypeListSchema = z.array(SessionTypeSchema)
```

- [ ] **Step 5: Create `frontend/src/schemas/appointments.ts`**

```typescript
import { z } from 'zod'

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled'] as const
const VALID_ADDONS = ['album', 'thank_you_card', 'enlarged_photos'] as const

export const SessionTypeSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const AppointmentSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  session_type_id: z.string().uuid().nullable(),
  session_type: SessionTypeSummarySchema.nullable().optional(),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  location: z.string().nullable(),
  status: z.enum(VALID_STATUSES),
  addons: z.array(z.enum(VALID_ADDONS)),
  deposit_paid: z.boolean(),
  deposit_amount: z.string(),
  deposit_account_id: z.string().uuid().nullable(),
  contract_signed: z.boolean(),
  notes: z.string().nullable(),
  created_at: z.string(),
})

export type Appointment = z.infer<typeof AppointmentSchema>

export const AppointmentListSchema = z.array(AppointmentSchema)
```

- [ ] **Step 6: Create `frontend/src/schemas/dashboard.ts`**

```typescript
import { z } from 'zod'

export const DashboardStatsSchema = z.object({
  revenue_this_month: z.number(),
  active_jobs: z.number(),
  total_clients: z.number(),
  unpaid_invoices_total: z.number(),
})

export type DashboardStats = z.infer<typeof DashboardStatsSchema>

export const MonthlyRevenueSchema = z.object({
  month: z.string(),   // e.g. '2026-01'
  revenue: z.number(),
})

export const RevenueChartSchema = z.array(MonthlyRevenueSchema)
export type MonthlyRevenue = z.infer<typeof MonthlyRevenueSchema>
```

- [ ] **Step 7: Create `frontend/src/api/notifications.ts`**

```typescript
import { api } from '@/lib/axios'
import { NotificationListSchema, NotificationSchema, type Notification } from '@/schemas/notifications'

export async function fetchNotifications(params?: {
  unread?: boolean
  type?: string
  limit?: number
}): Promise<Notification[]> {
  const { data } = await api.get('/notifications', { params })
  return NotificationListSchema.parse(data)
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await api.patch(`/notifications/${id}/read`)
  return NotificationSchema.parse(data)
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all')
}
```

- [ ] **Step 8: Create `frontend/src/api/settings.ts`**

```typescript
import { api } from '@/lib/axios'
import {
  AppSettingsSchema, AppSettingsUpdatePayload,
  SessionTypeListSchema, SessionTypeSchema,
  type AppSettings, type SessionType,
} from '@/schemas/settings'

// Re-export type for convenience
export type { AppSettings, SessionType }

export async function fetchSettings(): Promise<AppSettings> {
  const { data } = await api.get('/settings')
  return AppSettingsSchema.parse(data)
}

export async function updateSettings(payload: Partial<{
  tax_enabled: boolean
  tax_rate: string
  pdf_invoices_enabled: boolean
}>): Promise<AppSettings> {
  const { data } = await api.patch('/settings', payload)
  return AppSettingsSchema.parse(data)
}

export async function fetchSessionTypes(): Promise<SessionType[]> {
  const { data } = await api.get('/session-types')
  return SessionTypeListSchema.parse(data)
}

export async function createSessionType(name: string): Promise<SessionType> {
  const { data } = await api.post('/session-types', { name })
  return SessionTypeSchema.parse(data)
}

export async function updateSessionType(id: string, name: string): Promise<SessionType> {
  const { data } = await api.patch(`/session-types/${id}`, { name })
  return SessionTypeSchema.parse(data)
}

export async function deleteSessionType(id: string): Promise<void> {
  await api.delete(`/session-types/${id}`)
}
```

- [ ] **Step 9: Create `frontend/src/api/appointments.ts`**

```typescript
import { api } from '@/lib/axios'
import { AppointmentListSchema, AppointmentSchema, type Appointment } from '@/schemas/appointments'

export type { Appointment }

export interface AppointmentCreatePayload {
  client_id: string
  title: string
  starts_at: string
  session_type_id?: string | null
  ends_at?: string | null
  location?: string | null
  status?: 'pending' | 'confirmed' | 'cancelled'
  addons?: string[]
  deposit_paid?: boolean
  deposit_amount?: string
  contract_signed?: boolean
  notes?: string | null
}

export async function fetchAppointments(params?: {
  status?: string
  session_type_id?: string
  start_date?: string
  end_date?: string
}): Promise<Appointment[]> {
  const { data } = await api.get('/appointments', { params })
  return AppointmentListSchema.parse(data)
}

export async function fetchAppointment(id: string): Promise<Appointment> {
  const { data } = await api.get(`/appointments/${id}`)
  return AppointmentSchema.parse(data)
}

export async function createAppointment(payload: AppointmentCreatePayload): Promise<Appointment> {
  const { data } = await api.post('/appointments', payload)
  return AppointmentSchema.parse(data)
}

export async function updateAppointment(
  id: string,
  payload: Partial<AppointmentCreatePayload>
): Promise<Appointment> {
  const { data } = await api.patch(`/appointments/${id}`, payload)
  return AppointmentSchema.parse(data)
}

export async function deleteAppointment(id: string): Promise<void> {
  await api.delete(`/appointments/${id}`)
}
```

- [ ] **Step 10: Create `frontend/src/api/dashboard.ts`**

```typescript
// Dashboard stats are computed client-side from existing endpoints —
// no dedicated /api/dashboard endpoint exists. This module aggregates them.
import { api } from '@/lib/axios'
import { z } from 'zod'

const ClientCountSchema = z.array(z.object({ id: z.string() }))
const InvoiceListSchema = z.array(z.object({
  id: z.string(),
  status: z.string(),
  balance_due: z.string(),
}))
const JobListSchema = z.array(z.object({
  id: z.string(),
  stage_id: z.string(),
}))

export interface DashboardStats {
  totalClients: number
  activeJobs: number
  unpaidInvoicesTotal: number
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [clientsRes, jobsRes, invoicesRes] = await Promise.all([
    api.get('/clients'),
    api.get('/jobs'),
    api.get('/invoices'),
  ])

  const clients = ClientCountSchema.parse(clientsRes.data)
  const jobs = JobListSchema.parse(jobsRes.data)
  const invoices = InvoiceListSchema.parse(invoicesRes.data)

  const unpaidInvoicesTotal = invoices
    .filter(i => i.status !== 'paid' && i.status !== 'draft')
    .reduce((sum, i) => sum + parseFloat(i.balance_due), 0)

  return {
    totalClients: clients.length,
    activeJobs: jobs.length,
    unpaidInvoicesTotal,
  }
}
```

- [ ] **Step 11: Run tests**

```bash
npm test -- --testPathPattern=schemas/__tests__/admin
```
Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/schemas/ frontend/src/api/
git commit -m "feat: add admin Zod schemas and typed API functions"
```

---

## Chunk 2: Hooks + Shared UI Components

### Task 2: TanStack Query hooks + StatusBadge + ConfirmDialog

**Files:**
- Create: `frontend/src/hooks/useNotifications.ts`
- Create: `frontend/src/hooks/useSettings.ts`
- Create: `frontend/src/hooks/useAppointments.ts`
- Create: `frontend/src/components/ui/StatusBadge.tsx`
- Create: `frontend/src/components/ui/ConfirmDialog.tsx`
- Create: `frontend/src/components/ui/__tests__/StatusBadge.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/components/ui/__tests__/StatusBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

it('renders pending badge', () => {
  render(<StatusBadge status="pending" />)
  expect(screen.getByText('Pending')).toBeInTheDocument()
})

it('renders confirmed badge with correct color class', () => {
  const { container } = render(<StatusBadge status="confirmed" />)
  expect(container.firstChild).toHaveClass('bg-emerald-500')
})

it('renders cancelled badge', () => {
  render(<StatusBadge status="cancelled" />)
  expect(screen.getByText('Cancelled')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=StatusBadge
```
Expected: `Cannot find module '../StatusBadge'`.

- [ ] **Step 3: Create `frontend/src/components/ui/StatusBadge.tsx`**

```tsx
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Appointment statuses
  pending: { label: 'Pending', className: 'bg-amber-500 text-black' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-500 text-white' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500 text-white' },
  // Invoice statuses
  draft: { label: 'Draft', className: 'bg-zinc-600 text-white' },
  sent: { label: 'Sent', className: 'bg-blue-500 text-white' },
  partially_paid: { label: 'Partial', className: 'bg-amber-500 text-black' },
  paid: { label: 'Paid', className: 'bg-emerald-500 text-white' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-zinc-500 text-white' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
```

- [ ] **Step 4: Create `frontend/src/components/ui/ConfirmDialog.tsx`**

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#1a1a1a] border-zinc-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={destructive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 5: Create `frontend/src/hooks/useNotifications.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/api/notifications'

export function useNotifications(params?: { unread?: boolean; type?: string; limit?: number }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => fetchNotifications(params),
    refetchInterval: 30_000,  // poll every 30s for new notifications
  })
}

export function useUnreadCount() {
  const { data } = useNotifications({ unread: true })
  return data?.length ?? 0
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error('Failed to mark notification as read'),
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error('Failed to mark all as read'),
  })
}
```

- [ ] **Step 6: Create `frontend/src/hooks/useSettings.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchSettings, updateSettings,
  fetchSessionTypes, createSessionType, updateSessionType, deleteSessionType,
} from '@/api/settings'

export function useAppSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved')
    },
    onError: () => toast.error('Failed to save settings'),
  })
}

export function useSessionTypes() {
  return useQuery({
    queryKey: ['session-types'],
    queryFn: fetchSessionTypes,
  })
}

export function useCreateSessionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createSessionType(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-types'] })
      toast.success('Session type created')
    },
    onError: () => toast.error('Failed to create session type'),
  })
}

export function useDeleteSessionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSessionType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-types'] })
      toast.success('Session type deleted')
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Cannot delete — session type is in use'
      toast.error(msg)
    },
  })
}
```

- [ ] **Step 7: Create `frontend/src/hooks/useAppointments.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchAppointments, fetchAppointment,
  createAppointment, updateAppointment, deleteAppointment,
  type AppointmentCreatePayload,
} from '@/api/appointments'

export function useAppointments(params?: {
  status?: string
  session_type_id?: string
  start_date?: string
  end_date?: string
}) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: () => fetchAppointments(params),
  })
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ['appointments', id],
    queryFn: () => fetchAppointment(id),
    enabled: !!id,
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment created')
    },
    onError: () => toast.error('Failed to create appointment'),
  })
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AppointmentCreatePayload> }) =>
      updateAppointment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment updated')
    },
    onError: () => toast.error('Failed to update appointment'),
  })
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment deleted')
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Cannot delete — a job is linked'
      toast.error(msg)
    },
  })
}
```

- [ ] **Step 8: Run tests**

```bash
npm test -- --testPathPattern=StatusBadge
```
Expected: 3 PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/hooks/ frontend/src/components/ui/StatusBadge.tsx \
        frontend/src/components/ui/ConfirmDialog.tsx \
        frontend/src/components/ui/__tests__/StatusBadge.test.tsx
git commit -m "feat: add admin hooks and shared UI components (StatusBadge, ConfirmDialog)"
```

---

## Chunk 3: AdminShell Layout

### Task 3: AdminShell — top nav, notification bell, avatar dropdown

**Files:**
- Create: `frontend/src/components/layout/AdminShell.tsx`
- Create: `frontend/src/components/layout/__tests__/AdminShell.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/components/layout/__tests__/AdminShell.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminShell } from '../AdminShell'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin']}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders nav links', () => {
  render(<AdminShell />, { wrapper: Wrapper })
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
  expect(screen.getByText('Appointments')).toBeInTheDocument()
  expect(screen.getByText('Jobs')).toBeInTheDocument()
  expect(screen.getByText('Clients')).toBeInTheDocument()
  expect(screen.getByText('Accounting')).toBeInTheDocument()
  expect(screen.getByText('Settings')).toBeInTheDocument()
})

it('renders notification bell', () => {
  render(<AdminShell />, { wrapper: Wrapper })
  expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=AdminShell
```
Expected: `Cannot find module '../AdminShell'`.

- [ ] **Step 3: Create `frontend/src/components/layout/AdminShell.tsx`**

```tsx
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, User } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications, useUnreadCount, useMarkAllRead } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

const NAV_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/appointments', label: 'Appointments' },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/accounting', label: 'Accounting' },
  { to: '/admin/settings', label: 'Settings' },
]

function NotificationBell() {
  const { data: recent = [] } = useNotifications({ limit: 5 })
  const unreadCount = useUnreadCount()
  const markAllRead = useMarkAllRead()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-zinc-400 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 bg-[#1a1a1a] border-zinc-800 p-0"
        align="end"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-white">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-amber-500 hover:text-amber-400"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="divide-y divide-zinc-800">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No notifications</p>
          ) : (
            recent.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'px-4 py-3',
                  !n.read && 'bg-zinc-900'
                )}
              >
                <p className={cn('text-sm', n.read ? 'text-zinc-400' : 'text-white')}>{n.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{n.body}</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-zinc-800">
          <Link
            to="/admin/notifications"
            className="text-xs text-amber-500 hover:text-amber-400"
          >
            View all notifications →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function AdminShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A'

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0c0c0c]">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-6 px-4">
          {/* Logo */}
          <Link to="/admin" className="text-lg font-semibold text-amber-500 shrink-0">
            weCapture4U
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side: Bell + Avatar */}
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 text-zinc-400 hover:text-white">
                  <Avatar className="h-7 w-7">
                    {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
                    <AvatarFallback className="bg-zinc-700 text-xs text-white">{initials}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-[#1a1a1a] border-zinc-800 text-white"
              >
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-zinc-800">
                  <Link to="/admin/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-400 hover:bg-zinc-800 hover:text-red-300 focus:text-red-300"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-screen-xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=AdminShell
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/AdminShell.tsx \
        frontend/src/components/layout/__tests__/AdminShell.test.tsx
git commit -m "feat: add AdminShell layout with top nav, notification bell, and avatar dropdown"
```

---

## Chunk 4: Dashboard + Appointments pages

### Task 4: Dashboard page

**Files:**
- Create: `frontend/src/pages/admin/Dashboard.tsx`
- Create: `frontend/src/pages/admin/__tests__/Dashboard.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/admin/__tests__/Dashboard.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from '../Dashboard'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders dashboard heading', () => {
  render(<Dashboard />, { wrapper: Wrapper })
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
})

it('renders stat card labels', () => {
  render(<Dashboard />, { wrapper: Wrapper })
  expect(screen.getByText('Revenue this month')).toBeInTheDocument()
  expect(screen.getByText('Active jobs')).toBeInTheDocument()
  expect(screen.getByText('Total clients')).toBeInTheDocument()
  expect(screen.getByText('Unpaid invoices')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=Dashboard.test
```
Expected: `Cannot find module '../Dashboard'`.

- [ ] **Step 3: Create `frontend/src/pages/admin/Dashboard.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { DollarSign, Briefcase, Users, FileWarning } from 'lucide-react'
import { fetchDashboardStats } from '@/api/dashboard'
import { useAppointments } from '@/hooks/useAppointments'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { format, parseISO } from 'date-fns'

// Placeholder monthly data — Plan 8 (Accounting) adds real journal-based revenue
const PLACEHOLDER_REVENUE: Array<{ month: string; revenue: number }> = [
  { month: 'Oct', revenue: 0 },
  { month: 'Nov', revenue: 0 },
  { month: 'Dec', revenue: 0 },
  { month: 'Jan', revenue: 0 },
  { month: 'Feb', revenue: 0 },
  { month: 'Mar', revenue: 0 },
]

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  })

  // Upcoming appointments — next 5
  const now = new Date().toISOString()
  const { data: appointments = [] } = useAppointments({ start_date: now })
  const upcoming = appointments
    .filter(a => a.status !== 'cancelled')
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenue this month"
          value={statsLoading ? '—' : `€0`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="Active jobs"
          value={statsLoading ? '—' : (stats?.activeJobs ?? 0)}
          icon={<Briefcase className="h-5 w-5" />}
        />
        <StatCard
          label="Total clients"
          value={statsLoading ? '—' : (stats?.totalClients ?? 0)}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Unpaid invoices"
          value={statsLoading ? '—' : `€${(stats?.unpaidInvoicesTotal ?? 0).toFixed(2)}`}
          icon={<FileWarning className="h-5 w-5" />}
        />
      </div>

      {/* Main grid: revenue chart + upcoming appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart — large, 2 cols */}
        <div className="lg:col-span-2 rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={PLACEHOLDER_REVENUE} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #27272a', borderRadius: 8 }}
                labelStyle={{ color: '#fafafa' }}
                itemStyle={{ color: '#f59e0b' }}
              />
              <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-zinc-600 mt-2">Revenue chart will populate after accounting is set up (Plan 8)</p>
        </div>

        {/* Upcoming appointments */}
        <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Upcoming Appointments</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-zinc-500">No upcoming appointments</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map(a => (
                <li key={a.id} className="space-y-1">
                  <p className="text-sm font-medium text-white truncate">{a.title}</p>
                  <p className="text-xs text-zinc-400">
                    {format(parseISO(a.starts_at), 'MMM d, yyyy · HH:mm')}
                  </p>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=Dashboard.test
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Dashboard.tsx \
        frontend/src/pages/admin/__tests__/Dashboard.test.tsx
git commit -m "feat: add Dashboard page with stat cards and revenue chart placeholder"
```

---

### Task 5: Appointments page (calendar/list + create/edit modal)

**Files:**
- Create: `frontend/src/pages/admin/Appointments.tsx`
- Create: `frontend/src/pages/admin/__tests__/Appointments.test.tsx`

> **Install required packages first:**
> ```bash
> cd frontend
> npm install react-big-calendar date-fns
> npm install -D @types/react-big-calendar
> ```

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/admin/__tests__/Appointments.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Appointments } from '../Appointments'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders page heading', () => {
  render(<Appointments />, { wrapper: Wrapper })
  expect(screen.getByText('Appointments')).toBeInTheDocument()
})

it('renders calendar/list toggle buttons', () => {
  render(<Appointments />, { wrapper: Wrapper })
  expect(screen.getByText('Calendar')).toBeInTheDocument()
  expect(screen.getByText('List')).toBeInTheDocument()
})

it('opens create modal when New Appointment button is clicked', async () => {
  const user = userEvent.setup()
  render(<Appointments />, { wrapper: Wrapper })
  await user.click(screen.getByRole('button', { name: /new appointment/i }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=Appointments.test
```
Expected: `Cannot find module '../Appointments'`.

- [ ] **Step 3: Create `frontend/src/pages/admin/Appointments.tsx`**

```tsx
import { useState } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from '@/hooks/useAppointments'
import { useSessionTypes } from '@/hooks/useSettings'
import type { Appointment } from '@/schemas/appointments'
import { parseISO, addHours } from 'date-fns'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

// Form schema — client_id is required but filled from a text input for now
// (a proper client selector is added in Plan 6 when the Clients page exists)
const appointmentFormSchema = z.object({
  client_id: z.string().uuid('Select a client'),
  title: z.string().min(1, 'Title is required'),
  starts_at: z.string().min(1, 'Start date/time is required'),
  ends_at: z.string().optional(),
  session_type_id: z.string().uuid().optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  notes: z.string().optional().nullable(),
})
type AppointmentFormValues = z.infer<typeof appointmentFormSchema>

interface AppointmentModalProps {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
}

function AppointmentModal({ open, onClose, appointment }: AppointmentModalProps) {
  const { data: sessionTypes = [] } = useSessionTypes()
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: appointment
      ? {
          client_id: appointment.client_id,
          title: appointment.title,
          starts_at: appointment.starts_at.slice(0, 16),
          ends_at: appointment.ends_at?.slice(0, 16) ?? undefined,
          session_type_id: appointment.session_type_id,
          location: appointment.location,
          status: appointment.status,
          notes: appointment.notes,
        }
      : { status: 'pending' },
  })

  const onSubmit = async (values: AppointmentFormValues) => {
    const payload = {
      ...values,
      starts_at: new Date(values.starts_at).toISOString(),
      ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
    }
    if (appointment) {
      await updateMutation.mutateAsync({ id: appointment.id, payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-[#1a1a1a] border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="client_id">Client ID</Label>
            <Input
              id="client_id"
              {...register('client_id')}
              className="bg-zinc-900 border-zinc-700 text-white mt-1"
              placeholder="Client UUID"
            />
            {errors.client_id && <p className="text-xs text-red-400 mt-1">{errors.client_id.message}</p>}
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              {...register('title')}
              className="bg-zinc-900 border-zinc-700 text-white mt-1"
            />
            {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="starts_at">Start</Label>
              <Input
                id="starts_at"
                type="datetime-local"
                {...register('starts_at')}
                className="bg-zinc-900 border-zinc-700 text-white mt-1"
              />
              {errors.starts_at && <p className="text-xs text-red-400 mt-1">{errors.starts_at.message}</p>}
            </div>
            <div>
              <Label htmlFor="ends_at">End (optional)</Label>
              <Input
                id="ends_at"
                type="datetime-local"
                {...register('ends_at')}
                className="bg-zinc-900 border-zinc-700 text-white mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Session Type</Label>
              <Select
                onValueChange={(v) => setValue('session_type_id', v)}
                defaultValue={appointment?.session_type_id ?? undefined}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white mt-1">
                  <SelectValue placeholder="Any type" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  {sessionTypes.map(st => (
                    <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                onValueChange={(v) => setValue('status', v as AppointmentFormValues['status'])}
                defaultValue={appointment?.status ?? 'pending'}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              {...register('location')}
              className="bg-zinc-900 border-zinc-700 text-white mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-400">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-400 text-black font-medium"
            >
              {appointment ? 'Save changes' : 'Create appointment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Appointments() {
  const [view, setView] = useState<'calendar' | 'list'>('list')
  const [calendarView, setCalendarView] = useState<View>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null)

  const { data: appointments = [], isLoading } = useAppointments()
  const deleteMutation = useDeleteAppointment()

  // Map appointments to calendar events
  const events = appointments.map(a => ({
    id: a.id,
    title: a.title,
    start: parseISO(a.starts_at),
    end: a.ends_at ? parseISO(a.ends_at) : addHours(parseISO(a.starts_at), 1),
    resource: a,
  }))

  const openCreate = () => {
    setEditingAppointment(null)
    setModalOpen(true)
  }

  const openEdit = (a: Appointment) => {
    setEditingAppointment(a)
    setModalOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Appointments</h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-sm ${view === 'calendar' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-sm ${view === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              List
            </button>
          </div>
          <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-400 text-black font-medium">
            <Plus className="h-4 w-4 mr-1" />
            New Appointment
          </Button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-4" style={{ height: 600 }}>
          <Calendar
            localizer={localizer}
            events={events}
            view={calendarView}
            onView={setCalendarView}
            onSelectEvent={(event) => openEdit(event.resource)}
            style={{ background: 'transparent' }}
          />
        </div>
      ) : (
        <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sm text-zinc-400">Loading...</p>
          ) : appointments.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">No appointments yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800">
                <tr className="text-left">
                  <th className="px-4 py-3 text-zinc-400 font-medium">Title</th>
                  <th className="px-4 py-3 text-zinc-400 font-medium">Start</th>
                  <th className="px-4 py-3 text-zinc-400 font-medium">Status</th>
                  <th className="px-4 py-3 text-zinc-400 font-medium">Type</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {appointments.map(a => (
                  <tr key={a.id} className="hover:bg-zinc-900/50">
                    <td className="px-4 py-3 text-white font-medium">{a.title}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {format(parseISO(a.starts_at), 'MMM d, yyyy · HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {a.session_type?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(a)}
                        className="text-xs text-zinc-400 hover:text-white mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        appointment={editingAppointment}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete appointment?"
        description={`This will permanently delete "${deleteTarget?.title}". This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=Appointments.test
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Appointments.tsx \
        frontend/src/pages/admin/__tests__/Appointments.test.tsx
git commit -m "feat: add Appointments page with calendar/list toggle and create/edit modal"
```

---

## Chunk 5: Wire Routes + Verification

### Task 6: Update routes/index.tsx + add stub Accounting page

**Files:**
- Modify: `frontend/src/routes/index.tsx`
- Create: `frontend/src/pages/admin/Accounting.tsx` (stub — full page in Plan 8)

- [ ] **Step 1: Create stub Accounting page**

```tsx
// frontend/src/pages/admin/Accounting.tsx
export function Accounting() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Accounting</h1>
      <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-8 text-center">
        <p className="text-zinc-400">Accounting module coming in Plan 8.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `frontend/src/routes/index.tsx`** — add AdminShell wrapping all `/admin/*` routes and register the two new pages

The full routes file should look like this (merge with what exists from Plan 2):

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { ClientRoute } from '@/components/auth/ClientRoute'
import { AdminShell } from '@/components/layout/AdminShell'

// Auth pages (Plan 2)
import { AdminLogin } from '@/pages/auth/AdminLogin'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { BiometricSetup } from '@/pages/auth/BiometricSetup'

// Admin pages (Plan 5)
import { Dashboard } from '@/pages/admin/Dashboard'
import { Appointments } from '@/pages/admin/Appointments'
import { Accounting } from '@/pages/admin/Accounting'

export const router = createBrowserRouter([
  // Public auth routes
  { path: '/login', element: <AdminLogin /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },

  // Protected admin routes — all wrapped in AdminRoute + AdminShell
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminShell />
      </AdminRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'appointments', element: <Appointments /> },
      { path: 'jobs', element: <div className="text-white">Jobs — Plan 6</div> },
      { path: 'jobs/:id', element: <div className="text-white">Job Detail — Plan 6</div> },
      { path: 'clients', element: <div className="text-white">Clients — Plan 6</div> },
      { path: 'clients/:id', element: <div className="text-white">Client Detail — Plan 6</div> },
      { path: 'accounting', element: <Accounting /> },
      { path: 'notifications', element: <div className="text-white">Notifications — Plan 7</div> },
      { path: 'settings', element: <div className="text-white">Settings — Plan 7</div> },
      { path: 'profile', element: <div className="text-white">Profile — Plan 7</div> },
      { path: 'biometric/setup', element: <BiometricSetup /> },
    ],
  },

  // Redirect root → /login
  { path: '/', element: <Navigate to="/login" replace /> },
])
```

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd frontend
npm test -- --passWithNoTests
```
Expected: all PASS — no regressions.

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```
Expected: Vite starts on `http://localhost:5173`. Navigate to `http://localhost:5173/login` — login page renders. (Backend must be running for API calls to succeed.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/index.tsx frontend/src/pages/admin/Accounting.tsx
git commit -m "feat: wire AdminShell, Dashboard, and Appointments into router"
```
