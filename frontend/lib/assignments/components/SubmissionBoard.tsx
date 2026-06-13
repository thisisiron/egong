'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { gradeSubmissionAction } from '../actions'
import { submissionStatus, type AssignmentSubmission } from '../types'
import { SubmissionStatusBadge } from './SubmissionStatusBadge'
import { FeedbackCard } from './FeedbackCard'

export type RosterRow = {
  student_id: string
  student_name: string
  submission: (AssignmentSubmission & { signedFiles: Array<{ path: string; url: string | null }> }) | null
}

export function SubmissionBoard({ rows, readOnly = false }: { rows: RosterRow[]; readOnly?: boolean }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <SubmissionRow key={r.student_id} row={r} readOnly={readOnly} />
      ))}
    </div>
  )
}

function SubmissionRow({ row, readOnly }: { row: RosterRow; readOnly: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const sub = row.submission
  const status = submissionStatus(sub)

  function handleGrade(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sub) return
    const fd = new FormData(e.currentTarget)
    fd.set('submission_id', sub.id)
    startTransition(async () => {
      try { await gradeSubmissionAction(fd); setError(null) }
      catch (err) { setError(err instanceof Error ? err.message : '저장 실패') }
    })
  }

  return (
    <div className={`bg-white border rounded-lg p-4 ${status === 'submitted' && !readOnly ? 'border-indigo-300' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">{row.student_name}</span>
        <span className="ml-auto"><SubmissionStatusBadge status={status} /></span>
      </div>

      {sub && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {sub.signedFiles.map((f) => (
              <a key={f.path} href={f.url ?? '#'} target="_blank" rel="noreferrer"
                 className="text-xs px-2 py-1 rounded border border-slate-200 text-indigo-600 hover:bg-gray-50">첨부 열기</a>
            ))}
            {sub.signedFiles.length === 0 && <span className="text-xs text-slate-400">첨부 없음</span>}
          </div>
          {sub.memo && <p className="text-sm text-slate-600">메모: {sub.memo}</p>}

          {status === 'feedback' && sub.feedback && (
            <FeedbackCard score={sub.score} feedback={sub.feedback} byName={sub.feedback_by_name} at={sub.feedback_at} />
          )}

          {!readOnly && (
            <form onSubmit={handleGrade} className="space-y-2 pt-1">
              <Input name="score" defaultValue={sub.score ?? ''} placeholder="점수 (선택) 예: 90 / 상" className="w-40" />
              <Textarea name="feedback" rows={2} required defaultValue={sub.feedback ?? ''} placeholder="피드백 코멘트 (필수)" />
              {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
              <Button type="submit" disabled={pending}>{pending ? '저장 중…' : status === 'feedback' ? '피드백 수정' : '피드백 저장'}</Button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
