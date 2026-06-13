import { getMyTeachingClasses } from '@/lib/sessions/service'
import { listAssignments } from '@/lib/assignments/service'
import { AssignmentForm } from '@/lib/assignments/components/AssignmentForm'
import Link from 'next/link'

export default async function TeacherAssignmentsPage() {
  const [classes, assignments] = await Promise.all([getMyTeachingClasses(), listAssignments()])
  return (
    <div className="space-y-6">
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="font-semibold">과제 내기</h2>
        {classes.length > 0 ? (
          <AssignmentForm classOptions={classes} />
        ) : (
          <p className="text-sm text-slate-500">담당 반이 없습니다.</p>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-sm">과제 목록</h2>
        {assignments.map((a) => (
          <Link key={a.id} href={`/teacher/assignments/${a.id}`}
                className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{a.class_name}</span>
              <span className="font-medium">{a.title}</span>
            </div>
            {a.due_at && <p className="text-xs text-slate-500 mt-1">마감 {new Date(a.due_at).toLocaleString('ko-KR')}</p>}
          </Link>
        ))}
        {assignments.length === 0 && <p className="text-sm text-slate-400 text-center py-6">아직 과제가 없습니다.</p>}
      </section>
    </div>
  )
}
