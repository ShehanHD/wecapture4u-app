// frontend/src/pages/client/Jobs.tsx
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ExternalLink } from 'lucide-react'
import { useMyJobs } from '@/hooks/useClientPortal'

export function ClientJobs() {
  const { data: jobs = [], isLoading } = useMyJobs()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      )}

      {!isLoading && jobs.length === 0 && (
        <p className="text-muted-foreground text-sm">No jobs yet.</p>
      )}

      <div className="space-y-2">
        {jobs.map((job) => (
          <Link
            key={job.id}
            to={`/client/jobs/${job.id}`}
            className="flex items-center justify-between rounded-xl bg-card border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{job.appointment_title}</p>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(job.appointment_starts_at), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {job.delivery_url && (
                <a
                  href={job.delivery_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-brand-solid hover:opacity-70"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Photos
                </a>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium text-black"
                style={{ background: job.stage_color }}
              >
                {job.stage_name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
