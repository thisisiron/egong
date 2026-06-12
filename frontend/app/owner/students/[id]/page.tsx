import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSessionUser } from '@/lib/auth'
import { getStudentDetail, listStudentNotes } from '@/lib/students/service'
import {
  addParentLinkAction,
  removeParentLinkAction,
  updateStudentAction,
} from '@/lib/students/actions'
import { ChildAssignment } from './_components/ChildAssignment'
import { StudentNotes } from '@/lib/students/components/StudentNotes'
import { kstParts, monthFromParam, monthRange } from '@/lib/date'
import {
  getAttendanceRate,
  getAttendanceCounts,
  getStudentAttendanceWithDates,
} from '@/lib/attendance/service'
import { buildMonthDays } from '@/lib/attendance/calendar'
import { StudentAttendancePanel } from '@/lib/attendance/components/StudentAttendancePanel'

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { id } = await params
  const { month: monthParam } = await searchParams
  const view = await getStudentDetail(id)
  if (!view) notFound()

  const monthDate = monthFromParam(monthParam)
  const range = monthRange(monthDate)
  const { year, month } = kstParts(monthDate)

  // 출결 3종은 묶어서 fail-soft — 부가 패널의 실패가 학생 상세 전체를 죽이지 않게.
  // (DB 에러는 service가 throw — 0건과 구분되어 여기서 잡힘)
  const attendancePromise = Promise.all([
    getAttendanceRate(id, range.from, range.to),
    getAttendanceCounts(id, range.from, range.to),
    getStudentAttendanceWithDates(id, range.fromIso, range.toIso),
  ]).catch((e: unknown) => {
    console.error('학생 출결 패널 조회 실패:', e)
    return null
  })

  const [notes, user, attendance] = await Promise.all([
    listStudentNotes(id),
    getSessionUser(),
    attendancePromise,
  ])
  if (!user) notFound()
  const { student, parentLinks } = view

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">{student.name}</h1>

      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
        <h2 className="font-semibold">기본 정보</h2>
        <form action={updateStudentAction} className="space-y-3">
          <input type="hidden" name="id" value={student.id} />
          <div className="space-y-1">
            <Label htmlFor="name">이름</Label>
            <Input id="name" name="name" defaultValue={student.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="school">학교</Label>
            <Input id="school" name="school" defaultValue={student.school ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="grade">학년</Label>
            <Input id="grade" name="grade" defaultValue={student.grade ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">상태</Label>
            <select
              id="status"
              name="status"
              defaultValue={student.status}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="enrolled">재원</option>
              <option value="paused">휴원</option>
              <option value="graduated">종강</option>
            </select>
          </div>
          <Button type="submit">저장</Button>
        </form>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
        <h2 className="font-semibold">학부모 연결</h2>
        <ul className="space-y-2">
          {parentLinks.length === 0 ? (
            <li className="text-sm text-slate-400">연결된 학부모가 없습니다.</li>
          ) : null}
          {parentLinks.map((link) => (
            <li
              key={link.parent_id}
              className="flex items-center justify-between border rounded p-3"
            >
              <div>
                <div className="font-medium">
                  {link.name} ({link.relationship})
                </div>
                <div className="text-xs text-slate-500">{link.phone ?? ''}</div>
              </div>
              <form action={removeParentLinkAction}>
                <input type="hidden" name="student_id" value={student.id} />
                <input type="hidden" name="parent_id" value={link.parent_id} />
                <button className="text-sm text-red-600 hover:underline">
                  연결 해제
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form
          action={addParentLinkAction}
          className="flex items-end gap-2 pt-2 border-t"
        >
          <input type="hidden" name="student_id" value={student.id} />
          <div className="flex-1 space-y-1">
            <Label htmlFor="parent_email">학부모 이메일</Label>
            <Input
              id="parent_email"
              name="parent_email"
              type="email"
              placeholder="등록된 학부모 계정 이메일"
              required
            />
          </div>
          <select
            name="relationship"
            defaultValue="mother"
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="mother">모</option>
            <option value="father">부</option>
            <option value="other">기타</option>
          </select>
          <Button type="submit">연결</Button>
        </form>
      </section>

      {attendance ? (
        <StudentAttendancePanel
          year={year}
          month={month}
          rate={attendance[0]}
          counts={{
            present: attendance[1].present_count,
            late: attendance[1].late_count,
            absent: attendance[1].absent_count + attendance[1].excused_count,
          }}
          days={buildMonthDays(year, month, attendance[2])}
        />
      ) : (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold">출결</h2>
          <p className="text-sm text-slate-400 mt-2">
            출결 정보를 불러오지 못했습니다. 잠시 후 새로고침해주세요.
          </p>
        </section>
      )}
      <ChildAssignment studentId={student.id} />
      <StudentNotes
        studentId={student.id}
        notes={notes}
        currentUserId={user.id}
        isOwner
      />
    </div>
  )
}
