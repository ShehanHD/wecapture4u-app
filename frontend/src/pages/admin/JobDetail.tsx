import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, CheckCircle2, XCircle, Plus, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useJob, useUpdateJob, useDeleteJob, useJobStages } from '@/hooks/useJobs'
import { useInvoices, useAddPayment, useDeletePayment, useCreateJobInvoice } from '@/hooks/useInvoices'
import { useAccounts } from '@/hooks/useAccounting'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { format, parseISO } from 'date-fns'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

function BoolField({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {value
        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        : <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      <span className="text-sm text-foreground/80">{label}</span>
    </div>
  )
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading } = useJob(id!)
  const { data: stages = [] } = useJobStages()
  const { data: linkedInvoices } = useInvoices(id ? { job_id: id } : undefined)
  const updateJob = useUpdateJob()
  const deleteJob = useDeleteJob()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [deliveryUrl, setDeliveryUrl] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payAccountId, setPayAccountId] = useState('')
  const { data: accounts = [] } = useAccounts({ type: 'asset' })
  const invoice = linkedInvoices?.[0] ?? null
  const invoiceId = invoice?.id ?? ''
  const createInvoice = useCreateJobInvoice(id ?? '')
  const addPayment = useAddPayment(invoiceId)
  const deletePaymentMutation = useDeletePayment(invoiceId)

  const handleStageChange = async (newStageId: string) => {
    if (!id) return
    await updateJob.mutateAsync({ id, payload: { stage_id: newStageId } })
  }

  const handleDelete = async () => {
    if (!id) return
    await deleteJob.mutateAsync(id)
    navigate('/admin/jobs')
  }

  const appt = job?.appointment ?? null

  const handleAddPayment = async () => {
    if (!invoiceId || !payAmount || !payDate || !payAccountId) return
    await addPayment.mutateAsync({ amount: payAmount, payment_date: payDate, account_id: payAccountId })
    setPayAmount(''); setPayDate(''); setPayAccountId(''); setPaymentOpen(false)
  }

  const SESSION_TIME_LABELS: Record<string, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
  }

  const ADDON_LABELS: Record<string, string> = {
    album: 'Album',
    thank_you_card: 'Thank You Card',
    enlarged_photos: 'Enlarged Photos',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/jobs" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
              <Briefcase className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Job Detail</h1>
          </div>
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

      {isLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
      {!isLoading && !job && <div className="text-red-400">Job not found.</div>}

      {job && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-4">

            {/* Job info */}
            <div className="rounded-xl bg-card border p-5 space-y-4">
              <h2 className="text-lg font-medium text-foreground">{appt?.title ?? 'Untitled Job'}</h2>

              <Field label="Stage">
                <Select value={job.stage_id} onValueChange={handleStageChange}>
                  <SelectTrigger className="bg-input border text-foreground w-full">
                    <SelectValue>
                      {job.stage ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: job.stage.color }}
                          />
                          {job.stage.name}
                        </span>
                      ) : (
                        <span>Select stage</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border text-popover-foreground">
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
              </Field>

              {/* Delivery URL — only shown when stage is "Delivered" */}
              {job.stage?.name.toLowerCase() === 'delivered' && <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Delivery link</Label>
                <div className="flex gap-2">
                  <Input
                    value={deliveryUrl || job.delivery_url || ''}
                    onChange={e => setDeliveryUrl(e.target.value)}
                    placeholder="https://…"
                    className="bg-input border text-foreground text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    className="px-3"
                    onClick={async () => {
                      await updateJob.mutateAsync({ id: id!, payload: { delivery_url: deliveryUrl || job.delivery_url } })
                      setDeliveryUrl('')
                    }}
                    disabled={updateJob.isPending || (!deliveryUrl && !job.delivery_url)}
                  >
                    Save
                  </Button>
                </div>
                {job.delivery_url && !deliveryUrl && (
                  <a href={job.delivery_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand-solid hover:underline mt-1 block truncate">
                    {job.delivery_url}
                  </a>
                )}
              </div>}
            </div>

            {/* Appointment */}
            <div className="rounded-xl bg-card border p-5 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Linked Appointment</h3>

              {appt ? (
                <div className="space-y-4">
                  {/* Dates & status */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Title">{appt.title}</Field>
                    <Field label="Status">
                      <StatusBadge status={appt.status} />
                    </Field>
                    <Field label="Date">
                      {format(parseISO(appt.starts_at), 'MMM d, yyyy · HH:mm')}
                    </Field>
                    {appt.ends_at && (
                      <Field label="End date">
                        {format(parseISO(appt.ends_at), 'MMM d, yyyy · HH:mm')}
                      </Field>
                    )}
                    {appt.location && (
                      <Field label="Location">{appt.location}</Field>
                    )}
                    {appt.session_time && (
                      <Field label="Session time">
                        {SESSION_TIME_LABELS[appt.session_time] ?? appt.session_time}
                      </Field>
                    )}
                  </div>

                  {/* Session types */}
                  {appt.session_types.length > 0 && (
                    <Field label="Session types">
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {appt.session_types.map(st => (
                          <span key={st.id} className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground/80">
                            {st.name}
                          </span>
                        ))}
                      </div>
                    </Field>
                  )}

                  {/* Add-ons */}
                  {appt.addons.length > 0 && (
                    <Field label="Add-ons">
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {appt.addons.map(a => (
                          <span key={a} className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground/80">
                            {ADDON_LABELS[a] ?? a}
                          </span>
                        ))}
                      </div>
                    </Field>
                  )}

                  {/* Deposit & contract */}
                  <div className="space-y-1.5">
                    <BoolField label="Deposit paid" value={appt.deposit_paid} />
                    {appt.deposit_paid && Number(appt.deposit_amount) > 0 && (
                      <p className="text-xs text-muted-foreground pl-6">Amount: €{appt.deposit_amount}</p>
                    )}
                    <BoolField label="Contract signed" value={appt.contract_signed} />
                  </div>

                  {/* Notes */}
                  {appt.notes && (
                    <Field label="Appointment notes">
                      <p className="text-foreground/80">{appt.notes}</p>
                    </Field>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No appointment linked</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {job.client && (
              <div className="rounded-xl bg-card border p-5">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Client</h3>
                <Link
                  to={`/admin/clients/${job.client_id}`}
                  className="text-foreground hover:opacity-70 text-sm font-medium"
                >
                  {job.client.name}
                </Link>
                <p className="text-muted-foreground text-xs mt-1">{job.client.email}</p>
              </div>
            )}

            {/* Payments */}
          <div className="rounded-xl bg-card border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">Payments</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-brand-solid hover:opacity-70 h-7 px-2 text-xs disabled:opacity-40"
                  onClick={() => setPaymentOpen(p => !p)}
                  disabled={!invoice}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>

              {/* Price summary */}
              {invoice && Number(invoice.total) > 0 && (
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Invoice total</span>
                    <span className="text-foreground">€{invoice.total}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Paid</span>
                    <span className="text-emerald-400">
                      €{(Number(invoice.total) - Number(invoice.balance_due)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Balance</span>
                    <span className={Number(invoice.balance_due) > 0 ? 'text-red-400' : 'text-emerald-400'}>
                      €{invoice.balance_due}
                    </span>
                  </div>
                </div>
              )}

              {/* Add payment form */}
              {paymentOpen && (
                <div className="border rounded-lg p-3 space-y-2 bg-card mb-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Amount (€)</Label>
                      <Input
                        type="number" step="0.01" min="0"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        className="bg-muted border text-foreground h-8 text-sm mt-0.5"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={payDate}
                        onChange={e => setPayDate(e.target.value)}
                        className="bg-muted border text-foreground h-8 text-sm mt-0.5"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Account</Label>
                    <Select value={payAccountId} onValueChange={(v) => setPayAccountId(v ?? '')}>
                      <SelectTrigger className="bg-muted border text-foreground h-8 text-sm mt-0.5">
                        <SelectValue>
                          {payAccountId
                            ? (accounts.find(a => a.id === payAccountId)?.name ?? payAccountId)
                            : <span className="text-muted-foreground">Select account…</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                      onClick={() => setPaymentOpen(false)}>Cancel</Button>
                    <Button size="sm" className="h-7 text-xs"
                      onClick={handleAddPayment} disabled={addPayment.isPending}>
                      Save
                    </Button>
                  </div>
                </div>
              )}

              {/* Create invoice CTA */}
              {!invoice && appt?.price && Number(appt.price) > 0 && (
                <Button
                  size="sm"
                  className="w-full text-xs h-8 mb-3"
                  onClick={() => createInvoice.mutate()}
                  disabled={createInvoice.isPending}
                >
                  {appt?.price && Number(appt.price) > 0 ? `Create Invoice for €${appt.price}` : 'Create Invoice'}
                </Button>
              )}

              {/* Payment list */}
              {invoice && invoice.payments.length > 0 ? (
                <div className="space-y-1.5">
                  {invoice.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-foreground">€{p.amount}</span>
                        <span className="text-muted-foreground ml-1">
                          {format(parseISO(p.payment_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <button
                        onClick={() => deletePaymentMutation.mutate(p.id)}
                        className="text-muted-foreground hover:text-red-400 ml-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {invoice ? 'No payments recorded' : 'No invoice linked'}
                </p>
              )}

              {/* Invoice link */}
              {invoice && (
                <div className="mt-3 pt-3 border-t border">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={invoice.status} />
                    <span className="text-foreground text-xs">€{invoice.total}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {job && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete job?"
          description={`This will permanently delete this job. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          destructive
        />
      )}
    </div>
  )
}
