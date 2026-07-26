import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  addClassStudentAction,
  removeClassStudentAction,
  setClassTeacherAction,
} from '@/lib/classes/actions'
import { SessionsManager } from '@/lib/sessions/components/SessionsManager'
import { StudentSearchSelect } from '@/lib/classes/components/StudentSearchSelect'
import type { ClassDetailView } from '@/lib/classes/types'

// basePath: 도메인 링크용 (예: `${basePath}/questions` → /owner/questions · /teacher/questions)
export function ClassDetail({
  view,
  basePath,
}: {
  view: ClassDetailView
  basePath: string
}) {
  const { cls, currentTeacher, students, teacherOptions, availableStudents } = view

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">{cls.name}</h1>
      <p className="text-sm text-slate-500">
        레벨: {cls.level}
        {cls.description ? ` · ${cls.description}` : ''}
      </p>

      <div className="flex flex-wrap gap-4">
        <Link
          href={`${basePath}/questions`}
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          💬 이 반 학생들의 질문 보기 →
        </Link>
        <Link
          href={`${basePath}/exams?class=${cls.id}`}
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          📊 이 반 성적 보기 →
        </Link>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
        <h2 className="font-semibold">담임 선생님</h2>
        {currentTeacher ? (
          <p className="text-sm">
            현재: <span className="font-medium">{currentTeacher.display_name}</span>
          </p>
        ) : (
          <p className="text-sm text-slate-400">담임이 지정되지 않았습니다.</p>
        )}
        <form action={setClassTeacherAction} className="flex gap-2">
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
            {teacherOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display_name}
              </option>
            ))}
          </select>
          <Button type="submit">{currentTeacher ? '변경' : '지정'}</Button>
        </form>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
        <h2 className="font-semibold">배정된 학생 ({students.length})</h2>
        <ul className="space-y-1">
          {students.length === 0 ? (
            <li className="text-sm text-slate-400">배정된 학생이 없습니다.</li>
          ) : null}
          {students.map((s) => (
            <li
              key={s.assignment_id}
              className="flex items-center justify-between border rounded p-2 text-sm"
            >
              <span>
                {s.name}{' '}
                <span className="text-slate-500">({s.school ?? '-'})</span>
              </span>
              <form action={removeClassStudentAction}>
                <input type="hidden" name="assignment_id" value={s.assignment_id} />
                <input type="hidden" name="class_id" value={cls.id} />
                <button className="text-red-600 hover:underline">제거</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addClassStudentAction} className="flex gap-2 pt-2 border-t">
          <input type="hidden" name="class_id" value={cls.id} />
          <StudentSearchSelect
            key={availableStudents.length}
            availableStudents={availableStudents}
          />
        </form>
      </section>

      <SessionsManager classId={cls.id} />
    </div>
  )
}
