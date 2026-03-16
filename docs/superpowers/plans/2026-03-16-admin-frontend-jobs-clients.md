# weCapture4U — Admin Frontend: Jobs & Clients

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Jobs Kanban board (drag-and-drop with @dnd-kit/core), Job Detail page, Clients table (searchable/filterable), and Client Detail page (with portal account management and deactivation toggle).

**Architecture:** Jobs Kanban uses `@dnd-kit/core` with `DndContext` + `SortableContext` per column. Stage order is persisted immediately via `PATCH /api/job-stages/positions` when a card is dropped. Client table uses URL search params for filter state so filters survive navigation. Client Detail fetches `ClientWithStats` which includes `total_spent` and `is_active`.

**Depends on:** Plan 1 (Frontend scaffold), Plan 2 (Auth), Plan 5 (AdminShell, shared hooks/api for appointments/settings, routes skeleton).

**Tech Stack:** React 18 + TypeScript, @dnd-kit/core, @dnd-kit/sortable, TanStack Query v5, Zod, react-hook-form, shadcn/ui, Tailwind CSS.

---

## File Structure

```
frontend/src/
  lib/
    apiError.ts           # Utility: extract human-readable message from AxiosError 4xx responses
  schemas/
    jobs.ts               # Zod schemas for JobStage, Job, JobDetail
    clients.ts            # Zod schemas for Client, ClientWithStats
    invoices.ts           # Zod schema for InvoiceOut (used in Job Detail + Client Detail)
  api/
    jobs.ts               # Typed API functions — /api/jobs + /api/job-stages
    clients.ts            # /api/clients
    invoices.ts           # /api/invoices (read-only in this plan)
  hooks/
    useJobs.ts            # TanStack Query hooks for jobs + stages
    useClients.ts         # TanStack Query hooks for clients
    useInvoices.ts        # TanStack Query hooks for invoices (list + get)
  pages/
    admin/
      Jobs.tsx            # /admin/jobs — Kanban board
      JobDetail.tsx       # /admin/jobs/:id
      Clients.tsx         # /admin/clients — searchable table
      ClientDetail.tsx    # /admin/clients/:id
  routes/
    index.tsx             # Updated: replace stub job/client routes with real pages
```

---

## Chunk 1: Schemas, API, Hooks

### Task 1: Zod schemas + typed API functions

**Files:**
- Create: `frontend/src/schemas/jobs.ts`
- Create: `frontend/src/schemas/clients.ts`
- Create: `frontend/src/schemas/invoices.ts`
- Create: `frontend/src/api/jobs.ts`
- Create: `frontend/src/api/clients.ts`
- Create: `frontend/src/api/invoices.ts`
- Create: `frontend/src/schemas/__tests__/jobs-clients.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/schemas/__tests__/jobs-clients.test.ts
import { JobStageSchema, JobSchema } from '../jobs'
import { ClientSchema, ClientWithStatsSchema } from '../clients'

describe('JobStageSchema', () => {
  it('parses valid stage', () => {
    const result = JobStageSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Booked',
      color: '#f59e0b',
      position: 1,
      is_terminal: false,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('JobSchema', () => {
  it('parses valid job', () => {
    const result = JobSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      client_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      client: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Alice', email: 'alice@example.com' },
      appointment_id: null,
      title: 'Wedding photos',
      stage_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      shoot_date: null,
      delivery_deadline: null,
      delivery_url: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('ClientWithStatsSchema', () => {
  it('parses client with stats', () => {
    const result = ClientWithStatsSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      user_id: null,
      name: 'Alice',
      email: 'alice@example.com',
      phone: null,
      address: null,
      tags: ['wedding'],
      birthday: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
      total_spent: 1500.0,
      is_active: null,
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd frontend
npm test -- --testPathPattern=jobs-clients
```
Expected: `Cannot find module '../jobs'`.

- [ ] **Step 3: Create `frontend/src/schemas/jobs.ts`**

```typescript
import { z } from 'zod'

export const JobStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  position: z.number().int(),
  is_terminal: z.boolean(),
  created_at: z.string(),
})
export type JobStage = z.infer<typeof JobStageSchema>
export const JobStageListSchema = z.array(JobStageSchema)

const ClientSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
})

const AppointmentSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  starts_at: z.string(),
  status: z.string(),
})

export const JobSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  client: ClientSummarySchema.nullable().optional(),
  appointment_id: z.string().uuid().nullable(),
  title: z.string(),
  stage_id: z.string().uuid(),
  shoot_date: z.string().nullable(),
  delivery_deadline: z.string().nullable(),
  delivery_url: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type Job = z.infer<typeof JobSchema>
export const JobListSchema = z.array(JobSchema)

export const JobDetailSchema = JobSchema.extend({
  appointment: AppointmentSummarySchema.nullable().optional(),
})
export type JobDetail = z.infer<typeof JobDetailSchema>
```

- [ ] **Step 4: Create `frontend/src/schemas/clients.ts`**

```typescript
import { z } from 'zod'

export const ClientSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  tags: z.array(z.string()),
  birthday: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type Client = z.infer<typeof ClientSchema>
export const ClientListSchema = z.array(ClientSchema)

export const ClientWithStatsSchema = ClientSchema.extend({
  total_spent: z.number(),
  is_active: z.boolean().nullable(),
})
export type ClientWithStats = z.infer<typeof ClientWithStatsSchema>
```

- [ ] **Step 5: Create `frontend/src/schemas/invoices.ts`**

```typescript
import { z } from 'zod'

const InvoiceItemSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  revenue_account_id: z.string().uuid().nullable(),
  description: z.string(),
  quantity: z.string(),
  unit_price: z.string(),
  amount: z.string(),
})

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid().nullable(),
  client_id: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'partially_paid', 'paid']),
  subtotal: z.string(),
  discount: z.string(),
  tax: z.string(),
  total: z.string(),
  deposit_amount: z.string(),
  balance_due: z.string(),
  requires_review: z.boolean(),
  due_date: z.string().nullable(),
  sent_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  created_at: z.string(),
  items: z.array(InvoiceItemSchema),
})
export type Invoice = z.infer<typeof InvoiceSchema>
export const InvoiceListSchema = z.array(InvoiceSchema)
```

- [ ] **Step 6: Create `frontend/src/api/jobs.ts`**

```typescript
import { api } from '@/lib/axios'
import {
  JobListSchema, JobSchema, JobDetailSchema, JobStageListSchema, JobStageSchema,
  type Job, type JobDetail, type JobStage,
} from '@/schemas/jobs'

export type { Job, JobDetail, JobStage }

export interface JobCreatePayload {
  client_id: string
  title: string
  stage_id: string
  appointment_id?: string | null
  shoot_date?: string | null
  delivery_deadline?: string | null
  notes?: string | null
}

export interface JobUpdatePayload extends Partial<JobCreatePayload> {
  delivery_url?: string | null
}

export interface StagePositionItem { id: string; position: number }

export async function fetchJobs(params?: { stage_id?: string; client_id?: string }): Promise<Job[]> {
  const { data } = await api.get('/jobs', { params })
  return JobListSchema.parse(data)
}

export async function fetchJob(id: string): Promise<JobDetail> {
  const { data } = await api.get(`/jobs/${id}`)
  return JobDetailSchema.parse(data)
}

export async function createJob(payload: JobCreatePayload): Promise<Job> {
  const { data } = await api.post('/jobs', payload)
  return JobSchema.parse(data)
}

export async function updateJob(id: string, payload: JobUpdatePayload): Promise<Job> {
  const { data } = await api.patch(`/jobs/${id}`, payload)
  return JobSchema.parse(data)
}

export async function deleteJob(id: string): Promise<void> {
  await api.delete(`/jobs/${id}`)
}

export async function fetchJobStages(): Promise<JobStage[]> {
  const { data } = await api.get('/job-stages')
  return JobStageListSchema.parse(data)
}

export async function createJobStage(payload: { name: string; color: string; is_terminal?: boolean }): Promise<JobStage> {
  const { data } = await api.post('/job-stages', payload)
  return JobStageSchema.parse(data)
}

export async function updateJobStage(id: string, payload: { name?: string; color?: string; is_terminal?: boolean }): Promise<JobStage> {
  const { data } = await api.patch(`/job-stages/${id}`, payload)
  return JobStageSchema.parse(data)
}

export async function reorderJobStages(stages: StagePositionItem[]): Promise<JobStage[]> {
  const { data } = await api.patch('/job-stages/positions', { stages })
  return JobStageListSchema.parse(data)
}

export async function deleteJobStage(id: string): Promise<void> {
  await api.delete(`/job-stages/${id}`)
}
```

- [ ] **Step 7: Create `frontend/src/api/clients.ts`**

```typescript
import { api } from '@/lib/axios'
import { ClientListSchema, ClientSchema, ClientWithStatsSchema, type Client, type ClientWithStats } from '@/schemas/clients'

export type { Client, ClientWithStats }

export interface ClientCreatePayload {
  name: string
  email: string
  phone?: string | null
  address?: string | null
  tags?: string[]
  birthday?: string | null
  notes?: string | null
  portal_access?: boolean
  temp_password?: string | null
}

export async function fetchClients(params?: { search?: string; tag?: string }): Promise<Client[]> {
  const { data } = await api.get('/clients', { params })
  return ClientListSchema.parse(data)
}

export async function fetchClient(id: string): Promise<ClientWithStats> {
  const { data } = await api.get(`/clients/${id}`)
  return ClientWithStatsSchema.parse(data)
}

export async function createClient(payload: ClientCreatePayload): Promise<Client> {
  const { data } = await api.post('/clients', payload)
  return ClientSchema.parse(data)
}

export async function updateClient(id: string, payload: Partial<ClientCreatePayload>): Promise<Client> {
  const { data } = await api.patch(`/clients/${id}`, payload)
  return ClientSchema.parse(data)
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/clients/${id}`)
}

export async function createPortalAccess(id: string, temp_password: string): Promise<Client> {
  const { data } = await api.post(`/clients/${id}/portal-access`, { temp_password })
  return ClientSchema.parse(data)
}

export async function togglePortalAccess(id: string, is_active: boolean): Promise<Client> {
  const { data } = await api.patch(`/clients/${id}/portal-access`, { is_active })
  return ClientSchema.parse(data)
}
```

- [ ] **Step 8: Create `frontend/src/api/invoices.ts`**

```typescript
import { api } from '@/lib/axios'
import { InvoiceListSchema, InvoiceSchema, type Invoice } from '@/schemas/invoices'

export type { Invoice }

export async function fetchInvoices(params?: {
  status?: string; client_id?: string; job_id?: string
}): Promise<Invoice[]> {
  const { data } = await api.get('/invoices', { params })
  return InvoiceListSchema.parse(data)
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  const { data } = await api.get(`/invoices/${id}`)
  return InvoiceSchema.parse(data)
}
```

- [ ] **Step 9: Run tests**

```bash
npm test -- --testPathPattern=jobs-clients
```
Expected: 3 PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/schemas/jobs.ts frontend/src/schemas/clients.ts \
        frontend/src/schemas/invoices.ts frontend/src/api/jobs.ts \
        frontend/src/api/clients.ts frontend/src/api/invoices.ts \
        frontend/src/schemas/__tests__/jobs-clients.test.ts
git commit -m "feat: add Jobs and Clients Zod schemas and typed API functions"
```

---

### Task 1b: `lib/apiError.ts` — extract API error detail from AxiosError

FastAPI returns errors as `{"detail": "message"}`. Axios throws an `AxiosError` — `error.message` is always `"Request failed with status code 409"`, NOT the detail string. This utility is used by mutation `onError` handlers throughout the admin module.

**Files:**
- Create: `frontend/src/lib/apiError.ts`

- [ ] **Step 1: Create `frontend/src/lib/apiError.ts`**

```typescript
import type { AxiosError } from 'axios'

/**
 * Extracts the human-readable error message from a FastAPI error response.
 * FastAPI returns: { "detail": "message" } or { "detail": [{ "msg": "..." }] }
 * Falls back to the error's own message if the response body can't be parsed.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback
  const axiosError = error as AxiosError<{ detail: string | Array<{ msg: string }> }>
  const detail = axiosError.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return fallback
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/apiError.ts
git commit -m "feat: add getApiErrorMessage utility for AxiosError 4xx detail extraction"
```

---

### Task 2: TanStack Query hooks for jobs, clients, and invoices

**Files:**
- Create: `frontend/src/hooks/useJobs.ts`
- Create: `frontend/src/hooks/useClients.ts`
- Create: `frontend/src/hooks/useInvoices.ts`

- [ ] **Step 1: Create `frontend/src/hooks/useJobs.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchJobs, fetchJob, createJob, updateJob, deleteJob,
  fetchJobStages, createJobStage, updateJobStage, reorderJobStages, deleteJobStage,
  type JobCreatePayload, type JobUpdatePayload, type StagePositionItem,
} from '@/api/jobs'
import { getApiErrorMessage } from '@/lib/apiError'

export function useJobs(params?: { stage_id?: string; client_id?: string }) {
  return useQuery({ queryKey: ['jobs', params], queryFn: () => fetchJobs(params) })
}

export function useJob(id: string) {
  return useQuery({ queryKey: ['jobs', id], queryFn: () => fetchJob(id), enabled: !!id })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createJob,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job created') },
    onError: () => toast.error('Failed to create job'),
  })
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: JobUpdatePayload }) => updateJob(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job updated') },
    onError: () => toast.error('Failed to update job'),
  })
}

export function useDeleteJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteJob,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job deleted') },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Cannot delete — an invoice is linked'))
    },
  })
}

export function useJobStages() {
  return useQuery({ queryKey: ['job-stages'], queryFn: fetchJobStages })
}

export function useReorderJobStages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reorderJobStages,
    // Optimistic update: immediately update local order without waiting for server
    onMutate: async (newStages: StagePositionItem[]) => {
      await queryClient.cancelQueries({ queryKey: ['job-stages'] })
      const prev = queryClient.getQueryData(['job-stages'])
      queryClient.setQueryData(['job-stages'], (old: unknown) => {
        if (!Array.isArray(old)) return old
        return old.map(s => {
          const update = newStages.find(n => n.id === s.id)
          return update ? { ...s, position: update.position } : s
        }).sort((a, b) => a.position - b.position)
      })
      return { prev }
    },
    onError: (_err, _vars, context: unknown) => {
      if (context && typeof context === 'object' && 'prev' in context) {
        queryClient.setQueryData(['job-stages'], (context as { prev: unknown }).prev)
      }
      toast.error('Failed to reorder stages')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['job-stages'] }),
  })
}

export function useDeleteJobStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteJobStage,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['job-stages'] }); toast.success('Stage deleted') },
    onError: (error: unknown) => {
      // FastAPI returns: {"detail": "3 jobs are in this stage. Reassign them first."}
      toast.error(getApiErrorMessage(error, 'Cannot delete — jobs are assigned to this stage'))
    },
  })
}
```

- [ ] **Step 2: Create `frontend/src/hooks/useClients.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchClients, fetchClient, createClient, updateClient, deleteClient,
  createPortalAccess, togglePortalAccess,
  type ClientCreatePayload,
} from '@/api/clients'
import { getApiErrorMessage } from '@/lib/apiError'

export function useClients(params?: { search?: string; tag?: string }) {
  return useQuery({ queryKey: ['clients', params], queryFn: () => fetchClients(params) })
}

export function useClient(id: string) {
  return useQuery({ queryKey: ['clients', id], queryFn: () => fetchClient(id), enabled: !!id })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createClient,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client created') },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to create client'))
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ClientCreatePayload> }) =>
      updateClient(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients', id] })
      toast.success('Client updated')
    },
    onError: () => toast.error('Failed to update client'),
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client deleted') },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Cannot delete — client has jobs or invoices'))
    },
  })
}

export function useTogglePortalAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      togglePortalAccess(id, is_active),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['clients', id] })
      toast.success('Portal access updated')
    },
    onError: () => toast.error('Failed to update portal access'),
  })
}

export function useCreatePortalAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, temp_password }: { id: string; temp_password: string }) =>
      createPortalAccess(id, temp_password),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['clients', id] })
      toast.success('Portal account created — credentials sent by email')
    },
    onError: () => toast.error('Failed to create portal account'),
  })
}
```

- [ ] **Step 3: Create `frontend/src/hooks/useInvoices.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { fetchInvoices, fetchInvoice } from '@/api/invoices'

export function useInvoices(params?: { status?: string; client_id?: string; job_id?: string }) {
  return useQuery({ queryKey: ['invoices', params], queryFn: () => fetchInvoices(params) })
}

export function useInvoice(id: string) {
  return useQuery({ queryKey: ['invoices', id], queryFn: () => fetchInvoice(id), enabled: !!id })
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useJobs.ts frontend/src/hooks/useClients.ts \
        frontend/src/hooks/useInvoices.ts
git commit -m "feat: add Jobs, Clients, and Invoices TanStack Query hooks"
```

---

## Chunk 2: Jobs Pages

### Task 3: Jobs Kanban page

> **Install required packages first:**
> ```bash
> cd frontend
> npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
> ```

**Files:**
- Create: `frontend/src/pages/admin/Jobs.tsx`
- Create: `frontend/src/pages/admin/__tests__/Jobs.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/admin/__tests__/Jobs.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Jobs } from '../Jobs'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders Jobs heading', () => {
  render(<Jobs />, { wrapper: Wrapper })
  expect(screen.getByText('Jobs')).toBeInTheDocument()
})

it('renders New Job button', () => {
  render(<Jobs />, { wrapper: Wrapper })
  expect(screen.getByRole('button', { name: /new job/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=Jobs.test
```
Expected: `Cannot find module '../Jobs'`.

- [ ] **Step 3: Create `frontend/src/pages/admin/Jobs.tsx`**

```tsx
import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useJobs, useJobStages, useCreateJob, useUpdateJob } from '@/hooks/useJobs'
import { useClients } from '@/hooks/useClients'
import type { Job } from '@/schemas/jobs'

// --- Sortable Job Card ---
function JobCard({ job }: { job: Job }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: job.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg bg-[#0c0c0c] border border-zinc-800 p-3 space-y-1 cursor-default"
    >
      <div className="flex items-center gap-2">
        <span {...attributes} {...listeners} className="cursor-grab text-zinc-600 hover:text-zinc-400">
          <GripVertical className="h-4 w-4" />
        </span>
        <Link
          to={`/admin/jobs/${job.id}`}
          className="text-sm font-medium text-white hover:text-amber-400 truncate flex-1"
        >
          {job.title}
        </Link>
      </div>
      {job.client && (
        <p className="text-xs text-zinc-400 pl-6">{job.client.name}</p>
      )}
    </div>
  )
}

// --- Create Job Modal ---
const jobFormSchema = z.object({
  client_id: z.string().uuid('Select a client'),
  title: z.string().min(1, 'Title is required'),
  stage_id: z.string().uuid('Select a stage'),
  notes: z.string().optional(),
})
type JobFormValues = z.infer<typeof jobFormSchema>

function CreateJobModal({ open, onClose, defaultStageId }: {
  open: boolean; onClose: () => void; defaultStageId?: string
}) {
  const { data: stages = [] } = useJobStages()
  const { data: clients = [] } = useClients()
  const createJob = useCreateJob()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<JobFormValues>({
      resolver: zodResolver(jobFormSchema),
      defaultValues: { stage_id: defaultStageId ?? '' },
    })

  const onSubmit = async (values: JobFormValues) => {
    await createJob.mutateAsync(values)
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-[#1a1a1a] border-zinc-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>New Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="job_client_id">Client</Label>
            <select
              id="job_client_id"
              {...register('client_id')}
              className="w-full mt-1 rounded-md bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm"
            >
              <option value="">Select client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.client_id && <p className="text-xs text-red-400 mt-1">{errors.client_id.message}</p>}
          </div>
          <div>
            <Label htmlFor="job_title">Title</Label>
            <Input id="job_title" {...register('title')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
            {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <Label>Stage</Label>
            <select
              {...register('stage_id')}
              className="w-full mt-1 rounded-md bg-zinc-900 border border-zinc-700 text-white px-3 py-2 text-sm"
            >
              <option value="">Select stage…</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.stage_id && <p className="text-xs text-red-400 mt-1">{errors.stage_id.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-400">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-400 text-black font-medium">
              Create job
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Kanban Board ---
export function Jobs() {
  const { data: stages = [] } = useJobStages()
  const { data: jobs = [] } = useJobs()
  const updateJob = useUpdateJob()
  const [modalOpen, setModalOpen] = useState(false)
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const getJobsForStage = useCallback(
    (stageId: string) => jobs.filter(j => j.stage_id === stageId),
    [jobs]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const job = jobs.find(j => j.id === event.active.id)
    setActiveJob(job ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveJob(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    // `over.id` is either a stage column id or another job id
    // Find the target stage from either case
    const targetStage = stages.find(s => s.id === over.id)
    const targetJob = jobs.find(j => j.id === over.id)
    const newStageId = targetStage?.id ?? targetJob?.stage_id

    if (!newStageId) return
    const job = jobs.find(j => j.id === active.id)
    if (!job || job.stage_id === newStageId) return

    await updateJob.mutateAsync({ id: String(active.id), payload: { stage_id: newStageId } })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Jobs</h1>
        <Button
          onClick={() => { setDefaultStageId(stages[0]?.id); setModalOpen(true) }}
          className="bg-amber-500 hover:bg-amber-400 text-black font-medium"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Job
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => (
            <div
              key={stage.id}
              id={stage.id}
              className="flex-shrink-0 w-72 rounded-xl bg-[#1a1a1a] border border-zinc-800"
            >
              {/* Column header */}
              <div
                className="px-4 py-3 rounded-t-xl flex items-center gap-2"
                style={{ borderTop: `3px solid ${stage.color}` }}
              >
                <span className="text-sm font-medium text-white">{stage.name}</span>
                <span className="ml-auto text-xs text-zinc-500">
                  {getJobsForStage(stage.id).length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[120px]">
                <SortableContext
                  items={getJobsForStage(stage.id).map(j => j.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {getJobsForStage(stage.id).map(job => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </SortableContext>
              </div>

              {/* Add job to this stage */}
              <button
                onClick={() => { setDefaultStageId(stage.id); setModalOpen(true) }}
                className="w-full px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 text-left rounded-b-xl"
              >
                + Add job
              </button>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeJob && <JobCard job={activeJob} />}
        </DragOverlay>
      </DndContext>

      <CreateJobModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultStageId={defaultStageId}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=Jobs.test
```
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Jobs.tsx \
        frontend/src/pages/admin/__tests__/Jobs.test.tsx
git commit -m "feat: add Jobs Kanban page with dnd-kit drag and drop"
```

---

### Task 4: Job Detail page

**Files:**
- Create: `frontend/src/pages/admin/JobDetail.tsx`
- Create: `frontend/src/pages/admin/__tests__/JobDetail.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/admin/__tests__/JobDetail.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JobDetail } from '../JobDetail'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/jobs/test-id']}>
        <Routes>
          <Route path="/admin/jobs/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders job detail heading', () => {
  render(<JobDetail />, { wrapper: Wrapper })
  expect(screen.getByText('Job Detail')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=JobDetail.test
```
Expected: `Cannot find module '../JobDetail'`.

- [ ] **Step 3: Create `frontend/src/pages/admin/JobDetail.tsx`**

```tsx
import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useJob, useUpdateJob, useDeleteJob, useJobStages } from '@/hooks/useJobs'
import { useInvoices } from '@/hooks/useInvoices'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { format, parseISO } from 'date-fns'

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading } = useJob(id!)
  const { data: stages = [] } = useJobStages()
  const { data: linkedInvoice } = useInvoices(id ? { job_id: id } : undefined)
  const updateJob = useUpdateJob()
  const deleteJob = useDeleteJob()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const currentStage = stages.find(s => s.id === job?.stage_id)

  const handleStageChange = async (newStageId: string) => {
    if (!id) return
    await updateJob.mutateAsync({ id, payload: { stage_id: newStageId } })
  }

  const handleDelete = async () => {
    if (!id) return
    await deleteJob.mutateAsync(id)
    navigate('/admin/jobs')
  }

  if (isLoading) {
    return <div className="text-zinc-400 p-4">Loading...</div>
  }

  if (!job) {
    return <div className="text-red-400 p-4">Job not found.</div>
  }

  const invoice = linkedInvoice?.[0] ?? null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/jobs" className="text-zinc-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-semibold text-white">Job Detail</h1>
        </div>
        <Button
          onClick={() => setDeleteOpen(true)}
          variant="ghost"
          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5 space-y-4">
            <h2 className="text-lg font-medium text-white">{job.title}</h2>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500 mb-1">Stage</p>
                <Select value={job.stage_id} onValueChange={handleStageChange}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: s.color }}
                          />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {job.shoot_date && (
                <div>
                  <p className="text-zinc-500 mb-1">Shoot date</p>
                  <p className="text-white">{format(parseISO(job.shoot_date), 'MMM d, yyyy')}</p>
                </div>
              )}
              {job.delivery_deadline && (
                <div>
                  <p className="text-zinc-500 mb-1">Delivery deadline</p>
                  <p className="text-white">{format(parseISO(job.delivery_deadline), 'MMM d, yyyy')}</p>
                </div>
              )}
            </div>

            {job.notes && (
              <div>
                <p className="text-zinc-500 text-sm mb-1">Notes</p>
                <p className="text-zinc-300 text-sm">{job.notes}</p>
              </div>
            )}
          </div>

          {/* Linked appointment */}
          {job.appointment && (
            <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Linked Appointment</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm">{job.appointment.title}</p>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    {format(parseISO(job.appointment.starts_at), 'MMM d, yyyy · HH:mm')}
                  </p>
                </div>
                <StatusBadge status={job.appointment.status} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client */}
          {job.client && (
            <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Client</h3>
              <Link
                to={`/admin/clients/${job.client_id}`}
                className="text-white hover:text-amber-400 text-sm font-medium"
              >
                {job.client.name}
              </Link>
              <p className="text-zinc-400 text-xs mt-1">{job.client.email}</p>
            </div>
          )}

          {/* Linked Invoice */}
          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Invoice</h3>
            {invoice ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge status={invoice.status} />
                  <span className="text-white text-sm font-medium">€{invoice.total}</span>
                </div>
                <p className="text-zinc-400 text-xs">Balance due: €{invoice.balance_due}</p>
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No invoice linked</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete job?"
        description={`This will permanently delete "${job.title}". This cannot be undone.`}
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
npm test -- --testPathPattern=JobDetail.test
```
Expected: 1 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/JobDetail.tsx \
        frontend/src/pages/admin/__tests__/JobDetail.test.tsx
git commit -m "feat: add Job Detail page with stage selector, linked appointment, and invoice"
```

---

## Chunk 3: Clients Pages

### Task 5: Clients table page

**Files:**
- Create: `frontend/src/pages/admin/Clients.tsx`
- Create: `frontend/src/pages/admin/__tests__/Clients.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/admin/__tests__/Clients.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Clients } from '../Clients'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders Clients heading', () => {
  render(<Clients />, { wrapper: Wrapper })
  expect(screen.getByText('Clients')).toBeInTheDocument()
})

it('renders search input', () => {
  render(<Clients />, { wrapper: Wrapper })
  expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
})

it('renders New Client button', () => {
  render(<Clients />, { wrapper: Wrapper })
  expect(screen.getByRole('button', { name: /new client/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=Clients.test
```
Expected: `Cannot find module '../Clients'`.

- [ ] **Step 3: Create `frontend/src/pages/admin/Clients.tsx`**

```tsx
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useClients, useCreateClient, useDeleteClient } from '@/hooks/useClients'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Client } from '@/schemas/clients'
import { format, parseISO } from 'date-fns'

const clientFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  tags: z.string().optional(),  // comma-separated string, split on submit
  portal_access: z.boolean().default(false),
  temp_password: z.string().optional(),
}).refine(
  (d) => !d.portal_access || (d.temp_password && d.temp_password.length >= 8),
  { message: 'Temporary password (8+ chars) required when enabling portal access', path: ['temp_password'] }
)
type ClientFormValues = z.infer<typeof clientFormSchema>

function CreateClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createClient = useCreateClient()
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } =
    useForm<ClientFormValues>({ resolver: zodResolver(clientFormSchema), defaultValues: { portal_access: false } })

  const portalAccess = watch('portal_access')

  const onSubmit = async (values: ClientFormValues) => {
    await createClient.mutateAsync({
      name: values.name,
      email: values.email,
      phone: values.phone || null,
      tags: values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      portal_access: values.portal_access,
      temp_password: values.portal_access ? values.temp_password : undefined,
    })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-[#1a1a1a] border-zinc-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="c_name">Name</Label>
            <Input id="c_name" {...register('name')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="c_email">Email</Label>
            <Input id="c_email" type="email" {...register('email')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="c_phone">Phone (optional)</Label>
            <Input id="c_phone" {...register('phone')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
          </div>
          <div>
            <Label htmlFor="c_tags">Tags (comma-separated)</Label>
            <Input id="c_tags" {...register('tags')} placeholder="wedding, portrait" className="bg-zinc-900 border-zinc-700 text-white mt-1" />
          </div>

          {/* Portal access section */}
          <div className="rounded-lg border border-zinc-700 p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('portal_access')} className="rounded" />
              <span className="text-sm text-white">Enable portal access</span>
            </label>
            {portalAccess && (
              <div>
                <Label htmlFor="c_temp_pw">Temporary password</Label>
                <Input
                  id="c_temp_pw"
                  type="password"
                  {...register('temp_password')}
                  placeholder="Min. 8 characters"
                  className="bg-zinc-900 border-zinc-700 text-white mt-1"
                />
                {errors.temp_password && (
                  <p className="text-xs text-red-400 mt-1">{errors.temp_password.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-400">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-400 text-black font-medium">
              Create client
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Clients() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const [searchInput, setSearchInput] = useState(search)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)

  const { data: clients = [], isLoading } = useClients(search ? { search } : undefined)
  const deleteClient = useDeleteClient()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams(searchInput ? { search: searchInput } : {})
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteClient.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Clients</h1>
        <Button onClick={() => setModalOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-medium">
          <Plus className="h-4 w-4 mr-1" />
          New Client
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-700 text-white"
          />
        </div>
        <Button type="submit" variant="outline" className="border-zinc-700 text-white bg-zinc-900 hover:bg-zinc-800">
          Search
        </Button>
      </form>

      {/* Table */}
      <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-zinc-400">Loading...</p>
        ) : clients.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">
            {search ? `No clients matching "${search}".` : 'No clients yet.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-zinc-400 font-medium">Name</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Email</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Tags</th>
                <th className="px-4 py-3 text-zinc-400 font-medium">Since</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/clients/${c.id}`} className="text-white hover:text-amber-400 font-medium">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{c.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-zinc-700 text-zinc-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {format(parseISO(c.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget(c)}
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

      <CreateClientModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete client?"
        description={`This will permanently delete "${deleteTarget?.name}". This cannot be undone if they have no jobs or invoices.`}
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
npm test -- --testPathPattern=Clients.test
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Clients.tsx \
        frontend/src/pages/admin/__tests__/Clients.test.tsx
git commit -m "feat: add Clients page with searchable table and create modal"
```

---

### Task 6: Client Detail page

**Files:**
- Create: `frontend/src/pages/admin/ClientDetail.tsx`
- Create: `frontend/src/pages/admin/__tests__/ClientDetail.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/admin/__tests__/ClientDetail.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClientDetail } from '../ClientDetail'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/clients/test-id']}>
        <Routes>
          <Route path="/admin/clients/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders Client Detail heading', () => {
  render(<ClientDetail />, { wrapper: Wrapper })
  expect(screen.getByText('Client Detail')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=ClientDetail.test
```
Expected: `Cannot find module '../ClientDetail'`.

- [ ] **Step 3: Create `frontend/src/pages/admin/ClientDetail.tsx`**

```tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useClient, useTogglePortalAccess, useCreatePortalAccess } from '@/hooks/useClients'
import { useJobs } from '@/hooks/useJobs'
import { format, parseISO } from 'date-fns'

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: client, isLoading } = useClient(id!)
  const { data: jobs = [] } = useJobs(id ? { client_id: id } : undefined)
  const togglePortal = useTogglePortalAccess()
  const createPortal = useCreatePortalAccess()

  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [showPortalSetup, setShowPortalSetup] = useState(false)

  const handleTogglePortal = async (is_active: boolean) => {
    if (!id) return
    await togglePortal.mutateAsync({ id, is_active })
    setDeactivateOpen(false)
  }

  const handleCreatePortal = async () => {
    if (!id || !tempPassword) return
    await createPortal.mutateAsync({ id, temp_password: tempPassword })
    setTempPassword('')
    setShowPortalSetup(false)
  }

  if (isLoading) return <div className="text-zinc-400 p-4">Loading...</div>
  if (!client) return <div className="text-red-400 p-4">Client not found.</div>

  const hasPortal = client.user_id !== null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/clients" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold text-white">Client Detail</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: contact info + stats */}
        <div className="space-y-4">
          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5 space-y-3">
            <h2 className="text-lg font-medium text-white">{client.name}</h2>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-400">{client.email}</p>
              {client.phone && <p className="text-zinc-400">{client.phone}</p>}
              {client.address && <p className="text-zinc-400">{client.address}</p>}
              {client.birthday && (
                <p className="text-zinc-400">
                  🎂 {format(parseISO(client.birthday), 'MMMM d')}
                </p>
              )}
            </div>
            {client.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {client.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Stats</h3>
            <p className="text-white text-lg font-semibold">€{client.total_spent.toFixed(2)}</p>
            <p className="text-zinc-500 text-xs">Total spent (posted)</p>
          </div>

          {/* Portal access */}
          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Portal Access</h3>
            {!hasPortal ? (
              showPortalSetup ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="portal_pw" className="text-zinc-400">Temporary password</Label>
                    <Input
                      id="portal_pw"
                      type="password"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="bg-zinc-900 border-zinc-700 text-white mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreatePortal}
                      disabled={tempPassword.length < 8 || createPortal.isPending}
                      className="bg-amber-500 hover:bg-amber-400 text-black"
                    >
                      Create account
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowPortalSetup(false)} className="text-zinc-400">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-zinc-500 text-sm mb-3">No portal account yet.</p>
                  <Button size="sm" onClick={() => setShowPortalSetup(true)} className="bg-zinc-700 hover:bg-zinc-600 text-white">
                    Create portal account
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">
                    Status:{' '}
                    <span className={client.is_active ? 'text-emerald-400' : 'text-red-400'}>
                      {client.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </span>
                </div>
                {client.is_active ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeactivateOpen(true)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    Deactivate portal access
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleTogglePortal(true)}
                    disabled={togglePortal.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Reactivate portal access
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: job history */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400">Job History ({jobs.length})</h3>
            </div>
            {jobs.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">No jobs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-zinc-400 font-medium">Job</th>
                    <th className="px-4 py-3 text-zinc-400 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {jobs.map(j => (
                    <tr key={j.id} className="hover:bg-zinc-900/50">
                      <td className="px-4 py-3">
                        <Link to={`/admin/jobs/${j.id}`} className="text-white hover:text-amber-400">
                          {j.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {format(parseISO(j.created_at), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate portal access?"
        description={`${client.name} will immediately be blocked from logging in. Their data is preserved. You can reactivate at any time.`}
        confirmLabel="Deactivate"
        onConfirm={() => handleTogglePortal(false)}
        destructive
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=ClientDetail.test
```
Expected: 1 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/ClientDetail.tsx \
        frontend/src/pages/admin/__tests__/ClientDetail.test.tsx
git commit -m "feat: add Client Detail page with portal access management"
```

---

## Chunk 4: Wire Routes

### Task 7: Update routes/index.tsx + full verification

**Files:**
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Replace stub job/client routes with real pages**

Update the `/admin` children array in `routes/index.tsx` (replace stub `<div>` elements):

```tsx
// Add imports at top of routes/index.tsx
import { Jobs } from '@/pages/admin/Jobs'
import { JobDetail } from '@/pages/admin/JobDetail'
import { Clients } from '@/pages/admin/Clients'
import { ClientDetail } from '@/pages/admin/ClientDetail'

// Replace stub routes in the /admin children array:
{ path: 'jobs', element: <Jobs /> },
{ path: 'jobs/:id', element: <JobDetail /> },
{ path: 'clients', element: <Clients /> },
{ path: 'clients/:id', element: <ClientDetail /> },
```

- [ ] **Step 2: Run full test suite**

```bash
cd frontend
npm test -- --passWithNoTests
```
Expected: all PASS — no regressions.

- [ ] **Step 3: Verify dev server**

```bash
npm run dev
```
Navigate to `http://localhost:5173/admin/jobs` and `http://localhost:5173/admin/clients`. Both pages render (with empty state when backend has no data).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "feat: wire Jobs and Clients pages into admin router"
```
