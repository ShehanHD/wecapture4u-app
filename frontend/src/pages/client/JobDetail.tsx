// frontend/src/pages/client/JobDetail.tsx
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useMyJob } from '@/hooks/useClientPortal'
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

export function ClientJobDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: job, isLoading } = useMyJob(id!)

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
        </div>
      )}
    </div>
  )
}
