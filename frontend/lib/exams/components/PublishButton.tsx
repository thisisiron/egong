'use client'

import { useState, useTransition } from 'react'

import { publishExamAction } from '../actions'

type Props = {
  examId: string
  missingCount: number
  published: boolean
}

/** 공개 버튼. 미입력이 남아 있으면 비활성. 알림만 실패한 경우를 따로 알린다. */
export function PublishButton({ examId, missingCount, published }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (published) {
    return (
      <span className="text-xs px-2.5 py-1 rounded-md bg-green-100 text-green-800">
        공개됨 — 학생·학부모가 볼 수 있습니다
      </span>
    )
  }

  function publish() {
    setError(null)
    setWarning(null)
    const fd = new FormData()
    fd.set('id', examId)
    startTransition(async () => {
      try {
        const result = await publishExamAction(fd)
        if (!result.notified) {
          setWarning('공개됐지만 알림 발송에 실패했습니다.')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '공개에 실패했습니다.')
      }
    })
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={publish}
        disabled={pending || missingCount > 0}
        title={missingCount > 0 ? `미입력 ${missingCount}명` : undefined}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500"
      >
        {pending ? '공개 중…' : '공개하기'}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {warning && <p className="text-sm text-amber-700">{warning}</p>}
    </div>
  )
}
