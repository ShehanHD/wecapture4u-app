# weCapture4U — Admin Frontend: Notifications, Settings & Profile

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Notifications full-page history view, Settings page (four tabs: Work Stages, Session Types, Tax, PDF Invoices), and Profile page (edit info, change password, avatar upload, biometric device management). These complete the admin module UI.

**Architecture:** Notifications page is a full list view with mark-as-read and type filter — data comes from the same `useNotifications` hook as the bell dropdown (Plan 5). Settings page uses a tab layout with one tab per concern. Profile page uses the `/api/profile` endpoints from Plan 2. Job stage drag-and-drop reorder in Settings uses `@dnd-kit/sortable` (already installed in Plan 6).

**Depends on:** Plan 1 (Frontend scaffold), Plan 2 (Auth — profile endpoints, biometric credential management), Plan 5 (AdminShell, useNotifications hook, useSettings hook), Plan 6 (@dnd-kit installed, getApiErrorMessage utility).

**Tech Stack:** React 18 + TypeScript, TanStack Query v5, react-hook-form, Zod, @dnd-kit/sortable, shadcn/ui, Tailwind CSS.

---

## File Structure

```
frontend/src/
  api/
    profile.ts            # Typed API functions — /api/profile endpoints
  hooks/
    useProfile.ts         # TanStack Query hooks for profile CRUD
  pages/
    admin/
      Notifications.tsx   # /admin/notifications — full history with filter + mark-read
      Settings.tsx        # /admin/settings — 4-tab layout
      Profile.tsx         # /admin/profile — edit info, password, avatar, biometric devices
  routes/
    index.tsx             # Updated: replace stub notification/settings/profile routes
```

---

## Chunk 1: Profile API + Hook

### Task 1: Profile API functions + useProfile hook

**Files:**
- Create: `frontend/src/api/profile.ts`
- Create: `frontend/src/hooks/useProfile.ts`
- Create: `frontend/src/schemas/profile.ts`
- Create: `frontend/src/schemas/__tests__/profile.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/schemas/__tests__/profile.test.ts
import { ProfileSchema, WebAuthnCredentialSchema } from '../profile'

describe('ProfileSchema', () => {
  it('parses valid profile', () => {
    const result = ProfileSchema.safeParse({
      full_name: 'Alice Smith',
      email: 'alice@example.com',
      avatar_url: null,
      role: 'admin',
    })
    expect(result.success).toBe(true)
  })
})

describe('WebAuthnCredentialSchema', () => {
  it('parses valid credential', () => {
    const result = WebAuthnCredentialSchema.safeParse({
      credential_id: 'abc123',
      device_name: 'MacBook Pro · Chrome',
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend
npm test -- --testPathPattern=profile.test
```
Expected: `Cannot find module '../profile'`.

- [ ] **Step 3: Create `frontend/src/schemas/profile.ts`**

```typescript
import { z } from 'zod'

export const ProfileSchema = z.object({
  full_name: z.string(),
  email: z.string().email(),
  avatar_url: z.string().nullable(),
  role: z.enum(['admin', 'client']),
})
export type Profile = z.infer<typeof ProfileSchema>

export const WebAuthnCredentialSchema = z.object({
  credential_id: z.string(),
  device_name: z.string().nullable(),
  created_at: z.string(),
})
export type WebAuthnCredential = z.infer<typeof WebAuthnCredentialSchema>

export const WebAuthnCredentialListSchema = z.array(WebAuthnCredentialSchema)
```

- [ ] **Step 4: Create `frontend/src/api/profile.ts`**

```typescript
import { api } from '@/lib/axios'
import { ProfileSchema, WebAuthnCredentialListSchema, type Profile, type WebAuthnCredential } from '@/schemas/profile'

export type { Profile, WebAuthnCredential }

export async function fetchProfile(): Promise<Profile> {
  const { data } = await api.get('/profile')
  return ProfileSchema.parse(data)
}

export async function updateProfile(payload: {
  full_name?: string
  email?: string
  current_password?: string
}): Promise<Profile> {
  const { data } = await api.patch('/profile', payload)
  return ProfileSchema.parse(data)
}

export async function changePassword(payload: {
  current_password: string
  new_password: string
}): Promise<void> {
  await api.post('/profile/change-password', payload)
}

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/profile/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { avatar_url: string }
}

export async function fetchWebAuthnCredentials(): Promise<WebAuthnCredential[]> {
  const { data } = await api.get('/auth/webauthn/credentials')
  return WebAuthnCredentialListSchema.parse(data)
}

export async function deleteWebAuthnCredential(credentialId: string): Promise<void> {
  await api.delete(`/auth/webauthn/credentials/${credentialId}`)
}
```

- [ ] **Step 5: Create `frontend/src/hooks/useProfile.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchProfile, updateProfile, changePassword, uploadAvatar,
  fetchWebAuthnCredentials, deleteWebAuthnCredential,
} from '@/api/profile'
import { getApiErrorMessage } from '@/lib/apiError'

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: fetchProfile })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Profile updated')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to update profile'))
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => toast.success('Password changed'),
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to change password — check your current password'))
    },
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Avatar updated')
    },
    onError: () => toast.error('Failed to upload avatar'),
  })
}

export function useWebAuthnCredentials() {
  return useQuery({
    queryKey: ['webauthn-credentials'],
    queryFn: fetchWebAuthnCredentials,
  })
}

export function useDeleteWebAuthnCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteWebAuthnCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webauthn-credentials'] })
      toast.success('Device removed')
    },
    onError: () => toast.error('Failed to remove device'),
  })
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- --testPathPattern=profile.test
```
Expected: 2 PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/schemas/profile.ts frontend/src/api/profile.ts \
        frontend/src/hooks/useProfile.ts \
        frontend/src/schemas/__tests__/profile.test.ts
git commit -m "feat: add profile API functions and hooks"
```

---

## Chunk 2: Pages

### Task 2: Notifications full-page history view

**Files:**
- Create: `frontend/src/pages/admin/Notifications.tsx`
- Create: `frontend/src/pages/admin/__tests__/Notifications.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/admin/__tests__/Notifications.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Notifications } from '../Notifications'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders Notifications heading', () => {
  render(<Notifications />, { wrapper: Wrapper })
  expect(screen.getByText('Notifications')).toBeInTheDocument()
})

it('renders Mark all read button', () => {
  render(<Notifications />, { wrapper: Wrapper })
  expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument()
})

it('renders type filter dropdown', () => {
  render(<Notifications />, { wrapper: Wrapper })
  expect(screen.getByRole('combobox')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=Notifications.test
```
Expected: `Cannot find module '../Notifications'`.

- [ ] **Step 3: Create `frontend/src/pages/admin/Notifications.tsx`**

```tsx
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/useNotifications'

const TYPE_LABELS: Record<string, string> = {
  appointment_reminder: 'Appointment reminder',
  birthday: 'Birthday',
  invoice_overdue: 'Invoice overdue',
  booking_request_received: 'Booking request',
}

export function Notifications() {
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const { data: notifications = [], isLoading } = useNotifications(
    typeFilter ? { type: typeFilter } : undefined
  )
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Notifications</h1>
        <Button
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
          variant="outline"
          className="border-zinc-700 text-white bg-zinc-900 hover:bg-zinc-800"
        >
          Mark all read
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select
          value={typeFilter ?? 'all'}
          onValueChange={(v) => setTypeFilter(v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-52 bg-zinc-900 border-zinc-700 text-white">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="appointment_reminder">Appointment reminders</SelectItem>
            <SelectItem value="birthday">Birthdays</SelectItem>
            <SelectItem value="invoice_overdue">Invoice overdue</SelectItem>
            <SelectItem value="booking_request_received">Booking requests</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-zinc-500">{notifications.length} notification(s)</span>
      </div>

      {/* List */}
      <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 divide-y divide-zinc-800">
        {isLoading ? (
          <p className="p-6 text-sm text-zinc-400">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">No notifications.</p>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={cn(
                'flex items-start justify-between px-5 py-4 gap-4',
                !n.read && 'bg-zinc-900/40'
              )}
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {!n.read && (
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  )}
                  <p className={cn('text-sm font-medium truncate', n.read ? 'text-zinc-300' : 'text-white')}>
                    {n.title}
                  </p>
                </div>
                <p className="text-xs text-zinc-400">{n.body}</p>
                <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                  <span>{TYPE_LABELS[n.type] ?? n.type}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                </div>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead.mutate(n.id)}
                  className="shrink-0 text-xs text-amber-500 hover:text-amber-400 mt-0.5"
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=Notifications.test
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Notifications.tsx \
        frontend/src/pages/admin/__tests__/Notifications.test.tsx
git commit -m "feat: add Notifications full-page history view"
```

---

### Task 3: Settings page — 4 tabs

**Files:**
- Create: `frontend/src/pages/admin/Settings.tsx`
- Create: `frontend/src/pages/admin/__tests__/Settings.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/admin/__tests__/Settings.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Settings } from '../Settings'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders Settings heading', () => {
  render(<Settings />, { wrapper: Wrapper })
  expect(screen.getByText('Settings')).toBeInTheDocument()
})

it('renders all 4 tab labels', () => {
  render(<Settings />, { wrapper: Wrapper })
  expect(screen.getByRole('tab', { name: /work stages/i })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /session types/i })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /tax/i })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /pdf invoices/i })).toBeInTheDocument()
})

it('switches to Session Types tab on click', async () => {
  const user = userEvent.setup()
  render(<Settings />, { wrapper: Wrapper })
  await user.click(screen.getByRole('tab', { name: /session types/i }))
  expect(screen.getByText(/add session type/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=Settings.test
```
Expected: `Cannot find module '../Settings'`.

- [ ] **Step 3: Create `frontend/src/pages/admin/Settings.tsx`**

```tsx
import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  useAppSettings, useUpdateSettings,
  useSessionTypes, useCreateSessionType, useDeleteSessionType,
} from '@/hooks/useSettings'
import {
  useJobStages, useCreateJob, useDeleteJobStage, useReorderJobStages,
} from '@/hooks/useJobs'
import type { JobStage } from '@/schemas/jobs'

// --- Work Stages Tab ---
function SortableStageRow({ stage }: { stage: JobStage }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 bg-[#1a1a1a] rounded-lg border border-zinc-800"
    >
      <span {...attributes} {...listeners} className="cursor-grab text-zinc-600 hover:text-zinc-400">
        <GripVertical className="h-4 w-4" />
      </span>
      <span
        className="inline-block h-3 w-3 rounded-full shrink-0"
        style={{ background: stage.color }}
      />
      <span className="text-sm text-white flex-1">{stage.name}</span>
      {stage.is_terminal && (
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">terminal</span>
      )}
    </div>
  )
}

function WorkStagesTab() {
  const { data: stages = [] } = useJobStages()
  const reorder = useReorderJobStages()
  const deleteStage = useDeleteJobStage()
  const [deleteTarget, setDeleteTarget] = useState<JobStage | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = stages.findIndex(s => s.id === active.id)
    const newIndex = stages.findIndex(s => s.id === over.id)
    const reordered = arrayMove(stages, oldIndex, newIndex)
    await reorder.mutateAsync(reordered.map((s, i) => ({ id: s.id, position: i + 1 })))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Drag to reorder. Terminal stages are excluded from "active jobs" in the client portal.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {stages.map(stage => <SortableStageRow key={stage.id} stage={stage} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// --- Session Types Tab ---
function SessionTypesTab() {
  const { data: types = [] } = useSessionTypes()
  const createType = useCreateSessionType()
  const deleteType = useDeleteSessionType()
  const [newName, setNewName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createType.mutateAsync(newName.trim())
    setNewName('')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Wedding, Portrait…"
          className="bg-zinc-900 border-zinc-700 text-white max-w-xs"
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
        />
        <Button
          onClick={handleCreate}
          disabled={!newName.trim() || createType.isPending}
          className="bg-amber-500 hover:bg-amber-400 text-black"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add session type
        </Button>
      </div>

      <div className="space-y-2">
        {types.length === 0 ? (
          <p className="text-sm text-zinc-500">No session types yet.</p>
        ) : (
          types.map(t => (
            <div
              key={t.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#1a1a1a] border border-zinc-800"
            >
              <span className="text-sm text-white">{t.name}</span>
              <button
                onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                className="text-zinc-500 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete session type?"
        description={`Delete "${deleteTarget?.name}"? This will fail if any appointments reference it.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteTarget) await deleteType.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
        destructive
      />
    </div>
  )
}

// --- Tax Tab ---
function TaxTab() {
  const { data: settings } = useAppSettings()
  const updateSettings = useUpdateSettings()

  const handleToggleTax = async () => {
    await updateSettings.mutateAsync({ tax_enabled: !settings?.tax_enabled })
  }

  return (
    <div className="space-y-4 max-w-sm">
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={handleToggleTax}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings?.tax_enabled ? 'bg-amber-500' : 'bg-zinc-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              settings?.tax_enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </div>
        <span className="text-sm text-white">Enable tax on invoices</span>
      </label>

      {settings?.tax_enabled && (
        <div>
          <Label htmlFor="tax_rate" className="text-zinc-400">Default tax rate (%)</Label>
          <Input
            id="tax_rate"
            type="number"
            step="0.01"
            defaultValue={settings?.tax_rate}
            onBlur={async (e) => {
              await updateSettings.mutateAsync({ tax_rate: e.target.value })
            }}
            className="bg-zinc-900 border-zinc-700 text-white mt-1 max-w-[120px]"
          />
        </div>
      )}

      <p className="text-xs text-zinc-500">
        When disabled, the tax field is hidden on invoice forms and omitted from totals.
      </p>
    </div>
  )
}

// --- PDF Invoices Tab ---
function PdfInvoicesTab() {
  const { data: settings } = useAppSettings()
  const updateSettings = useUpdateSettings()

  const handleToggle = async () => {
    await updateSettings.mutateAsync({ pdf_invoices_enabled: !settings?.pdf_invoices_enabled })
  }

  return (
    <div className="space-y-4 max-w-sm">
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings?.pdf_invoices_enabled ? 'bg-amber-500' : 'bg-zinc-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              settings?.pdf_invoices_enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </div>
        <span className="text-sm text-white">Enable PDF invoice export</span>
      </label>
      <p className="text-xs text-zinc-500">
        When enabled, a "Download PDF" button appears on the invoice detail view.
      </p>
    </div>
  )
}

// --- Main Settings Page ---
export function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Settings</h1>

      <Tabs defaultValue="stages" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="stages" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
            Work Stages
          </TabsTrigger>
          <TabsTrigger value="session-types" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
            Session Types
          </TabsTrigger>
          <TabsTrigger value="tax" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
            Tax
          </TabsTrigger>
          <TabsTrigger value="pdf" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
            PDF Invoices
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stages" className="mt-6"><WorkStagesTab /></TabsContent>
        <TabsContent value="session-types" className="mt-6"><SessionTypesTab /></TabsContent>
        <TabsContent value="tax" className="mt-6"><TaxTab /></TabsContent>
        <TabsContent value="pdf" className="mt-6"><PdfInvoicesTab /></TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=Settings.test
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Settings.tsx \
        frontend/src/pages/admin/__tests__/Settings.test.tsx
git commit -m "feat: add Settings page with 4 tabs (Work Stages, Session Types, Tax, PDF)"
```

---

### Task 4: Profile page

**Files:**
- Create: `frontend/src/pages/admin/Profile.tsx`
- Create: `frontend/src/pages/admin/__tests__/Profile.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/pages/admin/__tests__/Profile.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Profile } from '../Profile'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders Profile heading', () => {
  render(<Profile />, { wrapper: Wrapper })
  expect(screen.getByText('Profile')).toBeInTheDocument()
})

it('renders avatar upload section', () => {
  render(<Profile />, { wrapper: Wrapper })
  expect(screen.getByText(/change photo/i)).toBeInTheDocument()
})

it('renders biometric devices section', () => {
  render(<Profile />, { wrapper: Wrapper })
  expect(screen.getByText(/registered devices/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=Profile.test
```
Expected: `Cannot find module '../Profile'`.

- [ ] **Step 3: Create `frontend/src/pages/admin/Profile.tsx`**

```tsx
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  useProfile, useUpdateProfile, useChangePassword,
  useUploadAvatar, useWebAuthnCredentials, useDeleteWebAuthnCredential,
} from '@/hooks/useProfile'
import { format, parseISO } from 'date-fns'

// --- Edit Info Form ---
const infoSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  current_password: z.string().optional(),
})
type InfoFormValues = z.infer<typeof infoSchema>

function EditInfoForm() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting, isDirty } } =
    useForm<InfoFormValues>({
      resolver: zodResolver(infoSchema),
      values: { full_name: profile?.full_name ?? '', email: profile?.email ?? '' },
    })

  const emailValue = watch('email')
  const emailChanged = profile && emailValue !== profile.email

  const onSubmit = async (values: InfoFormValues) => {
    await updateProfile.mutateAsync({
      full_name: values.full_name,
      ...(emailChanged ? { email: values.email, current_password: values.current_password } : {}),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="full_name" className="text-zinc-400">Full name</Label>
        <Input
          id="full_name"
          {...register('full_name')}
          className="bg-zinc-900 border-zinc-700 text-white mt-1"
        />
        {errors.full_name && <p className="text-xs text-red-400 mt-1">{errors.full_name.message}</p>}
      </div>
      <div>
        <Label htmlFor="email" className="text-zinc-400">Email</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          className="bg-zinc-900 border-zinc-700 text-white mt-1"
        />
        {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
      </div>
      {emailChanged && (
        <div>
          <Label htmlFor="current_pw_info" className="text-zinc-400">
            Current password (required to change email)
          </Label>
          <Input
            id="current_pw_info"
            type="password"
            {...register('current_password')}
            className="bg-zinc-900 border-zinc-700 text-white mt-1"
          />
        </div>
      )}
      <Button
        type="submit"
        disabled={!isDirty || isSubmitting}
        className="bg-amber-500 hover:bg-amber-400 text-black font-medium"
      >
        Save changes
      </Button>
    </form>
  )
}

// --- Change Password Form ---
const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'At least 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})
type PasswordFormValues = z.infer<typeof passwordSchema>

function ChangePasswordForm() {
  const changePw = useChangePassword()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) })

  const onSubmit = async (values: PasswordFormValues) => {
    await changePw.mutateAsync({
      current_password: values.current_password,
      new_password: values.new_password,
    })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="cur_pw" className="text-zinc-400">Current password</Label>
        <Input id="cur_pw" type="password" {...register('current_password')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
        {errors.current_password && <p className="text-xs text-red-400 mt-1">{errors.current_password.message}</p>}
      </div>
      <div>
        <Label htmlFor="new_pw" className="text-zinc-400">New password</Label>
        <Input id="new_pw" type="password" {...register('new_password')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
        {errors.new_password && <p className="text-xs text-red-400 mt-1">{errors.new_password.message}</p>}
      </div>
      <div>
        <Label htmlFor="confirm_pw" className="text-zinc-400">Confirm new password</Label>
        <Input id="confirm_pw" type="password" {...register('confirm_password')} className="bg-zinc-900 border-zinc-700 text-white mt-1" />
        {errors.confirm_password && <p className="text-xs text-red-400 mt-1">{errors.confirm_password.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-400 text-black font-medium">
        Change password
      </Button>
    </form>
  )
}

// --- Main Profile Page ---
export function Profile() {
  const { data: profile } = useProfile()
  const uploadAvatar = useUploadAvatar()
  const { data: credentials = [] } = useWebAuthnCredentials()
  const deleteCredential = useDeleteWebAuthnCredential()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A'

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadAvatar.mutateAsync(file)
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-white">Profile</h1>

      {/* Avatar */}
      <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Photo</h2>
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
            <AvatarFallback className="bg-zinc-700 text-2xl text-white">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatar.isPending}
              variant="outline"
              className="border-zinc-700 text-white bg-zinc-900 hover:bg-zinc-800"
            >
              {uploadAvatar.isPending ? 'Uploading…' : 'Change photo'}
            </Button>
            <p className="text-xs text-zinc-500 mt-1">Resized to 256×256 WebP. Max 5MB.</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Edit info */}
      <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Personal info</h2>
        <EditInfoForm />
      </div>

      {/* Change password */}
      <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Change password</h2>
        <ChangePasswordForm />
      </div>

      {/* Biometric devices */}
      <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Registered devices</h2>
        {credentials.length === 0 ? (
          <p className="text-sm text-zinc-500">No biometric devices registered.</p>
        ) : (
          <ul className="space-y-3">
            {credentials.map(cred => (
              <li
                key={cred.credential_id}
                className="flex items-center justify-between bg-zinc-900 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-zinc-500" />
                  <div>
                    <p className="text-sm text-white">{cred.device_name ?? 'Unknown device'}</p>
                    <p className="text-xs text-zinc-500">
                      Registered {format(parseISO(cred.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteCredential.mutate(cred.credential_id)}
                  className="text-zinc-500 hover:text-red-400"
                  aria-label={`Remove ${cred.device_name ?? 'device'}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-zinc-500 mt-3">
          Add this device: go to <a href="/admin/biometric/setup" className="text-amber-500 hover:underline">Biometric Setup</a>.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=Profile.test
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Profile.tsx \
        frontend/src/pages/admin/__tests__/Profile.test.tsx
git commit -m "feat: add Profile page with avatar upload, edit info, password change, biometric devices"
```

---

## Chunk 3: Wire Routes + Final Verification

### Task 5: Update routes/index.tsx + full admin module verification

**Files:**
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Replace stub routes with real pages**

Add imports at the top of `routes/index.tsx`:

```tsx
import { Notifications } from '@/pages/admin/Notifications'
import { Settings } from '@/pages/admin/Settings'
import { Profile } from '@/pages/admin/Profile'
```

Replace stub routes in the `/admin` children array:

```tsx
{ path: 'notifications', element: <Notifications /> },
{ path: 'settings', element: <Settings /> },
{ path: 'profile', element: <Profile /> },
```

- [ ] **Step 2: Run full frontend test suite**

```bash
cd frontend
npm test -- --passWithNoTests
```
Expected: all PASS — no regressions.

- [ ] **Step 3: TypeScript check**

```bash
npm run tsc -- --noEmit
```
Expected: no type errors.

- [ ] **Step 4: Verify dev server — all admin pages navigate**

```bash
npm run dev
```
With backend running (`uvicorn backend.main:app --reload`), log in as admin and verify each page loads:
- `/admin` — Dashboard
- `/admin/appointments` — Appointments (calendar + list)
- `/admin/jobs` — Kanban board
- `/admin/clients` — Clients table
- `/admin/notifications` — Notifications list
- `/admin/settings` — Settings with 4 tabs
- `/admin/profile` — Profile page

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "feat: complete admin module — all pages wired into router (Plans 3-7)"
```
