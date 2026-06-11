import { getSessionForTeacher } from '@/lib/sessions/service'
import { getClassRoster } from '@/lib/classes/service'
import { getSessionAttendance } from '@/lib/attendance/service'
import { getSessionUser } from '@/lib/auth'
import { listStudentNotes } from '@/lib/students/service'
import { StudentNotes } from '@/lib/students/components/StudentNotes'
import { updateVideoUrlAction } from '@/lib/sessions/actions'
import { AttendanceRow } from './_components/AttendanceRow'
import { BulkPresentButton } from './_components/BulkPresentButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default async function TeacherSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSessionForTeacher(id)
  if (!session) return <div>회차를 찾을 수 없습니다.</div>

  const [studentRows, attendance] = await Promise.all([
    getClassRoster(session.class_id),
    getSessionAttendance(id),
  ])

  const user = await getSessionUser()
  const notesEntries = await Promise.all(
    studentRows.map(
      async (s) => [s.id, await listStudentNotes(s.id)] as const
    )
  )
  const notesByStudent = new Map(notesEntries)

  const attMap = new Map(attendance.map((a) => [a.student_id, a]))
  const filledCount = studentRows.filter((s) => attMap.has(s.id)).length
  const totalCount = studentRows.length

  return (
    <div className="space-y-4">
      <header className="bg-white border border-amber-100 rounded-lg p-4">
        <div className="text-xs text-slate-500">{session.class_name}</div>
        <div className="text-lg font-semibold mt-1">
          {new Date(session.scheduled_at).toLocaleString('ko-KR')}
        </div>
        <div className="text-sm text-slate-600">
          {session.title}
          {session.unit ? ` · ${session.unit}` : ''}
        </div>
      </header>

      <form
        action={updateVideoUrlAction}
        className="bg-white border border-amber-100 rounded-lg p-4 space-y-2"
      >
        <input type="hidden" name="session_id" value={session.id} />
        <label className="text-sm font-medium">📹 수업 영상 URL</label>
        <div className="flex gap-2">
          <Input
            name="video_url"
            defaultValue={session.video_url ?? ''}
            placeholder="https://vimeo.com/..."
          />
          <Button type="submit">저장</Button>
        </div>
      </form>

      {(() => {
        const studentIds = studentRows.map((s) => s.id)
        const allPresent =
          studentIds.length > 0 &&
          studentIds.every((sid) => attMap.get(sid)?.status === 'present')
        return (
          <div className="bg-white border border-amber-100 rounded-lg p-4">
            <BulkPresentButton
              sessionId={session.id}
              studentIds={studentIds}
              allPresent={allPresent}
            />
          </div>
        )
      })()}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">학생 출결 ({totalCount}명)</h2>
          <span className="text-sm text-slate-500">
            {filledCount}/{totalCount} 입력됨
          </span>
        </div>
        {studentRows.map((s) => {
          const att = attMap.get(s.id)
          return (
            <AttendanceRow
              key={s.id}
              sessionId={session.id}
              student={s}
              initialStatus={att?.status ?? null}
              initialReason={att?.excused_reason ?? null}
              initialNeedsMakeup={att?.needs_makeup ?? false}
              notesSlot={
                user ? (
                  <StudentNotes
                    studentId={s.id}
                    notes={notesByStudent.get(s.id) ?? []}
                    currentUserId={user.id}
                    isOwner={false}
                  />
                ) : null
              }
            />
          )
        })}
        {totalCount === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            배정된 학생이 없습니다.
          </p>
        ) : null}
      </section>
    </div>
  )
}
