// frontend/src/components/accounting/JournalEntryLineEditor.tsx
import { useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AccountOut, JournalLineOut } from '@/schemas/accounting'

export interface LineInput {
  id: string
  account_id: string
  debit: string
  credit: string
  description: string
}

interface Props {
  lines: JournalLineOut[] | LineInput[]
  editable: boolean
  accounts?: AccountOut[]
  onChange?: (lines: LineInput[]) => void
  onBalanceChange?: (balanced: boolean) => void
}

function isJournalLineOut(line: JournalLineOut | LineInput): line is JournalLineOut {
  return 'account_name' in line
}

export function JournalEntryLineEditor({ lines, editable, accounts = [], onChange, onBalanceChange }: Props) {
  const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0)
  const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || '0'), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001

  useEffect(() => {
    onBalanceChange?.(balanced)
  }, [balanced, onBalanceChange])

  function updateLine(index: number, field: keyof LineInput, value: string) {
    const updated = (lines as LineInput[]).map((l, i) =>
      i === index ? { ...l, [field]: value } : l
    )
    onChange?.(updated)
  }

  function addLine() {
    onChange?.([...(lines as LineInput[]), { id: crypto.randomUUID(), account_id: '', debit: '0.00', credit: '0.00', description: '' }])
  }

  function removeLine(index: number) {
    onChange?.((lines as LineInput[]).filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground px-1 mb-1">
        <span>Account</span>
        <span className="text-right">Debit</span>
        <span className="text-right">Credit</span>
        <span />
      </div>

      {lines.map((line, i) => (
        <div key={isJournalLineOut(line) ? line.id : line.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
          {editable ? (
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={(line as LineInput).account_id}
              onChange={e => updateLine(i, 'account_id', e.target.value)}
            >
              <option value="">Select account…</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm">
              {isJournalLineOut(line) ? `${line.account_code} — ${line.account_name}` : line.account_id}
            </span>
          )}

          {editable ? (
            <Input
              className="h-8 text-right text-sm"
              value={(line as LineInput).debit}
              onChange={e => updateLine(i, 'debit', e.target.value)}
            />
          ) : (
            <span className="text-right text-sm tabular-nums">
              {parseFloat(line.debit) > 0 ? line.debit : '—'}
            </span>
          )}

          {editable ? (
            <Input
              className="h-8 text-right text-sm"
              value={(line as LineInput).credit}
              onChange={e => updateLine(i, 'credit', e.target.value)}
            />
          ) : (
            <span className="text-right text-sm tabular-nums">
              {parseFloat(line.credit) > 0 ? line.credit : '—'}
            </span>
          )}

          {editable ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(i)}>
              <X className="h-3 w-3" />
            </Button>
          ) : (
            <span />
          )}
        </div>
      ))}

      {editable && (
        <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={addLine}>
          <Plus className="h-3 w-3 mr-1" /> Add line
        </Button>
      )}

      <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 border-t border-border pt-2 mt-2">
        <span className="text-sm font-medium">Totals</span>
        <span className={`text-right text-sm font-medium tabular-nums ${!balanced ? 'text-destructive' : ''}`}>
          {totalDebit.toFixed(2)}
        </span>
        <span className={`text-right text-sm font-medium tabular-nums ${!balanced ? 'text-destructive' : ''}`}>
          {totalCredit.toFixed(2)}
        </span>
        <span />
      </div>
      {!balanced && (
        <p className="text-xs text-destructive">Debits and credits must be equal to post.</p>
      )}
    </div>
  )
}
