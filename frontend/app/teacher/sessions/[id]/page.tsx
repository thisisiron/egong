import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AttendanceRow } from './_components/AttendanceRow'
import { BulkPresentButton } from './_components/BulkPresentButton'
import { updateVideoUrlAction } from './actions'

type Status = 'present' | 'late' | 'absent' | 'excused'

type SessionRow = {
  id: string
  scheduled_at: string
  title: string
  unit: string | null
  video_url: string | null
  classes:
    | { id: string; name: string; level: string }
    | { id: string; name: string; level: string }[]
    | null
}

type ClassStudentRow = {
  students:
    | { id: string; name: string; school: string | null }
    | { id: string; name: string; school: string | null }[]
    | null
}

type AttendanceRecord = {
  student_id: string
  status: Status
  excused_reason: string | null
  needs_makeup: boolean
}

export default async function TeacherSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // First fetch: session metadata (need class id for the next two queries)
  const { data: session } = await supabase
    .from('sessions')
    .select('id, scheduled_at, title, unit, video_url, classes(id, name, level)')
    .eq('id', id)
    .single()

  if (!session) return <div>회차를 찾을 수 없습니다.</div>

  const sessionRow = session as unknown as SessionRow
  const cls = Array.isArray(sessionRow.classes)
    ? sessionRow.classes[0]
    : sessionRow.classes
  if (!cls) return <div>반 정보를 찾을 수 없습니다.</div>

  // Parallel: students in this class + existing attendance for this session
  const [classStudentsRes, attendanceRes] = await Promise.all([
    supabase
      .from('class_students')
      .select('students(id, name, school)')
      .eq('class_id', cls.id)
      .is('left_at', null),
    supabase
      .from('attendance')
      .select('student_id, status, excused_reason, needs_makeup')
      .eq('session_id', id),
  ])

  const classStudents = (classStudentsRes.data ?? []) as unknown as ClassStudentRow[]
  const attendance = (attendanceRes.data ?? []) as unknown as AttendanceRecord[]

  const studentRows = classStudents
    .map((cs) => (Array.isArray(cs.students) ? cs.students[0] : cs.students))
    .filter((s): s is { id: string; name: string; school: string | null } =>
      Boolean(s)
    )
  // sort by name in JS (Supabase relationship sorting is brittle)
  studentRows.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const attMap = new Map(attendance.map((a) => [a.student_id, a]))
  const filledCount = studentRows.filter((s) => attMap.has(s.id)).length
  const totalCount = studentRows.length

  return (
    <div className="space-y-4">
      <header className="bg-white border border-amber-100 rounded-lg p-4">
        <div className="text-xs text-slate-500">{cls.name}</div>
        <div className="text-lg font-semibold mt-1">
          {new Date(sessionRow.scheduled_at).toLocaleString('ko-KR')}
        </div>
        <div className="text-sm text-slate-600">
          {sessionRow.title}
          {sessionRow.unit ? ` · ${sessionRow.unit}` : ''}
        </div>
      </header>

      <form
        action={updateVideoUrlAction}
        className="bg-white border border-amber-100 rounded-lg p-4 space-y-2"
      >
        <input type="hidden" name="session_id" value={sessionRow.id} />
        <label className="text-sm font-medium">📹 수업 영상 URL</label>
        <div className="flex gap-2">
          <Input
            name="video_url"
            defaultValue={sessionRow.video_url ?? ''}
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
              sessionId={sessionRow.id}
              student={s}
              initialStatus={att?.status ?? null}
              initialReason={att?.excused_reason ?? null}
              initialNeedsMakeup={att?.needs_makeup ?? false}
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
