'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { bulkSetAllPresentAction } from '../actions'

type Props = {
  sessionId: string
  studentIds: string[]
  /** 현재 모든 학생이 present 상태인지 (서버 컴포넌트에서 계산해 prop으로) */
  allPresent: boolean
}

export function BulkPresentButton({ sessionId, studentIds, allPresent }: Props) {
  const [pending, startTransition] = useTransition()

  if (studentIds.length === 0) return null

  const mode: 'apply' | 'clear' = allPresent ? 'clear' : 'apply'
  const label = allPresent ? '↩ 전원 출석 취소' : '✓ 전원 출석'
  const variant = allPresent ? 'outline' : 'default'
  const className = allPresent
    ? 'w-full'
    : 'w-full bg-green-600 hover:bg-green-700 text-white'

  function onClick() {
    startTransition(() => {
      bulkSetAllPresentAction({ session_id: sessionId, student_ids: studentIds, mode })
    })
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      disabled={pending}
      className={className}
      aria-label={label}
    >
      {pending ? '저장 중...' : label}
    </Button>
  )
}
