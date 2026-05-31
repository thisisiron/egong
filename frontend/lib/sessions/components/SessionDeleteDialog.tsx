'use client'

import { useState, useTransition, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteSessionAction } from '@/lib/sessions/actions'

type Props = {
  sessionId: string
  sessionTitle: string
  attendanceCount: number
  trigger: ReactNode
}

export function SessionDeleteDialog({
  sessionId,
  sessionTitle,
  attendanceCount,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirm() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteSessionAction({ id: sessionId })
        setOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>수업 삭제</DialogTitle>
          <DialogDescription>
            「{sessionTitle}」 세션을 삭제할까요?
            {attendanceCount > 0 && (
              <span className="block mt-2 text-red-700 font-medium">
                이 세션의 출결 {attendanceCount}건도 함께 삭제됩니다.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" aria-live="polite" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={pending}
          >
            {pending ? '삭제 중...' : '삭제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
