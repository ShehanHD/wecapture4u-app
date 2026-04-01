// frontend/src/pages/client/JobDetail.tsx
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useMyJob } from '@/hooks/useClientPortal'
import type { ClientJobStage } from '@/schemas/clientPortal'

function StageProgress({ stages, currentStageId }: { stages: ClientJobStage[]; currentStageId: string }) {
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  const currentIndex = sorted.findIndex((s) => s.id === currentStageId)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progress</p>
      <div className="flex items-center gap-1 flex-wrap">
        {sorted.map((stage, i) => {
          const isActive = stage.id === currentStageId
          const isDone = i < currentIndex
          return (
            <div key={stage.id} className="flex items-center gap-1">
              <div
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{
                  background: isActive ? stage.color : isDone ? stage.color : undefined,
                  backgroundColor: !isActive && !isDone ? 'hsl(var(--muted))' : undefined,
                  opacity: isDone ? 0.5 : 1,
                }}
              />
              <span className={`text-xs ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {stage.name}
              </span>
              {i < sorted.length - 1 && <span className="text-muted-foreground text-xs mx-0.5">→</span>}
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/client/jobs" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Job Detail</h1>
      </div>

      {isLoading && <div className="h-40 rounded-xl bg-muted animate-pulse" />}

      {!isLoading && !job && (
        <p className="text-red-400">Job not found.</p>
      )}

      {job && (
        <div className="space-y-4">
          <div className="rounded-xl bg-card border p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{job.appointment_title}</h2>
              <p className="text-muted-foreground text-sm">
                {format(parseISO(job.appointment_starts_at), 'EEEE, MMMM d, yyyy')}
              </p>
              {job.appointment_session_types.length > 0 && (
                <p className="text-muted-foreground text-sm mt-1">
                  {job.appointment_session_types.join(', ')}
                </p>
              )}
            </div>

            <StageProgress stages={job.all_stages} currentStageId={job.stage_id} />

            {job.delivery_url && (
              <a href={job.delivery_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-white/20 text-white w-full sm:w-auto">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Your Photos
                </Button>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
