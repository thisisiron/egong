import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  assignToClassAction,
  unassignFromClassAction,
} from '../assign-actions'

type AssignmentRow = {
  id: string
  joined_at: string
  left_at: string | null
  classes: { id: string; name: string; level: string } | null
}

export async function ChildAssignment({ studentId }: { studentId: string }) {
  const supabase = await createClient()

  const [assignmentsRes, classesRes] = await Promise.all([
    supabase
      .from('class_students')
      .select('id, joined_at, left_at, classes(id, name, level)')
      .eq('student_id', studentId)
      .order('joined_at', { ascending: false }),
    supabase.from('classes').select('id, name, level').order('name'),
  ])

  const assignments = (assignmentsRes.data ?? []) as unknown as AssignmentRow[]
  const classes = classesRes.data ?? []

  const active = assignments.filter((a) => !a.left_at)
  const history = assignments.filter((a) => a.left_at)

  return (
    <section className="bg-white border rounded-lg p-6 space-y-3">
      <h2 className="font-semibold">반 배정</h2>
      <ul className="space-y-2">
        {active.length === 0 ? (
          <li className="text-sm text-slate-400">활성 배정 없음.</li>
        ) : null}
        {active.map((a) => (
          <li key={a.id} className="flex items-center justify-between border rounded p-3">
            <div>
              <div className="font-medium">{a.classes?.name ?? '(삭제됨)'}</div>
              <div className="text-xs text-slate-500">
                {a.classes?.level ?? '-'} · {a.joined_at} ~ 현재
              </div>
            </div>
            <form action={unassignFromClassAction}>
              <input type="hidden" name="assignment_id" value={a.id} />
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
              <li key={a.id}>
                {a.classes?.name ?? '(삭제됨)'} — {a.joined_at} ~ {a.left_at}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
