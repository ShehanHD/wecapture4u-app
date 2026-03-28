import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '@/hooks/useAccounting'
import type { AccountOut } from '@/schemas/accounting'

const TYPE_COLORS: Record<string, string> = {
  asset: 'bg-blue-500/20 text-blue-400',
  liability: 'bg-red-500/20 text-red-400',
  equity: 'bg-purple-500/20 text-purple-400',
  revenue: 'bg-green-500/20 text-green-400',
  expense: 'bg-orange-500/20 text-orange-400',
}

interface NewAccountForm {
  code: string
  name: string
  type: string
  normal_balance: string
}

export function AccountingAccounts() {
  const [showArchived, setShowArchived] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [newForm, setNewForm] = useState<NewAccountForm>({
    code: '', name: '', type: 'asset', normal_balance: 'debit',
  })

  const { data: accounts = [], isLoading } = useAccounts({ archived: showArchived || undefined })
  const createMutation = useCreateAccount()
  const updateMutation = useUpdateAccount()
  const deleteMutation = useDeleteAccount()

  const typeNormalBalance: Record<string, string> = {
    asset: 'debit', expense: 'debit',
    liability: 'credit', equity: 'credit', revenue: 'credit',
  }

  async function handleCreate() {
    try {
      await createMutation.mutateAsync(newForm)
      setNewForm({ code: '', name: '', type: 'asset', normal_balance: 'debit' })
      setShowAddForm(false)
      toast.success('Account created')
    } catch {
      toast.error('Failed to create account')
    }
  }

  async function handleUpdate(id: string) {
    try {
      await updateMutation.mutateAsync({ id, payload: { name: editName } })
      setEditingId(null)
      toast.success('Account updated')
    } catch {
      toast.error('Failed to update account')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      setDeleteConfirmId(null)
      toast.success('Account deleted')
    } catch {
      toast.error('Failed to delete account — it may be in use')
    }
  }

  async function handleArchive(account: AccountOut) {
    try {
      await updateMutation.mutateAsync({ id: account.id, payload: { archived: !account.archived } })
      toast.success(account.archived ? 'Account restored' : 'Account archived')
    } catch {
      toast.error('Failed to update account')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
        <Button size="sm" onClick={() => setShowAddForm(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Add Account
        </Button>
      </div>

      {showAddForm && (
        <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
          <h3 className="text-sm font-medium">New Account</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Code (e.g. 4100)" value={newForm.code} onChange={e => setNewForm(f => ({ ...f, code: e.target.value }))} />
            <Input placeholder="Account name" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={newForm.type}
              onChange={e => setNewForm(f => ({ ...f, type: e.target.value, normal_balance: typeNormalBalance[e.target.value] ?? 'debit' }))}
            >
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={newForm.normal_balance}
              onChange={e => setNewForm(f => ({ ...f, normal_balance: e.target.value }))}
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newForm.code || !newForm.name || createMutation.isPending}>Save</Button>
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
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Code</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Normal</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accounts.map(acct => (
                <tr key={acct.id} className={acct.archived ? 'opacity-50' : ''}>
                  <td className="px-4 py-2 font-mono text-xs">{acct.code}</td>
                  <td className="px-4 py-2">
                    {editingId === acct.id ? (
                      <div className="flex items-center gap-2">
                        <Input className="h-7 text-sm" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(acct.id)}><Check className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <span>
                        {acct.name}
                        {acct.is_system && <span className="ml-1 text-xs text-muted-foreground">(system)</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={`text-xs ${TYPE_COLORS[acct.type]}`}>{acct.type}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground capitalize">{acct.normal_balance}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      {!acct.is_system && editingId !== acct.id && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(acct.id); setEditName(acct.name) }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {!acct.is_system && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => handleArchive(acct)}>
                          {acct.archived ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        </Button>
                      )}
                      {!acct.is_system && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteConfirmId(acct.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={open => { if (!open) setDeleteConfirmId(null) }}
        title="Delete account"
        description="This will permanently delete the account. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (deleteConfirmId) void handleDelete(deleteConfirmId) }}
      />
    </div>
  )
}
