import React, { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Clock, ChevronDown, BookImage } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useJobs, useAlbumStages, useUpdateJob } from '@/hooks/useJobs'
import type { Job, AlbumStage } from '@/schemas/jobs'
import { format, parseISO } from 'date-fns'

const AUTO_COLLAPSE_STAGES = ['Arrived', 'Delivered', 'Dispatched']

function JobCard({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: job.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const appt = job.appointment
  const date = appt?.starts_at ? format(parseISO(appt.starts_at), 'MMM d') : null
  const title = [appt?.title ?? 'Untitled', date].filter(Boolean).join(' · ')
  const hasDetails = job.client || appt?.notes

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg bg-card border p-3 cursor-default">
      <div className="flex items-center gap-2">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span
          className="text-sm font-medium text-foreground truncate flex-1 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
        >
          {title}
        </span>
        {hasDetails && (
          <span
            className="text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0 cursor-pointer"
            onClick={() => setExpanded(e => !e)}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </span>
        )}
      </div>

      {expanded && (
        <div className="mt-2 pl-6 space-y-1.5">
          {job.client && <p className="text-xs text-muted-foreground">{job.client.name}</p>}
          {appt?.price && Number(appt.price) > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 flex-shrink-0" />
              €{appt.price}
            </span>
          )}
          {appt?.notes && (
            <p className="text-xs text-muted-foreground/60 line-clamp-2">{appt.notes}</p>
          )}
          <Link
            to={`/admin/jobs/${job.id}`}
            className="inline-block text-xs text-brand-solid hover:opacity-70 pt-0.5"
          >
            View detail →
          </Link>
        </div>
      )}
    </div>
  )
}

function AlbumKanbanColumn({ stage, jobs }: { stage: AlbumStage; jobs: Job[] }) {
  const [collapsed, setCollapsed] = useState(() => AUTO_COLLAPSE_STAGES.includes(stage.name))
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className={`flex-shrink-0 w-10 rounded-xl bg-card border flex flex-col items-center py-3 gap-2 cursor-pointer transition-colors ${isOver ? 'bg-accent/60' : 'hover:bg-muted/60'}`}
        style={{ borderTop: `3px solid ${stage.color}` }}
        onClick={() => setCollapsed(false)}
        title={`${stage.name} (${jobs.length})`}
      >
        <span className="text-xs text-muted-foreground font-medium" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {stage.name}
        </span>
        <span className="text-xs text-muted-foreground/60 mt-auto">{jobs.length}</span>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-56 rounded-xl bg-card border flex flex-col">
      <div
        className="px-4 py-3 rounded-t-xl flex items-center gap-2 cursor-pointer select-none hover:bg-muted/40 transition-colors"
        style={{ borderTop: `3px solid ${stage.color}` }}
        onClick={() => setCollapsed(true)}
      >
        <span className="text-sm font-medium text-foreground">{stage.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{jobs.length}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div
        ref={setNodeRef}
        className={`p-2 space-y-2 min-h-[120px] flex-1 rounded-b-xl transition-colors ${isOver ? 'bg-muted/40' : ''}`}
      >
        <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map(job => <JobCard key={job.id} job={job} />)}
        </SortableContext>
      </div>
    </div>
  )
}

export function AlbumJobs() {
  const { data: albumStages = [] } = useAlbumStages()
  const { data: jobs = [] } = useJobs()
  const updateJob = useUpdateJob()
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const albumJobs = jobs.filter(j => j.album_stage_id != null)
  const getJobsForStage = useCallback(
    (stageId: string) => albumJobs.filter(j => j.album_stage_id === stageId),
    [albumJobs]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveJob(albumJobs.find(j => j.id === event.active.id) ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveJob(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const targetStage = albumStages.find(s => s.id === over.id)
    const targetJob = albumJobs.find(j => j.id === over.id)
    const newStageId = targetStage?.id ?? targetJob?.album_stage_id
    if (!newStageId) return
    const job = albumJobs.find(j => j.id === active.id)
    if (!job || job.album_stage_id === newStageId) return
    await updateJob.mutateAsync({ id: String(active.id), payload: { album_stage_id: newStageId } })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
          <BookImage className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Albums</h1>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {albumStages.map(stage => (
            <AlbumKanbanColumn key={stage.id} stage={stage} jobs={getJobsForStage(stage.id)} />
          ))}
        </div>
        <DragOverlay>
          {activeJob ? <JobCard job={activeJob} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
