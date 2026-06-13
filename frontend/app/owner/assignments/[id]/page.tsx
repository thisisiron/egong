import { notFound } from 'next/navigation'
import { getAssignment, getClassRoster, getSubmissionsForAssignment, signSubmissionFiles } from '@/lib/assignments/service'
import { SubmissionBoard, type RosterRow } from '@/lib/assignments/components/SubmissionBoard'

export default async function OwnerAssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assignment = await getAssignment(id)
  if (!assignment) notFound()
  const [roster, submissions] = await Promise.all([getClassRoster(assignment.class_id), getSubmissionsForAssignment(id)])
  const byStudent = new Map(submissions.map((s) => [s.student_id, s]))
  const rows: RosterRow[] = await Promise.all(
    roster.map(async (stu) => {
      const sub = byStudent.get(stu.id) ?? null
      const signedFiles = sub ? await signSubmissionFiles(sub.file_paths) : []
      return { student_id: stu.id, student_name: stu.name, submission: sub ? { ...sub, signedFiles } : null }
    })
  )
  return (
    <div className="space-y-4">
      <header className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{assignment.class_name}</span>
          <h1 className="text-lg font-semibold">{assignment.title}</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">제출 {rows.filter((r) => r.submission).length}/{rows.length}</p>
      </header>
      <SubmissionBoard rows={rows} readOnly />
    </div>
  )
}
