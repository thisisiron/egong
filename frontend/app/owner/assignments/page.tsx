import Link from 'next/link'
import { listAssignments } from '@/lib/assignments/service'

export default async function OwnerAssignmentsPage() {
  const assignments = await listAssignments()
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">과제 모니터링</h1>
      <div className="space-y-2">
        {assignments.map((a) => (
          <Link key={a.id} href={`/owner/assignments/${a.id}`} className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{a.class_name}</span>
              <span className="font-medium">{a.title}</span>
            </div>
            {a.due_at && <p className="text-xs text-slate-500 mt-1">마감 {new Date(a.due_at).toLocaleString('ko-KR')}</p>}
          </Link>
        ))}
        {assignments.length === 0 && <p className="text-sm text-slate-400 text-center py-12">과제가 없습니다.</p>}
      </div>
    </div>
  )
}
