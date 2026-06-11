'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTimeKR } from '@/lib/format'
import { addStudentNoteAction, deleteStudentNoteAction } from '../actions'
import { addStudentNoteSchema } from '../schemas'
import type { StudentNote } from '../types'

type Props = {
  studentId: string
  notes: StudentNote[]
  currentUserId: string
  /** owner는 모든 메모 삭제 가능, teacher는 본인 작성분만 */
  isOwner: boolean
}

export function StudentNotes({ studentId, notes, currentUserId, isOwner }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // React 19 form action 자동 리셋은 액션이 throw해도 발생하므로,
  // onSubmit + preventDefault로 직접 제출하고 성공 시에만 수동 reset.
  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const parsed = addStudentNoteSchema.safeParse({
      student_id: studentId,
      body: formData.get('body'),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.')
      return
    }
    startTransition(async () => {
      try {
        await addStudentNoteAction(formData)
        form.reset()
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '기록에 실패했습니다.')
      }
    })
  }

  function handleDelete(noteId: string) {
    const fd = new FormData()
    fd.set('note_id', noteId)
    startTransition(async () => {
      try {
        await deleteStudentNoteAction(fd)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      }
    })
  }

  return (
    <section className="bg-white border border-amber-100 rounded-lg p-6 space-y-3">
      <div>
        <h2 className="font-semibold">상담 메모</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          내부 기록 — 학부모/학생에게 보이지 않습니다.
        </p>
      </div>
      <form onSubmit={handleAdd} className="space-y-2">
        <input type="hidden" name="student_id" value={studentId} />
        <Textarea
          name="body"
          required
          rows={3}
          maxLength={2000}
          placeholder="상담 내용, 특이사항 등"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? '저장 중...' : '기록'}
        </Button>
      </form>
      {error ? (
        <div role="alert" className="text-sm text-red-600">
          {error}
        </div>
      ) : null}
      <ul className="space-y-3 pt-3 border-t">
        {notes.length === 0 ? (
          <li className="text-sm text-slate-400">아직 기록이 없습니다.</li>
        ) : null}
        {notes.map((n) => (
          <li key={n.id} className="text-sm">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{n.author_name}</span>
              <span>{formatDateTimeKR(n.created_at)}</span>
              <div className="flex-1" />
              {isOwner || n.created_by === currentUserId ? (
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  disabled={pending}
                  className="text-red-600 hover:underline disabled:opacity-50"
                >
                  삭제
                </button>
              ) : null}
            </div>
            <p className="text-slate-700 whitespace-pre-wrap mt-1">{n.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
