import { notFound } from 'next/navigation'
import { getAssignment, getClassRoster, getSubmissionsForAssignment, signSubmissionFiles } from '@/lib/assignments/service'
import { SubmissionBoard, type RosterRow } from '@/lib/assignments/components/SubmissionBoard'

export default async function TeacherAssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assignment = await getAssignment(id)
  if (!assignment) notFound()
  const [roster, submissions] = await Promise.all([
    getClassRoster(assignment.class_id),
    getSubmissionsForAssignment(id),
  ])
  const byStudent = new Map(submissions.map((s) => [s.student_id, s]))

  const rows: RosterRow[] = await Promise.all(
    roster.map(async (stu) => {
      const sub = byStudent.get(stu.id) ?? null
      const signedFiles = sub ? await signSubmissionFiles(sub.file_paths) : []
      return { student_id: stu.id, student_name: stu.name, submission: sub ? { ...sub, signedFiles } : null }
    })
  )

  const submitted = rows.filter((r) => r.submission).length
  const feedbacked = rows.filter((r) => r.submission?.feedback_at).length

  return (
    <div className="space-y-4">
      <header className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{assignment.class_name}</span>
          <h1 className="text-lg font-semibold">{assignment.title}</h1>
        </div>
        {assignment.description && <p className="text-sm text-slate-600">{assignment.description}</p>}
        <p className="text-xs text-slate-500 mt-2">
          제출 {submitted}/{rows.length} · 피드백 {feedbacked}/{submitted}
          {assignment.due_at && ` · 마감 ${new Date(assignment.due_at).toLocaleString('ko-KR')}`}
        </p>
      </header>
      <SubmissionBoard rows={rows} />
    </div>
  )
}
