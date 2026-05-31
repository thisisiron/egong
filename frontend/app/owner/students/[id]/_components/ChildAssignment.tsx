import { Button } from '@/components/ui/button'
import { getStudentClassAssignments } from '@/lib/students/service'
import { listClasses } from '@/lib/classes/service'
import {
  assignToClassAction,
  unassignFromClassAction,
} from '@/lib/students/actions'

export async function ChildAssignment({ studentId }: { studentId: string }) {
  const [{ active, history }, classes] = await Promise.all([
    getStudentClassAssignments(studentId),
    listClasses(),
  ])

  return (
    <section className="bg-white border border-amber-100 rounded-lg p-6 space-y-3">
      <h2 className="font-semibold">반 배정</h2>
      <ul className="space-y-2">
        {active.length === 0 ? (
          <li className="text-sm text-slate-400">활성 배정 없음.</li>
        ) : null}
        {active.map((a) => (
          <li key={a.assignment_id} className="flex items-center justify-between border rounded p-3">
            <div>
              <div className="font-medium">{a.class_name}</div>
              <div className="text-xs text-slate-500">
                {a.class_level} · {a.joined_at} ~ 현재
              </div>
            </div>
            <form action={unassignFromClassAction}>
              <input type="hidden" name="assignment_id" value={a.assignment_id} />
              <input type="hidden" name="student_id" value={studentId} />
              <button className="text-sm text-orange-600 hover:underline">종료</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={assignToClassAction} className="flex items-end gap-2 pt-2 border-t">
        <input type="hidden" name="student_id" value={studentId} />
        <select
          name="class_id"
          className="flex-1 border rounded px-3 py-2 text-sm"
          required
        >
          <option value="">반 선택...</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.level})
            </option>
          ))}
        </select>
        <Button type="submit">배정</Button>
      </form>
      {history.length > 0 ? (
        <details className="text-xs text-slate-500">
          <summary>이전 배정 이력 ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((a) => (
              <li key={a.assignment_id}>
                {a.class_name} — {a.joined_at} ~ {a.left_at}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
