// frontend/src/pages/client/JobDetail.tsx
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useMyJob } from '@/hooks/useClientPortal'
import { usePublicSettings } from '@/hooks/usePortfolio'
import type { ClientJobStage } from '@/schemas/clientPortal'

function StageProgress({ stages, currentStageId }: { stages: ClientJobStage[]; currentStageId: string }) {
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  const currentIndex = sorted.findIndex(s => s.id === currentStageId)

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Progress</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {sorted.map((stage, i) => {
          const isActive = stage.id === currentStageId
          const isDone = i < currentIndex
          return (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: isActive ? stage.color : isDone ? `${stage.color}88` : '#e0e8ff', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: isActive ? '#0a0e2e' : '#778899', fontWeight: isActive ? 600 : 400 }}>{stage.name}</span>
              {i < sorted.length - 1 && <span style={{ color: '#c8d8ff', fontSize: 11, marginLeft: 2 }}>→</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GoogleColorLogo() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export function ClientJobDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: job, isLoading } = useMyJob(id!)
  const { data: publicSettings } = usePublicSettings()
  const writeReviewUrl = publicSettings?.google_write_review_url

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to="/client" style={{ color: '#4d79ff', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </Link>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>Session Detail</h1>
      </div>

      {isLoading && <div style={{ height: 160, background: '#e8f0ff', borderRadius: 14, animation: 'pulse 1.5s infinite' }} />}

      {!isLoading && !job && <p style={{ color: '#e05252', fontSize: 13 }}>Session not found.</p>}

      {job && (
        <div style={{ background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 14, padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0a0e2e' }}>{job.appointment_title}</h2>
            <p style={{ fontSize: 13, color: '#778899', marginTop: 3 }}>
              {format(parseISO(job.appointment_starts_at), 'EEEE, MMMM d, yyyy')}
            </p>
            {job.appointment_session_types.length > 0 && (
              <p style={{ fontSize: 13, color: '#778899', marginTop: 2 }}>{job.appointment_session_types.join(', ')}</p>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f0f4ff', paddingTop: 16 }}>
            <StageProgress stages={job.all_stages} currentStageId={job.stage_id} />
          </div>

          {job.delivery_url && (
            <a
              href={job.delivery_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#4d79ff', color: '#fff', borderRadius: 9, padding: '12px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
            >
              <ExternalLink size={16} />
              View Your Photos
            </a>
          )}

          {job.delivery_url && writeReviewUrl && (
            <div style={{ borderTop: '1px solid #f0f4ff', paddingTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#778899', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Enjoyed your session?
              </p>
              <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 12, lineHeight: 1.5 }}>
                Share your experience on Google — you can add photos too. It only takes a minute and means the world to us!
              </p>
              <button
                onClick={() => window.open(writeReviewUrl, 'google-review', 'width=560,height=680,left=200,top=100')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fff', color: '#0a0e2e', border: '1.5px solid #e0e8ff', borderRadius: 9, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}
              >
                <GoogleColorLogo />
                Leave a Google Review
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
