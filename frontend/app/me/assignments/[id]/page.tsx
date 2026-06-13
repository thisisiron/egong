import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getMyChildren } from '@/lib/students/service'
import { getAssignment, getMySubmission, signSubmissionFiles } from '@/lib/assignments/service'
import { submissionStatus } from '@/lib/assignments/types'
import { SubmissionStatusBadge } from '@/lib/assignments/components/SubmissionStatusBadge'
import { StudentSubmitCard } from '@/lib/assignments/components/StudentSubmitCard'
import { FeedbackCard } from '@/lib/assignments/components/FeedbackCard'

export default async function MyAssignmentDetailPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ child?: string }> }) {
  const user = await getSessionUser()
  if (!user) return null
  const { id } = await params
  const { child } = await searchParams
  const children = await getMyChildren()
  const studentId = child ?? children[0]?.id ?? null
  if (!studentId) return <div className="text-center text-slate-500 py-12">표시할 학생 정보가 없습니다.</div>

  const assignment = await getAssignment(id)
  if (!assignment) notFound()
  const sub = await getMySubmission(id, studentId)
  const signed = sub ? await signSubmissionFiles(sub.file_paths) : []
  const isParent = user.role === 'parent'

  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{assignment.class_name}</span>
          <SubmissionStatusBadge status={submissionStatus(sub)} />
        </div>
        <h1 className="text-lg font-semibold">{assignment.title}</h1>
        <p className="text-xs text-slate-500">{assignment.author_name}{assignment.due_at && ` · 마감 ${new Date(assignment.due_at).toLocaleString('ko-KR')}`}</p>
      </header>

      {assignment.description && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">과제 내용</div>
          <p className="text-sm whitespace-pre-wrap">{assignment.description}</p>
        </div>
      )}

      {isParent ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-slate-600">
          {sub ? (
            <>
              <div className="font-medium mb-2">제출물</div>
              <div className="flex flex-wrap gap-2">
                {signed.map((f) => <a key={f.path} href={f.url ?? '#'} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border border-slate-200 text-indigo-600">첨부 열기</a>)}
              </div>
              {sub.memo && <p className="mt-2">메모: {sub.memo}</p>}
            </>
          ) : '아직 제출하지 않았습니다.'}
        </div>
      ) : (
        <StudentSubmitCard
          assignmentId={id}
          academyId={assignment.academy_id}
          studentId={studentId}
          existing={sub}
          existingFiles={signed.map((f, i) => ({ path: f.path, name: `첨부 ${i + 1}` }))}
        />
      )}

      {sub?.feedback_at && sub.feedback && (
        <FeedbackCard score={sub.score} feedback={sub.feedback} byName={sub.feedback_by_name} at={sub.feedback_at} />
      )}
    </div>
  )
}
