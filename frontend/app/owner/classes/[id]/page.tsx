import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  addStudentAction,
  removeStudentAction,
  setTeacherAction,
} from './actions'

type TeacherLinkRow = {
  teacher_id: string
  teachers: { users: { display_name: string } | null } | null
}

type StudentLinkRow = {
  id: string
  joined_at: string
  students: { id: string; name: string; school: string | null } | null
}

type TeacherOption = {
  id: string
  users: { display_name: string } | null
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [clsRes, teacherLinksRes, studentLinksRes, allTeachersRes, allStudentsRes] =
    await Promise.all([
      supabase.from('classes').select('*').eq('id', id).single(),
      supabase
        .from('class_teachers')
        .select('teacher_id, teachers(users(display_name))')
        .eq('class_id', id),
      supabase
        .from('class_students')
        .select('id, joined_at, students(id, name, school)')
        .eq('class_id', id)
        .is('left_at', null)
        .order('joined_at'),
      supabase.from('teachers').select('id, users(display_name)'),
      supabase
        .from('students')
        .select('id, name')
        .eq('status', 'enrolled')
        .order('name'),
    ])

  const cls = clsRes.data
  if (!cls) notFound()

  const teacherLinks = (teacherLinksRes.data ?? []) as unknown as TeacherLinkRow[]
  const studentLinks = (studentLinksRes.data ?? []) as unknown as StudentLinkRow[]
  const allTeachers = (allTeachersRes.data ?? []) as unknown as TeacherOption[]
  const allStudents = allStudentsRes.data ?? []

  const currentTeacher = teacherLinks[0]
  const assignedStudentIds = new Set(
    studentLinks.map((s) => s.students?.id).filter(Boolean) as string[]
  )
  const availableStudents = allStudents.filter((s) => !assignedStudentIds.has(s.id))

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">{cls.name}</h1>
      <p className="text-sm text-slate-500">
        레벨: {cls.level}
        {cls.description ? ` · ${cls.description}` : ''}
      </p>

      <section className="bg-white border rounded-lg p-6 space-y-3">
        <h2 className="font-semibold">담임 선생님</h2>
        {currentTeacher ? (
          <p className="text-sm">
            현재: <span className="font-medium">{currentTeacher.teachers?.users?.display_name ?? '-'}</span>
          </p>
        ) : (
          <p className="text-sm text-slate-400">담임이 지정되지 않았습니다.</p>
        )}
        <form action={setTeacherAction} className="flex gap-2">
          <input type="hidden" name="class_id" value={cls.id} />
          {currentTeacher ? (
            <input
              type="hidden"
              name="current_teacher_id"
              value={currentTeacher.teacher_id}
            />
          ) : null}
          <select
            name="teacher_id"
            className="flex-1 border rounded px-3 py-2 text-sm"
            defaultValue={currentTeacher?.teacher_id ?? ''}
            required
          >
            <option value="">선생님 선택...</option>
            {allTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.users?.display_name ?? '(이름 없음)'}
              </option>
            ))}
          </select>
          <Button type="submit">{currentTeacher ? '변경' : '지정'}</Button>
        </form>
      </section>

      <section className="bg-white border rounded-lg p-6 space-y-3">
        <h2 className="font-semibold">배정된 학생 ({studentLinks.length})</h2>
        <ul className="space-y-1">
          {studentLinks.length === 0 ? (
            <li className="text-sm text-slate-400">배정된 학생이 없습니다.</li>
          ) : null}
          {studentLinks.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between border rounded p-2 text-sm"
            >
              <span>
                {s.students?.name ?? '(삭제됨)'}{' '}
                <span className="text-slate-500">({s.students?.school ?? '-'})</span>
              </span>
              <form action={removeStudentAction}>
                <input type="hidden" name="assignment_id" value={s.id} />
                <input type="hidden" name="class_id" value={cls.id} />
                <button className="text-red-600 hover:underline">제거</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addStudentAction} className="flex gap-2 pt-2 border-t">
          <input type="hidden" name="class_id" value={cls.id} />
          <select
            name="student_id"
            className="flex-1 border rounded px-3 py-2 text-sm"
            required
          >
            <option value="">학생 선택...</option>
            {availableStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={availableStudents.length === 0}>
            추가
          </Button>
        </form>
      </section>
    </div>
  )
}
