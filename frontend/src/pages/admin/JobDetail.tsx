import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useJob, useUpdateJob, useDeleteJob, useJobStages } from '@/hooks/useJobs'
import { useInvoices } from '@/hooks/useInvoices'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { format, parseISO } from 'date-fns'

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading } = useJob(id!)
  const { data: stages = [] } = useJobStages()
  const { data: linkedInvoices } = useInvoices(id ? { job_id: id } : undefined)
  const updateJob = useUpdateJob()
  const deleteJob = useDeleteJob()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleStageChange = async (newStageId: string) => {
    if (!id) return
    await updateJob.mutateAsync({ id, payload: { stage_id: newStageId } })
  }

  const handleDelete = async () => {
    if (!id) return
    await deleteJob.mutateAsync(id)
    navigate('/admin/jobs')
  }

  const invoice = linkedInvoices?.[0] ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/jobs" className="text-zinc-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-semibold text-white">Job Detail</h1>
        </div>
        {job && (
          <Button
            onClick={() => setDeleteOpen(true)}
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        )}
      </div>

      {isLoading && <div className="text-zinc-400 text-sm">Loading...</div>}
      {!isLoading && !job && <div className="text-red-400">Job not found.</div>}

      {job && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5 space-y-4">
            <h2 className="text-lg font-medium text-white">{job.title}</h2>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500 mb-1">Stage</p>
                <Select value={job.stage_id} onValueChange={handleStageChange}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: s.color }}
                          />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {job.shoot_date && (
                <div>
                  <p className="text-zinc-500 mb-1">Shoot date</p>
                  <p className="text-white">{format(parseISO(job.shoot_date), 'MMM d, yyyy')}</p>
                </div>
              )}
              {job.delivery_deadline && (
                <div>
                  <p className="text-zinc-500 mb-1">Delivery deadline</p>
                  <p className="text-white">{format(parseISO(job.delivery_deadline), 'MMM d, yyyy')}</p>
                </div>
              )}
            </div>

            {job.notes && (
              <div>
                <p className="text-zinc-500 text-sm mb-1">Notes</p>
                <p className="text-zinc-300 text-sm">{job.notes}</p>
              </div>
            )}
          </div>

          {job.appointment && (
            <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Linked Appointment</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm">{job.appointment.title}</p>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    {format(parseISO(job.appointment.starts_at), 'MMM d, yyyy · HH:mm')}
                  </p>
                </div>
                <StatusBadge status={job.appointment.status} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {job.client && (
            <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Client</h3>
              <Link
                to={`/admin/clients/${job.client_id}`}
                className="text-white hover:text-amber-400 text-sm font-medium"
              >
                {job.client.name}
              </Link>
              <p className="text-zinc-400 text-xs mt-1">{job.client.email}</p>
            </div>
          )}

          <div className="rounded-xl bg-[#1a1a1a] border border-zinc-800 p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Invoice</h3>
            {invoice ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge status={invoice.status} />
                  <span className="text-white text-sm font-medium">€{invoice.total}</span>
                </div>
                <p className="text-zinc-400 text-xs">Balance due: €{invoice.balance_due}</p>
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No invoice linked</p>
            )}
          </div>
        </div>
      </div>}

      {job && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete job?"
          description={`This will permanently delete "${job.title}". This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          destructive
        />
      )}
    </div>
  )
}
