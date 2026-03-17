import React, { useState, useCallback } from 'react'
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
              <div
                className="px-4 py-3 rounded-t-xl flex items-center gap-2"
                style={{ borderTop: `3px solid ${stage.color}` }}
              >
                <span className="text-sm font-medium text-white">{stage.name}</span>
                <span className="ml-auto text-xs text-zinc-500">
                  {getJobsForStage(stage.id).length}
                </span>
              </div>

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
