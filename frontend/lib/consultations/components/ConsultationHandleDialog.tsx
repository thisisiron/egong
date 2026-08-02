'use client'

import { useState, useTransition, type ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { confirmConsultationAction, rejectConsultationAction } from '../actions'

export function ConsultationHandleDialog({
  consultationId,
  mode,
  trigger,
}: {
  consultationId: string
  mode: 'confirm' | 'reject'
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        const result =
          mode === 'confirm'
            ? await confirmConsultationAction({
                id: consultationId,
                scheduled_at_local: scheduledAt,
                note: note || null,
              })
            : await rejectConsultationAction({ id: consultationId, note })
        if (!result.ok) {
          setError(result.message)
          return
        }
        setOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : '처리에 실패했습니다.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'confirm' ? '상담 확정' : '상담 반려'}</DialogTitle>
          <DialogDescription>
            {mode === 'confirm'
              ? '상담 시각을 정하면 학부모에게 알림이 갑니다.'
              : '반려 사유는 학부모에게 그대로 전달됩니다.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'confirm' && (
          <div className="space-y-1">
            <Label htmlFor="consultation-scheduled-at">상담 시각</Label>
            <Input
              id="consultation-scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="consultation-note">
            {mode === 'confirm' ? '안내 메모 (선택)' : '반려 사유'}
          </Label>
          <Textarea
            id="consultation-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? '처리 중…' : mode === 'confirm' ? '확정' : '반려'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
