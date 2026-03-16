# weCapture4U — Client Portal Frontend

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete client-facing portal — login, dashboard, job list, job detail (progress timeline + gallery link), bookings list + new booking form, and profile page. Dark amber theme, mobile-first.

**Architecture:** Separate route subtree under `/client/*`. `ClientShell` provides top bar + bottom nav. `ClientRoute` guards all client pages. Same Axios interceptor as admin — handles token refresh automatically. Theme differs from admin (dark base `#0c0c0c`, amber accents).

**Depends on:** Plans 1–2 (Foundation, Auth), Plan 12 (Client Portal Backend).

**Tech Stack:** React 18 + TypeScript, TanStack Query v5, react-hook-form, Zod, shadcn/ui, Tailwind CSS.

---

## File Structure

```
frontend/src/
  schemas/
    clientPortal.ts       # Zod schemas for booking requests and dashboard
  api/
    clientPortal.ts       # Typed API functions for all /api/client/* endpoints
  hooks/
    useClientPortal.ts    # TanStack Query hooks
  components/
    auth/
      ClientRoute.tsx     # Protected route guard (role: client)
    layout/
      ClientShell.tsx     # Top bar + bottom nav + outlet
  pages/
    auth/
      ClientLogin.tsx     # /client/login
    client/
      Dashboard.tsx       # /client
      JobList.tsx         # /client/jobs
      JobDetail.tsx       # /client/jobs/:id
      Bookings.tsx        # /client/bookings
      NewBooking.tsx      # /client/bookings/new
      Profile.tsx         # /client/profile
  routes/
    index.tsx             # Add all /client/* routes
```

---

## Chunk 1: Schemas + API + Hooks

### Task 1: Zod schemas + API functions

**Files:**
- Create: `frontend/src/schemas/clientPortal.ts`
- Create: `frontend/src/schemas/__tests__/clientPortal.test.ts`
- Create: `frontend/src/api/clientPortal.ts`

- [ ] **Step 1: Write failing schema tests**

```typescript
// frontend/src/schemas/__tests__/clientPortal.test.ts
import { BookingRequestCreateSchema } from '../clientPortal'

describe('BookingRequestCreateSchema', () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 30)
  const futureDate = tomorrow.toISOString().split('T')[0]
  const pastDate = '2020-01-01'

  it('accepts valid booking request', () => {
    const result = BookingRequestCreateSchema.safeParse({
      preferred_date: futureDate,
      time_slot: 'morning',
      session_type_id: '00000000-0000-0000-0000-000000000001',
      addons: ['album'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects past preferred_date', () => {
    const result = BookingRequestCreateSchema.safeParse({
      preferred_date: pastDate,
      time_slot: 'morning',
      session_type_id: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time_slot', () => {
    const result = BookingRequestCreateSchema.safeParse({
      preferred_date: futureDate,
      time_slot: 'midnight',
      session_type_id: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid addons', () => {
    const result = BookingRequestCreateSchema.safeParse({
      preferred_date: futureDate,
      time_slot: 'morning',
      session_type_id: '00000000-0000-0000-0000-000000000001',
      addons: ['invalid_addon'],
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect failures (module doesn't exist)**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="clientPortal" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Write schemas**

```typescript
// frontend/src/schemas/clientPortal.ts
import { z } from 'zod'

const VALID_ADDONS = ['album', 'thank_you_card', 'enlarged_photos'] as const

export const BookingRequestCreateSchema = z.object({
  preferred_date: z.string().date().refine(
    (d) => new Date(d) > new Date(),
    { message: 'Preferred date must be in the future' }
  ),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
  session_type_id: z.string().uuid(),
  addons: z.array(z.enum(VALID_ADDONS)).default([]),
  message: z.string().max(2000).optional(),
})
export type BookingRequestCreate = z.infer<typeof BookingRequestCreateSchema>

export const BookingRequestOutSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  preferred_date: z.string(),
  time_slot: z.string(),
  session_type_id: z.string().uuid(),
  addons: z.array(z.string()).default([]),
  message: z.string().nullable().optional(),
  status: z.enum(['pending', 'confirmed', 'rejected']),
  admin_notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type BookingRequestOut = z.infer<typeof BookingRequestOutSchema>

export const ClientDashboardSchema = z.object({
  active_job: z.object({
    id: z.string().uuid(),
    title: z.string(),
    current_stage_name: z.string().nullable().optional(),
    current_stage_position: z.number().nullable().optional(),
    total_stages: z.number(),
    delivery_url: z.string().nullable().optional(),
  }).nullable(),
  active_job_count: z.number(),
  next_appointment: z.object({
    id: z.string().uuid(),
    starts_at: z.string(),
    session_type: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    deposit_paid: z.boolean(),
  }).nullable(),
})
export type ClientDashboard = z.infer<typeof ClientDashboardSchema>

export const ClientJobStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  position: z.number(),
  is_terminal: z.boolean(),
  is_current: z.boolean(),
  is_completed: z.boolean(),
})

export const ClientJobDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  delivery_url: z.string().nullable().optional(),
  stages: z.array(ClientJobStageSchema),
})
export type ClientJobDetail = z.infer<typeof ClientJobDetailSchema>

export const ClientJobSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  current_stage: z.string().nullable().optional(),
  delivery_url: z.string().nullable().optional(),
  created_at: z.string(),
})
export type ClientJobSummary = z.infer<typeof ClientJobSummarySchema>
```

- [ ] **Step 4: Write API functions**

```typescript
// frontend/src/api/clientPortal.ts
import api from './index'
import {
  BookingRequestCreateSchema, BookingRequestCreate,
  BookingRequestOutSchema, BookingRequestOut,
  ClientDashboardSchema, ClientDashboard,
  ClientJobDetailSchema, ClientJobDetail,
  ClientJobSummarySchema, ClientJobSummary,
} from '../schemas/clientPortal'
import { z } from 'zod'

export const fetchClientDashboard = async (): Promise<ClientDashboard> => {
  const res = await api.get('/client/dashboard')
  return ClientDashboardSchema.parse(res.data)
}

export const fetchClientJobs = async (): Promise<ClientJobSummary[]> => {
  const res = await api.get('/client/jobs')
  return z.array(ClientJobSummarySchema).parse(res.data)
}

export const fetchClientJob = async (jobId: string): Promise<ClientJobDetail> => {
  const res = await api.get(`/client/jobs/${jobId}`)
  return ClientJobDetailSchema.parse(res.data)
}

export const fetchClientBookings = async (): Promise<BookingRequestOut[]> => {
  const res = await api.get('/client/bookings')
  return z.array(BookingRequestOutSchema).parse(res.data)
}

export const createBookingRequest = async (data: BookingRequestCreate): Promise<BookingRequestOut> => {
  const res = await api.post('/client/bookings', data)
  return BookingRequestOutSchema.parse(res.data)
}

export const fetchClientProfile = async (): Promise<Record<string, unknown>> => {
  const res = await api.get('/client/profile')
  return res.data
}
```

- [ ] **Step 5: Run schema tests — expect PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="clientPortal" --watchAll=false
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/schemas/clientPortal.ts frontend/src/schemas/__tests__/clientPortal.test.ts frontend/src/api/clientPortal.ts
git commit -m "feat: add client portal Zod schemas and API functions"
```

---

### Task 2: TanStack Query hooks

**Files:**
- Create: `frontend/src/hooks/useClientPortal.ts`

- [ ] **Step 1: Write the hooks**

```typescript
// frontend/src/hooks/useClientPortal.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../lib/apiError'
import * as clientApi from '../api/clientPortal'
import type { BookingRequestCreate } from '../schemas/clientPortal'

export const useClientDashboard = () =>
  useQuery({
    queryKey: ['client-dashboard'],
    queryFn: clientApi.fetchClientDashboard,
  })

export const useClientJobs = () =>
  useQuery({
    queryKey: ['client-jobs'],
    queryFn: clientApi.fetchClientJobs,
  })

export const useClientJob = (jobId: string) =>
  useQuery({
    queryKey: ['client-job', jobId],
    queryFn: () => clientApi.fetchClientJob(jobId),
    enabled: !!jobId,
  })

export const useClientBookings = () =>
  useQuery({
    queryKey: ['client-bookings'],
    queryFn: clientApi.fetchClientBookings,
  })

export const useCreateBookingRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BookingRequestCreate) => clientApi.createBookingRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-bookings'] })
      toast.success('Booking request sent!')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to send booking request')),
  })
}

export const useClientProfile = () =>
  useQuery({
    queryKey: ['client-profile'],
    queryFn: clientApi.fetchClientProfile,
  })
```

- [ ] **Step 2: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/hooks/useClientPortal.ts
git commit -m "feat: add client portal TanStack Query hooks"
```

---

## Chunk 2: Auth Guard + Shell + Pages

### Task 3: ClientRoute guard + ClientShell

**Files:**
- Create: `frontend/src/components/auth/ClientRoute.tsx`
- Create: `frontend/src/components/layout/ClientShell.tsx`
- Create: `frontend/src/components/auth/__tests__/ClientRoute.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/components/auth/__tests__/ClientRoute.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ClientRoute } from '../ClientRoute'

// Helper: mock localStorage with no token → should redirect to /client/login
const renderWithNoToken = () => {
  localStorage.removeItem('access_token')
  return render(
    <MemoryRouter initialEntries={['/client']}>
      <Routes>
        <Route element={<ClientRoute />}>
          <Route path="/client" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/client/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ClientRoute', () => {
  it('redirects to /client/login when no token', () => {
    renderWithNoToken()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="ClientRoute" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Write ClientRoute**

```typescript
// frontend/src/components/auth/ClientRoute.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'

interface JWTPayload {
  role: string
  exp: number
}

export function ClientRoute() {
  const token = localStorage.getItem('access_token')

  if (!token) {
    return <Navigate to="/client/login" replace />
  }

  try {
    const payload = jwtDecode<JWTPayload>(token)
    if (payload.role !== 'client' || payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      return <Navigate to="/client/login" replace />
    }
  } catch {
    return <Navigate to="/client/login" replace />
  }

  return <Outlet />
}
```

- [ ] **Step 4: Write ClientShell**

```typescript
// frontend/src/components/layout/ClientShell.tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/client', label: 'Home', icon: '🏠', exact: true },
  { to: '/client/jobs', label: 'My Jobs', icon: '📷' },
  { to: '/client/bookings', label: 'Bookings', icon: '📅' },
  { to: '/client/profile', label: 'Profile', icon: '👤' },
]

export function ClientShell() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    navigate('/client/login')
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-[#0c0c0c]/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <span className="text-amber-400 font-bold tracking-wide">weCapture4U</span>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Logout
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom nav (mobile) / inline nav (desktop) */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#0c0c0c]/95 backdrop-blur border-t border-white/10 flex md:hidden">
        {NAV_ITEMS.map(({ to, label, icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${
                isActive ? 'text-amber-400' : 'text-gray-500 hover:text-white'
              }`
            }
          >
            <span className="text-lg">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 5: Run ClientRoute test — expect PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="ClientRoute" --watchAll=false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/components/auth/ClientRoute.tsx frontend/src/components/layout/ClientShell.tsx frontend/src/components/auth/__tests__/ClientRoute.test.tsx
git commit -m "feat: add ClientRoute guard and ClientShell layout"
```

---

### Task 4: ClientLogin page

**Files:**
- Create: `frontend/src/pages/auth/ClientLogin.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/auth/__tests__/ClientLogin.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ClientLogin from '../ClientLogin'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter><QueryClientProvider client={qc}>{children}</QueryClientProvider></MemoryRouter>
)

describe('ClientLogin', () => {
  it('renders email and password fields', () => {
    render(<ClientLogin />, { wrapper: Wrapper })
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="ClientLogin.test" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Write ClientLogin**

```typescript
// frontend/src/pages/auth/ClientLogin.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import api from '../../api'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
type LoginForm = z.infer<typeof LoginSchema>

export default function ClientLogin() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    try {
      const res = await api.post('/auth/login', data)
      const { access_token, refresh_token, role } = res.data
      if (role !== 'client') {
        setError('This login is for clients only. Use the admin login instead.')
        return
      }
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)
      navigate('/client')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail ?? 'Invalid email or password')
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-amber-400 text-center mb-8">Client Portal</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
              {...register('email')}
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
              {...register('password')}
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-3 transition-colors"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-gray-500">
          <a href="/client/forgot-password" className="text-amber-400 hover:text-amber-300">
            Forgot password?
          </a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="ClientLogin.test" --watchAll=false
```

---

### Task 5: Client pages — Dashboard, JobList, JobDetail, Bookings, NewBooking, Profile

**Files:**
- Create: `frontend/src/pages/client/Dashboard.tsx`
- Create: `frontend/src/pages/client/JobList.tsx`
- Create: `frontend/src/pages/client/JobDetail.tsx`
- Create: `frontend/src/pages/client/Bookings.tsx`
- Create: `frontend/src/pages/client/NewBooking.tsx`
- Create: `frontend/src/pages/client/Profile.tsx`

- [ ] **Step 1: Write failing tests for Dashboard**

```typescript
// frontend/src/pages/client/__tests__/Dashboard.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from '../Dashboard'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter><QueryClientProvider client={qc}>{children}</QueryClientProvider></MemoryRouter>
)

describe('Dashboard', () => {
  it('renders Book a New Session CTA', () => {
    render(<Dashboard />, { wrapper: Wrapper })
    expect(screen.getByRole('link', { name: /book a new session/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="Dashboard.test" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Write all client pages**

```typescript
// frontend/src/pages/client/Dashboard.tsx
import { Link } from 'react-router-dom'
import { useClientDashboard } from '../../hooks/useClientPortal'

export default function Dashboard() {
  const { data, isLoading } = useClientDashboard()

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-white">Welcome back</h1>

      {/* Active job card */}
      {data?.active_job ? (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Job</p>
          <p className="text-white font-semibold text-lg">{data.active_job.title}</p>
          {data.active_job.current_stage_name && (
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span className="text-amber-400 text-sm">{data.active_job.current_stage_name}</span>
            </div>
          )}
          {/* Progress bar */}
          {data.active_job.current_stage_position !== null && data.active_job.total_stages > 0 && (
            <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${Math.round(((data.active_job.current_stage_position ?? 0) / data.active_job.total_stages) * 100)}%` }}
              />
            </div>
          )}
          {data.active_job_count > 1 && (
            <Link to="/client/jobs" className="text-xs text-amber-400 mt-3 block hover:underline">
              You have {data.active_job_count} active jobs — see all
            </Link>
          )}
        </div>
      ) : !isLoading ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-gray-400 text-sm">
          No active jobs at the moment.
        </div>
      ) : null}

      {/* Next appointment */}
      {data?.next_appointment && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Next Appointment</p>
          <p className="text-white">
            {new Date(data.next_appointment.starts_at).toLocaleDateString('en-IE', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </p>
          {data.next_appointment.session_type && (
            <p className="text-sm text-gray-400 mt-1">{data.next_appointment.session_type}</p>
          )}
          <div className={`mt-2 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
            data.next_appointment.deposit_paid
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            {data.next_appointment.deposit_paid ? '✓ Deposit paid' : 'Deposit pending'}
          </div>
        </div>
      )}

      {/* Book CTA */}
      <Link
        to="/client/bookings/new"
        className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl py-4 transition-colors"
        aria-label="Book a New Session"
      >
        Book a New Session
      </Link>
    </div>
  )
}
```

```typescript
// frontend/src/pages/client/JobList.tsx
import { Link } from 'react-router-dom'
import { useClientJobs } from '../../hooks/useClientPortal'

export default function JobList() {
  const { data: jobs = [], isLoading } = useClientJobs()

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold text-white">My Jobs</h1>
      {isLoading ? (
        <p className="text-gray-400">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="text-gray-400">No jobs yet.</p>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <Link
              key={job.id}
              to={`/client/jobs/${job.id}`}
              className="block bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{job.title}</p>
                  {job.current_stage && (
                    <p className="text-xs text-amber-400 mt-1">{job.current_stage}</p>
                  )}
                </div>
                {job.delivery_url && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                    Photos ready
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

```typescript
// frontend/src/pages/client/JobDetail.tsx
import { useParams } from 'react-router-dom'
import { useClientJob } from '../../hooks/useClientPortal'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: job, isLoading } = useClientJob(id ?? '')

  if (isLoading) return <div className="p-6 text-gray-400">Loading…</div>
  if (!job) return <div className="p-6 text-red-400">Job not found</div>

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div>
        <a href="/client/jobs" className="text-xs text-gray-400 hover:text-white">← My Jobs</a>
        <h1 className="text-xl font-bold text-white mt-2">{job.title}</h1>
      </div>

      {/* Progress timeline */}
      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-gray-400">Progress</h2>
        {job.stages.filter(s => !s.is_terminal).map(stage => (
          <div key={stage.id} className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
              stage.is_completed ? 'bg-emerald-500' :
              stage.is_current ? 'bg-amber-400' : 'bg-white/10'
            }`}>
              {stage.is_completed && <span className="text-white text-xs">✓</span>}
              {stage.is_current && <span className="w-2 h-2 bg-black rounded-full" />}
            </div>
            <span className={`text-sm ${stage.is_current ? 'text-amber-400 font-medium' : stage.is_completed ? 'text-gray-400' : 'text-gray-600'}`}>
              {stage.name}
            </span>
          </div>
        ))}
      </div>

      {/* Gallery */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Your Photos</h2>
        {job.delivery_url ? (
          <a
            href={job.delivery_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl py-4 transition-colors"
          >
            View Your Photos →
          </a>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-400 text-sm">
            Your photos will appear here once delivered.
          </div>
        )}
      </div>
    </div>
  )
}
```

```typescript
// frontend/src/pages/client/Bookings.tsx
import { Link } from 'react-router-dom'
import { useClientBookings } from '../../hooks/useClientPortal'
import { Badge } from '../../components/ui/badge'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  confirmed: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
}

export default function Bookings() {
  const { data: bookings = [] } = useClientBookings()

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Bookings</h1>
        <Link
          to="/client/bookings/new"
          className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-lg"
        >
          New Booking
        </Link>
      </div>

      {bookings.length === 0 ? (
        <p className="text-gray-400">No booking requests yet.</p>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => (
            <div key={b.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-medium">{b.preferred_date} · {b.time_slot}</p>
                <Badge className={STATUS_STYLE[b.status]}>{b.status}</Badge>
              </div>
              {b.status === 'pending' && (
                <p className="text-xs text-gray-400">Your request is being reviewed.</p>
              )}
              {b.admin_notes && b.status !== 'pending' && (
                <p className="text-xs text-gray-300 mt-1">{b.admin_notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

```typescript
// frontend/src/pages/client/NewBooking.tsx
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useCreateBookingRequest } from '../../hooks/useClientPortal'
import { BookingRequestCreateSchema, BookingRequestCreate } from '../../schemas/clientPortal'
import { useSessionTypes } from '../../hooks/useAdmin'

const ADDONS = [
  { value: 'album', label: 'Album' },
  { value: 'thank_you_card', label: 'Thank You Card' },
  { value: 'enlarged_photos', label: 'Enlarged Photos' },
]

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'all_day', label: 'All Day' },
]

export default function NewBooking() {
  const navigate = useNavigate()
  const createMutation = useCreateBookingRequest()
  const { data: sessionTypes = [] } = useSessionTypes()

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } =
    useForm<BookingRequestCreate>({
      resolver: zodResolver(BookingRequestCreateSchema),
      defaultValues: { addons: [] },
    })

  const onSubmit = async (data: BookingRequestCreate) => {
    await createMutation.mutateAsync(data)
    navigate('/client/bookings')
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <a href="/client/bookings" className="text-xs text-gray-400 hover:text-white">← Bookings</a>
      <h1 className="text-xl font-bold text-white mt-2 mb-6">Request a Session</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Session type */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Session Type</label>
          <select
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white"
            {...register('session_type_id')}
          >
            <option value="">Select type…</option>
            {sessionTypes.map(st => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
          {errors.session_type_id && <p className="text-red-400 text-xs mt-1">{errors.session_type_id.message}</p>}
        </div>

        {/* Preferred date */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Preferred Date</label>
          <input
            type="date"
            min={minDate}
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white"
            {...register('preferred_date')}
          />
          {errors.preferred_date && <p className="text-red-400 text-xs mt-1">{errors.preferred_date.message}</p>}
        </div>

        {/* Time slot */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Time Preference</label>
          <Controller
            name="time_slot"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2">
                {TIME_SLOTS.map(slot => (
                  <button
                    key={slot.value}
                    type="button"
                    onClick={() => field.onChange(slot.value)}
                    className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                      field.value === slot.value
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            )}
          />
          {errors.time_slot && <p className="text-red-400 text-xs mt-1">{errors.time_slot.message}</p>}
        </div>

        {/* Add-ons */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Add-ons (optional)</label>
          <Controller
            name="addons"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                {ADDONS.map(addon => {
                  const checked = field.value?.includes(addon.value as never) ?? false
                  return (
                    <label key={addon.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = field.value ?? []
                          field.onChange(
                            e.target.checked
                              ? [...current, addon.value]
                              : current.filter(v => v !== addon.value)
                          )
                        }}
                        className="accent-amber-500"
                      />
                      <span className="text-white text-sm">{addon.label}</span>
                    </label>
                  )
                })}
              </div>
            )}
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Message (optional)</label>
          <textarea
            rows={3}
            placeholder="Any notes for the photographer…"
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white resize-none"
            {...register('message')}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || createMutation.isPending}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-xl py-4 transition-colors"
        >
          {isSubmitting || createMutation.isPending ? 'Sending…' : 'Send Request'}
        </button>
      </form>
    </div>
  )
}
```

```typescript
// frontend/src/pages/client/Profile.tsx
import { useClientProfile } from '../../hooks/useClientPortal'

export default function Profile() {
  const { data: profile, isLoading } = useClientProfile()

  if (isLoading) return <div className="p-6 text-gray-400">Loading…</div>

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-white">Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url as string}
            alt="Avatar"
            className="w-16 h-16 rounded-full object-cover border-2 border-amber-500/30"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xl">
            {(profile?.full_name as string)?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div>
          <p className="text-white font-semibold">{profile?.full_name as string ?? '—'}</p>
          <p className="text-sm text-gray-400">{profile?.email as string}</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        {[
          ['Phone', profile?.phone],
          ['Address', profile?.address],
          ['Birthday', profile?.birthday],
        ].map(([label, value]) => (
          value ? (
            <div key={label as string}>
              <p className="text-xs text-gray-400">{label as string}</p>
              <p className="text-white text-sm">{value as string}</p>
            </div>
          ) : null
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run Dashboard test — expect PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="Dashboard.test" --watchAll=false
```

Expected: PASS.

---

### Task 6: Wire routes in index.tsx

**Files:**
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/routes/__tests__/clientRoutes.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppRoutes from '../index'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
)

describe('Client routes', () => {
  it('renders ClientLogin at /client/login', () => {
    render(
      <MemoryRouter initialEntries={['/client/login']}>
        <AppRoutes />
      </MemoryRouter>,
      { wrapper: Wrapper }
    )
    expect(screen.getByText('Client Portal')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL (routes not wired)**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="clientRoutes" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Add client routes to routes/index.tsx**

In `frontend/src/routes/index.tsx`, add the following routes alongside the existing admin routes:

```typescript
import { ClientRoute } from '../components/auth/ClientRoute'
import { ClientShell } from '../components/layout/ClientShell'
import ClientLogin from '../pages/auth/ClientLogin'
import Dashboard from '../pages/client/Dashboard'
import JobList from '../pages/client/JobList'
import JobDetail from '../pages/client/JobDetail'
import Bookings from '../pages/client/Bookings'
import NewBooking from '../pages/client/NewBooking'
import Profile from '../pages/client/Profile'

// Inside the Routes JSX, add:
// <Route path="/client/login" element={<ClientLogin />} />
// <Route element={<ClientRoute />}>
//   <Route element={<ClientShell />}>
//     <Route path="/client" element={<Dashboard />} />
//     <Route path="/client/jobs" element={<JobList />} />
//     <Route path="/client/jobs/:id" element={<JobDetail />} />
//     <Route path="/client/bookings" element={<Bookings />} />
//     <Route path="/client/bookings/new" element={<NewBooking />} />
//     <Route path="/client/profile" element={<Profile />} />
//   </Route>
// </Route>
```

- [ ] **Step 4: Run all frontend tests**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --watchAll=false
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/pages/auth/ClientLogin.tsx frontend/src/pages/client/ frontend/src/routes/index.tsx
git commit -m "feat: implement client portal — login, dashboard, jobs, bookings, profile pages"
```
