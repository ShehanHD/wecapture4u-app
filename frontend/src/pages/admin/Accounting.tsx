// frontend/src/pages/admin/Accounting.tsx
import { BarChart2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccountingOverview } from './accounting/AccountingOverview'
import { AccountingAccounts } from './accounting/AccountingAccounts'
import { AccountingJournal } from './accounting/AccountingJournal'
import { AccountingExpenses } from './accounting/AccountingExpenses'
import { AccountingPayments } from './accounting/AccountingPayments'
import { AccountingReports } from './accounting/AccountingReports'

export function Accounting() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
          <BarChart2 className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><AccountingOverview /></TabsContent>
        <TabsContent value="accounts"><AccountingAccounts /></TabsContent>
        <TabsContent value="journal"><AccountingJournal /></TabsContent>
        <TabsContent value="expenses"><AccountingExpenses /></TabsContent>
        <TabsContent value="payments"><AccountingPayments /></TabsContent>
        <TabsContent value="reports"><AccountingReports /></TabsContent>
      </Tabs>
    </div>
  )
}
