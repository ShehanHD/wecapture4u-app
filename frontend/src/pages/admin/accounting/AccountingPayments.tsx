// frontend/src/pages/admin/accounting/AccountingPayments.tsx
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { useClients } from '@/hooks/useClients'
import { useAccounts } from '@/hooks/useAccounting'

export function AccountingPayments() {
  const { data: invoices = [], isLoading, isError } = useInvoices()
  const { data: clients = [] } = useClients()
  const { data: accounts = [] } = useAccounts()

  const clientNameById = Object.fromEntries(clients.map(c => [c.id, c.name]))
  const accountNameById = Object.fromEntries(accounts.map(a => [a.id, a.name]))

  const payments = invoices
    .flatMap(inv =>
      inv.payments.map(p => ({
        ...p,
        clientName: clientNameById[inv.client_id] ?? '—',
        jobId: inv.job_id,
        accountName: accountNameById[p.account_id] ?? p.account_id.slice(0, 8),
      }))
    )
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load payments. Please refresh the page.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        All recorded invoice payments — read only. To add payments, open the job and record against its invoice.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Job</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Account</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{p.payment_date}</td>
                  <td className="px-4 py-2.5">{p.clientName}</td>
                  <td className="px-4 py-2.5">
                    {p.jobId ? (
                      <Link
                        to={`/admin/jobs/${p.jobId}`}
                        className="font-mono text-xs text-brand-solid hover:opacity-70"
                      >
                        {p.jobId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.accountName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">€{p.amount}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
