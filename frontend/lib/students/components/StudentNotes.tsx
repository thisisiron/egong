import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTimeKR } from '@/lib/format'
import { addStudentNoteAction, deleteStudentNoteAction } from '../actions'
import type { StudentNote } from '../types'

type Props = {
  studentId: string
  notes: StudentNote[]
  currentUserId: string
  /** owner는 모든 메모 삭제 가능, teacher는 본인 작성분만 */
  isOwner: boolean
}

export function StudentNotes({ studentId, notes, currentUserId, isOwner }: Props) {
  return (
    <section className="bg-white border border-amber-100 rounded-lg p-6 space-y-3">
      <div>
        <h2 className="font-semibold">상담 메모</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          내부 기록 — 학부모/학생에게 보이지 않습니다.
        </p>
      </div>
      <form action={addStudentNoteAction} className="space-y-2">
        <input type="hidden" name="student_id" value={studentId} />
        <Textarea
          name="body"
          required
          rows={3}
          maxLength={2000}
          placeholder="상담 내용, 특이사항 등"
        />
        <Button type="submit" size="sm">기록</Button>
      </form>
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
                <form action={deleteStudentNoteAction}>
                  <input type="hidden" name="note_id" value={n.id} />
                  <button className="text-red-600 hover:underline">삭제</button>
                </form>
              ) : null}
            </div>
            <p className="text-slate-700 whitespace-pre-wrap mt-1">{n.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
