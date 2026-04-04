// frontend/src/pages/admin/Settings.tsx
import { useState, useRef, useEffect } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useJobStages, useCreateJobStage, useUpdateJobStage,
  useDeleteJobStage, useReorderJobStages,
  useAlbumStages, useCreateAlbumStage, useUpdateAlbumStage,
  useDeleteAlbumStage, useReorderAlbumStages,
} from '@/hooks/useJobs'
import {
  useAppSettings, useUpdateSettings,
  useSessionTypes, useCreateSessionType,
  useUpdateSessionType, useDeleteSessionType,
} from '@/hooks/useSettings'
import type { JobStage, AlbumStage } from '@/schemas/jobs'
import type { StagePositionItem } from '@/api/jobs'
import type { AppSettings } from '@/schemas/settings'

// ─── Sortable stage row ───────────────────────────────────────────────────────

function SortableStageRow({
  stage,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  stage: JobStage
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(stage.name)
  const updateStage = useUpdateJobStage()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setName(stage.name)
  }, [stage.name, editing])

  const save = () => {
    if (name.trim() && name !== stage.name) {
      updateStage.mutate({ id: stage.id, payload: { name: name.trim() } })
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setName(stage.name); setEditing(false) }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2 border-b border-border last:border-0"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: stage.color }}
      />

      {editing ? (
        <Input
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm flex-1"
        />
      ) : (
        <button
          type="button"
          className="flex-1 text-left text-sm hover:underline bg-transparent"
          onClick={() => setEditing(true)}
        >
          {stage.name}
        </button>
      )}

      {stage.is_terminal && (
        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
          Final
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </li>
  )
}

// ─── Sortable album stage row ─────────────────────────────────────────────────

function SortableAlbumStageRow({
  stage,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  stage: AlbumStage
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(stage.name)
  const updateStage = useUpdateAlbumStage()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setName(stage.name)
  }, [stage.name, editing])

  const save = () => {
    if (name.trim() && name !== stage.name) {
      updateStage.mutate({ id: stage.id, payload: { name: name.trim() } })
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setName(stage.name); setEditing(false) }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2 border-b border-border last:border-0"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: stage.color }}
      />

      {editing ? (
        <Input
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm flex-1"
        />
      ) : (
        <button
          type="button"
          className="flex-1 text-left text-sm hover:underline bg-transparent"
          onClick={() => setEditing(true)}
        >
          {stage.name}
        </button>
      )}

      {stage.is_terminal && (
        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
          Final
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </li>
  )
}

// ─── Work Stages tab ─────────────────────────────────────────────────────────

function WorkStagesTab() {
  const { data: stages = [] } = useJobStages()
  const createStage = useCreateJobStage()
  const deleteStage = useDeleteJobStage()
  const reorder = useReorderJobStages()

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newTerminal, setNewTerminal] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const buildPositions = (ordered: JobStage[]): StagePositionItem[] =>
    ordered.map((s, i) => ({ id: s.id, position: i + 1 }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = stages.findIndex(s => s.id === active.id)
    const newIndex = stages.findIndex(s => s.id === over.id)
    const reordered = [...stages]
    reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, stages[oldIndex])
    reorder.mutate(buildPositions(reordered))
  }

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= stages.length) return
    const reordered = [...stages]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]
    reorder.mutate(buildPositions(reordered))
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    createStage.mutate(
      { name: newName.trim(), color: newColor, is_terminal: newTerminal },
      { onSuccess: () => { setNewName(''); setNewColor('#6366f1'); setNewTerminal(false) } },
    )
  }

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <ul>
            {stages.map((stage, index) => (
              <SortableStageRow
                key={stage.id}
                stage={stage}
                isFirst={index === 0}
                isLast={index === stages.length - 1}
                onMoveUp={() => moveStage(index, 'up')}
                onMoveDown={() => moveStage(index, 'down')}
                onDelete={() => deleteStage.mutate(stage.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2 pt-2">
        <Input
          placeholder="Stage name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="h-8 flex-1 text-sm"
        />
        <input
          type="color"
          value={newColor}
          onChange={e => setNewColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-border"
          title="Stage color"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={newTerminal}
            onChange={e => setNewTerminal(e.target.checked)}
            className="accent-primary"
          />
          Final
        </label>
        <Button size="sm" className="h-8" onClick={handleAdd} disabled={createStage.isPending}>
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  )
}

// ─── Album Stages tab ─────────────────────────────────────────────────────────

function AlbumStagesTab() {
  const { data: stages = [] } = useAlbumStages()
  const createStage = useCreateAlbumStage()
  const deleteStage = useDeleteAlbumStage()
  const reorder = useReorderAlbumStages()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6b7280')

  const buildPositions = (ordered: AlbumStage[]): StagePositionItem[] =>
    ordered.map((s, i) => ({ id: s.id, position: i + 1 }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = stages.findIndex(s => s.id === active.id)
    const newIndex = stages.findIndex(s => s.id === over.id)
    const reordered = [...stages]
    reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, stages[oldIndex])
    reorder.mutate(buildPositions(reordered))
  }

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= stages.length) return
    const reordered = [...stages]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]
    reorder.mutate(buildPositions(reordered))
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    createStage.mutate({ name: newName.trim(), color: newColor, is_terminal: false })
    setNewName('')
  }

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <ul>
            {stages.map((stage, index) => (
              <SortableAlbumStageRow
                key={stage.id}
                stage={stage}
                isFirst={index === 0}
                isLast={index === stages.length - 1}
                onMoveUp={() => moveStage(index, 'up')}
                onMoveDown={() => moveStage(index, 'down')}
                onDelete={() => deleteStage.mutate(stage.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="flex items-center gap-2 pt-2">
        <Input
          placeholder="Stage name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="h-8 flex-1 text-sm"
        />
        <input
          type="color"
          value={newColor}
          onChange={e => setNewColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-border"
          title="Stage color"
        />
        <Button size="sm" className="h-8" onClick={handleAdd} disabled={createStage.isPending}>
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  )
}

// ─── Session Types tab ───────────────────────────────────────────────────────

function SessionTypeRow({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const update = useUpdateSessionType()
  const del = useDeleteSessionType()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { if (!editing) setValue(name) }, [name, editing])

  const save = () => {
    if (value.trim() && value !== name) {
      update.mutate({ id, name: value.trim() })
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setValue(name); setEditing(false) }
  }

  return (
    <li className="flex items-center gap-2 py-2 border-b border-border last:border-0">
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm flex-1 rounded border border-input bg-input px-2"
        />
      ) : (
        <button
          type="button"
          className="flex-1 text-left text-sm hover:underline bg-transparent"
          onClick={() => setEditing(true)}
        >
          {name}
        </button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => del.mutate(id)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </li>
  )
}

function SessionTypesTab() {
  const { data: types = [] } = useSessionTypes()
  const create = useCreateSessionType()
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    if (!newName.trim()) return
    create.mutate(newName.trim(), { onSuccess: () => setNewName('') })
  }

  return (
    <div className="space-y-4">
      <ul>
        {types.map(t => (
          <SessionTypeRow key={t.id} id={t.id} name={t.name} />
        ))}
      </ul>
      <div className="flex gap-2 pt-2">
        <Input
          placeholder="Session type name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="h-8 flex-1 text-sm"
        />
        <Button size="sm" className="h-8" onClick={handleAdd} disabled={create.isPending}>
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  )
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── Tax tab ─────────────────────────────────────────────────────────────────

function TaxTabContent({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings()
  const [taxRate, setTaxRate] = useState(settings.tax_rate)

  return (
    <div className="space-y-6 max-w-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Enable tax on invoices</p>
          <p className="text-xs text-muted-foreground">Adds a tax line to all invoices</p>
        </div>
        <Toggle
          checked={settings.tax_enabled}
          onChange={() => update.mutate({ tax_enabled: !settings.tax_enabled })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Default tax rate (%)</Label>
        <Input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={taxRate}
          disabled={!settings.tax_enabled}
          onChange={e => setTaxRate(e.target.value)}
          onBlur={() => update.mutate({ tax_rate: taxRate })}
          className="w-32"
        />
      </div>
    </div>
  )
}

function TaxTab() {
  const { data: settings } = useAppSettings()
  if (!settings) return null
  return <TaxTabContent settings={settings} />
}

// ─── PDF Invoices tab ─────────────────────────────────────────────────────────

function PdfInvoicesTab() {
  const { data: settings } = useAppSettings()
  const update = useUpdateSettings()

  return (
    <div className="max-w-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Enable PDF invoice export</p>
          <p className="text-xs text-muted-foreground">Shows a "Download PDF" button on invoices</p>
        </div>
        <Toggle
          checked={settings?.pdf_invoices_enabled ?? false}
          onChange={() => update.mutate({ pdf_invoices_enabled: !settings?.pdf_invoices_enabled })}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Settings() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <Tabs defaultValue="stages" className="w-full">
        <TabsList>
          <TabsTrigger value="stages">Work Stages</TabsTrigger>
          <TabsTrigger value="album-stages">Album Stages</TabsTrigger>
          <TabsTrigger value="session-types">Session Types</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="pdf">PDF Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="stages" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Work Stages</h2>
            <WorkStagesTab />
          </div>
        </TabsContent>

        <TabsContent value="album-stages" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Album Stages</h2>
            <AlbumStagesTab />
          </div>
        </TabsContent>

        <TabsContent value="session-types" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Session Types</h2>
            <SessionTypesTab />
          </div>
        </TabsContent>

        <TabsContent value="tax" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Tax</h2>
            <TaxTab />
          </div>
        </TabsContent>

        <TabsContent value="pdf" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">PDF Invoices</h2>
            <PdfInvoicesTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
