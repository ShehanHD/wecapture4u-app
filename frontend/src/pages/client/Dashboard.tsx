// frontend/src/pages/client/Dashboard.tsx
import { Link } from 'react-router-dom'
import { CalendarPlus, ExternalLink } from 'lucide-react'
import { format, parseISO, isAfter, isBefore } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useMyJobs } from '@/hooks/useClientPortal'
import type { ClientJob } from '@/api/clientPortal'

function JobCard({ job }: { job: ClientJob }) {
  return (
    <div className="rounded-xl bg-card border p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-foreground truncate">{job.appointment_title}</p>
        <p className="text-sm text-muted-foreground">
          {format(parseISO(job.appointment_starts_at), 'MMMM d, yyyy')}
        </p>
        <span
          className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium text-black"
          style={{ background: job.stage_color }}
        >
          {job.stage_name}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {job.delivery_url && (
          <a
            href={job.delivery_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-brand-solid hover:opacity-70"
          >
            <ExternalLink className="h-4 w-4" />
            Photos
          </a>
        )}
        <Link to={`/client/jobs/${job.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          View →
        </Link>
      </div>
    </div>
  )
}

export function ClientDashboard() {
  const { data: jobs = [], isLoading } = useMyJobs()

  const now = new Date()

  const upcoming = jobs
    .filter((j) => isAfter(parseISO(j.appointment_starts_at), now))
    .sort((a, b) => parseISO(a.appointment_starts_at).getTime() - parseISO(b.appointment_starts_at).getTime())
    .slice(0, 3)

  const pending = jobs
    .filter((j) => isBefore(parseISO(j.appointment_starts_at), now) && !j.delivery_url)
    .sort((a, b) => parseISO(b.appointment_starts_at).getTime() - parseISO(a.appointment_starts_at).getTime())

  const isEmpty = !isLoading && upcoming.length === 0 && pending.length === 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isEmpty && (
        <div className="rounded-xl bg-card border p-6 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No upcoming sessions.</p>
          <Link to="/client/book">
            <Button size="sm">
              <CalendarPlus className="h-4 w-4 mr-2" />
              Book a session
            </Button>
          </Link>
        </div>
      )}

      {!isLoading && upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Upcoming Sessions</h2>
          {upcoming.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </section>
      )}

      {!isLoading && pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">In Progress</h2>
          {pending.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </section>
      )}
    </div>
  )
}
