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

import {
  cancelConsultationAction,
  confirmConsultationAction,
  rejectConsultationAction,
} from '../actions'

const TITLE: Record<'confirm' | 'reject' | 'cancel', string> = {
  confirm: '상담 확정',
  reject: '상담 반려',
  cancel: '상담 취소',
}

const DESCRIPTION: Record<'confirm' | 'reject' | 'cancel', string> = {
  confirm: '상담 시각을 정하면 학부모에게 알림이 갑니다.',
  reject: '반려 사유는 학부모에게 그대로 전달됩니다.',
  cancel: '취소 사유는 학부모에게 그대로 전달됩니다.',
}

const NOTE_LABEL: Record<'confirm' | 'reject' | 'cancel', string> = {
  confirm: '안내 메모 (선택)',
  reject: '반려 사유',
  cancel: '취소 사유 (선택)',
}

const SUBMIT_LABEL: Record<'confirm' | 'reject' | 'cancel', string> = {
  confirm: '확정',
  reject: '반려',
  // '취소'로만 쓰면 다이얼로그를 닫는 버튼처럼 읽힌다 — 실제로 취소 액션을 제출한다는
  // 것을 분명히 하고, teacher-day.spec.ts의 '확정'/'반려' 셀렉터와도 겹치지 않는다.
  cancel: '취소하기',
}

export function ConsultationHandleDialog({
  consultationId,
  mode,
  trigger,
}: {
  consultationId: string
  mode: 'confirm' | 'reject' | 'cancel'
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // 실패 후 닫았다 다시 열면 이전 에러·입력이 남아있던 문제. 이 다이얼로그 인스턴스가
      // confirm/reject/cancel 여러 목적으로 재사용되므로 닫힐 때마다 비운다.
      setError(null)
      setScheduledAt('')
      setNote('')
    }
  }

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
            : mode === 'reject'
              ? await rejectConsultationAction({ id: consultationId, note })
              : await cancelConsultationAction({ id: consultationId, note: note || null })
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLE[mode]}</DialogTitle>
          <DialogDescription>{DESCRIPTION[mode]}</DialogDescription>
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
          <Label htmlFor="consultation-note">{NOTE_LABEL[mode]}</Label>
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
            {pending ? '처리 중…' : SUBMIT_LABEL[mode]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
