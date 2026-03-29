// frontend/src/pages/admin/accounting/AccountingPayments.tsx
import { useInvoices } from '@/hooks/useInvoices'
import type { Payment } from '@/api/invoices'

export function AccountingPayments() {
  const { data: invoices = [], isLoading } = useInvoices()

  const payments: Array<Payment & { clientId: string }> = invoices
    .flatMap(inv => inv.payments.map(p => ({ ...p, clientId: inv.client_id })))
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        All recorded invoice payments — read only. To add payments, use the invoice detail view.
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
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Method</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{p.paid_at}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${p.amount}</td>
                  <td className="px-4 py-2 text-muted-foreground capitalize">{p.method ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
