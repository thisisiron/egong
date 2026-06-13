import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { getMyChildren } from '@/lib/students/service'
import { listAssignmentsForStudent, getMySubmission } from '@/lib/assignments/service'
import { submissionStatus } from '@/lib/assignments/types'
import { SubmissionStatusBadge } from '@/lib/assignments/components/SubmissionStatusBadge'
import { ChildSelector } from '../_components/ChildSelector'

export default async function MyAssignmentsPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const user = await getSessionUser()
  if (!user) return null
  const { child } = await searchParams
  const children = await getMyChildren()
  const studentId = child ?? children[0]?.id ?? null
  if (!studentId) return <div className="text-center text-slate-500 py-12">표시할 학생 정보가 없습니다.</div>

  const assignments = await listAssignmentsForStudent(studentId)
  const withStatus = await Promise.all(
    assignments.map(async (a) => ({ a, sub: await getMySubmission(a.id, studentId) }))
  )

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">과제</h1>
        {user.role === 'parent' && <ChildSelector items={children} current={studentId} basePath="/me/assignments" />}
      </header>
      <div className="space-y-2">
        {withStatus.map(({ a, sub }) => (
          <Link key={a.id} href={`/me/assignments/${a.id}`} className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="font-medium">{a.title}</span>
              <span className="ml-auto"><SubmissionStatusBadge status={submissionStatus(sub)} /></span>
            </div>
            {a.due_at && <p className="text-xs text-slate-500 mt-1">마감 {new Date(a.due_at).toLocaleString('ko-KR')}</p>}
          </Link>
        ))}
        {withStatus.length === 0 && <p className="text-sm text-slate-400 text-center py-12">받은 과제가 없습니다.</p>}
      </div>
    </div>
  )
}
