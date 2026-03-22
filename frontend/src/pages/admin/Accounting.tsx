import React from 'react'
import { BarChart2 } from 'lucide-react'

export function Accounting() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
          <BarChart2 className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
      </div>
      <div className="rounded-xl bg-card border p-8 text-center">
        <p className="text-muted-foreground">Accounting module coming in Plan 8.</p>
      </div>
    </div>
  )
}
