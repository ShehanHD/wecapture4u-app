import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { format, parseISO, isAfter } from 'date-fns'
import { useMyJobs, useMyProfile } from '@/hooks/useClientPortal'
import type { ClientJob } from '@/schemas/clientPortal'

function stageBadgeStyle(color: string): React.CSSProperties {
  return { background: `${color}22`, color, border: `1px solid ${color}44`, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }
}

function JobCard({ job }: { job: ClientJob }) {
  return (
    <Link
      to={`/client/jobs/${job.id}`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 12, padding: '13px 16px', textDecoration: 'none', transition: 'box-shadow 0.15s, border-color 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(77,121,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = '#c8d8ff' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.borderColor = '#e0e8ff' }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', marginBottom: 2 }}>{job.appointment_title}</p>
        <p style={{ fontSize: 11, color: '#778899' }}>{format(parseISO(job.appointment_starts_at), 'MMMM d, yyyy')}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {job.delivery_url && (
          <a
            href={job.delivery_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#4d79ff', fontWeight: 600, textDecoration: 'none' }}
          >
            <ExternalLink size={12} />
            Photos
          </a>
        )}
        <span style={stageBadgeStyle(job.stage_color)}>{job.stage_name}</span>
      </div>
    </Link>
  )
}

export function ClientHome() {
  const { data: jobs = [], isLoading } = useMyJobs()
  const { data: profile } = useMyProfile()

  const now = new Date()
  const sortedJobs = [...jobs].sort(
    (a, b) => parseISO(b.appointment_starts_at).getTime() - parseISO(a.appointment_starts_at).getTime(),
  )
  const nextSession = jobs
    .filter(j => isAfter(parseISO(j.appointment_starts_at), now))
    .sort((a, b) => parseISO(a.appointment_starts_at).getTime() - parseISO(b.appointment_starts_at).getTime())[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>
          Welcome back{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''} 👋
        </h1>
        <p style={{ fontSize: 13, color: '#778899', marginTop: 3 }}>Here's an overview of your sessions and photos.</p>
      </div>

      {/* Upcoming session banner */}
      {!isLoading && nextSession && (
        <div style={{ background: 'linear-gradient(135deg, #0a0e2e, #1a3468)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ display: 'inline-flex', background: 'rgba(77,121,255,0.2)', border: '1px solid rgba(77,121,255,0.35)', borderRadius: 999, padding: '2px 10px', fontSize: 10, color: '#7aa5ff', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 6 }}>
              📅 Upcoming session
            </span>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#f8f9ff' }}>{nextSession.appointment_title}</p>
            <p style={{ fontSize: 12, color: '#7aa5ff', marginTop: 2 }}>
              {format(parseISO(nextSession.appointment_starts_at), 'EEEE, MMMM d · h:mm a')}
            </p>
          </div>
          <Link
            to={`/client/jobs/${nextSession.id}`}
            style={{ background: '#4d79ff', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
          >
            View Details →
          </Link>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 64, background: '#e8f0ff', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {/* Jobs list */}
      {!isLoading && sortedJobs.length === 0 && (
        <div style={{ background: '#ffffff', border: '1.5px dashed #e0e8ff', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#778899', marginBottom: 12 }}>No sessions yet.</p>
          <Link
            to="/client/book"
            style={{ display: 'inline-block', background: '#4d79ff', color: '#fff', borderRadius: 9, padding: '8px 20px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
          >
            Book a session
          </Link>
        </div>
      )}

      {!isLoading && sortedJobs.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0a0e2e', marginBottom: 10 }}>Your Sessions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedJobs.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        </div>
      )}
    </div>
  )
}
