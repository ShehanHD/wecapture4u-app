<<<<<<< HEAD
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useExpenses, useCreateExpense, useDeleteExpense, usePayExpense, useAccounts } from '@/hooks/useAccounting'
=======
// frontend/src/pages/admin/accounting/AccountingExpenses.tsx
import { useState } from 'react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, usePayExpense, useAccounts } from '@/hooks/useAccounting'
>>>>>>> main
import type { ExpenseOut } from '@/schemas/accounting'

type FilterStatus = 'all' | 'payable' | 'paid'

export function AccountingExpenses() {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [payTarget, setPayTarget] = useState<ExpenseOut | null>(null)
<<<<<<< HEAD
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
=======
  const [deleteTarget, setDeleteTarget] = useState<ExpenseOut | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    date: '',
    description: '',
    expense_account_id: '',
    amount: '',
    notes: '',
  })

>>>>>>> main
  const [addForm, setAddForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    expense_account_id: '',
    amount: '',
    notes: '',
  })
<<<<<<< HEAD
=======

>>>>>>> main
  const [payForm, setPayForm] = useState({
    payment_account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
  })

  const { data: expenses = [], isLoading } = useExpenses(
    filter === 'all' ? undefined : { payment_status: filter }
  )
  const { data: allAccounts = [] } = useAccounts()
  const expenseAccounts = allAccounts.filter(a => a.type === 'expense' && !a.archived)
  const assetAccounts = allAccounts.filter(a => a.type === 'asset' && !a.archived)

  const createMutation = useCreateExpense()
<<<<<<< HEAD
=======
  const updateMutation = useUpdateExpense()
>>>>>>> main
  const deleteMutation = useDeleteExpense()
  const payMutation = usePayExpense()

  async function handleCreate() {
    try {
      await createMutation.mutateAsync({ ...addForm, payment_status: 'payable' })
<<<<<<< HEAD
      setAddForm({
        date: new Date().toISOString().split('T')[0],
        description: '',
        expense_account_id: '',
        amount: '',
        notes: '',
      })
=======
      setAddForm({ date: new Date().toISOString().split('T')[0], description: '', expense_account_id: '', amount: '', notes: '' })
>>>>>>> main
      setShowAddForm(false)
      toast.success('Expense added')
    } catch {
      toast.error('Failed to add expense')
    }
  }

<<<<<<< HEAD
  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Expense deleted')
    } catch {
      toast.error('Failed to delete expense')
=======
  function startEdit(exp: ExpenseOut) {
    setEditingId(exp.id)
    setEditForm({
      date: exp.date,
      description: exp.description,
      expense_account_id: exp.expense_account_id ?? '',
      amount: exp.amount,
      notes: exp.notes ?? '',
    })
  }

  async function handleEdit(id: string) {
    try {
      await updateMutation.mutateAsync({ id, payload: editForm })
      setEditingId(null)
      toast.success('Expense updated')
    } catch {
      toast.error('Failed to update expense')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      setDeleteTarget(null)
      toast.success('Expense deleted')
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        toast.error('Cannot delete: this expense has a posted journal entry.')
      } else {
        toast.error('Failed to delete expense')
      }
>>>>>>> main
    }
  }

  async function handlePay() {
    if (!payTarget) return
    try {
      await payMutation.mutateAsync({ id: payTarget.id, payload: payForm })
      setPayTarget(null)
      toast.success('Expense marked as paid')
    } catch {
      toast.error('Failed to record payment')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['all', 'payable', 'paid'] as FilterStatus[]).map(f => (
<<<<<<< HEAD
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'ghost'}
              onClick={() => setFilter(f)}
              className="capitalize text-xs h-7"
            >
              {f}
            </Button>
=======
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'ghost'}
              onClick={() => setFilter(f)} className="capitalize text-xs h-7">{f}</Button>
>>>>>>> main
          ))}
        </div>
        <Button size="sm" onClick={() => setShowAddForm(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Add Expense
        </Button>
      </div>

      {showAddForm && (
        <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
          <h3 className="text-sm font-medium">New Expense</h3>
          <div className="grid grid-cols-2 gap-3">
<<<<<<< HEAD
            <Input
              type="date"
              value={addForm.date}
              onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
            />
            <Input
              placeholder="Description"
              value={addForm.description}
              onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={addForm.expense_account_id}
              onChange={e => setAddForm(f => ({ ...f, expense_account_id: e.target.value }))}
            >
              <option value="">Expense account…</option>
              {expenseAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={addForm.amount}
              onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
            />
            <Input
              placeholder="Notes (optional)"
              value={addForm.notes}
              onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
              className="col-span-2"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!addForm.description || !addForm.expense_account_id || !addForm.amount || createMutation.isPending}
            >
=======
            <Input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
            <Input placeholder="Description" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={addForm.expense_account_id} onChange={e => setAddForm(f => ({ ...f, expense_account_id: e.target.value }))}>
              <option value="">Expense account…</option>
              {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
            <Input type="number" step="0.01" placeholder="Amount" value={addForm.amount}
              onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} />
            <Input placeholder="Notes (optional)" value={addForm.notes}
              onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} className="col-span-2" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}
              disabled={!addForm.description || !addForm.expense_account_id || !addForm.amount || createMutation.isPending}>
>>>>>>> main
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Account</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
<<<<<<< HEAD
              {expenses.map(exp => (
                <tr key={exp.id}>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{exp.date}</td>
                  <td className="px-4 py-2">{exp.description}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{exp.expense_account_name ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${exp.amount}</td>
                  <td className="px-4 py-2">
                    <Badge
                      className={
                        exp.payment_status === 'paid'
                          ? 'bg-green-500/20 text-green-400 text-xs'
                          : 'bg-yellow-500/20 text-yellow-400 text-xs'
                      }
                    >
                      {exp.payment_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      {exp.payment_status === 'payable' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setPayTarget(exp)
                            setPayForm({
                              payment_account_id: '',
                              payment_date: new Date().toISOString().split('T')[0],
                            })
                          }}
                        >
                          Mark Paid
                        </Button>
                      )}
                      {exp.payment_status === 'payable' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteConfirmId(exp.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
=======
              {expenses.map(exp => {
                const isEditing = editingId === exp.id
                return (
                  <tr key={exp.id}>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                      {isEditing
                        ? <Input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="h-7 text-xs w-32" />
                        : exp.date}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing
                        ? <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="h-7 text-xs" />
                        : exp.description}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {isEditing
                        ? (
                          <select className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                            value={editForm.expense_account_id} onChange={e => setEditForm(f => ({ ...f, expense_account_id: e.target.value }))}>
                            <option value="">Account…</option>
                            {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                          </select>
                        )
                        : exp.expense_account_name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {isEditing
                        ? <Input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} className="h-7 text-xs w-24 text-right" />
                        : `$${exp.amount}`}
                    </td>
                    <td className="px-4 py-2">
                      <Badge className={exp.payment_status === 'paid'
                        ? 'bg-green-500/20 text-green-400 text-xs'
                        : 'bg-yellow-500/20 text-yellow-400 text-xs'}>
                        {exp.payment_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500"
                              onClick={() => handleEdit(exp.id)}
                              disabled={!editForm.description || !editForm.amount || updateMutation.isPending}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => setEditingId(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {exp.payment_status === 'payable' && (
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => startEdit(exp)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            {exp.payment_status === 'payable' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => { setPayTarget(exp); setPayForm({ payment_account_id: '', payment_date: new Date().toISOString().split('T')[0] }) }}>
                                Mark Paid
                              </Button>
                            )}
                            {exp.payment_status === 'payable' && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteTarget(exp)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
>>>>>>> main
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
<<<<<<< HEAD
        open={deleteConfirmId !== null}
        onOpenChange={open => { if (!open) setDeleteConfirmId(null) }}
        title="Delete expense"
        description="Delete this expense? This cannot be undone."
        destructive
        onConfirm={() => {
          if (deleteConfirmId) handleDelete(deleteConfirmId)
          setDeleteConfirmId(null)
        }}
=======
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null) }}
        title="Delete expense"
        description={`Delete "${deleteTarget?.description}"?`}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
>>>>>>> main
      />

      <Dialog open={!!payTarget} onOpenChange={open => { if (!open) setPayTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as paid — {payTarget?.description}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Payment account</label>
<<<<<<< HEAD
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={payForm.payment_account_id}
                onChange={e => setPayForm(f => ({ ...f, payment_account_id: e.target.value }))}
              >
                <option value="">Select account…</option>
                {assetAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
=======
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={payForm.payment_account_id} onChange={e => setPayForm(f => ({ ...f, payment_account_id: e.target.value }))}>
                <option value="">Select account…</option>
                {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
>>>>>>> main
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Payment date</label>
<<<<<<< HEAD
              <Input
                type="date"
                value={payForm.payment_date}
                onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
              />
=======
              <Input type="date" value={payForm.payment_date}
                onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
>>>>>>> main
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Button>
<<<<<<< HEAD
            <Button
              onClick={handlePay}
              disabled={!payForm.payment_account_id || payMutation.isPending}
            >
=======
            <Button onClick={handlePay} disabled={!payForm.payment_account_id || payMutation.isPending}>
>>>>>>> main
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
