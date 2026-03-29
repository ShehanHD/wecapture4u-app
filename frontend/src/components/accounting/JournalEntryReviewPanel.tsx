// frontend/src/components/accounting/JournalEntryReviewPanel.tsx
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { JournalEntryLineEditor, type LineInput } from './JournalEntryLineEditor'
import { usePostJournalEntry, useVoidJournalEntry, useUpdateJournalEntry, useAccounts } from '@/hooks/useAccounting'
import type { JournalEntryOut } from '@/schemas/accounting'

interface Props {
  entry: JournalEntryOut | null
  open: boolean
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-500/20 text-yellow-400',
  posted: 'bg-green-500/20 text-green-400',
  voided: 'bg-zinc-500/20 text-zinc-400',
}

export function JournalEntryReviewPanel({ entry, open, onClose }: Props) {
  const [editLines, setEditLines] = useState<LineInput[] | null>(null)
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false)
  const [isBalanced, setIsBalanced] = useState(false)

  useEffect(() => {
    setEditLines(null)
  }, [entry?.id])
  const { data: accounts = [] } = useAccounts()

  const postMutation = usePostJournalEntry(entry?.id ?? '')
  const voidMutation = useVoidJournalEntry(entry?.id ?? '')
  const updateMutation = useUpdateJournalEntry(entry?.id ?? '')

  if (!open || !entry) return null

  const isDraft = entry.status === 'draft'
  const isPosted = entry.status === 'posted'
  const isEditing = editLines !== null && isDraft

  const displayLines = editLines ?? entry.lines.map(l => ({
    id: l.id,
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    description: l.description ?? '',
  }))

  async function handlePost() {
    try {
      await postMutation.mutateAsync()
      toast.success('Entry posted')
      onClose()
    } catch {
      toast.error('Failed to post entry')
    }
  }

  async function handleSaveAndPost() {
    if (!editLines) return
    try {
      await updateMutation.mutateAsync({ lines: editLines, date: entry!.date, description: entry!.description })
      await postMutation.mutateAsync()
      toast.success('Entry saved and posted')
      onClose()
    } catch {
      toast.error('Failed to save and post entry')
    }
  }

  async function handleSaveDraft() {
    if (!editLines) return
    try {
      await updateMutation.mutateAsync({ lines: editLines })
      setEditLines(null)
      toast.success('Draft saved')
    } catch {
      toast.error('Failed to save draft')
    }
  }

  async function handleVoid() {
    try {
      await voidMutation.mutateAsync()
      toast.success('Entry voided')
      onClose()
    } catch {
      toast.error('Failed to void entry')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-[520px] bg-card border-l border-border flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold leading-tight">{entry.description}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{entry.date}</span>
              <Badge className={`text-xs ${STATUS_COLORS[entry.status]}`}>{entry.status}</Badge>
              {entry.reference_type && (
                <span className="text-xs text-muted-foreground">{entry.reference_type}</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto p-4">
          <JournalEntryLineEditor
            lines={isEditing ? editLines! : entry.lines}
            editable={isEditing}
            accounts={accounts}
            onChange={setEditLines}
            onBalanceChange={setIsBalanced}
          />
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border shrink-0 flex items-center gap-2 flex-wrap">
          {isDraft && !isEditing && (
            <>
              <Button size="sm" onClick={() => setEditLines(displayLines)}>Edit</Button>
              <Button size="sm" variant="default" onClick={handlePost} disabled={postMutation.isPending}>
                Post
              </Button>
            </>
          )}
          {isDraft && isEditing && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditLines(null)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveDraft} disabled={updateMutation.isPending}>
                Save Draft
              </Button>
              <Button size="sm" variant="default" onClick={handleSaveAndPost} disabled={!isBalanced || updateMutation.isPending || postMutation.isPending}>
                Save & Post
              </Button>
            </>
          )}
          {isPosted && (
            <Button size="sm" variant="destructive" disabled={voidMutation.isPending} onClick={() => setVoidConfirmOpen(true)}>
              Void
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={voidConfirmOpen}
        onOpenChange={setVoidConfirmOpen}
        title="Void journal entry"
        description="This will create a reversing entry. The original entry cannot be edited after voiding."
        confirmLabel="Void"
        destructive
        onConfirm={handleVoid}
      />
    </>
  )
}
